import type { AccountDeleteError } from '@prepio/shared';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteAccount } from '@/lib/account/deleteAccount';
import { accountDeleteError } from '@/lib/account/errors';
import { authenticateBearer } from '@/lib/auth/bearer';
import { allowedOrigins, corsHeaders } from '@/lib/evaluate/cors';
import { captureError } from '@/lib/sentry';

export const dynamic = 'force-dynamic';

function headers(request: Request): Record<string, string> {
  return { ...corsHeaders(request.headers.get('origin'), allowedOrigins()), 'Cache-Control': 'no-store' };
}

function reply({ status, json }: { status: number; json: AccountDeleteError }, request: Request) {
  return Response.json(json, { status, headers: headers(request) });
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('origin'), allowedOrigins()) });
}

/** Deletes the signed-in student's account. No body; the caller is identified by its bearer token. */
export async function POST(request: Request) {
  // Same Origin rule as /api/evaluate: browsers must come from a student web origin; no Origin = native app.
  const origin = request.headers.get('origin');
  if (origin && !allowedOrigins().includes(origin)) {
    return reply(accountDeleteError('bad_request'), request);
  }

  try {
    const db = createAdminClient();
    const auth = await authenticateBearer(request, db);
    if (!auth) return reply(accountDeleteError('unauthorized'), request);

    const result = await deleteAccount(auth.userId, db);
    if (result === 'forbidden_admin') {
      return reply(accountDeleteError('forbidden'), request);
    }
    return new Response(null, { status: 204, headers: headers(request) });
  } catch (e) {
    console.error('[account/delete] unexpected failure:', e);
    captureError(e, { route: 'account/delete' });
    return reply(accountDeleteError('server_error'), request);
  }
}
