import type { TextStyle } from 'react-native';
import { typeScale } from '@prepio/shared';
import { fontFamily } from '../theme/fonts';

/** Text style for a typography role. Weight lives in the font family, so fontWeight stays default. */
export function type(role: keyof typeof typeScale): TextStyle {
  const r: { size: number; lineHeight: number; weight: keyof typeof fontFamily; letterSpacing?: number; uppercase?: boolean } = typeScale[role];
  return {
    fontFamily: fontFamily[r.weight],
    fontSize: r.size,
    lineHeight: r.lineHeight,
    letterSpacing: r.letterSpacing ?? 0,
    textTransform: r.uppercase ? 'uppercase' : 'none',
  };
}
