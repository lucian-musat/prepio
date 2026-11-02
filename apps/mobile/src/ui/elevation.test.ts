import { mixColors, raisedShadow, withAlpha } from './elevation';

it('mixes two colours like CSS color-mix in srgb', () => {
  expect(mixColors('#FFFFFF', '#000000', 0.5)).toBe('#808080');
  expect(mixColors('#0F766E', '#D8EAE3', 1)).toBe('#0F766E');
  expect(mixColors('#0F766E', '#D8EAE3', 0)).toBe('#D8EAE3');
  // primary 35 % into border (prototype `.lesson:hover` border)
  expect(mixColors('#0F766E', '#D8EAE3', 0.35)).toBe('#92C1BA');
});

it('turns a token colour into rgba', () => {
  expect(withAlpha('#FFFFFF', 0.18)).toBe('rgba(255, 255, 255, 0.18)');
});

it('raised shadow is the neutral shadow colour at the token opacity', () => {
  expect(raisedShadow('up')).toBe('0px -10px 24px -16px rgba(0, 0, 0, 0.25)');
  expect(raisedShadow('down')).toBe('0px 10px 24px -16px rgba(0, 0, 0, 0.25)');
});
