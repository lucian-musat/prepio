import { CARD_TYPES, cardFromRow } from './cards';
import type { Card, CardType } from './types';

/**
 * postMessage protocol between the admin card editor and the student app's `/preview` page, which the admin
 * embeds in an iframe. Both sides check the other's origin before calling these helpers.
 */

/** admin → preview: the card being edited, with its place in the lesson. */
export type AdminPreviewMessage = { source: 'prepio-admin'; kind: 'card'; card: Card; index: number; total: number };

/** preview → admin, once the page listens: the admin can send the current card. */
export type PreviewReadyMessage = { source: 'prepio-preview'; kind: 'ready' };

export const PREVIEW_READY_MESSAGE: PreviewReadyMessage = { source: 'prepio-preview', kind: 'ready' };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function isPreviewReadyMessage(data: unknown): data is PreviewReadyMessage {
  return isObj(data) && data.source === 'prepio-preview' && data.kind === 'ready';
}

/**
 * Validates an admin message (untrusted: anything can be posted to a window). Returns null unless the envelope,
 * the card type and the index/total match; the card itself goes through `cardFromRow`, so partial or malformed
 * content still renders. A card without id/position/title (not saved yet) gets placeholders.
 */
export function parsePreviewMessage(data: unknown): { card: Card; index: number; total: number } | null {
  if (!isObj(data) || data.source !== 'prepio-admin' || data.kind !== 'card') return null;
  const { card, index, total } = data;
  if (!isObj(card) || !CARD_TYPES.includes(card.type as CardType)) return null;
  if (!Number.isInteger(index) || !Number.isInteger(total)) return null;
  const i = index as number;
  const n = total as number;
  if (i < 0 || n < 1 || i >= n) return null;

  const { id, position, title, type, ...content } = card;
  return {
    card: cardFromRow({
      id: typeof id === 'string' && id !== '' ? id : 'preview',
      position: Number.isInteger(position) ? (position as number) : 0,
      title: typeof title === 'string' && title !== '' ? title : null,
      type: type as CardType,
      content,
    }),
    index: i,
    total: n,
  };
}
