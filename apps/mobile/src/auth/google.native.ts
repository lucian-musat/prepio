import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { getSupabase, withTimeout } from '../lib/supabase';
import { GOOGLE_SIGN_IN_ERROR, type GoogleSignInResult } from './googleCommon';

export { GOOGLE_SIGN_IN_ERROR } from './googleCommon';
export type { GoogleSignInResult } from './googleCommon';

let configured = false;

/** The WEB client id: Google issues the id token for it, which is what Supabase verifies. */
function configure() {
  if (configured) return;
  GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID });
  configured = true;
}

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  try {
    configure();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (isCancelledResponse(response)) return 'cancelled';
    const idToken = response.data.idToken;
    if (!idToken) throw new Error('Google returned no id token (is EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID set?)');
    const { error } = await withTimeout(getSupabase().auth.signInWithIdToken({ provider: 'google', token: idToken }));
    if (error) throw error;
    return 'ok';
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) return 'cancelled';
    console.warn('[google] sign-in failed:', e);
    throw new Error(GOOGLE_SIGN_IN_ERROR);
  }
}

export async function signOutGoogle(): Promise<void> {
  try {
    configure();
    await GoogleSignin.signOut();
  } catch (e) {
    console.warn('[google] sign-out failed:', e);
  }
}
