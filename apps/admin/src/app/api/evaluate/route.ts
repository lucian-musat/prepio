import { createAdminClient } from '@/lib/supabase/admin';
import { allowedOrigins, corsHeaders } from '@/lib/evaluate/cors';
import { errorResult, handleEvaluate, type Deps } from '@/lib/evaluate/handler';
import { createOpenAIEvaluator } from '@/lib/evaluate/openai';
import { createRateLimit } from '@/lib/evaluate/rateLimit';

export const dynamic = 'force-dynamic';

function reply(status: number, json: unknown, request: Request) {
  return Response.json(json, {
    status,
    headers: { ...corsHeaders(request.headers.get('origin'), allowedOrigins()), 'Cache-Control': 'no-store' },
  });
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('origin'), allowedOrigins()) });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const r = errorResult('bad_request');
    return reply(r.status, r.json, request);
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const db = createAdminClient();
  const apiKey = process.env.OPENAI_API_KEY;
  const deps: Deps = {
    db,
    rateLimit: createRateLimit(db),
    evaluate: apiKey
      ? createOpenAIEvaluator(apiKey)
      : async () => {
          throw new Error('OPENAI_API_KEY is not configured');
        },
  };
  const r = await handleEvaluate(body, ip, deps);
  return reply(r.status, r.json, request);
}
