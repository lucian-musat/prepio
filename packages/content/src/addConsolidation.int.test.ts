import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { validateExercise } from '@prepio/shared';
import { addConsolidation } from './addConsolidation';
import { loadConsolidation, MIGRATED_ESSAYS, toMigratedState } from './consolidation.testutil';
import { lessons } from './index';
import { withPendingTemplates } from './consolidation';
import { seed } from './seed';
import { TEMPLATES } from './templates';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const NON_ESSAY = lessons.reduce((n, l) => n + l.consolidation.filter((c) => c.type !== 'essay').length, 0);
const SOURCES = lessons.reduce((n, l) => n + l.sources.length, 0);

describe.skipIf(!url || !serviceKey)('addConsolidation (integration)', () => {
  let client: SupabaseClient;

  const lessonId = async (title: string): Promise<string> => {
    const { data, error } = await client.from('lessons').select('id').eq('title', title).single();
    if (error) throw error;
    return data.id;
  };
  const snapshot = async () => {
    const out: Record<string, unknown> = {};
    for (const table of ['solution_templates', 'sources', 'consolidation_exercises', 'consolidation_exercise_sources', 'consolidation_ai_context']) {
      const { data, error } = await client.from(table).select('*');
      if (error) throw error;
      out[table] = JSON.stringify(data.map((r) => JSON.stringify(r)).sort());
    }
    return out;
  };

  /** Production after the consolidation migration: only the converted essays (from position 0), no sources, no templates. */
  const toProductionState = () => toMigratedState(client, lessons);

  /** The real client, except that inserts into `table` fail. */
  const failingOn = (table: string): SupabaseClient =>
    new Proxy(client, {
      get(target, prop, receiver) {
        if (prop !== 'from') return Reflect.get(target, prop, receiver);
        return (t: string) => {
          const builder = target.from(t);
          if (t !== table) return builder;
          return new Proxy(builder, {
            get(b, p, r) {
              return p === 'insert' ? async () => ({ data: null, error: { message: `simulated ${table} failure` } }) : Reflect.get(b, p, r);
            },
          });
        };
      },
    });

  const lessonState = async (title: string) => {
    const id = await lessonId(title);
    const src = await client.from('sources').select('id').eq('lesson_id', id);
    const ex = await client.from('consolidation_exercises').select('id, type').eq('lesson_id', id);
    if (src.error) throw src.error;
    if (ex.error) throw ex.error;
    const ids = ex.data.map((e) => e.id);
    const links = await client.from('consolidation_exercise_sources').select('exercise_id').in('exercise_id', ids);
    const ctx = await client.from('consolidation_ai_context').select('exercise_id').in('exercise_id', ids);
    return { sources: src.data.length, types: ex.data.map((e) => e.type), links: links.data?.length, contexts: ctx.data?.length };
  };

  beforeAll(async () => {
    client = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    await toProductionState();
  });

  afterAll(async () => {
    await seed(client, { reset: true });
  });

  it('a dry run plans the templates, sources and non-essay exercises and changes nothing', async () => {
    const before = await snapshot();
    const result = await addConsolidation(client, { apply: false });
    expect(result.problems).toBe(0);
    expect(result.planned.filter((p) => p.startsWith('template'))).toHaveLength(TEMPLATES.length);
    expect(result.planned.filter((p) => p.startsWith('source'))).toHaveLength(SOURCES);
    expect(result.planned.filter((p) => p.startsWith('exercise'))).toHaveLength(NON_ESSAY);
    expect(await snapshot()).toEqual(before);
  });

  it('--apply inserts them after the existing essays, valid, with links, templates and AI contexts', async () => {
    const result = await addConsolidation(client, { apply: true });
    expect(result.problems).toBe(0);
    expect(result.planned).toHaveLength(TEMPLATES.length + SOURCES + NON_ESSAY);

    const { data: tpl, error } = await client.from('solution_templates').select('id,title');
    if (error) throw error;
    const keyOf = new Map(tpl.map((t) => [t.id as string, TEMPLATES.find((x) => x.title === t.title)?.key]));
    expect(TEMPLATES.every((t) => tpl.some((r) => r.title === t.title))).toBe(true);

    for (const l of lessons) {
      const stored = await loadConsolidation(client, await lessonId(l.title));
      expect(stored.sources.map((s) => s.body)).toEqual(l.sources.map((s) => s.body));
      const seedNonEssay = l.consolidation.filter((c) => c.type !== 'essay');
      const seedEssays = MIGRATED_ESSAYS[l.key]!;
      // Existing essays keep their place; the new exercises follow, in seed order.
      expect(stored.exercises.map((e) => e.exercise.prompt)).toEqual([...seedEssays, ...seedNonEssay].map((c) => c.prompt));
      expect(stored.exercises.map((e) => e.exercise.position)).toEqual(stored.exercises.map((_, i) => i));
      for (const [i, c] of seedNonEssay.entries()) {
        const { exercise, ai } = stored.exercises[seedEssays.length + i]!;
        expect(validateExercise(exercise, stored.sources, withPendingTemplates(exercise, ai)), c.prompt).toEqual([]);
        expect(exercise.templateId && keyOf.get(exercise.templateId)).toBe(c.template);
        expect(exercise.sources).toHaveLength(c.sources.length);
        if (c.ai) expect(ai).toEqual(c.ai);
      }
    }
  });

  it('a re-run plans nothing and changes nothing', async () => {
    const before = await snapshot();
    const dry = await addConsolidation(client, { apply: false });
    expect(dry).toMatchObject({ planned: [], problems: 0 });
    const again = await addConsolidation(client, { apply: true });
    expect(again).toMatchObject({ planned: [], problems: 0 });
    expect(await snapshot()).toEqual(before);
  });

  it('reports a seed lesson that is not found among the published lessons', async () => {
    const title = lessons[1]!.title;
    const id = await lessonId(title);
    expect((await client.from('lessons').update({ status: 'draft' }).eq('id', id)).error).toBeNull();
    try {
      const result = await addConsolidation(client, { apply: false });
      expect(result.problems).toBe(1);
      expect(result.skipped.join('\n')).toContain(title);
    } finally {
      await client.from('lessons').update({ status: 'published' }).eq('id', id);
    }
  });

  it('does not add missing templates when no lesson is written', async () => {
    const title = TEMPLATES[0]!.title;
    expect((await client.from('solution_templates').update({ title: `[test] ${title}` }).eq('title', title)).error).toBeNull();
    try {
      const before = await snapshot();
      const result = await addConsolidation(client, { apply: true });
      expect(result).toMatchObject({ planned: [], problems: 0 });
      expect(result.skipped.join('\n')).toContain('1 missing template(s) not added');
      expect(await snapshot()).toEqual(before);
    } finally {
      await client.from('solution_templates').update({ title }).eq('title', `[test] ${title}`);
    }
  });

  it.each(['consolidation_exercise_sources', 'consolidation_ai_context'])(
    'a failure while inserting %s removes the rows inserted for that lesson and aborts',
    async (table) => {
      await toProductionState();
      await expect(addConsolidation(failingOn(table), { apply: true })).rejects.toThrow(
        new RegExp(`simulated ${table} failure.*removed again`),
      );
      for (const l of lessons) {
        const state = await lessonState(l.title);
        expect(state, l.title).toEqual({ sources: 0, types: ['essay', 'essay'], links: 0, contexts: 2 });
      }
      // The next run starts from a clean state and completes.
      const retry = await addConsolidation(client, { apply: true });
      expect(retry.problems).toBe(0);
      expect(retry.planned.filter((p) => p.startsWith('exercise'))).toHaveLength(NON_ESSAY);
    },
  );

  it('reports a lesson that has sources but no exercise besides essays and leaves it alone', async () => {
    await toProductionState();
    const lesson = lessons[0]!;
    const id = await lessonId(lesson.title);
    const s = lesson.sources[0]!;
    const ins = await client.from('sources').insert({ lesson_id: id, title: s.title, author: s.author, work: s.work, body: s.body });
    if (ins.error) throw ins.error;

    const result = await addConsolidation(client, { apply: true });
    expect(result.problems).toBe(1);
    expect(result.skipped.join('\n')).toMatch(new RegExp(`${lesson.title.replace(/[()]/g, '.')}: PROBLEM.*check by hand`));
    expect(result.planned.some((p) => p.includes(lesson.title))).toBe(false);
    expect(await lessonState(lesson.title)).toEqual({ sources: 1, types: ['essay', 'essay'], links: 0, contexts: 2 });
    // The other lessons are written.
    expect(result.planned.filter((p) => p.startsWith('exercise'))).toHaveLength(
      NON_ESSAY - lesson.consolidation.filter((c) => c.type !== 'essay').length,
    );
  });
});
