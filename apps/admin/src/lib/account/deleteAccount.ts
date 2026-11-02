import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Deletes a student's auth user (their profile and data go with it via `on delete cascade`).
 * Admin accounts are refused. `db` must be the service-role client. Throws on database/auth errors.
 */
export async function deleteAccount(userId: string, db: SupabaseClient): Promise<'deleted' | 'forbidden_admin'> {
  const { data, error } = await db.from('admins').select('user_id').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(`admins lookup failed: ${error.message}`);
  if (data) return 'forbidden_admin';

  const { error: delErr } = await db.auth.admin.deleteUser(userId);
  if (delErr) throw new Error(`deleteUser failed: ${delErr.message}`);
  return 'deleted';
}
