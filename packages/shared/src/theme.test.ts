import { describe, expect, it } from 'vitest';
import {
  color,
  contrastRatio,
  difficultyTone,
  feedbackText,
  palette,
  radius,
  space,
} from './theme';

describe('design tokens', () => {
  it('semantic colours match the approved variant B', () => {
    expect(color).toEqual({
      bg: '#F3FAF7',
      surface: '#FFFFFF',
      surfaceMuted: '#E6F4EF',
      text: '#0F2E28',
      textMuted: '#4C6A63',
      border: '#D8EAE3',
      primary: '#0F766E',
      primaryStrong: '#0A5C55',
      primarySubtle: '#E0F5F1',
      onPrimary: '#FFFFFF',
      accent: '#FFC93C',
      accentSubtle: '#FFF6D9',
      onAccent: '#3A2C00',
      success: '#22A55B',
      successSubtle: '#E5F7EC',
      danger: '#E5484D',
      dangerSubtle: '#FDECEC',
    });
  });

  it('every semantic colour exists in the primitive palette', () => {
    const flat = new Set(Object.values(palette).flatMap((scale) => Object.values(scale)));
    for (const [name, value] of Object.entries(color)) {
      expect(flat.has(value), `${name} ${value}`).toBe(true);
    }
  });

  it('text pairs meet WCAG AA', () => {
    const pairs: [string, string, string][] = [
      ['text/bg', color.text, color.bg],
      ['textMuted/bg', color.textMuted, color.bg],
      ['textMuted/surface', color.textMuted, color.surface],
      ['onAccent/accent', color.onAccent, color.accent],
      ['medium/accentSubtle', difficultyTone.medium.fg, color.accentSubtle],
      ['feedback wrong/dangerSubtle', feedbackText.wrong, color.dangerSubtle],
      ['feedback good/successSubtle', feedbackText.good, color.successSubtle],
    ];
    for (const [name, fg, bg] of pairs) {
      expect(contrastRatio(fg, bg), name).toBeGreaterThanOrEqual(4.5);
    }
    expect(feedbackText).toEqual({ good: '#1A7C49', wrong: '#A54042' });
  });

  it('button label meets AA', () => {
    expect(contrastRatio(color.onPrimary, color.primary)).toBeGreaterThanOrEqual(4.5);
  });

  it('contrastRatio follows WCAG', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('difficulty tones map to semantic colours', () => {
    expect(difficultyTone).toEqual({
      easy: { fg: color.success, bg: color.successSubtle },
      medium: { fg: '#8A6A00', bg: color.accentSubtle },
      hard: { fg: color.danger, bg: color.dangerSubtle },
    });
  });

  it('space and radius scales are the prototype values', () => {
    expect(space).toEqual({
      1: 4, 1.5: 6, 2: 8, 2.5: 10, 3: 12, 3.5: 14, 4: 16, 4.5: 18,
      5: 20, 5.5: 22, 6: 24, 8: 32, 10: 40, 12: 48,
    });
    expect(radius).toEqual({ xs: 9, sm: 12, md: 14, lg: 20, xl: 26, pill: 999 });
  });
});
