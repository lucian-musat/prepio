import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AI_TYPES, BAC_ESSAY_WORDS, BAC_TOTAL_POINTS, DEFAULT_ESSAY_STYLE, MAX_ANSWER_CHARS, allowedSteps, bacGrade, bacItemFromRow, clampToStep,
  detectConnectors, essayLengthPoints, firstSentence, sanitizeAnswers, scoreDeterministic, sourceFromRow,
  type BacAnswers, type BacEssayStyle, type BacItem, type BacItemResult, type BacPartResult, type BacSection, type BacStepRule,
  type BacSubmitError, type BacSubmitErrorCode, type BacSubmitResponse, type ExerciseAnswer, type Mark,
  type Source, type SourceLabel, type SourceRef,
} from '@prepio/shared';
import { isSuspended } from '@/lib/account/suspended';
import { acceptedSupport } from '@/lib/consolidation/handler';
import { isUuid } from '@/lib/data/db';
import type { Credits } from '@/lib/credits/credits';
import type { Grader } from '@/lib/evaluate/openai';
import type { RateLimit } from '@/lib/evaluate/rateLimit';
import { captureFailure } from '@/lib/sentry';
import type { BacCharge } from './charge';
import { buildBacItemPrompt, buildBacStylePrompt } from './prompt';
import { bacGradeSchema, bacStyleSchema } from './schema';

/** `credits` is used for refunds; charging goes through `charge` (spend + ledger entry on the attempt, atomically). */
export type BacDeps = { db: SupabaseClient; grade: Grader; rateLimit: RateLimit; credits: Credits; charge: BacCharge; now?: () => Date };
export type BacHandlerResult = { status: number; json: BacSubmitResponse | BacSubmitError };

/** The Sentry route tag of this handler's failures; every failed grading answers 502 grading_failed. */
const ROUTE = 'bac/submit';
const FAILED_STATUS = 502;

/** Papers per day across all students; separate from the consolidation checks' `evaluate:global` budget. */
export const BAC_RATE_KEY = 'bac:global';
export const BAC_RATE_LIMIT = 60;
export const BAC_RATE_WINDOW_SECONDS = 86400;
/** Papers per day per student, consumed before the global slot so one account cannot burn the global budget. */
export const bacUserRateKey = (userId: string) => `bac:user:${userId}`;
export const BAC_USER_RATE_LIMIT = 5;

const ERRORS: Record<BacSubmitErrorCode, { status: number; message: string }> = {
  bad_request: { status: 400, message: 'Cererea nu este validă.' },
  unauthorized: { status: 401, message: 'Trebuie să fii autentificat.' },
  suspended: { status: 403, message: 'Contul tău este suspendat.' },
  access_required: { status: 403, message: 'Subiectele BAC fac parte din accesul complet.' },
  not_found: { status: 404, message: 'Subiectul nu a fost găsit.' },
  too_long: { status: 400, message: `Textul depășește ${MAX_ANSWER_CHARS} de caractere.` },
  rate_limited: { status: 429, message: 'Corectarea nu este disponibilă acum. Încearcă din nou mai târziu.' },
  insufficient_credits: { status: 402, message: 'Nu ai destule credite pentru corectarea lucrării.' },
  already_grading: { status: 409, message: 'Lucrarea se corectează deja.' },
  grading_failed: { status: 502, message: 'Corectarea nu a reușit. Nu ți-am luat niciun credit. Încearcă din nou.' },
};

export function bacError(
  code: BacSubmitErrorCode,
  extra?: Pick<BacSubmitError, 'required' | 'balance' | 'credits'>,
): BacHandlerResult {
  const { status, message } = ERRORS[code];
  return { status, json: { error: code, message, ...extra } };
}

// ---------------------------------------------------------------- request

const NOT_FILLED = 'Necompletat.';
/** More list entries than any item asks for is not a real answer. */
const MAX_LIST = 20;
const LETTERS = new Set(['A', 'B', 'C', 'D']);

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.length <= MAX_LIST && v.every((x) => typeof x === 'string');
const isMark = (m: unknown): m is Mark =>
  isObj(m) && typeof m.sourceId === 'string' && Number.isInteger(m.from) && Number.isInteger(m.to);
const isMarks = (v: unknown): v is Mark[] => Array.isArray(v) && v.length <= MAX_LIST && v.every(isMark);
const mark = (m: Mark): Mark => ({ sourceId: m.sourceId, from: m.from, to: m.to });

/** One answer with its text fields; null when its shape is wrong. Unknown extra fields are dropped. */
function parseAnswer(a: unknown): { answer: ExerciseAnswer; texts: string[] } | null {
  if (!isObj(a)) return null;
  switch (a.type) {
    case 'short_answer':
    case 'comparison':
    case 'argument':
      return typeof a.text === 'string' ? { answer: { type: a.type, text: a.text }, texts: [a.text] } : null;
    case 'multi_answer':
    case 'facts':
      return isStrings(a.texts) ? { answer: { type: a.type, texts: a.texts }, texts: a.texts } : null;
    case 'source_info':
      return isMarks(a.marks) ? { answer: { type: 'source_info', marks: a.marks.map(mark) }, texts: [] } : null;
    case 'source_letter':
      if (a.letter !== null && !(typeof a.letter === 'string' && LETTERS.has(a.letter))) return null;
      return { answer: { type: 'source_letter', letter: a.letter as SourceLabel | null }, texts: [] };
    case 'cause_effect': {
      const ok = (m: unknown) => m === null || isMark(m);
      if (!ok(a.cause) || !ok(a.effect)) return null;
      const cause = a.cause ? mark(a.cause as Mark) : null;
      const effect = a.effect ? mark(a.effect as Mark) : null;
      return { answer: { type: 'cause_effect', cause, effect }, texts: [] };
    }
    case 'viewpoint':
      if (typeof a.text !== 'string' || !isMarks(a.marks)) return null;
      return { answer: { type: 'viewpoint', text: a.text, marks: a.marks.map(mark) }, texts: [a.text] };
    case 'essay': {
      const parts = a.parts;
      if (!isObj(parts) || Object.keys(parts).length > MAX_LIST || !Object.values(parts).every((v) => typeof v === 'string')) return null;
      const p = parts as Record<string, string>;
      return { answer: { type: 'essay', parts: { ...p } }, texts: Object.values(p) };
    }
    default:
      return null;
  }
}

function parseRequest(body: unknown): { subjectId: string; answers: BacAnswers } | 'bad_request' | 'too_long' {
  if (!isObj(body) || typeof body.subjectId !== 'string' || !isUuid(body.subjectId) || !isObj(body.answers)) return 'bad_request';
  const answers: BacAnswers = {};
  let tooLong = false;
  for (const [id, raw] of Object.entries(body.answers)) {
    const parsed = parseAnswer(raw);
    if (!parsed) return 'bad_request';
    if (parsed.texts.some((t) => [...t].length > MAX_ANSWER_CHARS)) tooLong = true;
    answers[id] = parsed.answer;
  }
  return tooLong ? 'too_long' : { subjectId: body.subjectId, answers };
}

// ---------------------------------------------------------------- loading

type Loaded = {
  creditCost: number;
  items: BacItem[];
  /** By item id; the rule's `points` is the item's (or the essay requirement's) maximum. */
  barem: Map<string, { rule: BacStepRule; essay: { requirements: Record<string, BacStepRule>; style: BacEssayStyle } | null }>;
  sources: Source[];
  rules: string;
  model: string;
};


function ok<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what} failed: ${res.error.message}`);
  return res.data;
}

function ruleFrom(raw: unknown, points: number): BacStepRule | null {
  if (!isObj(raw) || typeof raw.text !== 'string') return null;
  const steps = Array.isArray(raw.steps) ? raw.steps.filter((s): s is number => Number.isInteger(s)) : null;
  return { text: raw.text, points, steps };
}

function styleFrom(raw: unknown): BacEssayStyle {
  if (!isObj(raw)) return DEFAULT_ESSAY_STYLE;
  const n = (v: unknown, d: number) => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : d);
  return {
    language: n(raw.language, DEFAULT_ESSAY_STYLE.language),
    structure: n(raw.structure, DEFAULT_ESSAY_STYLE.structure),
    order: n(raw.order, DEFAULT_ESSAY_STYLE.order),
    length: n(raw.length, DEFAULT_ESSAY_STYLE.length),
  };
}

/** Null = missing, unpublished or not gradable (an AI item without its barem). Service-role reads: the barem stays here. */
async function load(db: SupabaseClient, subjectId: string): Promise<Loaded | null> {
  const subject = ok(
    await db.from('bac_subjects').select('id,credit_cost,published').eq('id', subjectId).maybeSingle(),
    'subject lookup',
  ) as { id: string; credit_cost: number; published: boolean } | null;
  if (!subject || !subject.published) return null;

  type ItemRow = Parameters<typeof bacItemFromRow>[0];
  const rows = ok(
    await db
      .from('bac_items')
      .select('id,section,position,type,prompt,content,template_id,points')
      .eq('subject_id', subjectId)
      .order('section')
      .order('position'),
    'items',
  ) as unknown as ItemRow[];
  if (rows.length === 0) return null;
  const ids = rows.map((r) => r.id);

  const links = ok(
    await db.from('bac_item_sources').select('item_id,label,source_id,position').in('item_id', ids).order('position'),
    'item sources',
  ) as unknown as Array<{ item_id: string; label: string; source_id: string }>;
  const sources = (
    ok(await db.from('bac_sources').select('id,position,title,author,work,body').eq('subject_id', subjectId), 'sources') as unknown as Record<
      string,
      unknown
    >[]
  ).map(sourceFromRow);
  const baremRows = ok(await db.from('bac_item_barem').select('item_id,barem').in('item_id', ids), 'barem') as unknown as Array<{
    item_id: string;
    barem: unknown;
  }>;
  const st = ok(await db.from('ai_settings').select('bac_rules,model').eq('id', 1).single(), 'settings lookup') as {
    bac_rules: string;
    model: string;
  } | null;
  if (!st) throw new Error('settings lookup failed: no row');

  const numbers = new Map<number, number>();
  const items = rows.map((r) => {
    const number = (numbers.get(r.section) ?? 0) + 1;
    numbers.set(r.section, number);
    // BAC items label their sources A–D; SourceLabel only names the consolidation pair.
    const refs: SourceRef[] = links.filter((l) => l.item_id === r.id).map((l) => ({ sourceId: l.source_id, label: l.label as SourceLabel }));
    return bacItemFromRow(r, number, refs);
  });

  const barem: Loaded['barem'] = new Map();
  for (const item of items) {
    const raw = baremRows.find((b) => b.item_id === item.id)?.barem;
    const rule = ruleFrom(raw, item.points);
    if (!AI_TYPES.has(item.type)) {
      if (rule) barem.set(item.id, { rule, essay: null });
      continue;
    }
    if (!rule) return null;
    let essay: { requirements: Record<string, BacStepRule>; style: BacEssayStyle } | null = null;
    if (item.type === 'essay') {
      const e = isObj(raw) && isObj(raw.essay) ? raw.essay : null;
      const reqs = e && isObj(e.requirements) ? e.requirements : {};
      const requirements: Record<string, BacStepRule> = {};
      for (const r of item.requirements) {
        const rr = reqs[r.id];
        const points = isObj(rr) && Number.isInteger(rr.points) ? (rr.points as number) : 0;
        const rRule = ruleFrom(rr, points);
        if (!rRule || points < 1) return null;
        requirements[r.id] = rRule;
      }
      essay = { requirements, style: styleFrom(e?.style) };
    }
    barem.set(item.id, { rule, essay });
  }
  return { creditCost: subject.credit_cost, items, barem, sources, rules: st.bac_rules, model: st.model };
}

// ---------------------------------------------------------------- attempt state

const OPEN_FOR_SUBMIT = ['draft', 'failed'];

/**
 * Moves the student's open attempt to `grading` (or creates one in `grading`). Null when another request is grading
 * it: only one guarded update or insert can win, and the partial unique index refuses a concurrent second insert.
 * A reopened attempt drops its old ledger entry and results, so a later failure never refunds a stale entry.
 */
async function claimAttempt(db: SupabaseClient, userId: string, subjectId: string, answers: BacAnswers, at: string): Promise<string | null> {
  const fresh = { status: 'grading', answers, submitted_at: at, ledger_entry: null, points: null, grade: null, results: null, graded_at: null };
  const claimed = ok(
    await db.from('bac_attempts').update(fresh).eq('user_id', userId).eq('subject_id', subjectId).in('status', OPEN_FOR_SUBMIT).select('id'),
    'attempt claim',
  ) as unknown as Array<{ id: string }>;
  if (claimed[0]) return claimed[0].id;

  const busy = ok(
    await db.from('bac_attempts').select('id').eq('user_id', userId).eq('subject_id', subjectId).eq('status', 'grading').maybeSingle(),
    'attempt lookup',
  );
  if (busy) return null;
  const inserted = await db
    .from('bac_attempts')
    .insert({ user_id: userId, subject_id: subjectId, status: 'grading', answers, submitted_at: at })
    .select('id')
    .single();
  if ((inserted.error as { code?: string } | null)?.code === '23505') return null;
  return (ok(inserted, 'attempt insert') as { id: string }).id;
}

/** Writes `patch` only while the attempt is still `grading` (the stale sweep may have failed it); false when it was not. */
async function whileGrading(db: SupabaseClient, attemptId: string, patch: Record<string, unknown>): Promise<boolean> {
  const rows = ok(
    await db.from('bac_attempts').update(patch).eq('id', attemptId).eq('status', 'grading').select('id'),
    'attempt update',
  ) as unknown as unknown[];
  return rows.length > 0;
}

async function isGrading(db: SupabaseClient, userId: string, subjectId: string): Promise<boolean> {
  const busy = ok(
    await db.from('bac_attempts').select('id').eq('user_id', userId).eq('subject_id', subjectId).eq('status', 'grading').maybeSingle(),
    'attempt lookup',
  );
  return !!busy;
}

/** The ledger entry stored on the attempt (by `bac_charge_attempt`); null when nothing was charged. */
async function storedLedgerEntry(db: SupabaseClient, attemptId: string): Promise<number | null> {
  const row = ok(await db.from('bac_attempts').select('ledger_entry').eq('id', attemptId).maybeSingle(), 'attempt lookup') as {
    ledger_entry: number | string | null;
  } | null;
  return row?.ledger_entry == null ? null : Number(row.ledger_entry);
}

async function currentBalance(db: SupabaseClient, userId: string): Promise<number> {
  const row = ok(await db.from('profiles').select('credit_balance').eq('id', userId).maybeSingle(), 'balance lookup') as {
    credit_balance: number;
  } | null;
  return row?.credit_balance ?? 0;
}

async function canOpenBac(db: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await db.rpc('can_open_bac_for', { p_user: userId });
  if (error) throw new Error(`access lookup failed: ${error.message}`);
  return data === true;
}

/** Timeline event; a failure is only logged. */
async function logEvent(db: SupabaseClient, userId: string, kind: string, details: Record<string, unknown>) {
  try {
    const { error } = await db.rpc('log_student_event_service', { p_user: userId, p_kind: kind, p_exercise: null, p_details: details });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error(`[bac/submit] logging ${kind} failed:`, e);
    captureFailure(ROUTE, 'log_event', e);
  }
}

// ---------------------------------------------------------------- scoring

type ScoreCtx = { grade: Grader; model: string; rules: string; sources: Source[] };

const blank = (s: string | undefined) => !s || s.trim() === '';
const yn = (b: boolean) => (b ? 'da' : 'nu');
const connectorFact = (text: string) => {
  const c = detectConnectors(text);
  return `Conectori detectați automat: cauzalitate ${yn(c.causal)}, concluzie ${yn(c.conclusion)}`;
};
const MAX_FEEDBACK_CHARS = 300;
/** One sentence for the student; none on full points. */
const studentFeedback = (feedback: string, points: number, max: number) =>
  points >= max ? '' : [...firstSentence(feedback)].slice(0, MAX_FEEDBACK_CHARS).join('');
/** Long feedback is cut, never a reason to fail the paper. */
const capFeedback = (raw: unknown) =>
  isObj(raw) && typeof raw.feedback === 'string' ? { ...raw, feedback: [...raw.feedback].slice(0, MAX_FEEDBACK_CHARS).join('') } : raw;

async function gradeItemCall(ctx: ScoreCtx, prompt: { instructions: string; input: string }) {
  const parsed = bacGradeSchema.safeParse(capFeedback(await ctx.grade({ model: ctx.model, ...prompt, kind: 'item' })));
  if (!parsed.success) throw new Error('grader output failed validation');
  return parsed.data;
}

const itemSources = (item: BacItem, sources: Source[]) =>
  item.sources.flatMap((ref) => {
    const s = sources.find((x) => x.id === ref.sourceId);
    return s ? [{ label: ref.label as string, body: s.body }] : [];
  });

/** The text the grader judges and the facts it must not contradict; null for an empty answer. */
function aiAnswer(item: BacItem, answer: ExerciseAnswer, sources: Source[]): { text: string; facts: string[] } | null {
  switch (answer.type) {
    case 'facts':
      if (answer.texts.every(blank)) return null;
      return { text: answer.texts.map((t, i) => `Faptul ${i + 1}: ${t}`).join('\n'), facts: [] };
    case 'comparison':
      return blank(answer.text) ? null : { text: answer.text, facts: [] };
    case 'argument':
      return blank(answer.text) ? null : { text: answer.text, facts: [connectorFact(answer.text)] };
    case 'viewpoint': {
      if (blank(answer.text) && answer.marks.length === 0) return null;
      const support = item.type === 'viewpoint' ? acceptedSupport(item, sources, answer) : [];
      return {
        text: answer.text,
        facts: support.map((s) => `Informația-suport ${s.index + 1}, selectată din sursă și acceptată automat: „${s.text}”`),
      };
    }
    default:
      return null;
  }
}

function itemResult(item: BacItem, points: number, feedback: string, parts?: BacPartResult[]): BacItemResult {
  return {
    itemId: item.id, section: item.section as BacSection, number: item.number, points, max: item.points, feedback, ...(parts ? { parts } : {}),
  };
}

async function scoreEssay(
  ctx: ScoreCtx,
  item: Extract<BacItem, { type: 'essay' }>,
  essay: { requirements: Record<string, BacStepRule>; style: BacEssayStyle },
  answer: ExerciseAnswer | undefined,
): Promise<BacItemResult> {
  const parts = answer?.type === 'essay' ? answer.parts : {};
  const texts = item.requirements.map((r) => parts[r.id] ?? '');
  if (texts.every(blank)) return itemResult(item, 0, NOT_FILLED);
  const sources = itemSources(item, ctx.sources);
  const style = essay.style;

  const requirementParts = Promise.all(
    item.requirements.map(async (r, i): Promise<BacPartResult> => {
      const rule = essay.requirements[r.id]!;
      const text = texts[i]!;
      if (blank(text)) return { key: r.id, points: 0, max: rule.points, feedback: NOT_FILLED };
      const out = await gradeItemCall(
        ctx,
        buildBacItemPrompt({
          rules: ctx.rules, item, rule, requirementText: r.text, sources, answerText: text, facts: r.argument ? [connectorFact(text)] : [],
        }),
      );
      const points = clampToStep(out.points, allowedSteps(rule));
      return { key: r.id, points, max: rule.points, feedback: studentFeedback(out.feedback, points, rule.points) };
    }),
  );
  const styleParts = (async (): Promise<BacPartResult[]> => {
    const raw = await ctx.grade({
      model: ctx.model,
      kind: 'style',
      ...buildBacStylePrompt({
        rules: ctx.rules,
        essayPrompt: item.prompt,
        requirements: item.requirements.map((r, i) => ({ text: r.text, answer: texts[i]! })),
        style,
      }),
    });
    const parsed = bacStyleSchema.safeParse(capFeedback(raw));
    if (!parsed.success) throw new Error('style output failed validation');
    const upTo = (points: number, max: number) => clampToStep(points, allowedSteps({ text: '', points: max, steps: null }));
    const scored = (['language', 'structure', 'order'] as const).map((key) => ({ key, points: upTo(parsed.data[key], style[key]), max: style[key] }));
    // The one style feedback goes with the first sub-criterion below its maximum.
    const weak = scored.find((p) => p.points < p.max)?.key;
    return scored.map((p) => ({ ...p, feedback: p.key === weak ? studentFeedback(parsed.data.feedback, p.points, p.max) : '' }));
  })();

  const [reqs, styled] = await Promise.all([requirementParts, styleParts]);
  const length = essayLengthPoints(parts, style);
  const lengthPart: BacPartResult = {
    key: 'length',
    points: length,
    max: style.length,
    feedback: length < style.length ? `Eseul trebuie să aibă între ${BAC_ESSAY_WORDS.min} și ${BAC_ESSAY_WORDS.max} de cuvinte.` : '',
  };
  const all = [...reqs, ...styled, lengthPart];
  const points = Math.min(item.points, all.reduce((t, p) => t + p.points, 0));
  const feedback = points >= item.points ? '' : (all.find((p) => p.feedback !== '')?.feedback ?? '');
  return itemResult(item, points, feedback, all);
}

async function scoreItem(ctx: ScoreCtx, loaded: Loaded, item: BacItem, answer: ExerciseAnswer | undefined): Promise<BacItemResult> {
  const deterministic = scoreDeterministic(item, loaded.sources, answer);
  if (deterministic) return deterministic;
  const barem = loaded.barem.get(item.id)!;
  if (item.type === 'essay') return scoreEssay(ctx, item, barem.essay!, answer);

  const ai = answer && aiAnswer(item, answer, loaded.sources);
  if (!ai) return itemResult(item, 0, NOT_FILLED);
  const out = await gradeItemCall(
    ctx,
    buildBacItemPrompt({
      rules: ctx.rules, item, rule: barem.rule, sources: itemSources(item, loaded.sources), answerText: ai.text, facts: ai.facts,
    }),
  );
  const points = clampToStep(out.points, allowedSteps(barem.rule));
  return itemResult(item, points, studentFeedback(out.feedback, points, item.points));
}

// ---------------------------------------------------------------- handler

/** `userId` is the authenticated caller (verified by the route). */
export async function handleBacSubmit(body: unknown, userId: string, deps: BacDeps): Promise<BacHandlerResult> {
  const now = deps.now ?? (() => new Date());
  const req = parseRequest(body);
  if (typeof req === 'string') return bacError(req);
  const { db } = deps;
  const subjectId = req.subjectId;

  // Set once the attempt is ours (in `grading`) and once it is paid for; the catch block undoes both.
  let attemptId: string | null = null;
  let entryId: number | null = null;
  try {
    if (await isSuspended(db, userId)) return bacError('suspended');
    if (!(await canOpenBac(db, userId))) return bacError('access_required');
    const loaded = await load(db, subjectId);
    if (!loaded) return bacError('not_found');
    const answers = sanitizeAnswers(loaded.items, req.answers);

    const cost = loaded.creditCost;
    // Cheap pre-checks so a request that cannot be charged never consumes a rate-limit slot. The guarded claim and
    // the atomic charge below remain the real protection against races.
    if (await isGrading(db, userId, subjectId)) return bacError('already_grading');
    const before = await currentBalance(db, userId);
    if (before < cost) return bacError('insufficient_credits', { required: cost, balance: before });
    if (!(await deps.rateLimit(bacUserRateKey(userId), BAC_USER_RATE_LIMIT, BAC_RATE_WINDOW_SECONDS))) return bacError('rate_limited');
    if (!(await deps.rateLimit(BAC_RATE_KEY, BAC_RATE_LIMIT, BAC_RATE_WINDOW_SECONDS))) return bacError('rate_limited');

    attemptId = await claimAttempt(db, userId, subjectId, answers, now().toISOString());
    if (attemptId === null) return bacError('already_grading');

    // Spends and stores the ledger entry on the attempt in one transaction, so the stale sweep can always refund it.
    const spend = await deps.charge(attemptId, userId, cost, `bac:${subjectId}`);
    if (spend.entryId === null) {
      await whileGrading(db, attemptId, { status: 'draft' });
      return bacError('insufficient_credits', { required: cost, balance: spend.balance });
    }
    entryId = spend.entryId;
    await logEvent(db, userId, 'bac_submitted', { subject_id: subjectId, cost });

    const ctx: ScoreCtx = { grade: deps.grade, model: loaded.model, rules: loaded.rules, sources: loaded.sources };
    const results = await Promise.all(loaded.items.map((item) => scoreItem(ctx, loaded, item, answers[item.id])));
    const points = Math.min(BAC_TOTAL_POINTS, results.reduce((t, r) => t + r.points, 0));
    const grade = bacGrade(points);

    const graded = await whileGrading(db, attemptId, { status: 'graded', points, grade, results, graded_at: now().toISOString() });
    if (!graded) {
      // The stale sweep failed the attempt and refunded its entry meanwhile: nothing left to give back.
      console.error(`[bac/submit] attempt ${attemptId} left grading before it was graded`);
      captureFailure(ROUTE, 'stuck_grading', undefined, FAILED_STATUS);
      return bacError('grading_failed', { credits: { spent: 0, balance: await currentBalance(db, userId) } });
    }
    await logEvent(db, userId, 'bac_graded', { subject_id: subjectId, points, grade });
    return { status: 200, json: { attemptId, points, grade, results, credits: { spent: cost, balance: spend.balance } } };
  } catch (e) {
    console.error('[bac/submit] failed:', e);
    captureFailure(ROUTE, 'grade', e, FAILED_STATUS);
    if (attemptId === null) return bacError('grading_failed');
    if (entryId === null) {
      // The charge may have committed with its response lost: the attempt is the source of truth.
      try {
        entryId = await storedLedgerEntry(db, attemptId);
      } catch (lookupError) {
        // Unknown outcome: leave the attempt in `grading`; the stale sweep refunds a stored entry and fails it.
        console.error(`[bac/submit] ledger lookup for attempt ${attemptId} failed:`, lookupError);
        captureFailure(ROUTE, 'ledger_lookup', lookupError, FAILED_STATUS);
        return bacError('grading_failed');
      }
    }
    if (entryId === null) {
      // Claimed but not paid: let the student submit again.
      try {
        await whileGrading(db, attemptId, { status: 'failed' });
      } catch (stateError) {
        console.error(`[bac/submit] failing attempt ${attemptId} failed:`, stateError);
        captureFailure(ROUTE, 'fail_attempt', stateError, FAILED_STATUS);
      }
      return bacError('grading_failed');
    }
    let balance: number;
    try {
      // Idempotent: harmless if the stale sweep already refunded this entry.
      balance = await deps.credits.refund(entryId);
    } catch (refundError) {
      // The attempt stays in `grading` with its ledger entry: the stale sweep refunds and fails it within minutes.
      console.error(`[bac/submit] refund of ledger entry ${entryId} failed:`, refundError);
      captureFailure(ROUTE, 'refund', refundError, FAILED_STATUS);
      return bacError('grading_failed');
    }
    try {
      if (await whileGrading(db, attemptId, { status: 'failed' })) {
        await logEvent(db, userId, 'bac_grading_failed', { subject_id: subjectId });
      }
    } catch (stateError) {
      // Refunded already; the sweep fails the attempt later.
      console.error(`[bac/submit] failing attempt ${attemptId} failed:`, stateError);
      captureFailure(ROUTE, 'fail_attempt', stateError, FAILED_STATUS);
    }
    return bacError('grading_failed', { credits: { spent: 0, balance } });
  }
}
