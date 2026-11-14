import type { TextEntry } from './types';
import { formatText } from './format';
import { authTexts } from './groups/auth';
import { bacTexts } from './groups/bac';
import { cardsTexts } from './groups/cards';
import { commonTexts } from './groups/common';
import { consolidationTexts } from './groups/consolidation';
import { errorsTexts } from './groups/errors';
import { homeTexts } from './groups/home';
import { lessonTexts } from './groups/lesson';
import { metaTexts } from './groups/meta';
import { onboardingTexts } from './groups/onboarding';
import { suspendedTexts } from './groups/suspended';

export const TEXTS = {
  ...authTexts,
  ...bacTexts,
  ...cardsTexts,
  ...commonTexts,
  ...consolidationTexts,
  ...errorsTexts,
  ...homeTexts,
  ...lessonTexts,
  ...metaTexts,
  ...onboardingTexts,
  ...suspendedTexts,
}as const satisfies Record<string, TextEntry>;

export type TextKey = keyof typeof TEXTS;

/** A text lookup: the app passes its `t` (overrides applied); shared code defaults to `defaultText`. */
export type TextFn = (key: TextKey, vars?: Record<string, string | number>) => string;

/** The catalog default of `key`, with its variables filled in (shared code has no override store). */
export const defaultText: TextFn = (key, vars) => formatText(TEXTS[key].default, vars);

export function isTextKey(k: string): k is TextKey {
  return Object.prototype.hasOwnProperty.call(TEXTS, k);
}
