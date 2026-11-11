import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase } from './supabase';
import { TERMS_VERSION } from './legal';

/**
 * The 16+/terms consent ticked on Welcome, kept on this device with the time it was given (valid 15 minutes) until
 * the sign-in it was given for records it (`accept_terms`), that sign-in is cancelled or fails, or sign-out.
 * AsyncStorage is localStorage on the web, like the Supabase session, so the consent survives the OAuth redirect.
 */
export const TERMS_CONSENT_KEY = 'prepio.termsConsent';

/**
 * How long a consent ticked on Welcome stays valid: long enough for a sign-in (OAuth redirect, email code), short
 * enough that a consent left behind (a cancelled or failed sign-in) can't be recorded on a later, other account.
 */
export const CONSENT_TTL_MS = 15 * 60_000;

type Stored = { version: string; at: number };

function parse(raw: string): Stored | null {
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== 'object') return null;
    const { version, at } = v as Record<string, unknown>;
    return typeof version === 'string' && typeof at === 'number' && Number.isFinite(at) ? { version, at } : null;
  } catch {
    return null;
  }
}

/**
 * The terms version this device consented to in the last {@link CONSENT_TTL_MS}, or null (nothing stored, the
 * storage is unavailable, or the value is stale or malformed, which is then removed).
 */
export async function getStoredConsent(): Promise<string | null> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(TERMS_CONSENT_KEY);
  } catch {
    return null;
  }
  if (raw == null) return null;
  const stored = parse(raw);
  const age = stored ? Date.now() - stored.at : NaN;
  if (!stored || !(age >= 0 && age <= CONSENT_TTL_MS)) {
    await clearConsent();
    return null;
  }
  return stored.version;
}

/** Best-effort: without storage the student simply sees the gate after signing in. */
export async function storeConsent(version: string): Promise<void> {
  try {
    const value: Stored = { version, at: Date.now() };
    await AsyncStorage.setItem(TERMS_CONSENT_KEY, JSON.stringify(value));
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
