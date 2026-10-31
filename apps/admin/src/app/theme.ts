import { legacyColors, legacyRadius } from '@prepio/shared';

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
};

/** Bootstrap CSS-variable overrides generated from the shared design tokens. */
export const themeVariablesCss = `:root{
--bs-primary:${legacyColors.bordeaux};--bs-primary-rgb:${hexToRgb(legacyColors.bordeaux)};
--bs-success:${legacyColors.success};--bs-success-rgb:${hexToRgb(legacyColors.success)};
--bs-danger:${legacyColors.error};--bs-danger-rgb:${hexToRgb(legacyColors.error)};
--bs-warning:${legacyColors.gold};--bs-warning-rgb:${hexToRgb(legacyColors.gold)};
--bs-body-bg:${legacyColors.parchment};--bs-body-bg-rgb:${hexToRgb(legacyColors.parchment)};
--bs-body-color:${legacyColors.ink};--bs-body-color-rgb:${hexToRgb(legacyColors.ink)};
--bs-secondary-color:${legacyColors.inkMuted};--bs-secondary-bg:${legacyColors.paper};
--bs-tertiary-bg:${legacyColors.paper};
--bs-border-color:${legacyColors.border};
--bs-link-color:${legacyColors.bordeaux};--bs-link-color-rgb:${hexToRgb(legacyColors.bordeaux)};
--bs-link-hover-color:${legacyColors.ink};--bs-link-hover-color-rgb:${hexToRgb(legacyColors.ink)};
--bs-border-radius:${legacyRadius}px;--bs-border-radius-lg:${legacyRadius}px;
--bs-body-font-size:1rem;--bs-body-line-height:1.5;
--prepio-gold:${legacyColors.gold};--prepio-paper:${legacyColors.paper};--prepio-bordeaux:${legacyColors.bordeaux};--prepio-parchment:${legacyColors.parchment};
}`;
