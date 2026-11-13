import { parseStreak, type StreakSummary } from '@prepio/shared';
import { getSupabase, withTimeout } from './supabase';

const RPC_TIMEOUT_MS = 10_000;

/**
 * The daily streak. Best-effort like `activity.ts`: a failure is only logged and the call resolves `null`
 * (also when the server reply is not a streak summary).
 */
async function call(fn: 'my_streak' | 'mark_active_today'): Promise<StreakSummary | null> {
  try {
    const { data, error } = await withTimeout(Promise.resolve(getSupabase().rpc(fn)), RPC_TIMEOUT_MS);
    if (error) throw error;
    return parseStreak(data);
  } catch (e) {
    console.warn(`[streak] ${fn} failed:`, e);
    return null;
  }
}

/** The student's streak as the server sees it now. */
export const fetchStreak = () => call('my_streak');

/** Records today (Bucharest) as an active day; idempotent on the server. Returns the updated streak. */
export const markActiveToday = () => call('mark_active_today');
