import type { Difficulty } from './types';

// ---- Primitives: raw scales (keys 50-900); components never use these directly. ----
export const palette = {
  // Brand teal; 300/400/500/600 feed the gradients, 700 is `primary`.
  teal: {
    50: '#E0F5F1', 100: '#CCFBF1', 200: '#99F6E4', 300: '#5EEAD4', 400: '#2DD4BF',
    500: '#14B8A6', 600: '#0D9488', 700: '#0F766E', 800: '#0A5C55', 900: '#134E4A',
  },
  // Accent yellow; 700 is the AA-safe text tone on yellow tints.
  yellow: {
    50: '#FFF6D9', 100: '#FFEDB0', 200: '#FFE38A', 300: '#FFD761', 400: '#FFC93C',
    500: '#E0AA14', 600: '#B88A00', 700: '#8A6A00', 800: '#5E4800', 900: '#3A2C00',
  },
  // Success green; 600 is the feedback text tone.
  green: {
    50: '#E5F7EC', 100: '#C6EDD6', 200: '#9ADDB7', 300: '#6BCB95', 400: '#3FB878',
    500: '#22A55B', 600: '#1A7C49', 700: '#17673C', 800: '#124F30', 900: '#0C3520',
  },
  // Danger red; 700 is the feedback text tone.
  red: {
    50: '#FDECEC', 100: '#FAD3D4', 200: '#F5B0B2', 300: '#EF8B8E', 400: '#EA6A6E',
    500: '#E5484D', 600: '#C93A3F', 700: '#A54042', 800: '#7C2F31', 900: '#551F21',
  },
  // Mint-tinted neutrals, from white to the dark text colour.
  neutral: {
    50: '#FFFFFF', 100: '#F3FAF7', 200: '#E6F4EF', 300: '#D8EAE3', 400: '#AFC7BF',
    500: '#8AA69E', 600: '#4C6A63', 700: '#38534C', 800: '#23413A', 900: '#0F2E28',
  },
} as const;

// ---- Semantic colours: the only colours components may use. ----
export const color = {
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
} as const;

// Feedback text tones, AA on the matching subtle background. Deviation: good is #1A7C49, not the plan's #1C814C (only 4.39:1).
export const feedbackText = { good: palette.green[600], wrong: palette.red[700] } as const;

// Difficulty badge colours (medium uses a darker yellow for AA on accentSubtle).
export const difficultyTone: Record<Difficulty, { fg: string; bg: string }> = {
  easy: { fg: color.success, bg: color.successSubtle },
  medium: { fg: palette.yellow[700], bg: color.accentSubtle },
  hard: { fg: color.danger, bg: color.dangerSubtle },
};

// Decorative gradients (large bold text only); angles in degrees.
export const gradient = {
  hero: {
    colors: [palette.teal[600], palette.teal[500], palette.teal[300]],
    locations: [0, 0.55, 1],
    angle: 135,
  },
  progress: { colors: [palette.teal[600], palette.teal[400]], angle: 90 },
} as const;

// Spacing scale in px (key = step, value = px).
export const space = {
  1: 4, 1.5: 6, 2: 8, 2.5: 10, 3: 12, 3.5: 14, 4: 16, 4.5: 18,
  5: 20, 5.5: 22, 6: 24, 8: 32, 10: 40, 12: 48,
} as const;

// Corner radii in px.
export const radius = { xs: 9, sm: 12, md: 14, lg: 20, xl: 26, pill: 999 } as const;

// Type roles: size/lineHeight in px, weight is a font-family key, letterSpacing in px.
type TypeRole = {
  size: number;
  lineHeight: number;
  weight: 'body' | 'bodySemi' | 'bodyBold' | 'headExtra' | 'headBlack';
  letterSpacing?: number;
  uppercase?: boolean;
};
export const typeScale = {
  logo: { size: 22, lineHeight: 27, weight: 'headBlack', letterSpacing: -0.22 },
  display: { size: 24, lineHeight: 29, weight: 'headBlack', letterSpacing: -0.24 },
  title: { size: 22, lineHeight: 28, weight: 'headBlack', letterSpacing: -0.22 },
  question: { size: 20, lineHeight: 26, weight: 'headBlack', letterSpacing: -0.2 },
  section: { size: 18, lineHeight: 23, weight: 'headBlack', letterSpacing: -0.18 },
  bar: { size: 17, lineHeight: 22, weight: 'headBlack', letterSpacing: -0.17 },
  body: { size: 17, lineHeight: 27, weight: 'body' },
  bodyStrong: { size: 16, lineHeight: 21, weight: 'bodyBold' },
  option: { size: 16, lineHeight: 22, weight: 'body' },
  small: { size: 15, lineHeight: 23, weight: 'body' },
  caption: { size: 13, lineHeight: 18, weight: 'body' },
  eyebrow: { size: 12, lineHeight: 16, weight: 'bodyBold', letterSpacing: 0.96, uppercase: true },
  button: { size: 16, lineHeight: 20, weight: 'bodyBold' },
  chip: { size: 12, lineHeight: 16, weight: 'bodyBold' },
  badge: { size: 11, lineHeight: 14, weight: 'bodyBold' },
} as const satisfies Record<string, TypeRole>;

// Motion: durations in ms, easings as cubic-bezier control points (usable by RN and CSS).
export const motion = {
  duration: { fast: 160, base: 320, slow: 420, shake: 420 },
  easing: {
    standard: [0.34, 1.4, 0.64, 1],
    pop: [0.34, 1.56, 0.64, 1],
    shake: [0.36, 0.07, 0.19, 0.97],
    out: [0.22, 1, 0.36, 1],
  },
  stagger: 50,
} as const;

// Elevation: solid offset "shadows" (blur 0) plus one soft raised shadow.
export const elevation = {
  card: { offsetY: 2, blur: 0, color: color.border },
  button: { offsetY: 4, color: color.primaryStrong },
  buttonPressed: { offsetY: 1 },
  optionRest: { offsetY: 3, color: color.border },
  raised: { offsetY: -10, blur: 24, spread: -16, opacity: 0.25 },
} as const;

// Layout metrics in px.
export const layout = {
  maxContentWidth: 720,
  gutter: 16,
  gutterWide: 32,
  wideBreakpoint: 768,
  minTouch: 48,
} as const;

// WCAG 2.x contrast ratio between two #RRGGBB colours (1-21).
export function contrastRatio(fg: string, bg: string): number {
  const luminance = (hex: string) => {
    const channel = (i: number) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  };
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// ---- Legacy (old theme) — removed in Task 10 once apps use the tokens above. ----
export const legacyColors = {
  parchment: '#F7F1E3',
  paper: '#FFFDF7',
  ink: '#2B2118',
  inkMuted: '#6B5D4F',
  bordeaux: '#7A1F2B',
  gold: '#B8893B',
  border: '#E3D8C3',
  success: '#2F6B3A',
  error: '#A12C2C',
} as const;

export const legacyDifficultyColors: Record<Difficulty, string> = {
  easy: '#2F6B3A',
  medium: '#B8893B',
  hard: '#7A1F2B',
};

export const legacyRadius = 12;

export const fonts = { heading: 'Lora', body: 'Source Sans 3' } as const;
