import { markerPen, markerSlot } from '@prepio/shared';
import { t } from '../../texts/store';
import type { Pen } from './markerReducer';

/** Numbered marks (spec 2026-11-11): the slot copy, colours and in-text pills. */
type SlotPen = Extract<Pen, 'info' | 'support'>;
const isSlotPen = (pen: Pen): pen is SlotPen => pen === 'info' || pen === 'support';

/** „Informația” / „Informația-suport”. */
export const slotNoun = (pen: SlotPen) => t(`consolidation.marker.slot.${pen}`);
const pillText = (pen: SlotPen) => t(`consolidation.marker.pill.${pen}`);
const ORDINAL_KEYS = ['consolidation.marker.numbered.ordinal1', 'consolidation.marker.numbered.ordinal2', 'consolidation.marker.numbered.ordinal3'] as const;
/** „prima” / „a doua” / „a treia” for slot 0-2, else null. */
export const ordinal = (slot: number): string | null => (ORDINAL_KEYS[slot] ? t(ORDINAL_KEYS[slot]) : null);

/** Slot k's colours (bg, ink, tint). */
export const slotTone = (slot: number) => markerSlot[slot % markerSlot.length]!;
/** A mark's background: its slot's colour when numbered, else its pen's. */
export const markBg = (m: { pen: Pen; slot?: number }) => (m.slot === undefined ? markerPen[m.pen] : slotTone(m.slot).bg);
/** „Informația 2” / „Informația-suport 2”. */
export const slotName = (pen: Pen, slot: number) => `${slotNoun(isSlotPen(pen) ? pen : 'info')} ${slot + 1}`;
/** The pill before a numbered mark: „INFO 2” / „SUPORT 2” on the slot's ink. */
export const slotPill = (pen: Pen, slot: number) => ({ label: `${pillText(isSlotPen(pen) ? pen : 'info')} ${slot + 1}`, ink: slotTone(slot).ink });
