import type { SupabaseClient } from '@supabase/supabase-js';
import { MAX_ESSAY_CHARS, type EvaluateError, type EvaluateErrorCode, type EvaluateResponse } from '@prepio/shared';
import { isUuid } from '@/lib/data/db';
import type { Evaluator } from './openai';
import { buildEvaluationInput, evaluationSchema } from './prompt';
import {
  GLOBAL_RATE_KEY, GLOBAL_RATE_LIMIT, GLOBAL_RATE_WINDOW_SECONDS, USER_RATE_LIMIT, USER_RATE_WINDOW_SECONDS, type RateLimit,
} from './rateLimit';

export type Deps = { db: SupabaseClient; evaluate: Evaluator; rateLimit: RateLimit };

const GLOBAL_LIMIT_MESSAGE = 'Serviciul de evaluare este foarte solicitat azi. Încearcă din nou mâine.';
export type HandlerResult = { status: number; json: EvaluateResponse | EvaluateError };

const ERRORS: Record<EvaluateErrorCode, { status: number; message: string }> = {
  bad_request: { status: 400, message: 'Cererea nu este validă.' },
  unauthorized: { status: 401, message: 'Trebuie să fii autentificat.' },
  empty: { status: 400, message: 'Scrie un text înainte de a-l trimite.' },
  too_long: { status: 400, message: `Textul depășește ${MAX_ESSAY_CHARS} de caractere.` },
  not_found: { status: 404, message: 'Exercițiul nu a fost găsit.' },
  rate_limited: { status: 429, message: 'Ai atins limita de evaluări pentru moment. Încearcă din nou peste o oră.' },
  ai_failed: { status: 502, message: 'Evaluarea nu a reușit. Încearcă din nou.' },
};

export function errorResult(code: EvaluateErrorCode): HandlerResult {
  const { status, message } = ERRORS[code];
  return { status, json: { error: code, message } };
}

type ExerciseRow = { prompt: string; criteria: string; lessons: { status: string } | { status: string }[] | null };
type SettingsRow = { rules: string; grade_min: number; grade_max: number; model: string };

/** `userId` is the authenticated caller (verified by the route); quotas are per user. */
export async function handleEvaluate(body: unknown, userId: string, deps: Deps): Promise<HandlerResult> {
  if (typeof body !== 'object' || body === null) return errorResult('bad_request');
  const { exerciseId, text } = body as Record<string, unknown>;
  if (typeof exerciseId !== 'string' || typeof text !== 'string') return errorResult('bad_request');
  if (text.trim().length === 0) return errorResult('empty');
  if ([...text].length > MAX_ESSAY_CHARS) return errorResult('too_long');
  if (!isUuid(exerciseId)) return errorResult('not_found');

  try {
    const { data: ex, error: exErr } = await deps.db
      .from('writing_exercises')
      .select('prompt, criteria, lessons(status)')
      .eq('id', exerciseId)
      .maybeSingle();
    if (exErr) throw new Error(`exercise lookup failed: ${exErr.message}`);
    const row = ex as ExerciseRow | null;
    const lesson = Array.isArray(row?.lessons) ? row.lessons[0] : row?.lessons;
    if (!row || lesson?.status !== 'published') return errorResult('not_found');

    const { data: st, error: stErr } = await deps.db
      .from('ai_settings')
      .select('rules, grade_min, grade_max, model')
      .eq('id', 1)
      .single();
    if (stErr || !st) throw new Error(`settings lookup failed: ${stErr?.message ?? 'no row'}`);
    const settings = st as SettingsRow;

    const userKey = `evaluate:user:${userId}`;
    if (!(await deps.rateLimit(userKey, USER_RATE_LIMIT, USER_RATE_WINDOW_SECONDS))) return errorResult('rate_limited');
    if (!(await deps.rateLimit(GLOBAL_RATE_KEY, GLOBAL_RATE_LIMIT, GLOBAL_RATE_WINDOW_SECONDS))) {
      return { status: 429, json: { error: 'rate_limited', message: GLOBAL_LIMIT_MESSAGE } };
    }

    const { instructions, input } = buildEvaluationInput({
      rules: settings.rules,
      gradeMin: settings.grade_min,
      gradeMax: settings.grade_max,
      exercise: { prompt: row.prompt, criteria: row.criteria },
      text,
    });
    const raw = await deps.evaluate({ model: settings.model, instructions, input });
    const parsed = evaluationSchema.safeParse(raw);
    if (!parsed.success) throw new Error('model output failed validation');

    const grade = Math.min(settings.grade_max, Math.max(settings.grade_min, Math.round(parsed.data.grade)));
    return {
      status: 200,
      json: {
        grade,
        gradeMin: settings.grade_min,
        gradeMax: settings.grade_max,
        summary: parsed.data.summary,
        suggestions: parsed.data.suggestions,
      },
    };
  } catch (e) {
    console.error('[evaluate] failed:', e);
    return errorResult('ai_failed');
  }
}
