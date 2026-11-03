'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Alert, ToggleButton, ToggleButtonGroup } from 'react-bootstrap';
import { isPreviewReadyMessage, type AdminPreviewMessage, type Card } from '@prepio/shared';
import type { CardInput } from '@/lib/data/lesson';

type Mode = 'phone' | 'desktop';

const HEIGHT = 740;
const PHONE_WIDTH = 360;
const DESKTOP_WIDTH = 1024;
const DEBOUNCE_MS = 150;
const READY_TIMEOUT_MS = 8000;

function studentOrigin(): string | null {
  const base = process.env.NEXT_PUBLIC_STUDENT_WEB_URL;
  if (!base) return null;
  try {
    return new URL(base).origin;
  } catch {
    return null;
  }
}

/**
 * Live preview of the card being edited: the student web `/preview` page in an iframe, sent the draft by
 * postMessage. It only talks to that page after its `ready`, accepted only from the student origin and from
 * this iframe's window; then each change is posted 150 ms after the last edit.
 */
export default function CardPreview({ draft, index, total }: { draft: CardInput; index: number; total: number }) {
  const name = useId();
  const origin = studentOrigin();
  const [mode, setMode] = useState<Mode>('phone');
  const [ready, setReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [paneWidth, setPaneWidth] = useState(DESKTOP_WIDTH);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(false);

  const message = useMemo<AdminPreviewMessage>(
    () => ({ source: 'prepio-admin', kind: 'card', card: { ...draft, id: draft.id ?? 'preview', position: index } as Card, index, total }),
    [draft, index, total],
  );
  const messageRef = useRef(message);

  useEffect(() => {
    if (!origin) return;
    const post = () => iframeRef.current?.contentWindow?.postMessage(messageRef.current, origin);
    const onMessage = (e: MessageEvent) => {
      const win = iframeRef.current?.contentWindow;
      if (e.origin !== origin || !win || e.source !== win || !isPreviewReadyMessage(e.data)) return;
      readyRef.current = true;
      setReady(true);
      post();
    };
    window.addEventListener('message', onMessage);
    const timer = setTimeout(() => setTimedOut(true), READY_TIMEOUT_MS);
    return () => {
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
    };
  }, [origin]);

  useEffect(() => {
    messageRef.current = message;
    if (!origin || !readyRef.current) return;
    const timer = setTimeout(() => iframeRef.current?.contentWindow?.postMessage(messageRef.current, origin), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [message, origin]);

  useEffect(() => {
    const pane = paneRef.current;
    if (!pane || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setPaneWidth(entry.contentRect.width));
    ro.observe(pane);
    return () => ro.disconnect();
  }, [origin]);

  const unavailable = !origin || (timedOut && !ready);
  const scale = Math.min(1, paneWidth / DESKTOP_WIDTH);

  return (
    <div className="position-sticky" style={{ top: '1rem' }}>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <span className="form-label mb-0 me-auto" aria-hidden>Previzualizare</span>
        <ToggleButtonGroup
          type="radio"
          name={name}
          value={mode}
          onChange={(m: Mode) => setMode(m)}
          role="radiogroup"
          aria-label="Dimensiunea previzualizării"
          size="sm"
        >
          <ToggleButton id={`${name}-phone`} value="phone" variant="outline-secondary">📱 Telefon</ToggleButton>
          <ToggleButton id={`${name}-desktop`} value="desktop" variant="outline-secondary">🖥️ Desktop</ToggleButton>
        </ToggleButtonGroup>
      </div>
      {unavailable && <Alert variant="secondary">Previzualizarea nu este disponibilă. Poți salva cardul în continuare.</Alert>}
      {origin && (
        <div ref={paneRef} className="w-100 overflow-hidden" style={mode === 'desktop' ? { height: HEIGHT * scale } : undefined}>
          <iframe
            ref={iframeRef}
            src={`${origin}/preview`}
            title="Previzualizare card"
            className="d-block border rounded bg-body"
            style={
              mode === 'phone'
                ? { width: PHONE_WIDTH, maxWidth: '100%', height: HEIGHT, margin: '0 auto' }
                : { width: DESKTOP_WIDTH, height: HEIGHT, transform: `scale(${scale})`, transformOrigin: 'top left' }
            }
          />
        </div>
      )}
    </div>
  );
}
