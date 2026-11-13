import type { TextEntry } from './types';
import { commonTexts } from './groups/common';
import { errorsTexts } from './groups/errors';
import { homeTexts } from './groups/home';
import { metaTexts } from './groups/meta';
import { suspendedTexts } from './groups/suspended';

export const TEXTS = {
  ...commonTexts,
  ...errorsTexts,
  ...homeTexts,
  ...metaTexts,
  ...suspendedTexts,
}as const satisfies Record<string, TextEntry>;

export type TextKey = keyof typeof TEXTS;

export function isTextKey(k: string): k is TextKey {
  return Object.prototype.hasOwnProperty.call(TEXTS, k);
}
