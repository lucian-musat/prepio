import type { AccountDeleteError } from '@prepio/shared';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteAccount } from '@/lib/account/deleteAccount';
import { authenticateBearer } from '@/lib/auth/bearer';
import { allowedOrigins, corsHeaders } from '@/lib/evaluate/cors';

export const dynamic = 'force-dynamic';

function headers(request: Request): Record<string, string> {
  return { ...corsHeaders(request.headers.get('origin'), allowedOrigins()), 'Cache-Control': 'no-store' };
}

function reply(status: number, json: AccountDeleteError, request: Request) {
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
    return reply(403, { error: 'bad_request', message: 'Cerere nepermisă.' }, request);
  }

  try {
    const db = createAdminClient();
    const auth = await authenticateBearer(request, db);
    if (!auth) return reply(401, { error: 'unauthorized', message: 'Trebuie să fii autentificat.' }, request);

    const result = await deleteAccount(auth.userId, db);
    if (result === 'forbidden_admin') {
      return reply(403, { error: 'forbidden', message: 'Contul de administrator nu poate fi șters de aici.' }, request);
    }
    return new Response(null, { status: 204, headers: headers(request) });
  } catch (e) {
    console.error('[account/delete] unexpected failure:', e);
    return reply(500, { error: 'server_error', message: 'Contul nu a putut fi șters. Încearcă din nou.' }, request);
  }
}
