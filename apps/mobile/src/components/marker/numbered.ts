import { markerPen, markerSlot } from '@prepio/shared';
import type { Pen } from './markerReducer';

/** Numbered marks (spec 2026-11-11): the slot copy, colours and in-text pills. */
type SlotPen = Extract<Pen, 'info' | 'support'>;
const isSlotPen = (pen: Pen): pen is SlotPen => pen === 'info' || pen === 'support';

export const SLOT_NOUN: Record<SlotPen, string> = { info: 'Informația', support: 'Informația-suport' };
const PILL: Record<SlotPen, string> = { info: 'INFO', support: 'SUPORT' };
export const ORDINAL = ['prima', 'a doua', 'a treia'] as const;

/** Slot k's colours (bg, ink, tint). */
export const slotTone = (slot: number) => markerSlot[slot % markerSlot.length]!;
/** A mark's background: its slot's colour when numbered, else its pen's. */
export const markBg = (m: { pen: Pen; slot?: number }) => (m.slot === undefined ? markerPen[m.pen] : slotTone(m.slot).bg);
/** „Informația 2” / „Informația-suport 2”. */
export const slotName = (pen: Pen, slot: number) => `${SLOT_NOUN[isSlotPen(pen) ? pen : 'info']} ${slot + 1}`;
/** The pill before a numbered mark: „INFO 2” / „SUPORT 2” on the slot's ink. */
export const slotPill = (pen: Pen, slot: number) => ({ label: `${PILL[isSlotPen(pen) ? pen : 'info']} ${slot + 1}`, ink: slotTone(slot).ink });
