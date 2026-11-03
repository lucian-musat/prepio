// Markdown-subset parser for card text. Output is a plain data tree; renderers
// map it to native/React elements and never interpret the source as HTML.

export type RichSpan = { text: string; bold?: true; italic?: true };
export type CalloutVariant = 'retine' | 'atentie' | 'exemplu';
export type RichBlock =
  | { kind: 'paragraph'; spans: RichSpan[] }
  | { kind: 'heading'; spans: RichSpan[] }
  | { kind: 'list'; ordered: boolean; items: RichSpan[][] }
  | { kind: 'callout'; variant: CalloutVariant; blocks: RichBlock[] };

export const CALLOUT_LABELS: Record<CalloutVariant, string> = {
  retine: 'De reținut',
  atentie: 'Atenție',
  exemplu: 'Exemplu',
};

const OPENERS: Record<string, CalloutVariant> = {
  ':::retine': 'retine',
  ':::atentie': 'atentie',
  ':::exemplu': 'exemplu',
};

// A marker pair only counts when it wraps non-empty text that does not start
// or end with whitespace, so "2 * 3 * 4" stays literal.
function closingIndex(src: string, marker: string, from: number): number {
  const first = src[from];
  if (first === undefined || /\s/.test(first)) return -1;
  let i = src.indexOf(marker, from + 1);
  while (i !== -1) {
    if (!/\s/.test(src.charAt(i - 1))) return i;
    i = src.indexOf(marker, i + 1);
  }
  return -1;
}

function pushSpan(spans: RichSpan[], text: string, bold: boolean, italic: boolean) {
  if (!text) return;
  const last = spans[spans.length - 1];
  if (last && !!last.bold === bold && !!last.italic === italic) {
    last.text += text;
    return;
  }
  const span: RichSpan = { text };
  if (bold) span.bold = true;
  if (italic) span.italic = true;
  spans.push(span);
}

function parseInline(src: string): RichSpan[] {
  const spans: RichSpan[] = [];
  let i = 0;
  while (i < src.length) {
    if (src.startsWith('**', i)) {
      const end = closingIndex(src, '**', i + 2);
      if (end !== -1) {
        pushSpan(spans, src.slice(i + 2, end), true, false);
        i = end + 2;
        continue;
      }
    }
    if (src[i] === '*') {
      const end = closingIndex(src, '*', i + 1);
      if (end !== -1) {
        pushSpan(spans, src.slice(i + 1, end), false, true);
        i = end + 1;
        continue;
      }
    }
    pushSpan(spans, src.charAt(i), false, false);
    i++;
  }
  return spans;
}

const BULLET = /^- (.*)$/;
const ORDERED = /^\d+\. (.*)$/;

function parseBlocks(lines: string[], allowCallouts: boolean): RichBlock[] {
  const blocks: RichBlock[] = [];
  let para: string[] = [];

  const flush = () => {
    if (para.length) blocks.push({ kind: 'paragraph', spans: parseInline(para.join('\n')) });
    para = [];
  };

  for (let n = 0; n < lines.length; n++) {
    const line = lines[n] ?? '';
    const trimmed = line.trim();

    const variant = allowCallouts ? OPENERS[trimmed] : undefined;
    if (variant) {
      flush();
      const inner: string[] = [];
      n++;
      while (n < lines.length && (lines[n] ?? '').trim() !== ':::') inner.push(lines[n++] ?? '');
      blocks.push({ kind: 'callout', variant, blocks: parseBlocks(inner, false) });
      continue;
    }
    if (trimmed === '') {
      flush();
      continue;
    }
    if (line.startsWith('### ')) {
      flush();
      blocks.push({ kind: 'heading', spans: parseInline(line.slice(4)) });
      continue;
    }
    const bullet = BULLET.exec(line);
    const ordered = bullet ? null : ORDERED.exec(line);
    const match = bullet ?? ordered;
    if (match) {
      flush();
      const isOrdered = !!ordered;
      const last = blocks[blocks.length - 1];
      const item = parseInline(match[1] ?? '');
      if (last && last.kind === 'list' && last.ordered === isOrdered) last.items.push(item);
      else blocks.push({ kind: 'list', ordered: isOrdered, items: [item] });
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks;
}

export function parseRichText(src: string): RichBlock[] {
  return parseBlocks(src.replace(/\r\n?/g, '\n').split('\n'), true);
}
