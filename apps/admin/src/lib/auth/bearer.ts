import { isAuthSessionMissingError, type AuthError, type SupabaseClient } from '@supabase/supabase-js';

/** Supabase Auth answers 401/403 when the token itself is bad (malformed, expired, user gone). */
const TOKEN_REJECTED = new Set([401, 403]);

/** A revoked session (403 `session_not_found`) reaches us as AuthSessionMissingError with status 400. */
const tokenRejected = (error: AuthError) =>
  isAuthSessionMissingError(error) || (typeof error.status === 'number' && TOKEN_REJECTED.has(error.status));

/**
 * Verifies the `Authorization: Bearer <jwt>` header with Supabase Auth.
 * Returns the signed-in user's id, or null when the header is missing/malformed or Supabase says the token is
 * invalid. Any other failure (network, 5xx, thrown) is an auth outage, not a logout: it throws so the caller
 * answers 5xx and the client keeps its session.
 */
export async function authenticateBearer(request: Request, db: SupabaseClient): Promise<{ userId: string } | null> {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(request.headers.get('authorization') ?? '');
  if (!match) return null;
  const { data, error } = await db.auth.getUser(match[1]);
  if (error) {
    if (tokenRejected(error)) return null;
    throw new Error(`Supabase Auth getUser failed (status ${error.status ?? 'unknown'}): ${error.message}`);
  }
  if (!data.user) return null;
  return { userId: data.user.id };
}
