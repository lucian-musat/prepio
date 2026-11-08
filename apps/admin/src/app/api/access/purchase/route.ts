import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateBearer } from '@/lib/auth/bearer';
import { allowedOrigins, corsHeaders } from '@/lib/evaluate/cors';
import { handleAccessPurchase, purchaseError } from '@/lib/access/purchase';

export const dynamic = 'force-dynamic';

function reply(status: number, json: unknown, request: Request) {
  return Response.json(json, {
    status,
    headers: { ...corsHeaders(request.headers.get('origin'), allowedOrigins()), 'Cache-Control': 'no-store' },
  });
}

function isJson(request: Request): boolean {
  const type = request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  return type === 'application/json';
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('origin'), allowedOrigins()) });
}

export async function POST(request: Request) {
  // Only our student web origins may call cross-origin; requests without Origin (native app) are allowed.
  const origin = request.headers.get('origin');
  if (origin && !allowedOrigins().includes(origin)) {
    return reply(403, { error: 'bad_request', message: 'Cerere nepermisă.' }, request);
  }
  // Rejects "simple" cross-site form/text posts that skip the CORS preflight.
  if (!isJson(request)) {
    return reply(415, { error: 'bad_request', message: 'Cerere invalidă.' }, request);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const r = purchaseError('bad_request');
    return reply(r.status, r.json, request);
  }

  try {
    const db = createAdminClient();
    const auth = await authenticateBearer(request, db);
    if (!auth) {
      const r = purchaseError('unauthorized');
      return reply(r.status, r.json, request);
    }
    const r = await handleAccessPurchase(body, auth.userId, db);
    return reply(r.status, r.json, request);
  } catch (e) {
    console.error('[access/purchase] unexpected failure:', e);
    const r = purchaseError('server_error');
    return reply(r.status, r.json, request);
  }
}
