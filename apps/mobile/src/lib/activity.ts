import { getSupabase } from './supabase';

/**
 * Activity events for the admin timeline. Best-effort: they never block or break the app, so every failure is
 * only logged and the call resolves `false` (`true` when the server recorded it).
 */
async function call(fn: string, args?: Record<string, unknown>): Promise<boolean> {
  try {
    const { error } = args ? await getSupabase().rpc(fn, args) : await getSupabase().rpc(fn);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn(`[activity] ${fn} failed:`, e);
    return false;
  }
}

/** The student opened the app (the server keeps at most one per Bucharest day). */
export const logAppOpen = () => call('log_app_open');

/** A guided-mode test attempt failed on this lesson. */
export const logTestFailed = (lessonId: string) => call('log_test_failed', { p_lesson: lessonId });

/** Today's local date (YYYY-MM-DD), used to send the app-opened event at most once a day from this device. */
export function localDay(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
