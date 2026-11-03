/**
 * Clamps a pan translation so a `scale`-times larger image of `size` px never leaves its stage:
 * the overflow on each side is half of the extra scaled size. No room at 1x (or unknown size).
 */
export function clampTranslation(value: number, scale: number, size: number): number {
  'worklet';
  const limit = Math.max(0, (size * (scale - 1)) / 2);
  return Math.min(limit, Math.max(-limit, value));
}
