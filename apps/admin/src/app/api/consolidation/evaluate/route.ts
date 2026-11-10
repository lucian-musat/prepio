import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateBearer } from '@/lib/auth/bearer';
import { allowedOrigins, corsHeaders } from '@/lib/evaluate/cors';
import { errorResult, handleConsolidationEvaluate, type Deps } from '@/lib/consolidation/handler';
import { createOpenAIEvaluator } from '@/lib/evaluate/openai';
import { createRateLimit } from '@/lib/evaluate/rateLimit';
import { createCredits } from '@/lib/credits/credits';
import { captureFailure } from '@/lib/sentry';

export const dynamic = 'force-dynamic';
/** Vercel's default (10 s on Hobby) would kill the function before the 50 s OpenAI timeout. */
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
    const r = errorResult('bad_request');
    return reply(r.status, r.json, request);
  }

  try {
    const db = createAdminClient();
    const auth = await authenticateBearer(request, db);
    if (!auth) {
      const r = errorResult('unauthorized');
      return reply(r.status, r.json, request);
    }
    const apiKey = process.env.OPENAI_API_KEY;
    const deps: Deps = {
      db,
      rateLimit: createRateLimit(db),
      credits: createCredits(db),
      evaluate: apiKey
        ? createOpenAIEvaluator(apiKey)
        : async () => {
            throw new Error('OPENAI_API_KEY is not configured');
          },
    };
    const r = await handleConsolidationEvaluate(body, auth.userId, deps);
    return reply(r.status, r.json, request);
  } catch (e) {
    console.error('[consolidation/evaluate] unexpected failure:', e);
    const r = errorResult('ai_failed');
    // Sanitized: the error's message can quote model output about the student's answer.
    captureFailure('consolidation/evaluate', 'unhandled', e, r.status);
    return reply(r.status, r.json, request);
  }
}
