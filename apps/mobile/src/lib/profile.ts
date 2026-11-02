import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './supabase';

export type Profile = { id: string; displayName: string | null };

/** Same limit as the database check on `profiles.display_name` (trimmed, 1–60 characters). */
export const MAX_DISPLAY_NAME_CHARS = 60;

const EMPTY = 'Scrie-ți numele.';
const TOO_LONG = `Numele poate avea cel mult ${MAX_DISPLAY_NAME_CHARS} de caractere.`;
const SAVE_FAILED = 'Numele nu a putut fi salvat. Încearcă din nou.';

export function validateDisplayName(raw: string): { ok: true; value: string } | { ok: false; message: string } {
  const value = raw.trim();
  if (!value) return { ok: false, message: EMPTY };
  // Code points, like Postgres char_length (an emoji or a letter with diacritics counts once).
  if ([...value].length > MAX_DISPLAY_NAME_CHARS) return { ok: false, message: TOO_LONG };
  return { ok: true, value };
}

/** The student's own profile row, or null if it does not exist. */
export async function fetchProfile(userId: string, client: SupabaseClient = getSupabase()): Promise<Profile | null> {
  const { data, error } = await client.from('profiles').select('id,display_name').eq('id', userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id: data.id, displayName: data.display_name };
}

/** Validates and saves the trimmed name; throws with a Romanian message when invalid or not saved. */
export async function updateDisplayName(
  userId: string,
  name: string,
  client: SupabaseClient = getSupabase(),
): Promise<void> {
  const valid = validateDisplayName(name);
  if (!valid.ok) throw new Error(valid.message);
  const { data, error } = await client
    .from('profiles')
    .update({ display_name: valid.value })
    .eq('id', userId)
    .select('id');
  if (error) throw error;
  // RLS filters out rows the student may not touch without an error: no row means nothing was saved.
  if (!data?.length) throw new Error(SAVE_FAILED);
}
