import type { SupabaseClient } from '@supabase/supabase-js';
import { UserError } from '@/lib/data/db';

/**
 * Deletes a student's auth user (their profile and data go with it via `on delete cascade`).
 * Admin accounts are refused. `db` must be the service-role client. Throws on database/auth errors.
 *
 * Before deleting, the email is blocked from re-registering (`block_student_email`) when `opts.blockReason` is given
 * (that reason) or when the student is suspended (the suspension reason). A blank `blockReason` is a UserError.
 */
export async function deleteAccount(
  userId: string,
  db: SupabaseClient,
  opts?: { blockReason?: string },
): Promise<'deleted' | 'forbidden_admin'> {
  if (opts?.blockReason !== undefined && opts.blockReason.trim() === '') throw new UserError('Motivul este obligatoriu.');

  const { data, error } = await db.from('admins').select('user_id').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(`admins lookup failed: ${error.message}`);
  if (data) return 'forbidden_admin';

  const profile = await db.from('profiles').select('suspended_at,suspended_reason').eq('id', userId).maybeSingle();
  if (profile.error) throw new Error(`profile lookup failed: ${profile.error.message}`);
  const p = profile.data as { suspended_at: string | null; suspended_reason: string | null } | null;
  const reason = opts?.blockReason ?? (p?.suspended_at != null ? p.suspended_reason : null);
  if (reason != null) {
    const { error: blockErr } = await db.rpc('block_student_email', { p_user: userId, p_reason: reason.trim() });
    if (blockErr) throw new Error(`block_student_email failed: ${blockErr.message}`);
  }

  const { error: delErr } = await db.auth.admin.deleteUser(userId);
  if (delErr) throw new Error(`deleteUser failed: ${delErr.message}`);
  return 'deleted';
}
