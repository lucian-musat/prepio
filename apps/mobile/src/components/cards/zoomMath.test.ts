import { clampTranslation } from './zoomMath';

it('allows no translation at 1x', () => {
  expect(clampTranslation(50, 1, 300)).toBe(0);
});
it('limits translation to half of the extra scaled size', () => {
  expect(clampTranslation(500, 2, 300)).toBe(150);
  expect(clampTranslation(-500, 2, 300)).toBe(-150);
  expect(clampTranslation(40, 2, 300)).toBe(40);
  expect(clampTranslation(-300, 4, 200)).toBe(-300);
});
it('treats scales below 1 and unknown size as no room', () => {
  expect(clampTranslation(10, 0.5, 300)).toBe(0);
  expect(clampTranslation(10, 2, 0)).toBe(0);
});
