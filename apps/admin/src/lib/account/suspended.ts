import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Whether the student is suspended. `db` is the service-role client: the student APIs enforce suspension themselves.
 * A missing profile is not suspended. Throws on database errors.
 */
export async function isSuspended(db: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await db.from('profiles').select('suspended_at').eq('id', userId).maybeSingle();
  if (error) throw new Error(`suspension lookup failed: ${error.message}`);
  return (data as { suspended_at: string | null } | null)?.suspended_at != null;
}
