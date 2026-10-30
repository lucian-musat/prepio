import { colors, radius } from '@prepio/shared';

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
};

/** Bootstrap CSS-variable overrides generated from the shared design tokens. */
export const themeVariablesCss = `:root{
--bs-primary:${colors.bordeaux};--bs-primary-rgb:${hexToRgb(colors.bordeaux)};
--bs-success:${colors.success};--bs-success-rgb:${hexToRgb(colors.success)};
--bs-danger:${colors.error};--bs-danger-rgb:${hexToRgb(colors.error)};
--bs-warning:${colors.gold};--bs-warning-rgb:${hexToRgb(colors.gold)};
--bs-body-bg:${colors.parchment};--bs-body-bg-rgb:${hexToRgb(colors.parchment)};
--bs-body-color:${colors.ink};--bs-body-color-rgb:${hexToRgb(colors.ink)};
--bs-secondary-color:${colors.inkMuted};--bs-secondary-bg:${colors.paper};
--bs-tertiary-bg:${colors.paper};
--bs-border-color:${colors.border};
--bs-link-color:${colors.bordeaux};--bs-link-color-rgb:${hexToRgb(colors.bordeaux)};
--bs-link-hover-color:${colors.ink};--bs-link-hover-color-rgb:${hexToRgb(colors.ink)};
--bs-border-radius:${radius}px;--bs-border-radius-lg:${radius}px;
--bs-body-font-size:1rem;--bs-body-line-height:1.5;
--prepio-gold:${colors.gold};--prepio-paper:${colors.paper};--prepio-bordeaux:${colors.bordeaux};--prepio-parchment:${colors.parchment};
}`;
