import { isAuthSessionMissingError, type AuthError, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase Auth error codes that mean the token itself is no good (malformed/expired JWT, user deleted, session
 * revoked or expired). auth-js maps `session_not_found` to AuthSessionMissingError, but keep the code too.
 */
const TOKEN_REJECTED_CODES = new Set(['bad_jwt', 'session_not_found', 'user_not_found', 'session_expired']);

/**
 * Only a token/session/user error code counts as a rejection. A bare 401/403 is not enough: a wrong or rotated
 * service-role key answers 401 "Invalid API key" with no such code, and that is our outage, not the student's.
 */
const tokenRejected = (error: AuthError) =>
  isAuthSessionMissingError(error) || (typeof error.code === 'string' && TOKEN_REJECTED_CODES.has(error.code));

/**
 * Verifies the `Authorization: Bearer <jwt>` header with Supabase Auth.
 * Returns the signed-in user's id, or null when the header is missing/malformed or Supabase says the token is
 * invalid. Any other failure (network, 5xx, bad server key, thrown) is an auth outage, not a logout: it throws so
 * the caller answers 5xx and the client keeps its session.
 */
export async function authenticateBearer(request: Request, db: SupabaseClient): Promise<{ userId: string } | null> {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(request.headers.get('authorization') ?? '');
  if (!match) return null;
  const { data, error } = await db.auth.getUser(match[1]);
  if (error) {
    if (tokenRejected(error)) return null;
    throw new Error(
      `Supabase Auth getUser failed (status ${error.status ?? 'unknown'}, code ${error.code ?? 'none'}): ${error.message}`,
    );
  }
  if (!data.user) return null;
  return { userId: data.user.id };
}
