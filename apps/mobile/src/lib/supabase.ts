import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

let client: SupabaseClient | undefined;

/**
 * Lazily-created client with the student's persisted session (RLS lets signed-in students read published content).
 * Native keeps the session in AsyncStorage; web uses Supabase's default (localStorage) and picks up the OAuth
 * redirect (PKCE `?code=`) from the URL.
 */
export function getSupabase(): SupabaseClient {
  if (!client) {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY');
    }
    client = createClient(url, key, {
      auth: {
        storage: Platform.OS === 'web' ? undefined : AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: Platform.OS === 'web',
        // Web Google sign-in returns with `?code=`; auth-js keeps the code verifier in the same storage
        // (localStorage on web) and exchanges it on load. Native Google (signInWithIdToken) and email OTP
        // (verifyOtp) don't use the redirect, so PKCE changes nothing there.
        flowType: 'pkce',
      },
    });
  }
  return client;
}

/** Upper bound for an auth/profile network call the app waits on (splash, API token): a stalled network is an outage. */
export const AUTH_TIMEOUT_MS = 6_000;

/** The session could not be checked or refreshed (offline, timeout, Supabase down). It is NOT a logout. */
export class AuthOutageError extends Error {
  constructor(message = 'Supabase Auth is unreachable') {
    super(message);
    this.name = 'AuthOutageError';
  }
}

/** Rejects with AuthOutageError when `promise` takes longer than `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms = AUTH_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new AuthOutageError(`timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const REJECTED_STATUS = new Set([400, 401, 403, 404]);

/**
 * True when Supabase says the session/token is no good (user deleted, session revoked, refresh token invalid);
 * auth-js reports a revoked session as AuthSessionMissingError (status 400). Anything else — network failure
 * (AuthRetryableFetchError, status 0/5xx), rate limit, unknown — is an outage and the stored session is kept.
 */
export function isAuthRejection(error: { name?: string; status?: number }): boolean {
  return error.name === 'AuthSessionMissingError' || (typeof error.status === 'number' && REJECTED_STATUS.has(error.status));
}

/**
 * The current access token, read at call time (so a refreshed token is always used), or null when there is no
 * session. Throws AuthOutageError when the stored token is expired and cannot be refreshed right now (offline):
 * auth-js then returns no session but keeps it in storage, so callers must not sign out.
 */
export async function getAccessToken(): Promise<string | null> {
  const { data, error } = await withTimeout(getSupabase().auth.getSession());
  if (data.session) return data.session.access_token;
  if (error && !isAuthRejection(error)) throw new AuthOutageError(error.message);
  return null;
}

/**
 * Signs out on this device. Supabase removes the stored session even when the server call fails (offline, token
 * already invalid) and emits SIGNED_OUT, which the AuthProvider turns into `signedOut`. Never throws.
 */
export async function signOut(): Promise<void> {
  try {
    await getSupabase().auth.signOut({ scope: 'local' });
  } catch (e) {
    console.warn('[signOut] failed:', e);
  }
}

/**
 * Base URL of the admin API (essay evaluation, account deletion). No fallback: a build without EXPO_PUBLIC_API_URL
 * must fail loudly instead of silently calling localhost. Local dev sets it in apps/mobile/.env.
 */
export const apiUrl = (): string | undefined => process.env.EXPO_PUBLIC_API_URL || undefined;
