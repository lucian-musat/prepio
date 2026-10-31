import { elevation } from '@prepio/shared';

const { raised } = elevation;

/**
 * Soft edge shadow for the fixed bars when content scrolls under them, as a CSS-style boxShadow
 * (supported by react-native-web and the RN new architecture). 'up' casts above (action bar),
 * 'down' casts below (top bar).
 */
export function raisedShadow(direction: 'up' | 'down'): string {
  const y = direction === 'up' ? raised.offsetY : -raised.offsetY;
  return `0px ${y}px ${raised.blur}px ${raised.spread}px rgba(0, 0, 0, ${raised.opacity})`;
}

/** Solid offset "shadow" under an element (prototype B `0 Npx 0 colour`). */
export function solidShadow(offsetY: number, shade: string): string {
  return `0px ${offsetY}px 0px ${shade}`;
}

/** A #RRGGBB token colour at the given opacity, as rgba() (CSS color-mix with transparent). */
export function withAlpha(hex: string, alpha: number): string {
  const channel = (i: number) => parseInt(hex.slice(i, i + 2), 16);
  return `rgba(${channel(1)}, ${channel(3)}, ${channel(5)}, ${alpha})`;
}
