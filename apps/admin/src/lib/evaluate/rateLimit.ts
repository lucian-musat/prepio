import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Global spend guard: at most 300 evaluations per day across all callers. There is no per-student limit: every
 * check costs credits, which pace the student (owner decision, 2026-11-06).
 */
export const GLOBAL_RATE_KEY = 'evaluate:global';
export const GLOBAL_RATE_LIMIT = 300;
export const GLOBAL_RATE_WINDOW_SECONDS = 86400;

export type RateLimit = (key: string, limit: number, windowSeconds: number) => Promise<boolean>;

/** Returns a function that consumes one unit of quota for `key`; false when the limit is reached. */
export function createRateLimit(db: SupabaseClient): RateLimit {
  return async (key, limit, windowSeconds) => {
    const { data, error } = await db.rpc('consume_rate_limit', {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) throw new Error(`consume_rate_limit failed: ${error.message}`);
    return data === true;
  };
}
