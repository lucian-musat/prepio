import type { TextEntry } from './types';
import { authTexts } from './groups/auth';
import { commonTexts } from './groups/common';
import { errorsTexts } from './groups/errors';
import { homeTexts } from './groups/home';
import { metaTexts } from './groups/meta';
import { onboardingTexts } from './groups/onboarding';
import { suspendedTexts } from './groups/suspended';

export const TEXTS = {
  ...authTexts,
  ...commonTexts,
  ...errorsTexts,
  ...homeTexts,
  ...metaTexts,
  ...onboardingTexts,
  ...suspendedTexts,
}as const satisfies Record<string, TextEntry>;

export type TextKey = keyof typeof TEXTS;

export function isTextKey(k: string): k is TextKey {
  return Object.prototype.hasOwnProperty.call(TEXTS, k);
}
