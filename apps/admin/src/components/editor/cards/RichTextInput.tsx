'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Button, ButtonGroup, Form } from 'react-bootstrap';
import type { CalloutVariant } from '@prepio/shared';

type Edit = { text: string; sel: [number, number] };

/** Wraps the selection (whitespace trimmed, since the parser ignores `** x **`) in an inline marker. */
export function wrapInline(v: string, s: number, e: number, marker: string): Edit {
  while (s < e && /\s/.test(v.charAt(s))) s++;
  while (e > s && /\s/.test(v.charAt(e - 1))) e--;
  const inner = v.slice(s, e);
  const text = v.slice(0, s) + marker + inner + marker + v.slice(e);
  return { text, sel: [s + marker.length, e + marker.length] };
}

/** Start and end of the full lines touched by the selection. */
function lineRange(v: string, s: number, e: number): [number, number] {
  if (e > s && v.charAt(e - 1) === '\n') e--;
  const start = v.lastIndexOf('\n', s - 1) + 1;
  const nl = v.indexOf('\n', e);
  return [start, nl === -1 ? v.length : nl];
}

export type LineKind = 'bullet' | 'ordered' | 'heading';
const LINE_PREFIX = /^(- |\d+\. |### )/;
const prefixFor = (kind: LineKind, i: number) => (kind === 'bullet' ? '- ' : kind === 'ordered' ? `${i + 1}. ` : '### ');
const hasKind = (line: string, kind: LineKind) =>
  kind === 'bullet' ? line.startsWith('- ') : kind === 'ordered' ? /^\d+\. /.test(line) : line.startsWith('### ');

/** Turns the selected lines into a list / heading; removes the prefix when every line already has it. */
export function prefixLines(v: string, s: number, e: number, kind: LineKind): Edit {
  const [start, end] = lineRange(v, s, e);
  const lines = v.slice(start, end).split('\n');
  const remove = lines.every((l) => hasKind(l, kind));
  const out = lines
    .map((l) => l.replace(LINE_PREFIX, ''))
    .map((l, i) => (remove ? l : prefixFor(kind, i) + l))
    .join('\n');
  return { text: v.slice(0, start) + out + v.slice(end), sel: [start, start + out.length] };
}

/** Puts the selected lines inside a `:::variant … :::` callout block. */
export function wrapCallout(v: string, s: number, e: number, variant: CalloutVariant): Edit {
  const [start, end] = lineRange(v, s, e);
  const inner = v.slice(start, end);
  const open = `:::${variant}\n`;
  const text = `${v.slice(0, start)}${open}${inner}\n:::${v.slice(end)}`;
  return { text, sel: [start + open.length, start + open.length + inner.length] };
}

type Tool = { label: ReactNode; name: string; title: string; edit: (v: string, s: number, e: number) => Edit };

const TOOLS: Tool[] = [
  { label: <strong>B</strong>, name: 'B', title: 'Bold (**text**)', edit: (v, s, e) => wrapInline(v, s, e, '**') },
  { label: <em>I</em>, name: 'I', title: 'Italic (*text*)', edit: (v, s, e) => wrapInline(v, s, e, '*') },
  { label: 'Listă', name: 'Listă', title: 'Listă cu puncte (- )', edit: (v, s, e) => prefixLines(v, s, e, 'bullet') },
  { label: 'Listă numerotată', name: 'Listă numerotată', title: 'Listă numerotată (1. )', edit: (v, s, e) => prefixLines(v, s, e, 'ordered') },
  { label: 'Subtitlu', name: 'Subtitlu', title: 'Subtitlu (### )', edit: (v, s, e) => prefixLines(v, s, e, 'heading') },
  { label: 'De reținut', name: 'De reținut', title: 'Casetă „De reținut”', edit: (v, s, e) => wrapCallout(v, s, e, 'retine') },
  { label: 'Atenție', name: 'Atenție', title: 'Casetă „Atenție”', edit: (v, s, e) => wrapCallout(v, s, e, 'atentie') },
  { label: 'Exemplu', name: 'Exemplu', title: 'Casetă „Exemplu”', edit: (v, s, e) => wrapCallout(v, s, e, 'exemplu') },
];

/** Textarea for the card rich-text subset, with a toolbar that inserts the syntax. */
export default function RichTextInput({ id, label, value, onChange, required }: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const nextSel = useRef<[number, number] | null>(null);

  // Restores focus + selection after a toolbar edit has been rendered.
  useLayoutEffect(() => {
    const t = ref.current;
    if (!t || !nextSel.current) return;
    t.focus();
    t.setSelectionRange(...nextSel.current);
    nextSel.current = null;
  }, [value]);

  const apply = (tool: Tool) => {
    const t = ref.current;
    if (!t) return;
    const res = tool.edit(value, t.selectionStart, t.selectionEnd);
    nextSel.current = res.sel;
    onChange(res.text);
  };

  return (
    <Form.Group className="mb-3" controlId={id}>
      <Form.Label>{label}</Form.Label>
      <div className="mb-1">
        <ButtonGroup size="sm" role="toolbar" aria-label={`Formatare ${label}`} className="flex-wrap">
          {TOOLS.map((tool) => (
            <Button
              key={tool.name}
              variant="outline-secondary"
              title={tool.title}
              // keep the textarea selection while clicking
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => apply(tool)}
            >
              {tool.label}
            </Button>
          ))}
        </ButtonGroup>
      </div>
      <Form.Control
        as="textarea"
        ref={ref}
        rows={8}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <Form.Text>Formatare: **bold**, *italic*, „- ” listă, „### ” subtitlu.</Form.Text>
    </Form.Group>
  );
}
