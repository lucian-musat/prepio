import { parseRichText, type Card, type RichBlock } from '@prepio/shared';

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function blockText(b: RichBlock): string[] {
  switch (b.kind) {
    case 'paragraph':
    case 'heading':
      return [b.spans.map((s) => s.text).join('')];
    case 'list':
      return b.items.map((item) => item.map((s) => s.text).join(''));
    case 'callout':
      return b.blocks.flatMap(blockText);
  }
}

/** Rich text without its markup, whitespace collapsed. */
export function plainText(src: string): string {
  return parseRichText(src).flatMap(blockText).join(' ').replace(/\s+/g, ' ').trim();
}

/** One-line, type-specific description of a card for the admin card list. */
export function cardSummary(card: Card): string {
  switch (card.type) {
    case 'text':
      return plainText(card.text).slice(0, 120);
    case 'images':
      return count(card.images.length, 'imagine', 'imagini');
    case 'video': {
      const { startSeconds: s, endSeconds: e } = card;
      const fragment = s !== null || e !== null ? ` · ${s ?? 0}s–${e === null ? 'final' : `${e}s`}` : '';
      return `YouTube · ${card.youtubeId}${fragment}`;
    }
    case 'timeline':
      return count(card.points.length, 'punct', 'puncte');
    case 'schema':
      return `${count(card.causes.length, 'cauză', 'cauze')} → ${card.central.text} → ${count(card.consequences.length, 'urmare', 'urmări')}`;
    case 'link':
      try {
        return new URL(card.url).hostname;
      } catch {
        return card.url;
      }
  }
}
