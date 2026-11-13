import type { TextEntry } from './types';
import { commonTexts } from './groups/common';
import { homeTexts } from './groups/home';

export const TEXTS = {
  ...commonTexts,
  ...homeTexts,
} as const satisfies Record<string, TextEntry>;

export type TextKey = keyof typeof TEXTS;

export function isTextKey(k: string): k is TextKey {
  return Object.prototype.hasOwnProperty.call(TEXTS, k);
}
