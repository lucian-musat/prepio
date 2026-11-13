import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '../lib/supabase';
import { readTextCache, writeTextCache } from './cache';
import { applyOverrides } from './store';

/** How long the first opening (no cache) waits for the network before showing the defaults. */
export const TEXTS_BOOT_TIMEOUT_MS = 1500;

/** All admin overrides as `{ key: value }` (the table is readable without a session). */
export async function fetchTextOverrides(client: SupabaseClient = getSupabase()): Promise<Record<string, string>> {
  const { data, error } = await client.from('ui_texts').select('key,value');
  if (error) throw new Error(error.message);
  const rows: Record<string, string> = {};
  for (const row of (data ?? []) as { key: string; value: string }[]) rows[row.key] = row.value;
  return rows;
}

/**
 * Fills the text store once, before the first screen. With a device cache it uses the cache at once and refreshes
 * the cache in the background (for the next start). Without one it waits for the network up to `timeoutMs`, then
 * falls back to the defaults; a late answer still fills the cache. Never rejects.
 */
export async function bootTexts(
  opts: { timeoutMs?: number; client?: SupabaseClient } = {},
): Promise<'cache' | 'network' | 'defaults'> {
  const { timeoutMs = TEXTS_BOOT_TIMEOUT_MS, client } = opts;
  // Fetched and cached whatever happens next; a failure only means the cache stays as it is.
  const fetched = fetchTextOverrides(client).then(async (rows) => {
    await writeTextCache(rows);
    return rows;
  });
  fetched.catch(() => {});

  const cached = await readTextCache();
  if (cached) {
    applyOverrides(cached);
    return 'cache';
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    const rows = await Promise.race([fetched, timeout]);
    if (!rows) return 'defaults';
    applyOverrides(rows);
    return 'network';
  } catch {
    return 'defaults';
  } finally {
    clearTimeout(timer);
  }
}
