import type { TextEntry } from './types';
import { formatText } from './format';
import { accessTexts } from './groups/access';
import { authTexts } from './groups/auth';
import { bacTexts } from './groups/bac';
import { cardsTexts } from './groups/cards';
import { commonTexts } from './groups/common';
import { consolidationTexts } from './groups/consolidation';
import { creditsTexts } from './groups/credits';
import { errorsTexts } from './groups/errors';
import { homeTexts } from './groups/home';
import { inviteTexts } from './groups/invite';
import { lessonTexts } from './groups/lesson';
import { metaTexts } from './groups/meta';
import { notificationsTexts } from './groups/notifications';
import { onboardingTexts } from './groups/onboarding';
import { pagesTexts } from './groups/pages';
import { profileTexts } from './groups/profile';
import { streakTexts } from './groups/streak';
import { suspendedTexts } from './groups/suspended';

export const TEXTS = {
  ...accessTexts,
  ...authTexts,
  ...bacTexts,
  ...cardsTexts,
  ...commonTexts,
  ...consolidationTexts,
  ...creditsTexts,
  ...errorsTexts,
  ...homeTexts,
  ...inviteTexts,
  ...lessonTexts,
  ...metaTexts,
  ...notificationsTexts,
  ...onboardingTexts,
  ...pagesTexts,
  ...profileTexts,
  ...streakTexts,
  ...suspendedTexts,
} as const satisfies Record<string, TextEntry>;

export type TextKey = keyof typeof TEXTS;

/** A text lookup: the app passes its `t` (overrides applied); shared code defaults to `defaultText`. */
export type TextFn = (key: TextKey, vars?: Record<string, string | number>) => string;

/** The catalog default of `key`, with its variables filled in (shared code has no override store). */
export const defaultText: TextFn = (key, vars) => formatText(TEXTS[key].default, vars);

export function isTextKey(k: string): k is TextKey {
  return Object.prototype.hasOwnProperty.call(TEXTS, k);
}
