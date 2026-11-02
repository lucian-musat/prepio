/** Shown when Google sign-in fails for any reason other than the student cancelling it. */
export const GOOGLE_SIGN_IN_ERROR = 'Autentificarea cu Google nu a reușit. Încearcă din nou.';

/** `cancelled`: the student closed the Google picker; not an error, show nothing. */
export type GoogleSignInResult = 'ok' | 'cancelled';
