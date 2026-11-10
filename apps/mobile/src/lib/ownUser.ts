import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The signed-in user's id, for queries on per-student tables that admins can read in full (RLS lets an admin see every
 * student's rows for the admin pages). Filtering on it keeps an admin's own app showing only their own data.
 */
export async function ownUserId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  const id = data.session?.user.id;
  if (!id) throw new Error('Not signed in');
  return id;
}
