import type { SupabaseClient } from '@supabase/supabase-js';
import {
  aiTemplateTypeFor,
  DEFAULT_CREDIT_COST,
  exerciseToRow,
  type AiContext,
  type AiTemplateType,
  type AnswerSpan,
  type ConsolidationExercise,
  type SourceRef,
} from '@prepio/shared';
import { AI_TEMPLATES } from './aiTemplates';
import { TEMPLATES } from './templates';
import type { SeedAiTemplate, SeedConsolidation, SeedSource, SeedSpan, SeedTemplate } from './types';

export function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

/** Short title for an essay exercise: the first 80 characters, cut at a word boundary (same rule as the SQL migration). */
export function essayTitle(prompt: string): string {
  if (prompt.length <= 80) return prompt;
  let title = prompt.slice(0, 80);
  if (!/\s/.test(prompt[80]!) && /\s/.test(title)) title = title.replace(/\s+\S*$/, '');
  return `${title.replace(/[\s,;:]+$/, '')}…`;
}

/** A former writing exercise as the consolidation migration stores it: a one-requirement essay, criteria as its context. */
export function essayFromWriting(prompt: string, criteria: string): SeedConsolidation {
  return {
    type: 'essay',
    prompt: essayTitle(prompt),
    template: null,
    sources: [],
    requirements: [{ id: 'r1', text: prompt, modelAnswer: null, template: null, argument: false }],
    ai: { main: '', requirements: { r1: criteria } },
  };
}

/** Every span quoted by a seed exercise. */
export function seedSpans(c: SeedConsolidation): SeedSpan[] {
  switch (c.type) {
    case 'source_info':
    case 'viewpoint':
      return c.spans;
    case 'source_letter':
      return c.evidence ? [c.evidence] : [];
    case 'cause_effect':
      return c.pairs.flatMap((p) => [p.cause, p.effect]);
    default:
      return [];
  }
}

const LABELS = ['A', 'B'] as const;

/**
 * Turns a seed exercise into the shared model: source keys become ids (labelled A/B in order), quotes become offsets
 * (`body.indexOf(quote)`, limit = the sentence), template keys become ids. An AI exercise (each essay requirement) gets
 * the AI template of its type from `aiTemplateIds`: seed exercises never name one. Throws on a quote that is not in its
 * source, an unknown key or a missing AI template type, naming the exercise. `position` is 0; the writer sets it.
 */
export function toExercise(
  c: SeedConsolidation,
  sourceIds: Map<string, string>,
  bodies: Map<string, string>,
  templateIds: Map<string, string>,
  aiTemplateIds: Map<AiTemplateType, string>,
  newId: () => string,
): { exercise: ConsolidationExercise; ai: AiContext } {
  const fail = (msg: string): never => {
    throw new Error(`Exercise „${c.prompt}”: ${msg}`);
  };
  const sourceId = (key: string): string => sourceIds.get(key) ?? fail(`unknown source „${key}”`);
  const template = (key: string | null): string | null => (key === null ? null : (templateIds.get(key) ?? fail(`unknown template „${key}”`)));
  const span = (s: SeedSpan): AnswerSpan => {
    const id = sourceId(s.source);
    const body = bodies.get(s.source) ?? fail(`no body for source „${s.source}”`);
    const start = body.indexOf(s.quote);
    if (start < 0) fail(`quote not found in source „${s.source}”: „${s.quote}”`);
    return { id: newId(), sourceId: id, start, end: start + s.quote.length, text: s.quote, limitStart: null, limitEnd: null };
  };

  if (c.sources.length > LABELS.length) fail('at most 2 sources');
  const head = {
    id: newId(),
    position: 0,
    prompt: c.prompt,
    templateId: template(c.template),
    sources: c.sources.map((key, i): SourceRef => ({ sourceId: sourceId(key), label: LABELS[i]! })),
    modelAnswer: c.modelAnswer ?? null,
    explanation: c.explanation ?? null,
    // Seed content never sets a cost: it gets the type default, the same as the credits migration gave existing rows.
    creditCost: DEFAULT_CREDIT_COST[c.type],
  };

  let exercise: ConsolidationExercise;
  switch (c.type) {
    case 'short_answer':
      exercise = { ...head, type: c.type, accepted: c.accepted, mistakes: c.mistakes };
      break;
    case 'multi_answer':
      exercise = { ...head, type: c.type, count: c.count, groups: c.groups.map((variants) => ({ id: newId(), variants })) };
      break;
    case 'source_info':
    case 'viewpoint':
      exercise = { ...head, type: c.type, count: c.count, spans: c.spans.map(span) };
      break;
    case 'source_letter':
      exercise = { ...head, type: c.type, correct: c.correct, evidence: c.evidence ? span(c.evidence) : null };
      break;
    case 'cause_effect':
      exercise = {
        ...head,
        type: c.type,
        pairs: c.pairs.map((p) => ({ id: newId(), cause: span(p.cause), effect: span(p.effect), explanation: p.explanation })),
      };
      break;
    case 'facts':
      exercise = { ...head, type: c.type, count: c.count };
      break;
    case 'comparison':
      exercise = { ...head, type: c.type, variant: c.variant };
      break;
    case 'argument':
      exercise = { ...head, type: c.type };
      break;
    case 'essay':
      exercise = {
        ...head,
        type: c.type,
        requirements: c.requirements.map((r) => ({
          id: r.id,
          text: r.text,
          modelAnswer: r.modelAnswer,
          templateId: template(r.template),
          argument: r.argument,
        })),
      };
      break;
  }

  // Same shape the admin stores: empty for deterministic types, `main` or one entry per requirement otherwise.
  const aiType = aiTemplateTypeFor(exercise.type);
  const aiTemplate = (type: AiTemplateType): string => aiTemplateIds.get(type) ?? fail(`no AI template of type „${type}”`);
  let ai: AiContext = { main: '', requirements: {}, templateId: null, requirementTemplates: {} };
  if (exercise.type === 'essay') {
    ai = {
      main: '',
      requirements: Object.fromEntries(exercise.requirements.map((r) => [r.id, c.ai?.requirements[r.id] ?? ''])),
      templateId: null,
      requirementTemplates: Object.fromEntries(exercise.requirements.map((r) => [r.id, aiTemplate('essay_requirement')])),
    };
  } else if (aiType) {
    ai = { main: c.ai?.main ?? '', requirements: {}, templateId: aiTemplate(aiType), requirementTemplates: {} };
  }
  return { exercise, ai };
}

/**
 * Finds the seed AI templates by title, like `ensureTemplates`: with `apply`, inserts the missing ones; returns
 * type → id for the templates that exist afterwards and those that were (or, in a dry run, would be) inserted.
 * Never changes an existing template.
 */
export async function ensureAiTemplates(
  client: SupabaseClient,
  apply: boolean,
  templates: SeedAiTemplate[] = AI_TEMPLATES,
  opts: { tolerateMismatch?: boolean } = {},
): Promise<{ ids: Map<AiTemplateType, string>; missing: SeedAiTemplate[]; mismatched: string[] }> {
  const rows = check(
    await client.from('ai_templates').select('id, title, type').in('title', templates.map((t) => t.title)).order('created_at'),
    'find AI templates',
  ) as { id: string; title: string; type: string }[];
  const ids = new Map<AiTemplateType, string>();
  const missing: SeedAiTemplate[] = [];
  const mismatched: string[] = [];
  for (const t of templates) {
    const row = rows.find((r) => r.title === t.title);
    if (!row) missing.push(t);
    // A template with the seed's title but another type is not usable for this type: reported, never linked.
    else if (row.type !== t.key) mismatched.push(`template „${t.title}” exists with type ${row.type}, expected ${t.key}`);
    else ids.set(t.key, row.id);
  }
  if (mismatched.length && !opts.tolerateMismatch) throw new Error(mismatched.join('; '));
  if (apply && missing.length) {
    const inserted = check(
      await client
        .from('ai_templates')
        .insert(missing.map((t) => ({ title: t.title, type: t.key, criteria: t.criteria, keywords: t.keywords, response_format: t.responseFormat })))
        .select('id, title'),
      'insert AI templates',
    ) as { id: string; title: string }[];
    for (const t of missing) ids.set(t.key, inserted.find((r) => r.title === t.title)!.id);
  }
  return { ids, missing, mismatched };
}

/**
 * Finds the seed templates by title. With `apply`, inserts the missing ones; returns key → id for the templates that
 * exist afterwards and the titles that were (or, in a dry run, would be) inserted. Never changes an existing template.
 */
export async function ensureTemplates(
  client: SupabaseClient,
  apply: boolean,
  templates: SeedTemplate[] = TEMPLATES,
): Promise<{ ids: Map<string, string>; missing: SeedTemplate[] }> {
  const rows = check(
    await client.from('solution_templates').select('id, title').in('title', templates.map((t) => t.title)).order('created_at'),
    'find templates',
  ) as { id: string; title: string }[];
  const ids = new Map<string, string>();
  const missing: SeedTemplate[] = [];
  for (const t of templates) {
    const row = rows.find((r) => r.title === t.title);
    if (row) ids.set(t.key, row.id);
    else missing.push(t);
  }
  if (apply && missing.length) {
    const inserted = check(
      await client
        .from('solution_templates')
        .insert(missing.map((t) => ({ title: t.title, exercise_type: t.exerciseType, points: t.points, body: t.body })))
        .select('id, title'),
      'insert templates',
    ) as { id: string; title: string }[];
    for (const t of missing) ids.set(t.key, inserted.find((r) => r.title === t.title)!.id);
  }
  return { ids, missing };
}

/**
 * Inserts sources and exercises (with their source links, AI contexts and AI template links) into a lesson, after the
 * sources and exercises it already has. Every exercise is converted (and so checked) before anything is written. The
 * writes are not one transaction: when one fails, the rows inserted by this call (ids generated up front) are deleted
 * again and the error is rethrown, saying whether the rollback succeeded.
 */
export async function writeConsolidation(
  client: SupabaseClient,
  lessonId: string,
  sources: SeedSource[],
  items: SeedConsolidation[],
  templateIds: Map<string, string>,
  aiTemplateIds: Map<AiTemplateType, string>,
  newId: () => string,
): Promise<void> {
  const [lastSource] = check(
    await client.from('sources').select('position').eq('lesson_id', lessonId).order('position', { ascending: false }).limit(1),
    'find last source',
  ) as { position: number }[];
  const [lastExercise] = check(
    await client.from('consolidation_exercises').select('position').eq('lesson_id', lessonId).order('position', { ascending: false }).limit(1),
    'find last exercise',
  ) as { position: number }[];

  const sourceIds = new Map(sources.map((s) => [s.key, newId()]));
  const bodies = new Map(sources.map((s) => [s.key, s.body]));
  const converted = items.map((c) => toExercise(c, sourceIds, bodies, templateIds, aiTemplateIds, newId));

  try {
    await insertConsolidation(client, lessonId, sources, sourceIds, converted, lastSource, lastExercise);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Exercises first: their links restrict source deletes; links (source and AI template) and contexts go with them by cascade.
    const exercises = await client.from('consolidation_exercises').delete().in('id', converted.map((c) => c.exercise.id));
    const srcs = exercises.error ? exercises : await client.from('sources').delete().in('id', [...sourceIds.values()]);
    const rollback = srcs.error
      ? `ROLLBACK FAILED (${srcs.error.message}): check the lesson's sources and exercises by hand`
      : 'the rows inserted for this lesson were removed again';
    throw new Error(`${message} (lesson ${lessonId}: ${rollback})`);
  }
}

async function insertConsolidation(
  client: SupabaseClient,
  lessonId: string,
  sources: SeedSource[],
  sourceIds: Map<string, string>,
  converted: { exercise: ConsolidationExercise; ai: AiContext }[],
  lastSource: { position: number } | undefined,
  lastExercise: { position: number } | undefined,
): Promise<void> {
  if (sources.length) {
    const first = (lastSource?.position ?? -1) + 1;
    check(
      await client.from('sources').insert(
        sources.map((s, i) => ({
          id: sourceIds.get(s.key),
          lesson_id: lessonId,
          position: first + i,
          title: s.title,
          author: s.author,
          work: s.work,
          body: s.body,
        })),
      ),
      'insert sources',
    );
  }
  if (!converted.length) return;

  const first = (lastExercise?.position ?? -1) + 1;
  check(
    await client.from('consolidation_exercises').insert(
      converted.map(({ exercise }, i) => {
        const { id, position: _position, sources: _sources, ...rest } = exercise;
        return { id, lesson_id: lessonId, position: first + i, ...exerciseToRow(rest) };
      }),
    ),
    'insert exercises',
  );
  const links = converted.flatMap(({ exercise }) =>
    exercise.sources.map((s, position) => ({ exercise_id: exercise.id, source_id: s.sourceId, label: s.label, position })),
  );
  if (links.length) check(await client.from('consolidation_exercise_sources').insert(links), 'insert exercise sources');
  // The jsonb context holds the text only, as the admin stores it; the template ids go to the links.
  check(
    await client
      .from('consolidation_ai_context')
      .insert(converted.map(({ exercise, ai }) => ({ exercise_id: exercise.id, context: { main: ai.main, requirements: ai.requirements } }))),
    'insert exercise contexts',
  );
  const aiLinks = converted.flatMap(({ exercise, ai }) => [
    ...(ai.templateId ? [{ exercise_id: exercise.id, requirement_id: '', template_id: ai.templateId }] : []),
    ...Object.entries(ai.requirementTemplates).map(([requirementId, templateId]) => ({
      exercise_id: exercise.id,
      requirement_id: requirementId,
      template_id: templateId,
    })),
  ]);
  if (aiLinks.length) check(await client.from('consolidation_ai_template_links').insert(aiLinks), 'insert AI template links');
}
