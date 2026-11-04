// Swipe-between-cards math for CardStepper (worklets: they run on the UI thread inside gesture callbacks).

/** A drag past this fraction of the card width commits. */
export const SWIPE_DISTANCE = 0.25;
/** A flick faster than this (px/s) commits, whatever the distance. */
export const SWIPE_VELOCITY = 500;
/** Maximum tilt in degrees while dragging (cardInConfig tilts the incoming card by 2°). */
export const SWIPE_TILT = 3;
// iOS-style rubber band constant: lower is stiffer.
const RUBBER = 0.55;

export type SwipeBounds = { canPrev: boolean; canNext: boolean };

/** Resisted offset for a drag of `dx` px past an end: grows ever slower and never reaches `size`. */
export function rubberBand(dx: number, size: number): number {
  'worklet';
  if (dx === 0 || size <= 0) return 0;
  const d = Math.abs(dx);
  return Math.sign(dx) * (1 - 1 / ((d * RUBBER) / size + 1)) * size;
}

/** Where the card is drawn for a drag of `dx`: under the finger, or rubber-banded where there is no card to go to. */
export function swipeOffset(dx: number, width: number, { canPrev, canNext }: SwipeBounds): number {
  'worklet';
  const blocked = (dx > 0 && !canPrev) || (dx < 0 && !canNext);
  return blocked ? rubberBand(dx, width) : dx;
}

/**
 * Card to go to when the finger lifts: a flick decides by its direction, otherwise the drag must pass a quarter
 * of the width. Left = next, right = previous; null springs back (also at the ends: swiping never finishes).
 */
export function swipeTarget(dx: number, vx: number, width: number, { canPrev, canNext }: SwipeBounds): 'next' | 'prev' | null {
  'worklet';
  let sign = 0;
  if (Math.abs(vx) > SWIPE_VELOCITY) sign = Math.sign(vx);
  else if (width > 0 && Math.abs(dx) > width * SWIPE_DISTANCE) sign = Math.sign(dx);
  if (sign < 0 && canNext) return 'next';
  if (sign > 0 && canPrev) return 'prev';
  return null;
}

/** Tilt in degrees for a card drawn at `offset`: same sign as the offset (like cardInConfig), capped at SWIPE_TILT. */
export function swipeTilt(offset: number, width: number): number {
  'worklet';
  if (width <= 0) return 0;
  return Math.max(-SWIPE_TILT, Math.min(SWIPE_TILT, (offset / width) * SWIPE_TILT * 2));
}
