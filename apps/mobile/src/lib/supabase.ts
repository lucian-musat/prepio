import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

let client: SupabaseClient | undefined;

/**
 * Lazily-created client with the student's persisted session (RLS lets signed-in students read published content).
 * Native keeps the session in AsyncStorage; web uses Supabase's default (localStorage) and picks up the OAuth
 * redirect from the URL.
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
      },
    });
  }
  return client;
}

/** The current access token, read at call time (so a refreshed token is always used), or null when signed out. */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await getSupabase().auth.getSession();
  return data.session?.access_token ?? null;
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
