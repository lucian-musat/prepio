import type { TextEntry } from './types';
import { authTexts } from './groups/auth';
import { cardsTexts } from './groups/cards';
import { commonTexts } from './groups/common';
import { errorsTexts } from './groups/errors';
import { homeTexts } from './groups/home';
import { lessonTexts } from './groups/lesson';
import { metaTexts } from './groups/meta';
import { onboardingTexts } from './groups/onboarding';
import { suspendedTexts } from './groups/suspended';

export const TEXTS = {
  ...authTexts,
  ...cardsTexts,
  ...commonTexts,
  ...errorsTexts,
  ...homeTexts,
  ...lessonTexts,
  ...metaTexts,
  ...onboardingTexts,
  ...suspendedTexts,
}as const satisfies Record<string, TextEntry>;

export type TextKey = keyof typeof TEXTS;

export function isTextKey(k: string): k is TextKey {
  return Object.prototype.hasOwnProperty.call(TEXTS, k);
}
