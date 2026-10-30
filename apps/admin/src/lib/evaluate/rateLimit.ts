import type { SupabaseClient } from '@supabase/supabase-js';

export const RATE_LIMIT = 10;
export const RATE_WINDOW_SECONDS = 3600;

/** Returns a function that consumes one unit of quota for `key`; false when the limit is reached. */
export function createRateLimit(db: SupabaseClient) {
  return async (key: string): Promise<boolean> => {
    const { data, error } = await db.rpc('consume_rate_limit', {
      p_key: key,
      p_limit: RATE_LIMIT,
      p_window_seconds: RATE_WINDOW_SECONDS,
    });
    if (error) throw new Error(`consume_rate_limit failed: ${error.message}`);
    return data === true;
  };
}
