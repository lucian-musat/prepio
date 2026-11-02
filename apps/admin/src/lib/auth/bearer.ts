import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Verifies the `Authorization: Bearer <jwt>` header with Supabase Auth.
 * Returns the signed-in user's id, or null when the header is missing/malformed or the token is invalid.
 */
export async function authenticateBearer(request: Request, db: SupabaseClient): Promise<{ userId: string } | null> {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(request.headers.get('authorization') ?? '');
  if (!match) return null;
  try {
    const { data, error } = await db.auth.getUser(match[1]);
    if (error || !data.user) return null;
    return { userId: data.user.id };
  } catch {
    return null;
  }
}
