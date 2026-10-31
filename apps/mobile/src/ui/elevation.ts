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
