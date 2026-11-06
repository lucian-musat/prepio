import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { validateExercise } from '@prepio/shared';
import { addConsolidation } from './addConsolidation';
import { loadConsolidation } from './consolidation.testutil';
import { lessons } from './index';
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

  beforeAll(async () => {
    client = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    await seed(client, { reset: true });
    // Simulate production after the consolidation migration: only the converted essays, no sources, no templates.
    for (const l of lessons) {
      const id = await lessonId(l.title);
      const del = await client.from('consolidation_exercises').delete().eq('lesson_id', id).neq('type', 'essay');
      if (del.error) throw del.error;
      const src = await client.from('sources').delete().eq('lesson_id', id);
      if (src.error) throw src.error;
      // The migration numbered the converted essays from 0.
      const essays = await client.from('consolidation_exercises').select('id').eq('lesson_id', id).order('position');
      if (essays.error) throw essays.error;
      for (const [position, e] of essays.data.entries()) {
        const upd = await client.from('consolidation_exercises').update({ position }).eq('id', e.id);
        if (upd.error) throw upd.error;
      }
    }
    const tpl = await client.from('solution_templates').delete().in('title', TEMPLATES.map((t) => t.title));
    if (tpl.error) throw tpl.error;
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
      const seedEssays = l.consolidation.filter((c) => c.type === 'essay');
      // Existing essays keep their place; the new exercises follow, in seed order.
      expect(stored.exercises.map((e) => e.exercise.prompt)).toEqual([...seedEssays, ...seedNonEssay].map((c) => c.prompt));
      expect(stored.exercises.map((e) => e.exercise.position)).toEqual(stored.exercises.map((_, i) => i));
      for (const [i, c] of seedNonEssay.entries()) {
        const { exercise, ai } = stored.exercises[seedEssays.length + i]!;
        expect(validateExercise(exercise, stored.sources, ai), c.prompt).toEqual([]);
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
});
