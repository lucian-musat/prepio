import { getSupabase } from '../lib/supabase';
import { GOOGLE_SIGN_IN_ERROR, type GoogleSignInResult } from './googleCommon';

export { GOOGLE_SIGN_IN_ERROR } from './googleCommon';
export type { GoogleSignInResult } from './googleCommon';

/** Redirects to Google; on return Supabase (`detectSessionInUrl`) stores the session and emits SIGNED_IN. */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  try {
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  } catch (e) {
    console.warn('[google] sign-in could not start:', e);
    throw new Error(GOOGLE_SIGN_IN_ERROR);
  }
  return 'ok';
}

/** Nothing to forget on web: the Google session belongs to the browser, not to the app. */
export async function signOutGoogle(): Promise<void> {}
