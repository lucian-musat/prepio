import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { lessons } from './index';
import { seed } from './seed';
import { formatAiTemplatesSync, syncAiTemplates } from './syncAiTemplates';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!url || !serviceKey)('syncAiTemplates (integration)', () => {
  let client: SupabaseClient;
  let testLessonId: string;
  let testExerciseId: string;
  let seedExerciseId: string;
  let seedLesson: { title: string; prompt: string };
  let otherTemplateId: string;

  const ok = <T>(r: { data: T; error: { message: string } | null }): NonNullable<T> => {
    if (r.error) throw new Error(r.error.message);
    return r.data as NonNullable<T>;
  };
  const snapshot = async () => {
    const out: Record<string, string> = {};
    for (const table of ['ai_templates', 'consolidation_ai_context', 'consolidation_ai_template_links']) {
      out[table] = JSON.stringify(ok(await client.from(table).select('*')).map((r) => JSON.stringify(r)).sort());
    }
    return out;
  };

  beforeAll(async () => {
    client = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    await seed(client, { reset: true });

    // A seed facts exercise: old-style context, no link.
    const lesson = lessons.find((l) => l.consolidation.some((c) => c.type === 'facts' && c.ai))!;
    const c = lesson.consolidation.find((x) => x.type === 'facts' && x.ai)!;
    seedLesson = { title: lesson.title, prompt: c.prompt };
    const lessonRow = ok(await client.from('lessons').select('id, node_id').eq('title', lesson.title).single());
    seedExerciseId = ok(
      await client.from('consolidation_exercises').select('id').eq('lesson_id', lessonRow.id).eq('type', 'facts').eq('prompt', c.prompt).single(),
    ).id as string;
    ok(await client.from('consolidation_ai_context').update({ context: { main: 'old style context with criteria', requirements: {} } }).eq('exercise_id', seedExerciseId));
    // Every link goes.
    ok(await client.from('consolidation_ai_template_links').delete().neq('requirement_id', 'none'));

    // A hand-made lesson with an argument exercise without links.
    testLessonId = ok(
      await client.from('lessons').insert({ node_id: lessonRow.node_id, title: '[test] ai templates', status: 'published', position: 999 }).select('id').single(),
    ).id as string;
    testExerciseId = ok(
      await client
        .from('consolidation_exercises')
        .insert({ lesson_id: testLessonId, position: 0, type: 'argument', prompt: '[test] argument', content: {} })
        .select('id')
        .single(),
    ).id as string;

    otherTemplateId = ok(
      await client.from('ai_templates').insert({ title: '[test] other', type: 'argument', criteria: 'x', keywords: '' }).select('id').single(),
    ).id as string;
  });

  afterAll(async () => {
    await seed(client, { reset: true });
  });

  it('a dry run lists the context and the missing links and writes nothing', async () => {
    const before = await snapshot();
    const r = await syncAiTemplates(client, { apply: false });
    expect(await snapshot()).toEqual(before);
    expect(r.contextsToReplace).toEqual([{ lesson: seedLesson.title, prompt: seedLesson.prompt }]);
    expect(r.linksToAdd).toContainEqual({ lesson: seedLesson.title, prompt: seedLesson.prompt, requirementId: '', templateTitle: 'Prezentare fapte (BAC)' });
    expect(r.linksToAdd).toContainEqual({ lesson: '[test] ai templates', prompt: '[test] argument', requirementId: '', templateTitle: 'Argumentare (BAC)' });
    expect(r.linksToAdd.some((l) => l.requirementId !== '')).toBe(true); // essay requirements
    expect(r.templatesToAdd).toEqual([]);
    expect(r.problems).toEqual([]);
    expect(formatAiTemplatesSync(r)).toContain('Dry run');
  });

  it('--apply fixes them, keeps an existing link to another template, and a second run plans nothing', async () => {
    ok(await client.from('consolidation_ai_template_links').insert({ exercise_id: testExerciseId, requirement_id: '', template_id: otherTemplateId }));
    const r = await syncAiTemplates(client, { apply: true });
    expect(r.linksToAdd.some((l) => l.prompt === '[test] argument')).toBe(false);

    const ctx = ok(await client.from('consolidation_ai_context').select('context').eq('exercise_id', seedExerciseId).single());
    const seedAi = lessons.flatMap((l) => l.consolidation).find((c) => c.type === 'facts' && c.prompt === seedLesson.prompt)!.ai!;
    expect(ctx.context).toEqual({ main: seedAi.main, requirements: seedAi.requirements });
    const kept = ok(await client.from('consolidation_ai_template_links').select('template_id').eq('exercise_id', testExerciseId));
    expect(kept).toEqual([{ template_id: otherTemplateId }]);

    const again = await syncAiTemplates(client, { apply: true });
    expect(again).toMatchObject({ templatesToAdd: [], contextsToReplace: [], linksToAdd: [], problems: [] });
  });

  it('inserts a missing seed AI template and links to it', async () => {
    ok(await client.from('consolidation_ai_template_links').delete().neq('requirement_id', 'none'));
    ok(await client.from('ai_templates').delete().eq('title', 'Argumentare (BAC)'));
    const r = await syncAiTemplates(client, { apply: true });
    expect(r.templatesToAdd).toEqual(['Argumentare (BAC)']);
    expect(ok(await client.from('ai_templates').select('id').eq('title', 'Argumentare (BAC)'))).toHaveLength(1);
    expect(r.linksToAdd.some((l) => l.templateTitle === 'Argumentare (BAC)')).toBe(true);
  });

  it('cleans up the [test] rows', async () => {
    ok(await client.from('consolidation_ai_template_links').delete().eq('template_id', otherTemplateId));
    ok(await client.from('ai_templates').delete().eq('id', otherTemplateId));
    ok(await client.from('lessons').delete().eq('id', testLessonId));
    expect(ok(await client.from('lessons').select('id').like('title', '[test]%'))).toEqual([]);
  });
});
