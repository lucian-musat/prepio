import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;

/** Lazily-created anon client (reads published content only; RLS enforces it). */
export function getSupabase(): SupabaseClient {
  if (!client) {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY');
    }
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

/**
 * Base URL of the admin API (essay evaluation). No fallback: a build without EXPO_PUBLIC_API_URL must fail loudly
 * instead of silently calling localhost. Local dev sets it in apps/mobile/.env.
 */
export const apiUrl = (): string | undefined => process.env.EXPO_PUBLIC_API_URL || undefined;