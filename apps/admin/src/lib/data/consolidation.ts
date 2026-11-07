import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AI_TYPES, CONSOLIDATION_TYPES, aiTemplateFromRow, aiTemplateTypeFor, exerciseFromRow, exerciseToRow, reanchorSpan, sourceFromRow, templateFromRow, validateExercise,
  type AiContext, type AiTemplate, type AnswerSpan, type ConsolidationExercise, type ConsolidationRow, type DistributiveOmit,
  type SolutionTemplate, type Source, type SourceRef,
} from '@prepio/shared';
import { GENERIC_ERROR, UserError, check, checkAffected, renumber, siblings } from './db';
import { upsert } from './lesson';

export type EditorConsolidation = {
  sources: Source[];
  exercises: Array<{ exercise: ConsolidationExercise; ai: AiContext; errors: string[] }>; // errors = validateExercise result (shows detached spans)
  templates: SolutionTemplate[];
  aiTemplates: AiTemplate[];
};
export type SourceInput = { id?: string; title: string | null; author: string; work: string; body: string };
export type SourceImpact = Array<{ exerciseId: string; prompt: string; detached: string[] }>; // span texts that would detach
export type ExerciseInput = DistributiveOmit<ConsolidationExercise, 'id' | 'position'> & { id?: string; ai: AiContext };

const EMPTY_AI: AiContext = { main: '', requirements: {}, templateId: null, requirementTemplates: {} };
const blank = (s: string | null | undefined) => !s || s.trim() === '';
const MISMATCH = 'Șablonul AI ales nu se potrivește tipului exercițiului.';
const orNull = (s: unknown) => (typeof s === 'string' && s.trim() !== '' ? s.trim() : null);
const SOURCE_COLUMNS = 'id,position,title,author,work,body';
const EXERCISE_COLUMNS = 'id,position,type,prompt,content,template_id,credit_cost';

type JoinRow = { exercise_id: string; source_id: string; label: string };

/** The jsonb context only; the template ids live in `consolidation_ai_template_links`. */
export function aiFromJson(v: unknown): AiContext {
  const o = typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
  const reqs = typeof o.requirements === 'object' && o.requirements !== null ? (o.requirements as Record<string, unknown>) : {};
  return {
    main: typeof o.main === 'string' ? o.main : '',
    requirements: Object.fromEntries(Object.entries(reqs).filter((e): e is [string, string] => typeof e[1] === 'string')),
    templateId: null,
    requirementTemplates: {},
  };
}

async function loadSources(db: SupabaseClient, lessonId: string): Promise<Source[]> {
  const rows = check(await db.from('sources').select(SOURCE_COLUMNS).eq('lesson_id', lessonId).order('position').order('id'));
  return (rows as Record<string, unknown>[]).map(sourceFromRow);
}

async function loadExercises(db: SupabaseClient, lessonId: string, onlyIds?: string[]) {
  let q = db.from('consolidation_exercises').select(EXERCISE_COLUMNS).eq('lesson_id', lessonId);
  if (onlyIds) q = q.in('id', onlyIds);
  const rows = check(await q.order('position').order('id')) as unknown as ConsolidationRow[];
  if (rows.length === 0) return { rows, byExercise: new Map<string, SourceRef[]>(), ai: new Map<string, AiContext>() };
  const ids = rows.map((r) => r.id);
  const [links, ctx, tplLinks] = await Promise.all([
    db.from('consolidation_exercise_sources').select('exercise_id,source_id,label').in('exercise_id', ids).order('position').order('label'),
    db.from('consolidation_ai_context').select('exercise_id,context').in('exercise_id', ids),
    db.from('consolidation_ai_template_links').select('exercise_id,requirement_id,template_id').in('exercise_id', ids),
  ]);
  const byExercise = new Map<string, SourceRef[]>();
  for (const l of check(links) as unknown as JoinRow[]) {
    const list = byExercise.get(l.exercise_id) ?? [];
    list.push({ sourceId: l.source_id, label: l.label === 'B' ? 'B' : 'A' });
    byExercise.set(l.exercise_id, list);
  }
  const ai = new Map<string, AiContext>();
  for (const c of check(ctx) as unknown as Array<{ exercise_id: string; context: unknown }>) ai.set(c.exercise_id, aiFromJson(c.context));
  for (const l of check(tplLinks) as unknown as Array<{ exercise_id: string; requirement_id: string; template_id: string }>) {
    const a = ai.get(l.exercise_id) ?? { ...EMPTY_AI };
    if (l.requirement_id === '') a.templateId = l.template_id;
    else a.requirementTemplates = { ...a.requirementTemplates, [l.requirement_id]: l.template_id };
    ai.set(l.exercise_id, a);
  }
  return { rows, byExercise, ai };
}

export async function getConsolidation(db: SupabaseClient, lessonId: string): Promise<EditorConsolidation> {
  const [sources, loaded, templates, aiTemplates] = await Promise.all([
    loadSources(db, lessonId),
    loadExercises(db, lessonId),
    db.from('solution_templates').select('id,title,exercise_type,points,body').order('title').order('id'),
    db.from('ai_templates').select('id,title,type,criteria,keywords,response_format').order('title').order('id'),
  ]);
  const aiTemplateList = (check(aiTemplates) as Record<string, unknown>[]).map(aiTemplateFromRow);
  const typeOf = new Map(aiTemplateList.map((t) => [t.id, t.type]));
  const exercises = loaded.rows.map((row) => {
    const exercise = exerciseFromRow(row, loaded.byExercise.get(row.id) ?? []);
    const ai = loaded.ai.get(row.id) ?? EMPTY_AI;
    const errors = validateExercise(exercise, sources, ai);
    const expected = aiTemplateTypeFor(exercise.type);
    const linked = [ai.templateId, ...Object.values(ai.requirementTemplates)].filter((id): id is string => !!id);
    if (linked.some((id) => typeOf.get(id) !== expected)) errors.push(MISMATCH);
    return { exercise, ai, errors };
  });
  return {
    sources, exercises, templates: (check(templates) as Record<string, unknown>[]).map(templateFromRow), aiTemplates: aiTemplateList,
  };
}

/** Every span of an exercise (read-only view). */
function spansOf(ex: ConsolidationExercise): AnswerSpan[] {
  switch (ex.type) {
    case 'source_info':
    case 'viewpoint':
      return ex.spans;
    case 'source_letter':
      return ex.evidence ? [ex.evidence] : [];
    case 'cause_effect':
      return ex.pairs.flatMap((p) => [p.cause, p.effect]);
    default:
      return [];
  }
}

/** Copy of the exercise with `fn` applied to every span. */
function mapSpans(ex: ConsolidationExercise, fn: (s: AnswerSpan) => AnswerSpan): ConsolidationExercise {
  switch (ex.type) {
    case 'source_info':
    case 'viewpoint':
      return { ...ex, spans: ex.spans.map(fn) };
    case 'source_letter':
      return { ...ex, evidence: ex.evidence ? fn(ex.evidence) : null };
    case 'cause_effect':
      return { ...ex, pairs: ex.pairs.map((p) => ({ ...p, cause: fn(p.cause), effect: fn(p.effect) })) };
    default:
      return ex;
  }
}

async function sourceLesson(db: SupabaseClient, id: string): Promise<string> {
  const row = check(await db.from('sources').select('lesson_id').eq('id', id).maybeSingle()) as { lesson_id: string } | null;
  if (!row) throw new UserError('Sursa nu există.');
  return row.lesson_id;
}

/** The lesson's exercises that link the source. */
async function exercisesUsing(db: SupabaseClient, lessonId: string, sourceId: string) {
  const links = check(await db.from('consolidation_exercise_sources').select('exercise_id').eq('source_id', sourceId)) as unknown as Array<{ exercise_id: string }>;
  if (links.length === 0) return [];
  const { rows, byExercise } = await loadExercises(db, lessonId, [...new Set(links.map((l) => l.exercise_id))]);
  return rows.map((row) => exerciseFromRow(row, byExercise.get(row.id) ?? []));
}

export async function sourceImpact(db: SupabaseClient, sourceId: string, newBody: string): Promise<SourceImpact> {
  const lessonId = await sourceLesson(db, sourceId);
  const impact: SourceImpact = [];
  for (const ex of await exercisesUsing(db, lessonId, sourceId)) {
    const detached = spansOf(ex)
      .filter((s) => s.sourceId === sourceId && reanchorSpan(newBody, s) === null)
      .map((s) => s.text);
    if (detached.length) impact.push({ exerciseId: ex.id, prompt: ex.prompt, detached });
  }
  return impact;
}

/** Saves the source and re-anchors every span of the lesson's exercises that point at it (updates their content). */
export async function saveSource(db: SupabaseClient, lessonId: string, input: SourceInput): Promise<{ id: string }> {
  if (typeof input?.body !== 'string' || blank(input.body)) throw new UserError('Textul sursei nu poate fi gol.');
  const fields = {
    title: orNull(input.title),
    author: typeof input.author === 'string' ? input.author.trim() : '',
    work: typeof input.work === 'string' ? input.work.trim() : '',
    body: input.body.trim(),
  };
  const saved = await upsert(db, 'sources', lessonId, input.id, fields);
  if (input.id) {
    for (const ex of await exercisesUsing(db, lessonId, input.id)) {
      let changed = false;
      const next = mapSpans(ex, (s) => {
        if (s.sourceId !== input.id) return s;
        const moved = reanchorSpan(fields.body, s);
        if (!moved) return s; // detached: kept as is, validateExercise reports it
        if (moved.start !== s.start || moved.end !== s.end || moved.limitStart !== s.limitStart || moved.limitEnd !== s.limitEnd) changed = true;
        return moved;
      });
      if (!changed) continue;
      const { id: _id, position: _p, sources: _s, ...rest } = next;
      checkAffected(
        await db.from('consolidation_exercises').update({ content: exerciseToRow(rest).content }).eq('id', ex.id).eq('lesson_id', lessonId).select('id'),
      );
    }
  }
  return saved;
}

export async function deleteSource(db: SupabaseClient, id: string): Promise<void> {
  const lessonId = await sourceLesson(db, id);
  const used = check(await db.from('consolidation_exercise_sources').select('exercise_id').eq('source_id', id).limit(1)) as unknown[];
  if (used.length) throw new UserError('Sursa este folosită de un exercițiu.');
  checkAffected(await db.from('sources').delete().eq('id', id).select('id'));
  const rows = await siblings(db, 'sources', 'lesson_id', lessonId);
  await renumber(db, 'sources', rows.map((r) => r.id), rows);
}

/** Rebuilds the exercise from untrusted input through the shared model and trims the free-text fields (never span text). */
function normalizeExercise(input: ExerciseInput): ConsolidationExercise {
  if (!CONSOLIDATION_TYPES.includes(input?.type) || !Array.isArray(input.sources)) throw new UserError(GENERIC_ERROR);
  const sources: SourceRef[] = input.sources.map((s, i) => ({ sourceId: String(s?.sourceId ?? ''), label: i === 0 ? 'A' : 'B' }));
  const ex = exerciseFromRow(
    {
      id: input.id ?? 'new', position: 0, type: input.type, prompt: typeof input.prompt === 'string' ? input.prompt : '',
      content: input as unknown as Record<string, unknown>, template_id: typeof input.templateId === 'string' ? input.templateId : null,
      credit_cost: input.creditCost, // a non-number falls back to the type default; validateExercise checks the range
    },
    sources,
  );
  const base = { ...ex, prompt: ex.prompt.trim(), modelAnswer: orNull(ex.modelAnswer), explanation: orNull(ex.explanation) };
  const list = (a: string[]) => a.map((x) => x.trim()).filter((x) => x !== '');
  switch (base.type) {
    case 'short_answer':
      return {
        ...base,
        accepted: list(base.accepted),
        mistakes: base.mistakes.map((m) => ({ answer: m.answer.trim(), message: m.message.trim() })).filter((m) => m.answer !== ''),
      };
    case 'multi_answer':
      return { ...base, groups: base.groups.map((g) => ({ ...g, variants: list(g.variants) })) };
    case 'cause_effect':
      return { ...base, pairs: base.pairs.map((p) => ({ ...p, explanation: orNull(p.explanation) })) };
    case 'essay':
      return {
        ...base,
        requirements: base.requirements.map((r) => ({ ...r, text: r.text.trim(), modelAnswer: orNull(r.modelAnswer) })),
      };
    default:
      return base;
  }
}

function normalizeAi(ex: ConsolidationExercise, raw: unknown): AiContext {
  if (!AI_TYPES.has(ex.type)) return EMPTY_AI;
  const ai = aiFromJson(raw);
  const o = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const id = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
  if (ex.type === 'essay') {
    const given = typeof o.requirementTemplates === 'object' && o.requirementTemplates !== null ? (o.requirementTemplates as Record<string, unknown>) : {};
    const requirements: Record<string, string> = {};
    const requirementTemplates: Record<string, string> = {};
    for (const r of ex.requirements) {
      requirements[r.id] = (ai.requirements[r.id] ?? '').trim();
      const t = id(given[r.id]);
      if (t) requirementTemplates[r.id] = t; // ids of removed requirements are dropped
    }
    return { main: '', requirements, templateId: null, requirementTemplates };
  }
  return { main: ai.main.trim(), requirements: {}, templateId: id(o.templateId), requirementTemplates: {} };
}

export async function saveConsolidationExercise(db: SupabaseClient, lessonId: string, input: ExerciseInput): Promise<{ id: string }> {
  const ex = normalizeExercise(input);
  const ai = normalizeAi(ex, input.ai);

  const lessonSources = await loadSources(db, lessonId);
  const ownIds = new Set(lessonSources.map((s) => s.id));
  const linked = ex.sources.map((s) => s.sourceId);
  if (linked.some((id) => !ownIds.has(id)) || new Set(linked).size !== linked.length) {
    throw new UserError('Sursele exercițiului trebuie să aparțină lecției și să fie diferite.');
  }

  const templateIds = new Set<string>();
  if (ex.templateId) templateIds.add(ex.templateId);
  if (ex.type === 'essay') for (const r of ex.requirements) if (r.templateId) templateIds.add(r.templateId);
  if (templateIds.size) {
    const found = check(await db.from('solution_templates').select('id').in('id', [...templateIds])) as unknown as unknown[];
    if (found.length !== templateIds.size) throw new UserError('Șablonul ales nu există.');
  }

  const chosen = [ai.templateId, ...Object.values(ai.requirementTemplates)].filter((x): x is string => !!x);
  if (chosen.length) {
    const found = check(await db.from('ai_templates').select('id,type').in('id', [...new Set(chosen)])) as unknown as Array<{ id: string; type: string }>;
    const typeOf = new Map(found.map((t) => [t.id, t.type]));
    if (chosen.some((x) => !typeOf.has(x))) throw new UserError('Șablonul AI ales nu există.');
    if (chosen.some((x) => typeOf.get(x) !== aiTemplateTypeFor(ex.type))) throw new UserError(MISMATCH);
  }

  const errors = validateExercise(ex, lessonSources, ai);
  if (errors.length) throw new UserError(errors.join(' '));

  const { id: _id, position: _position, sources: _sources, ...rest } = ex;
  const saved = await upsert(db, 'consolidation_exercises', lessonId, input.id, exerciseToRow(rest));

  check(await db.from('consolidation_exercise_sources').delete().eq('exercise_id', saved.id));
  if (ex.sources.length) {
    check(
      await db.from('consolidation_exercise_sources').insert(
        ex.sources.map((s, position) => ({ exercise_id: saved.id, source_id: s.sourceId, label: s.label, position })),
      ),
    );
  }
  check(await db.from('consolidation_ai_context').upsert({ exercise_id: saved.id, context: { main: ai.main, requirements: ai.requirements } }));
  check(await db.from('consolidation_ai_template_links').delete().eq('exercise_id', saved.id));
  const links = [
    ...(ai.templateId ? [{ exercise_id: saved.id, requirement_id: '', template_id: ai.templateId }] : []),
    ...Object.entries(ai.requirementTemplates).map(([rid, tid]) => ({ exercise_id: saved.id, requirement_id: rid, template_id: tid })),
  ];
  if (links.length) check(await db.from('consolidation_ai_template_links').insert(links));
  return saved;
}
