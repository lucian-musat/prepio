import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AI_TYPES, MAX_ANSWER_CHARS, aiTemplateFromRow, aiTemplateTypeFor, checkCost, checkExercise, detectConnectors, exerciseFromRow,
  sourceFromRow, targetKey, tokenizeSource, validateExercise,
  type AiContext, type AiTemplate, type ConsolidationEvaluateError, type ConsolidationEvaluateErrorCode, type ConsolidationEvaluateRequest,
  type ConsolidationEvaluateResponse, type ConsolidationExercise, type ConsolidationRow, type ExerciseAnswer, type FeedbackItem,
  type Mark, type Source, type SourceRef,
} from '@prepio/shared';
import { isSuspended } from '@/lib/account/suspended';
import { aiFromJson, withTemplateLinks, type TemplateLinkRow } from '@/lib/data/consolidation';
import { isUuid } from '@/lib/data/db';
import type { Credits } from '@/lib/credits/credits';
import type { Evaluator } from '@/lib/evaluate/openai';
import {
  GLOBAL_RATE_KEY, GLOBAL_RATE_LIMIT, GLOBAL_RATE_WINDOW_SECONDS, type RateLimit,
} from '@/lib/evaluate/rateLimit';
import { buildConsolidationPrompt, expectedKeys, type Deterministic } from './prompt';
import { aiOutputSchema, normalizeAiOutput } from './schema';

export type Deps = { db: SupabaseClient; evaluate: Evaluator; rateLimit: RateLimit; credits: Credits };
export type HandlerResult = { status: number; json: ConsolidationEvaluateResponse | ConsolidationEvaluateError };

const ERRORS: Record<ConsolidationEvaluateErrorCode, { status: number; message: string }> = {
  bad_request: { status: 400, message: 'Cererea nu este validă.' },
  unauthorized: { status: 401, message: 'Trebuie să fii autentificat.' },
  empty: { status: 400, message: 'Scrie un text înainte de a-l trimite.' },
  too_long: { status: 400, message: `Textul depășește ${MAX_ANSWER_CHARS} de caractere.` },
  not_found: { status: 404, message: 'Exercițiul nu a fost găsit.' },
  rate_limited: { status: 429, message: 'Serviciul de evaluare este foarte solicitat azi. Încearcă din nou mâine.' },
  insufficient_credits: { status: 402, message: 'Nu ai destule credite pentru această verificare.' },
  ai_failed: { status: 502, message: 'Evaluarea nu a reușit. Încearcă din nou.' },
  suspended: { status: 403, message: 'Contul tău este suspendat.' },
  access_required: { status: 403, message: 'Lecția face parte din accesul complet.' },
};
/** `ai_failed` once the spent credits were given back. */
const REFUNDED_MESSAGE = 'Verificarea nu a reușit. Nu ți-am luat niciun credit. Încearcă din nou.';

export function errorResult(code: ConsolidationEvaluateErrorCode): HandlerResult {
  const { status, message } = ERRORS[code];
  return { status, json: { error: code, message } };
}

type Target = ConsolidationEvaluateRequest['target'];
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const isMark = (m: unknown): m is Mark =>
  isObj(m) && typeof m.sourceId === 'string' && Number.isInteger(m.from) && Number.isInteger(m.to);

/** Shape check only; whether the answer fits the stored exercise is checked after loading it. */
function parseRequest(body: unknown): { exerciseId: string; target: Target; answer: ExerciseAnswer } | null {
  if (!isObj(body) || typeof body.exerciseId !== 'string' || !isObj(body.answer)) return null;
  const t = body.target;
  let target: Target;
  if (t === 'exercise') target = t;
  else if (isObj(t) && typeof t.requirementId === 'string') target = { requirementId: t.requirementId };
  else return null;
  const a = body.answer;
  let answer: ExerciseAnswer;
  switch (a.type) {
    case 'facts':
      if (!isStrings(a.texts)) return null;
      answer = { type: 'facts', texts: a.texts };
      break;
    case 'comparison':
    case 'argument':
      if (typeof a.text !== 'string') return null;
      answer = { type: a.type, text: a.text };
      break;
    case 'viewpoint':
      if (typeof a.text !== 'string' || !Array.isArray(a.marks) || !a.marks.every(isMark)) return null;
      answer = { type: 'viewpoint', text: a.text, marks: a.marks.map((m) => ({ sourceId: m.sourceId, from: m.from, to: m.to })) };
      break;
    case 'essay':
      if (!isObj(a.parts) || !Object.values(a.parts).every((v) => typeof v === 'string')) return null;
      answer = { type: 'essay', parts: a.parts as Record<string, string> };
      break;
    default:
      // Any other type (incl. the non-AI ones) is answered with not_found once the exercise is loaded.
      if (typeof a.type !== 'string') return null;
      answer = { type: a.type } as unknown as ExerciseAnswer;
  }
  return { exerciseId: body.exerciseId, target, answer };
}

type LoadedRow = ConsolidationRow & { lesson_id: string; lessons: { status: string } | { status: string }[] | null };
type Loaded = {
  exercise: ConsolidationExercise; lessonId: string; sources: Source[]; context: AiContext; rules: string; model: string;
  /** The AI template of the request target; null when it is missing or any linked template has the wrong type. */
  template: AiTemplate | null;
};

const SOURCE_COLUMNS = 'id,position,title,author,work,body';
const AI_TEMPLATE_COLUMNS = 'id,title,type,criteria,keywords,response_format';

function ok<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what} failed: ${res.error.message}`);
  return res.data;
}

/** Null = not found or the lesson isn't published. Service-role reads: the context and templates never leave the server. */
async function load(db: SupabaseClient, id: string, target: Target): Promise<Loaded | null> {
  const row = ok(
    await db.from('consolidation_exercises').select('id,position,type,prompt,content,template_id,credit_cost,lesson_id,lessons(status)').eq('id', id).maybeSingle(),
    'exercise lookup',
  ) as unknown as LoadedRow | null;
  const lesson = Array.isArray(row?.lessons) ? row.lessons[0] : row?.lessons;
  if (!row || lesson?.status !== 'published') return null;
  if (!AI_TYPES.has(row.type)) return null;

  const links = ok(
    await db.from('consolidation_exercise_sources').select('source_id,label').eq('exercise_id', id).order('position').order('label'),
    'source links',
  ) as unknown as Array<{ source_id: string; label: string }>;
  const refs: SourceRef[] = links.map((l) => ({ sourceId: l.source_id, label: l.label === 'B' ? 'B' : 'A' }));
  const sources =
    refs.length === 0
      ? []
      : (ok(await db.from('sources').select(SOURCE_COLUMNS).in('id', refs.map((r) => r.sourceId)), 'sources') as unknown as Record<string, unknown>[]).map(
          sourceFromRow,
        );
  const ctx = ok(await db.from('consolidation_ai_context').select('context').eq('exercise_id', id).maybeSingle(), 'ai context') as {
    context: unknown;
  } | null;
  const st = ok(await db.from('ai_settings').select('rules, model').eq('id', 1).single(), 'settings lookup') as unknown as {
    rules: string;
    model: string;
  } | null;
  if (!st) throw new Error('settings lookup failed: no row');
  const tplLinks = ok(
    await db.from('consolidation_ai_template_links').select('requirement_id,template_id').eq('exercise_id', id),
    'ai template links',
  ) as unknown as TemplateLinkRow[];
  const linkedIds = [...new Set(tplLinks.map((l) => l.template_id))];
  const templates =
    linkedIds.length === 0
      ? []
      : (ok(await db.from('ai_templates').select(AI_TEMPLATE_COLUMNS).in('id', linkedIds), 'ai templates') as unknown as Record<string, unknown>[]).map(
          aiTemplateFromRow,
        );

  const exercise = exerciseFromRow(row, refs);
  const context = withTemplateLinks(aiFromJson(ctx?.context), tplLinks);
  // Like the admin's „Invalid” badge: any linked template of another type makes the exercise unusable.
  const expected = aiTemplateTypeFor(exercise.type);
  const typesOk = templates.every((t) => t.type === expected);
  const targetTemplateId = typeof target === 'object' ? context.requirementTemplates[target.requirementId] : context.templateId;
  const template = (typesOk && templates.find((t) => t.id === targetTemplateId)) || null;
  return { exercise, lessonId: row.lesson_id, sources, context, rules: st.rules, model: st.model, template };
}

const blank = (s: string | undefined) => !s || s.trim() === '';
const tooLong = (s: string) => [...s].length > MAX_ANSWER_CHARS;

/** Empty/too-long check of the text fields this target needs; also the target and type rules and the answer bounds. */
function validate(ex: ConsolidationExercise, target: Target, answer: ExerciseAnswer): ConsolidationEvaluateErrorCode | null {
  const isEssay = ex.type === 'essay';
  if (isEssay ? target === 'exercise' : target !== 'exercise') return 'not_found';
  if (isEssay && typeof target === 'object' && !ex.requirements.some((r) => r.id === target.requirementId)) return 'not_found';
  if (answer.type !== ex.type) return 'bad_request';

  let texts: string[];
  switch (ex.type) {
    case 'facts': {
      const a = answer as Extract<ExerciseAnswer, { type: 'facts' }>;
      if (a.texts.length !== ex.count) return 'bad_request';
      texts = a.texts;
      break;
    }
    case 'viewpoint':
      if ((answer as Extract<ExerciseAnswer, { type: 'viewpoint' }>).marks.length > ex.count) return 'bad_request';
      texts = [(answer as { text: string }).text];
      break;
    case 'comparison':
    case 'argument':
      texts = [(answer as { text: string }).text];
      break;
    case 'essay': {
      const parts = (answer as Extract<ExerciseAnswer, { type: 'essay' }>).parts;
      const known = new Set(ex.requirements.map((r) => r.id));
      if (!Object.keys(parts).every((k) => known.has(k))) return 'bad_request';
      const ids = [(target as { requirementId: string }).requirementId];
      texts = ids.map((id) => parts[id] ?? '');
      break;
    }
    default:
      return 'not_found';
  }
  if (texts.some(blank)) return 'empty';
  if (texts.some(tooLong)) return 'too_long';
  return null;
}

/** Marks the deterministic check accepted, with their texts from the source (those are the only ones the AI sees). */
function acceptedSupport(
  ex: Extract<ConsolidationExercise, { type: 'viewpoint' }>,
  sources: Source[],
  answer: Extract<ExerciseAnswer, { type: 'viewpoint' }>,
): NonNullable<Deterministic['support']> {
  const feedback = checkExercise(ex, sources, answer);
  const body = sources.find((s) => s.id === ex.sources[0]?.sourceId)?.body ?? '';
  const words = tokenizeSource(body).words;
  const support: NonNullable<Deterministic['support']> = [];
  for (const it of feedback.items) {
    const m = /^support-(\d+)$/.exec(it.key);
    if (!m || it.verdict !== 'ok') continue;
    const index = Number(m[1]);
    const mark = answer.marks[index];
    const first = mark && words[mark.from];
    const last = mark && words[mark.to];
    if (first && last && mark.from <= mark.to) support.push({ index, text: body.slice(first.start, last.end) });
  }
  return support;
}

function deterministicFacts(ex: ConsolidationExercise, target: Target, answer: ExerciseAnswer, sources: Source[]): Deterministic {
  if (ex.type === 'argument' && answer.type === 'argument') return { connectors: detectConnectors(answer.text) };
  if (ex.type === 'viewpoint' && answer.type === 'viewpoint') return { support: acceptedSupport(ex, sources, answer) };
  if (ex.type === 'essay' && answer.type === 'essay') {
    const flagged = ex.requirements.filter((r) => r.argument);
    const id = (target as { requirementId: string }).requirementId;
    if (flagged.some((r) => r.id === id)) return { connectors: detectConnectors(answer.parts[id] ?? '') };
  }
  return {};
}

/** Puts the refused check on the student's timeline; a failure is only logged. */
async function logCheckBlocked(db: SupabaseClient, userId: string, exerciseId: string, required: number, balance: number) {
  try {
    const { error } = await db.rpc('log_student_event_service', {
      p_user: userId, p_kind: 'check_blocked', p_exercise: exerciseId, p_details: { required, balance },
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error('[consolidation/evaluate] logging check_blocked failed:', e);
  }
}

/** Whether the student's plan opens this lesson (the `can_open_lesson_for` RPC). Throws on database errors. */
async function canOpenLesson(db: SupabaseClient, userId: string, lessonId: string): Promise<boolean> {
  const { data, error } = await db.rpc('can_open_lesson_for', { p_user: userId, p_lesson: lessonId });
  if (error) throw new Error(`access lookup failed: ${error.message}`);
  return data === true;
}

/** Puts the check refused for lack of access on the timeline; a failure is only logged. */
async function logAccessBlocked(db: SupabaseClient, userId: string, exerciseId: string, cost: number) {
  try {
    const { error } = await db.rpc('log_student_event_service', {
      p_user: userId, p_kind: 'check_blocked', p_exercise: exerciseId, p_details: { reason: 'access_required', cost },
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error('[consolidation/evaluate] logging check_blocked (access_required) failed:', e);
  }
}

/** `userId` is the authenticated caller (verified by the route); quotas are per user. */
export async function handleConsolidationEvaluate(body: unknown, userId: string, deps: Deps): Promise<HandlerResult> {
  const req = parseRequest(body);
  if (!req) return errorResult('bad_request');
  if (!isUuid(req.exerciseId)) return errorResult('not_found');

  // Set once the check is paid for; any failure after that gives the credits back.
  let entryId: number | null = null;
  try {
    if (await isSuspended(deps.db, userId)) return errorResult('suspended');
    const loaded = await load(deps.db, req.exerciseId, req.target);
    if (!loaded) return errorResult('not_found');
    const { exercise, lessonId, sources, context, rules, model, template } = loaded;
    // A stored exercise that no longer validates (no AI context or template, detached span, ...) cannot be evaluated fairly.
    if (validateExercise(exercise, sources, context).length > 0) return errorResult('not_found');
    if (!template) return errorResult('not_found');
    const invalid = validate(exercise, req.target, req.answer);
    if (invalid) return errorResult(invalid);

    const cost = checkCost(exercise, req.target);
    // Locked lessons (trial / expired access) are refused before any charge; a lookup failure fails closed (ai_failed).
    if (!(await canOpenLesson(deps.db, userId, lessonId))) {
      await logAccessBlocked(deps.db, userId, exercise.id, cost);
      return errorResult('access_required');
    }

    if (!(await deps.rateLimit(GLOBAL_RATE_KEY, GLOBAL_RATE_LIMIT, GLOBAL_RATE_WINDOW_SECONDS))) return errorResult('rate_limited');

    const spend = await deps.credits.spend(userId, cost, exercise.id, targetKey(req.target));
    if (spend.entryId === null) {
      await logCheckBlocked(deps.db, userId, exercise.id, cost, spend.balance);
      const { status, message } = ERRORS.insufficient_credits;
      return { status, json: { error: 'insufficient_credits', message, required: cost, balance: spend.balance } };
    }
    entryId = spend.entryId;

    const deterministic = deterministicFacts(exercise, req.target, req.answer, sources);
    const { instructions, input } = buildConsolidationPrompt({
      rules, exercise, sources, context, template, target: req.target, answer: req.answer, deterministic,
    });
    const keys = expectedKeys(exercise, req.target, deterministic);
    const raw = await deps.evaluate({ model, instructions, input, keys });
    const parsed = aiOutputSchema.safeParse(raw);
    if (!parsed.success) throw new Error('model output failed validation');

    const normalized = normalizeAiOutput(parsed.data, keys);
    const items: FeedbackItem[] = [];
    for (const key of keys) {
      const found = normalized.items.find((i) => i.key === key);
      // The returned keys (never the feedback text) make a key mismatch diagnosable from the logs.
      if (!found) throw new Error(`model output is missing item "${key}" (got keys: ${JSON.stringify(parsed.data.items.map((i) => i.key))})`);
      items.push({ key, verdict: found.verdict, title: found.title, good: found.good, improve: found.improve, ai: true });
    }
    return { status: 200, json: { items, credits: { spent: cost, balance: spend.balance } } };
  } catch (e) {
    console.error('[consolidation/evaluate] failed:', e);
    if (entryId === null) return errorResult('ai_failed');
    try {
      const balance = await deps.credits.refund(entryId);
      return { status: 502, json: { error: 'ai_failed', message: REFUNDED_MESSAGE, credits: { spent: 0, balance } } };
    } catch (refundError) {
      console.error(`[consolidation/evaluate] refund of ledger entry ${entryId} failed:`, refundError);
      return errorResult('ai_failed');
    }
  }
}
