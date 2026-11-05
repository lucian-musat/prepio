'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';
import { limitWords, tokenizeSource, type AnswerSpan, type Source } from '@prepio/shared';
import { extendLimit, isAnchored, segmentBody, selectionOffsets, snapToWords, spanFromSelection, type CharRange } from './selection';

/** Marker pens (same colours as the student app). */
export type Tone = 'info' | 'cause' | 'effect' | 'support';
const TONES: Record<Tone, string> = { info: '#fff1a8', cause: '#b8e6dc', effect: '#ffd9c2', support: '#cfe2ff' };

export type MarkerAction = { label: string; onClick: (sel: CharRange) => void };

const newId = () => crypto.randomUUID();

/** Char range of the span's limit (explicit, or its sentence). */
function limitRange(body: string, span: AnswerSpan): CharRange | null {
  const t = tokenizeSource(body);
  if (t.words.length === 0) return null;
  const [a, b] = limitWords(t, span);
  return { start: t.words[a]!.start, end: t.words[b]!.end };
}

/**
 * The source body with the answer spans highlighted. The admin selects text with the browser's native
 * selection (snapped to whole words) and presses one of `actions`; clicking a highlight selects it.
 * Without `actions`, one „Marchează ca răspuns corect” action calls `onAdd`.
 */
export default function SpanMarker({
  source, spans, onAdd, onChange, onRemove, actions, toneOf, hint,
}: {
  source: Source;
  spans: AnswerSpan[];
  onAdd?: (span: AnswerSpan) => void;
  onChange: (span: AnswerSpan) => void;
  onRemove: (id: string) => void;
  actions?: MarkerAction[];
  toneOf?: (span: AnswerSpan) => Tone;
  hint?: ReactNode;
}) {
  const body = source.body;
  const textRef = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<CharRange | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      const el = textRef.current;
      const r = el ? selectionOffsets(el, document.getSelection()) : null;
      setSel(r ? snapToWords(body, r.start, r.end) : null);
    };
    document.addEventListener('selectionchange', update);
    return () => document.removeEventListener('selectionchange', update);
  }, [body]);

  const list = actions ?? [
    { label: 'Marchează ca răspuns corect', onClick: (s: CharRange) => onAdd?.(spanFromSelection(body, source.id, s, newId())) },
  ];

  // A span of another source (the exercise's source was changed) is as lost as one whose text moved.
  const live = (s: AnswerSpan) => s.sourceId === source.id && isAnchored(body, s);
  const anchored = spans.filter(live);
  const detached = spans.filter((s) => !live(s));
  const selected = anchored.find((s) => s.id === selectedId) ?? null;

  const limit = selected ? limitRange(body, selected) : null;

  const segments = segmentBody(body, anchored, limit ? [limit.start, limit.end] : []);
  const byId = new Map(anchored.map((s) => [s.id, s]));

  const runAction = (a: MarkerAction) => {
    if (!sel) return;
    a.onClick(sel);
    document.getSelection()?.removeAllRanges();
    setSel(null);
  };

  const pick = (id: string) => {
    if (document.getSelection()?.isCollapsed === false) return; // a drag, not a click
    setSelectedId(id);
  };

  return (
    <div className="mb-3">
      <div className="small text-secondary mb-1">
        {source.title ? `${source.title} · ` : ''}{source.author}{source.work ? `, ${source.work}` : ''}
      </div>
      <div
        ref={textRef}
        className="border rounded p-3 bg-body"
        style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, maxHeight: 420, overflowY: 'auto' }}
        data-testid="span-marker-text"
      >
        {segments.map((seg) => {
          const text = body.slice(seg.start, seg.end);
          const inLimit = limit !== null && seg.start >= limit.start && seg.end <= limit.end;
          const top = seg.spanIds.length ? byId.get(seg.spanIds[seg.spanIds.length - 1]!)! : null;
          const style: CSSProperties = inLimit ? { textDecoration: 'underline dotted', textUnderlineOffset: 4 } : {};
          if (!top) return <span key={seg.start} data-offset={seg.start} style={style}>{text}</span>;
          const isSel = selected !== null && seg.spanIds.includes(selected.id);
          return (
            <mark
              key={seg.start}
              data-offset={seg.start}
              tabIndex={0}
              title="Click pentru a selecta marcajul"
              onClick={() => pick(top.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedId(top.id);
                }
              }}
              style={{
                ...style,
                padding: 0,
                cursor: 'pointer',
                background: TONES[toneOf?.(top) ?? 'info'],
                outline: isSel ? '2px solid var(--bs-primary)' : undefined,
              }}
            >
              {text}
            </mark>
          );
        })}
      </div>

      <div className="d-flex flex-wrap align-items-center gap-2 mt-2">
        {list.map((a) => (
          <Button
            key={a.label}
            size="sm"
            variant="primary"
            disabled={!sel}
            // keep the text selection when the button is pressed
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runAction(a)}
          >
            {a.label}
          </Button>
        ))}
        <span className="small text-secondary">
          {hint ?? (list.length ? 'Selectează cuvintele în text, apoi alege acțiunea.' : null)}
        </span>
      </div>

      {selected && (
        <div className="border rounded p-2 mt-2 bg-body-tertiary" data-testid="span-controls">
          <div className="mb-2 small">
            Marcaj selectat: „{selected.text}”
            {selected.limitStart !== null && <span className="text-secondary"> · limită extinsă</span>}
          </div>
          <div className="d-flex flex-wrap gap-2">
            <ButtonGroup size="sm">
              <Button variant="outline-secondary" onClick={() => onChange(extendLimit(body, selected, 'prev'))}>
                Extinde limita: propoziția anterioară
              </Button>
              <Button variant="outline-secondary" onClick={() => onChange(extendLimit(body, selected, 'next'))}>
                Extinde limita: propoziția următoare
              </Button>
              <Button
                variant="outline-secondary"
                disabled={selected.limitStart === null}
                onClick={() => onChange({ ...selected, limitStart: null, limitEnd: null })}
              >
                Limită implicită
              </Button>
            </ButtonGroup>
            <Button size="sm" variant="outline-danger" onClick={() => { onRemove(selected.id); setSelectedId(null); }}>
              Șterge
            </Button>
            <Button size="sm" variant="link" onClick={() => setSelectedId(null)}>Închide</Button>
          </div>
        </div>
      )}

      {detached.map((s) => (
        <div key={s.id} className="alert alert-warning d-flex flex-wrap align-items-center gap-2 py-2 mt-2 mb-0">
          <span className="me-auto">Răspunsul marcat „{s.text}” nu se mai găsește în text. Șterge-l și marchează-l din nou.</span>
          <Button size="sm" variant="outline-danger" aria-label={`Șterge „${s.text}”`} onClick={() => onRemove(s.id)}>Șterge</Button>
        </div>
      ))}
    </div>
  );
}
