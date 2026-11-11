import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase } from './supabase';
import { TERMS_VERSION } from './legal';

/**
 * The 16+/terms consent ticked on Welcome, kept on this device until the sign-in it was given for has recorded it
 * (`accept_terms`), or until sign-out. AsyncStorage is localStorage on the web, like the Supabase session, so the
 * consent survives the web OAuth redirect.
 */
export const TERMS_CONSENT_KEY = 'prepio.termsConsent';

/** The terms version this device consented to, or null (nothing stored, or the storage is unavailable). */
export async function getStoredConsent(): Promise<string | null> {
  try {
    return (await AsyncStorage.getItem(TERMS_CONSENT_KEY)) ?? null;
  } catch {
    return null;
  }
}

/** Best-effort: without storage the student simply sees the gate after signing in. */
export async function storeConsent(version: string): Promise<void> {
  try {
    await AsyncStorage.setItem(TERMS_CONSENT_KEY, version);
  } catch {
    // Blocked / unavailable storage.
  }
}

export async function clearConsent(): Promise<void> {
  try {
    await AsyncStorage.removeItem(TERMS_CONSENT_KEY);
  } catch {
    // Blocked / unavailable storage.
  }
}

/**
 * Records the signed-in student's age confirmation and acceptance of the current terms. The server refuses any
 * version other than its own `current_terms_version()` (`terms_version_mismatch`). Throws on any error.
 */
export async function acceptTerms(): Promise<void> {
  const { error } = await getSupabase().rpc('accept_terms', { p_version: TERMS_VERSION });
  if (error) throw error;
}
