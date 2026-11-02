// Type declarations only: the bundler picks google.web.ts (web) or google.native.ts (Android) at runtime.
import type { GoogleSignInResult } from './googleCommon';

export type { GoogleSignInResult } from './googleCommon';
export { GOOGLE_SIGN_IN_ERROR } from './googleCommon';

/**
 * Signs the student in with Google. Web: redirects to Google through Supabase OAuth (the page navigates away and
 * Supabase picks the session up from the URL on return). Android: native account picker, then the id token is
 * exchanged with Supabase. Resolves `cancelled` when the student closes the picker; throws an Error with
 * GOOGLE_SIGN_IN_ERROR on any other failure.
 */
export declare function signInWithGoogle(): Promise<GoogleSignInResult>;

/** Forgets the Google account on this device (native only, so the next sign-in shows the picker). Never throws. */
export declare function signOutGoogle(): Promise<void>;
