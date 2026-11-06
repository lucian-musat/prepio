import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { validateExercise } from '@prepio/shared';
import { addConsolidation } from './addConsolidation';
import { writeConsolidation } from './consolidation';
import { loadConsolidation, MIGRATED_ESSAYS, toMigratedState } from './consolidation.testutil';
import { lessons } from './index';
import { seed } from './seed';
import { syncConsolidation } from './syncConsolidation';
import { TEMPLATES } from './templates';
import type { SeedLesson } from './types';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!url || !serviceKey)('syncConsolidation (integration)', () => {
  let client: SupabaseClient;
  let userId: string;

  const lessonId = async (title: string): Promise<string> => {
    const { data, error } = await client.from('lessons').select('id').eq('title', title).single();
    if (error) throw error;
    return data.id;
  };
  const snapshot = async () => {
    const out: Record<string, unknown> = {};
    for (const table of [
      'solution_templates',
      'sources',
      'consolidation_exercises',
      'consolidation_exercise_sources',
      'consolidation_ai_context',
      'consolidation_attempts',
      'consolidation_runs',
    ]) {
      const { data, error } = await client.from(table).select('*');
      if (error) throw error;
      out[table] = JSON.stringify(data.map((r) => JSON.stringify(r)).sort());
    }
    return out;
  };
  /** Rows of every table that hangs off a lesson, for the lessons the sync must not touch. */
  const lessonRows = async (id: string) => {
    const ex = await client.from('consolidation_exercises').select('*').eq('lesson_id', id).order('position');
    const src = await client.from('sources').select('*').eq('lesson_id', id).order('position');
    const cards = await client.from('cards').select('*').eq('lesson_id', id).order('position');
    return { ex: ex.data, src: src.data, cards: cards.data };
  };

  /** Production as it is after the consolidation release: the migrated essays, then the add-consolidation set. */
  const toOldProduction = async () => {
    await toMigratedState(client, lessons);
    const added = await addConsolidation(client, { apply: true });
    expect(added.problems).toBe(0);
  };

  /** A student attempt and run on the first exercise of a lesson. */
  const studentWork = async (id: string): Promise<string> => {
    const { data, error } = await client.from('consolidation_exercises').select('id, type').eq('lesson_id', id).order('position').limit(1).single();
    if (error) throw error;
    const att = await client
      .from('consolidation_attempts')
      .insert({ user_id: userId, exercise_id: data.id, answer: { type: data.type }, feedback: { verdict: null, items: [] }, verdict: null });
    if (att.error) throw att.error;
    const run = await client.from('consolidation_runs').insert({ user_id: userId, lesson_id: id, exercise_ids: [data.id], index: 0 });
    if (run.error) throw run.error;
    return data.id;
  };

  beforeAll(async () => {
    client = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    await seed(client, { reset: true });
    const { data, error } = await client.auth.admin.createUser({ email: 'test-sync-int@example.com', password: 'test-pass-123456', email_confirm: true });
    if (error) throw error;
    userId = data.user.id;
  });

  afterAll(async () => {
    await client.auth.admin.deleteUser(userId);
    await seed(client, { reset: true });
  });

  it('reports a freshly seeded database as in sync and plans nothing', async () => {
    const before = await snapshot();
    const r = await syncConsolidation(client, { apply: true });
    expect(r.lessons.map((l) => l.status)).toEqual(lessons.map(() => 'in_sync'));
    expect(r).toMatchObject({ replaced: 0, problems: 0, missingTemplates: [], changedTemplates: [] });
    expect(await snapshot()).toEqual(before);
  });

  it('a dry run on the old production shape plans every lesson and writes nothing', async () => {
    await toOldProduction();
    await studentWork(await lessonId(lessons[0]!.title));
    const before = await snapshot();
    const r = await syncConsolidation(client, { apply: false });
    expect(await snapshot()).toEqual(before);
    expect(r.problems).toBe(0);
    expect(r.lessons.map((l) => l.status)).toEqual(lessons.map(() => 'replace'));
    const first = r.lessons[0]!;
    if (first.status !== 'replace') throw new Error(first.status);
    expect(first.current.types.essay).toBe(MIGRATED_ESSAYS[lessons[0]!.key]!.length);
    expect(first.next.exercises).toBe(lessons[0]!.consolidation.length);
    expect(first).toMatchObject({ attempts: 1, runs: 1 });
  });

  it('--apply replaces each lesson with exactly the seed set, removing old attempts and runs; a re-run plans nothing', async () => {
    const id0 = await lessonId(lessons[0]!.title);
    const { data: oldEx } = await client.from('consolidation_exercises').select('id').eq('lesson_id', id0);
    const r = await syncConsolidation(client, { apply: true });
    expect(r).toMatchObject({ replaced: lessons.length, problems: 0 });

    const { data: tpl, error } = await client.from('solution_templates').select('id,title');
    if (error) throw error;
    const keyOf = new Map(tpl.map((t) => [t.id as string, TEMPLATES.find((x) => x.title === t.title)?.key]));
    for (const l of lessons) {
      const stored = await loadConsolidation(client, await lessonId(l.title));
      expect(stored.sources.map((s) => [s.position, s.title, s.body])).toEqual(l.sources.map((s, i) => [i, s.title, s.body]));
      expect(stored.exercises.map((e) => [e.exercise.position, e.exercise.type, e.exercise.prompt])).toEqual(
        l.consolidation.map((c, i) => [i, c.type, c.prompt]),
      );
      stored.exercises.forEach(({ exercise, ai }, i) => {
        const c = l.consolidation[i]!;
        expect(validateExercise(exercise, stored.sources, ai), c.prompt).toEqual([]);
        expect(exercise.templateId && keyOf.get(exercise.templateId)).toBe(c.template);
        if (c.ai) expect(ai).toEqual(c.ai);
      });
    }
    const attempts = await client.from('consolidation_attempts').select('exercise_id').in('exercise_id', oldEx!.map((e) => e.id));
    expect(attempts.data).toEqual([]);
    const runs = await client.from('consolidation_runs').select('lesson_id').eq('lesson_id', id0);
    expect(runs.data).toEqual([]);
    const ex = await client.from('consolidation_exercises').select('id').in('id', oldEx!.map((e) => e.id));
    expect(ex.data).toEqual([]);

    const before = await snapshot();
    const again = await syncConsolidation(client, { apply: true });
    expect(again.lessons.map((l) => l.status)).toEqual(lessons.map(() => 'in_sync'));
    expect(again.replaced).toBe(0);
    expect(await snapshot()).toEqual(before);
  });

  it('replaces only the lessons out of sync, leaving the others and owner-authored lessons untouched', async () => {
    await seed(client, { reset: true });
    // Lesson 1 holds only an old migrated essay.
    const target = lessons[1]!;
    const targetId = await lessonId(target.title);
    await client.from('consolidation_exercises').delete().eq('lesson_id', targetId);
    await client.from('sources').delete().eq('lesson_id', targetId);
    await writeConsolidation(client, targetId, [], MIGRATED_ESSAYS[target.key]!.slice(0, 1), new Map(), randomUUID);
    await studentWork(targetId);
    // An owner-authored lesson with its own exercise, not in the seed.
    const node = await client.from('lessons').select('node_id').eq('id', targetId).single();
    const own = await client.from('lessons').insert({ node_id: node.data!.node_id, title: '[test] own lesson', position: 99, status: 'published' }).select('id').single();
    if (own.error) throw own.error;
    await writeConsolidation(client, own.data.id, [], MIGRATED_ESSAYS[target.key]!.slice(1), new Map(), randomUUID);

    const others = lessons.filter((l) => l !== target);
    const untouched = async () => Promise.all([...others.map(async (l) => lessonRows(await lessonId(l.title))), lessonRows(own.data.id)]);
    const before = await untouched();

    const r = await syncConsolidation(client, { apply: true });
    expect(r.lessons.map((l) => [l.title, l.status])).toEqual(lessons.map((l) => [l.title, l === target ? 'replace' : 'in_sync']));
    expect(await untouched()).toEqual(before);
    const stored = await loadConsolidation(client, targetId);
    expect(stored.exercises.map((e) => [e.exercise.type, e.exercise.prompt])).toEqual(target.consolidation.map((c) => [c.type, c.prompt]));
    expect((await client.from('consolidation_runs').select('lesson_id').eq('lesson_id', targetId)).data).toEqual([]);
  });

  it('reports a seed lesson not found among the published lessons and still syncs the others', async () => {
    const title = lessons[0]!.title;
    const id = await lessonId(title);
    expect((await client.from('lessons').update({ status: 'draft' }).eq('id', id)).error).toBeNull();
    try {
      const r = await syncConsolidation(client, { apply: false });
      expect(r.problems).toBe(1);
      expect(r.lessons[0]).toEqual({ title, status: 'problem', reason: 'no published lesson with this title' });
    } finally {
      await client.from('lessons').update({ status: 'published' }).eq('id', id);
    }
  });

  it('aborts before any write when a seed exercise is invalid', async () => {
    await toOldProduction();
    const before = await snapshot();
    const broken: SeedLesson[] = lessons.map((l, i) =>
      i === 2 ? { ...l, consolidation: l.consolidation.map((c) => (c.type === 'short_answer' ? { ...c, accepted: [] } : c)) } : l,
    );
    await expect(syncConsolidation(client, { apply: true, lessons: broken })).rejects.toThrow(/Invalid seed exercise.*\n.*variantă acceptată/);
    expect(await snapshot()).toEqual(before);
  });

  it('keeps the old set when inserting the new one fails', async () => {
    const before = await snapshot();
    const failing = new Proxy(client, {
      get(target, prop, receiver) {
        if (prop !== 'from') return Reflect.get(target, prop, receiver);
        return (t: string) => {
          const builder = target.from(t);
          if (t !== 'consolidation_ai_context') return builder;
          return new Proxy(builder, {
            get(b, p, r) {
              return p === 'insert' ? async () => ({ data: null, error: { message: 'simulated failure' } }) : Reflect.get(b, p, r);
            },
          });
        };
      },
    });
    // The missing templates are inserted before the first lesson write; everything else must be as before.
    await expect(syncConsolidation(failing, { apply: true })).rejects.toThrow(/simulated failure.*removed again/);
    const after = await snapshot();
    for (const table of Object.keys(before).filter((t) => t !== 'solution_templates')) expect(after[table], table).toEqual(before[table]);
    // The next run completes.
    expect((await syncConsolidation(client, { apply: true })).replaced).toBe(lessons.length);
  });
});
