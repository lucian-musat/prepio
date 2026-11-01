import { color, feedbackText, gradient, radius } from '@prepio/shared';

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
};

const [heroFrom, heroMid, heroTo] = gradient.hero.colors;

/** Bootstrap CSS-variable overrides generated from the shared design tokens. */
export const themeVariablesCss = `:root{
--bs-primary:${color.primary};--bs-primary-rgb:${hexToRgb(color.primary)};
--bs-success:${color.success};--bs-success-rgb:${hexToRgb(color.success)};
--bs-danger:${color.danger};--bs-danger-rgb:${hexToRgb(color.danger)};
--bs-warning:${color.accent};--bs-warning-rgb:${hexToRgb(color.accent)};
--bs-body-bg:${color.bg};--bs-body-bg-rgb:${hexToRgb(color.bg)};
--bs-body-color:${color.text};--bs-body-color-rgb:${hexToRgb(color.text)};
--bs-secondary-color:${color.textMuted};--bs-secondary-color-rgb:${hexToRgb(color.textMuted)};
--bs-secondary-bg:${color.surfaceMuted};--bs-secondary-bg-rgb:${hexToRgb(color.surfaceMuted)};
--bs-tertiary-bg:${color.surfaceMuted};--bs-tertiary-bg-rgb:${hexToRgb(color.surfaceMuted)};
--bs-success-text-emphasis:${feedbackText.good};--bs-danger-text-emphasis:${feedbackText.wrong};
--bs-border-color:${color.border};
--bs-link-color:${color.primaryStrong};--bs-link-color-rgb:${hexToRgb(color.primaryStrong)};
--bs-link-hover-color:${color.text};--bs-link-hover-color-rgb:${hexToRgb(color.text)};
--bs-border-radius:${radius.md}px;--bs-border-radius-lg:${radius.lg}px;
--bs-body-font-size:1rem;--bs-body-line-height:1.5;
--prepio-bg:${color.bg};--prepio-surface:${color.surface};--prepio-surface-muted:${color.surfaceMuted};
--prepio-text:${color.text};--prepio-text-muted:${color.textMuted};--prepio-border:${color.border};
--prepio-primary:${color.primary};--prepio-primary-strong:${color.primaryStrong};--prepio-primary-subtle:${color.primarySubtle};--prepio-on-primary:${color.onPrimary};
--prepio-accent:${color.accent};--prepio-accent-subtle:${color.accentSubtle};--prepio-on-accent:${color.onAccent};
--prepio-success-text:${feedbackText.good};--prepio-danger-text:${feedbackText.wrong};
--prepio-success:${color.success};--prepio-success-subtle:${color.successSubtle};
--prepio-danger:${color.danger};--prepio-danger-subtle:${color.dangerSubtle};
--prepio-primary-rgb:${hexToRgb(color.primary)};
--prepio-hero-from:${heroFrom};--prepio-hero-mid:${heroMid};--prepio-hero-to:${heroTo};
}`;
