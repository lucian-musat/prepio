import { describe, expect, it } from 'vitest';
import {
  border,
  color,
  consolidationColor,
  contrastRatio,
  difficultyTone,
  elevation,
  feedbackText,
  gradient,
  layout,
  markerPen,
  motion,
  opacity,
  palette,
  planTone,
  pressScale,
  radius,
  shadowColor,
  space,
  stroke,
  typeScale,
} from './theme';

describe('design tokens', () => {
  it('marker pens are the approved mockup colours, and text stays AA on each', () => {
    expect(markerPen).toEqual({ info: '#FFE38A', cause: '#99F6E4', effect: '#FFD0A8', support: '#C9D7FF' });
    for (const bg of Object.values(markerPen)) expect(contrastRatio(color.text, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('consolidation colours are the approved mockup paper and lilac; text stays AA on both', () => {
    expect(consolidationColor).toEqual({ paper: '#FFFDF8', tint: '#EEE8FF' });
    for (const bg of Object.values(consolidationColor)) {
      expect(contrastRatio(color.text, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(color.textMuted, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('plan pill tones are the approved paid-access mockup colours; each text stays AA on its background', () => {
    expect(planTone).toEqual({
      trial: { fg: '#38534C', bg: '#EEF2F1', border: '#D0DDD9' },
      full: { fg: '#0F766E', bg: '#E3F6EF', border: '#9ED9C5' },
      expiring: { fg: '#8A4B00', bg: '#FFF1E0', border: '#FFC98A' },
    });
    for (const t of Object.values(planTone)) expect(contrastRatio(t.fg, t.bg)).toBeGreaterThanOrEqual(4.5);
  });

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

  it('each semantic colour is its palette step', () => {
    expect(color).toEqual({
      bg: palette.neutral[100],
      surface: palette.neutral[50],
      surfaceMuted: palette.neutral[200],
      text: palette.neutral[900],
      textMuted: palette.neutral[600],
      border: palette.neutral[300],
      primary: palette.teal[700],
      primaryStrong: palette.teal[800],
      primarySubtle: palette.teal[50],
      onPrimary: palette.neutral[50],
      accent: palette.yellow[400],
      accentSubtle: palette.yellow[50],
      onAccent: palette.yellow[900],
      success: palette.green[500],
      successSubtle: palette.green[50],
      danger: palette.red[500],
      dangerSubtle: palette.red[50],
    });
    expect(feedbackText).toEqual({ good: palette.green[600], almost: palette.yellow[700], wrong: palette.red[700] });
  });

  it('type scale is the prototype values', () => {
    expect(typeScale).toEqual({
      logo: { size: 22, lineHeight: 30, weight: 'headBlack', letterSpacing: -0.22 },
      logoMark: { size: 15, lineHeight: 20.5, weight: 'headBlack' },
      display: { size: 24, lineHeight: 28.8, weight: 'headBlack', letterSpacing: -0.24 },
      celebrate: { size: 24, lineHeight: 32.7, weight: 'headBlack' },
      title: { size: 22, lineHeight: 27.5, weight: 'headBlack', letterSpacing: -0.22 },
      question: { size: 20, lineHeight: 26, weight: 'headBlack', letterSpacing: -0.2 },
      section: { size: 18, lineHeight: 24.5, weight: 'headBlack', letterSpacing: -0.18 },
      bar: { size: 17, lineHeight: 23.2, weight: 'headBlack', letterSpacing: -0.17 },
      body: { size: 17, lineHeight: 27.2, weight: 'body' },
      bodyStrong: { size: 16, lineHeight: 20.8, weight: 'bodyBold' },
      verdict: { size: 16, lineHeight: 24, weight: 'bodyBold' },
      option: { size: 16, lineHeight: 21.8, weight: 'body' },
      lead: { size: 16, lineHeight: 21.8, weight: 'body' },
      input: { size: 16, lineHeight: 24.8, weight: 'body' },
      small: { size: 15, lineHeight: 22.5, weight: 'body' },
      list: { size: 15, lineHeight: 21.75, weight: 'body' },
      note: { size: 14, lineHeight: 20.3, weight: 'body' },
      label: { size: 14, lineHeight: 19.1, weight: 'bodySemi' },
      caption: { size: 13, lineHeight: 17.7, weight: 'body' },
      eyebrow: { size: 12, lineHeight: 16, weight: 'bodyBold', letterSpacing: 0.96, uppercase: true },
      button: { size: 16, lineHeight: 21.8, weight: 'bodyBold' },
      chip: { size: 12, lineHeight: 15, weight: 'bodyBold' },
      badge: { size: 11, lineHeight: 15, weight: 'bodyBold' },
    });
  });

  it('motion is the prototype values', () => {
    expect(motion).toEqual({
      duration: { fast: 160, base: 320, slow: 420, shake: 420 },
      easing: {
        standard: [0.34, 1.4, 0.64, 1],
        pop: [0.34, 1.56, 0.64, 1],
        shake: [0.36, 0.07, 0.19, 0.97],
        out: [0.22, 1, 0.36, 1],
      },
      stagger: 50,
    });
  });

  it('elevation is the prototype values', () => {
    expect(elevation).toEqual({
      card: { offsetY: 2, blur: 0, color: palette.neutral[300] },
      button: { offsetY: 4, color: palette.teal[800] },
      buttonPressed: { offsetY: 1 },
      optionRest: { offsetY: 3, color: palette.neutral[300] },
      raised: { offsetY: -10, blur: 24, spread: -16, opacity: 0.25 },
      progressInset: { offsetY: -3, opacity: 0.08 },
    });
    expect(shadowColor).toBe('#000000');
  });

  it('layout and gradients are the prototype values', () => {
    expect(layout).toEqual({ maxContentWidth: 720, maxWideContentWidth: 1180, gutter: 16, gutterWide: 32, wideBreakpoint: 768, minTouch: 48 });
    expect(gradient).toEqual({
      hero: { colors: ['#0D9488', '#14B8A6', '#5EEAD4'], locations: [0, 0.55, 1], angle: 135 },
      progress: { colors: ['#0D9488', '#2DD4BF'], angle: 90 },
    });
  });

  it('border widths, strokes, disabled opacities and press scales are the prototype values', () => {
    expect(border).toEqual({ hairline: 1, thick: 2 });
    expect(stroke).toEqual({ icon: 2.2, iconBold: 3, ring: 8 });
    expect(opacity).toEqual({ disabled: 0.45, disabledIcon: 0.4 });
    expect(pressScale).toEqual({ row: 0.98, icon: 0.92 });
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
      ['feedback almost/accentSubtle', feedbackText.almost, color.accentSubtle],
    ];
    for (const [name, fg, bg] of pairs) {
      expect(contrastRatio(fg, bg), name).toBeGreaterThanOrEqual(4.5);
    }
    expect(feedbackText).toEqual({ good: '#1A7C49', almost: '#8A6A00', wrong: '#A54042' });
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
