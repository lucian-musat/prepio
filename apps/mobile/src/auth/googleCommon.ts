import { t } from '../texts/store';

/** Shown when Google sign-in fails for any reason other than the student cancelling it. */
export const googleSignInError = (): string => t('errors.auth.googleFailed');

/** `cancelled`: the student closed the Google picker; not an error, show nothing. */
export type GoogleSignInResult = 'ok' | 'cancelled';
