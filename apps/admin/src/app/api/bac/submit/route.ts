import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateBearer } from '@/lib/auth/bearer';
import { allowedOrigins, corsHeaders } from '@/lib/evaluate/cors';
import { bacError, handleBacSubmit, type BacDeps } from '@/lib/bac/handler';
import { createOpenAIGrader } from '@/lib/evaluate/openai';
import { createRateLimit } from '@/lib/evaluate/rateLimit';
import { createCredits } from '@/lib/credits/credits';

export const dynamic = 'force-dynamic';
/** The paper's grading calls run in parallel with a 40 s timeout each; Vercel's default would kill the function first. */
export const maxDuration = 60;

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
  // Browsers always send Origin on cross-origin POSTs; only our student web origins may call us.
  // Requests without Origin (the native app) are allowed.
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
    const r = bacError('bad_request');
    return reply(r.status, r.json, request);
  }

  try {
    const db = createAdminClient();
    const auth = await authenticateBearer(request, db);
    if (!auth) {
      const r = bacError('unauthorized');
      return reply(r.status, r.json, request);
    }
    const apiKey = process.env.OPENAI_API_KEY;
    const deps: BacDeps = {
      db,
      rateLimit: createRateLimit(db),
      credits: createCredits(db),
      grade: apiKey
        ? createOpenAIGrader(apiKey)
        : async () => {
            throw new Error('OPENAI_API_KEY is not configured');
          },
    };
    const r = await handleBacSubmit(body, auth.userId, deps);
    return reply(r.status, r.json, request);
  } catch (e) {
    console.error('[bac/submit] unexpected failure:', e);
    const r = bacError('grading_failed');
    return reply(r.status, r.json, request);
  }
}
