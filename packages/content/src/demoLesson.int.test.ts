import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { validateExercise } from '@prepio/shared';
import { loadConsolidation } from './consolidation.testutil';
import { DEMO_CARDS, DEMO_CONSOLIDATION, DEMO_LESSON_TITLE, DEMO_NODE_TITLE, DEMO_QUESTIONS, DEMO_SOURCES, seedDemo } from './demoLesson';
import { seed } from './seed';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!url || !serviceKey)('seedDemo (integration)', () => {
  let client: SupabaseClient;
  let userId: string;

  const rootNodes = async () => {
    const { data, error } = await client.from('nodes').select('id, title, position').is('parent_id', null).order('position');
    if (error) throw error;
    return data;
  };
  const demoLessons = async () => {
    const { data, error } = await client
      .from('lessons')
      .select('id, status, cards(count), questions(count), consolidation_exercises(count), sources(count)')
      .eq('title', DEMO_LESSON_TITLE);
    if (error) throw error;
    return data as { id: string; status: string; cards: { count: number }[]; questions: { count: number }[]; consolidation_exercises: { count: number }[]; sources: { count: number }[] }[];
  };

  beforeAll(async () => {
    client = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    await seed(client, { reset: true });
    const { data, error } = await client.auth.admin.createUser({ email: 'test-demo-int@example.com', password: 'test-pass-123456', email_confirm: true });
    if (error) throw error;
    userId = data.user.id;
  });

  afterAll(async () => {
    await seedDemo(client, { apply: true, remove: true });
    await client.auth.admin.deleteUser(userId);
  });

  it('a dry run changes nothing', async () => {
    const r = await seedDemo(client, { apply: false });
    expect(r.action).toBe('create');
    expect((await rootNodes()).some((n) => n.title === DEMO_NODE_TITLE)).toBe(false);
  });

  it('creates the demo lesson as the first published lesson, before every other node', async () => {
    const r = await seedDemo(client, { apply: true });
    expect(r.action).toBe('create');
    expect((await rootNodes())[0]?.title).toBe(DEMO_NODE_TITLE);
    const [lesson, ...more] = await demoLessons();
    expect(more).toEqual([]);
    expect(lesson?.status).toBe('published');
    expect(lesson?.cards[0]?.count).toBe(DEMO_CARDS.length);
    expect(lesson?.questions[0]?.count).toBe(DEMO_QUESTIONS.length);
    expect(lesson?.consolidation_exercises[0]?.count).toBe(DEMO_CONSOLIDATION.length);
    expect(lesson?.sources[0]?.count).toBe(DEMO_SOURCES.length);
    const stored = await loadConsolidation(client, lesson!.id);
    for (const { exercise, ai } of stored.exercises) expect(validateExercise(exercise, stored.sources, ai), exercise.prompt).toEqual([]);
  });

  it('a second run refreshes the same lesson, stays first and resets progress in it', async () => {
    const [before] = await demoLessons();
    const { error } = await client.from('lesson_progress').insert({ user_id: userId, lesson_id: before!.id, finished_at: new Date().toISOString() });
    if (error) throw error;
    const ex = await client.from('consolidation_exercises').select('id').eq('lesson_id', before!.id);
    if (ex.error) throw ex.error;
    const run = await client
      .from('consolidation_runs')
      .insert({ user_id: userId, lesson_id: before!.id, exercise_ids: ex.data.map((e) => e.id), index: 1 });
    if (run.error) throw run.error;
    // Another root node moved in front meanwhile.
    const roots = await rootNodes();
    await client.from('nodes').update({ position: roots[0]!.position - 5 }).eq('id', roots[1]!.id);

    const r = await seedDemo(client, { apply: true });
    expect(r.action).toBe('update');
    const after = await demoLessons();
    expect(after.map((l) => l.id)).toEqual([before!.id]);
    expect(after[0]?.cards[0]?.count).toBe(DEMO_CARDS.length);
    expect(after[0]?.consolidation_exercises[0]?.count).toBe(DEMO_CONSOLIDATION.length);
    expect(after[0]?.sources[0]?.count).toBe(DEMO_SOURCES.length);
    expect((await rootNodes())[0]?.title).toBe(DEMO_NODE_TITLE);
    const progress = await client.from('lesson_progress').select('lesson_id').eq('lesson_id', before!.id);
    expect(progress.data).toEqual([]);
    const runs = await client.from('consolidation_runs').select('lesson_id').eq('lesson_id', before!.id);
    expect(runs.data).toEqual([]);
  });

  it('--remove deletes the node and the lesson', async () => {
    const r = await seedDemo(client, { apply: true, remove: true });
    expect(r.action).toBe('remove');
    expect(await demoLessons()).toEqual([]);
    expect((await rootNodes()).some((n) => n.title === DEMO_NODE_TITLE)).toBe(false);
    expect((await seedDemo(client, { apply: true, remove: true })).action).toBe('nothing');
  });
});
