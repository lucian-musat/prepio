import { limitWords, sentenceRange, tokenizeSource, type AnswerSpan } from '@prepio/shared';

export type CharRange = { start: number; end: number };

/** The rendered segment (element with `data-offset`) that contains `node`, without leaving `container`. */
function segmentOf(node: Node, container: HTMLElement): HTMLElement | null {
  for (let n: Node | null = node; n && n !== container; n = n.parentNode) {
    if (n instanceof HTMLElement && n.dataset.offset !== undefined) return n;
  }
  return null;
}

const segments = (container: HTMLElement) => Array.from(container.querySelectorAll<HTMLElement>('[data-offset]'));
const segEnd = (s: HTMLElement) => Number(s.dataset.offset) + (s.textContent ?? '').length;

/** Body offset of the DOM point (node, offset) inside `container`; null when the point is outside it. */
function pointOffset(container: HTMLElement, node: Node, offset: number): number | null {
  if (node !== container && !container.contains(node)) return null;
  const seg = segmentOf(node, container);
  if (seg) {
    const r = document.createRange();
    r.selectNodeContents(seg);
    r.setEnd(node, offset);
    return Number(seg.dataset.offset) + r.toString().length;
  }
  // A boundary between segments: the offset of the first segment after the point.
  const all = segments(container);
  const child = node.childNodes[offset] ?? null;
  const next = all.find((s) =>
    child
      ? child === s || child.contains(s) || (child.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
      : (node.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 && !node.contains(s),
  );
  if (next) return Number(next.dataset.offset);
  const last = all[all.length - 1];
  return last ? segEnd(last) : 0;
}

/** Char offsets of the current DOM selection inside `container`, whose segments carry their body offset in `data-offset`. */
export function selectionOffsets(container: HTMLElement, selection: Selection | null): CharRange | null {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  const a = pointOffset(container, range.startContainer, range.startOffset);
  const b = pointOffset(container, range.endContainer, range.endOffset);
  if (a === null || b === null || a === b) return null;
  return { start: Math.min(a, b), end: Math.max(a, b) };
}

/** Snaps to whole words of tokenizeSource(body); null for an empty or whitespace-only selection. */
export function snapToWords(body: string, start: number, end: number): CharRange | null {
  if (end <= start) return null;
  const words = tokenizeSource(body).words.filter((w) => w.end > start && w.start < end);
  if (words.length === 0) return null;
  return { start: words[0]!.start, end: words[words.length - 1]!.end };
}

export function spanFromSelection(body: string, sourceId: string, sel: CharRange, id: string): AnswerSpan {
  return { id, sourceId, start: sel.start, end: sel.end, text: body.slice(sel.start, sel.end), limitStart: null, limitEnd: null };
}

/** True when the span still quotes the body at its offsets. */
export const isAnchored = (body: string, s: AnswerSpan) => s.text !== '' && s.start < s.end && body.slice(s.start, s.end) === s.text;

/** Widens the span's limit (explicit char offsets) by one sentence before or after; unchanged at the edges of the text. */
export function extendLimit(body: string, span: AnswerSpan, dir: 'prev' | 'next'): AnswerSpan {
  const t = tokenizeSource(body);
  if (t.words.length === 0) return span;
  let [from, to] = limitWords(t, span);
  if (dir === 'prev') {
    if (from === 0) return span;
    from = sentenceRange(t, from - 1, from - 1)[0];
  } else {
    if (to >= t.words.length - 1) return span;
    to = sentenceRange(t, to + 1, to + 1)[1];
  }
  return { ...span, limitStart: t.words[from]!.start, limitEnd: t.words[to]!.end };
}

export type Segment = { start: number; end: number; spanIds: string[] };

/** Splits the body at every span boundary (and the extra cut points); each segment lists the spans covering it. */
export function segmentBody(body: string, spans: AnswerSpan[], cuts: number[] = []): Segment[] {
  const live = spans.filter((s) => isAnchored(body, s));
  const points = new Set([0, body.length, ...cuts.filter((c) => c > 0 && c < body.length)]);
  for (const s of live) {
    points.add(s.start);
    points.add(s.end);
  }
  const sorted = [...points].sort((a, b) => a - b);
  const out: Segment[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i]!;
    const end = sorted[i + 1]!;
    out.push({ start, end, spanIds: live.filter((s) => s.start <= start && s.end >= end).map((s) => s.id) });
  }
  return out;
}
