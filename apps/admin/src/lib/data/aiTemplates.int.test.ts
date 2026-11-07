import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AiContext, AiTemplateType } from '@prepio/shared';
import { UserError } from './db';
import { createLesson, createNode } from './tree';
import { deleteItem } from './lesson';
import { getConsolidation, saveConsolidationExercise, type ExerciseInput } from './consolidation';
import { deleteAiTemplate, listAiTemplates, saveAiTemplate } from './aiTemplates';

config({ path: [resolve(__dirname, '../../../.env.local'), resolve(__dirname, '../../../../../.env')], quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const email = process.env.ADMIN_EMAIL ?? 'admin@prepio.local';
const password = process.env.ADMIN_PASSWORD ?? 'prepio-local-admin';

describe.skipIf(!url || !anon)('AI template data functions (local Supabase)', () => {
  let db: SupabaseClient;
  let rootId: string;
  let lessonId: string;
  const created: string[] = [];

  const mk = async (title: string, type: AiTemplateType = 'argument') => {
    const { id } = await saveAiTemplate(db, { title, type, criteria: 'c', keywords: '', responseFormat: '' });
    created.push(id);
    return id;
  };
  const usage = async (id: string) => (await listAiTemplates(db)).find((t) => t.id === id)?.usage;
  const ctx = (templateId: string | null, requirementTemplates: Record<string, string> = {}): AiContext => ({
    main: 'ctx', requirements: { r1: 'c1', r2: 'c2' }, templateId, requirementTemplates,
  });
  const base = { prompt: 'P', modelAnswer: null, explanation: null, sources: [] as never[], creditCost: 1, templateId: null };
  const argument = (templateId: string | null, id?: string): ExerciseInput => ({ ...base, id, type: 'argument', ai: ctx(templateId) });
  const essay = (reqs: string[], rt: Record<string, string>, id?: string): ExerciseInput => ({
    ...base, id, type: 'essay',
    requirements: reqs.map((r) => ({ id: r, text: `R ${r}`, modelAnswer: null, templateId: null, argument: false })),
    ai: ctx(null, rt),
  });
  const find = async (id: string) => (await getConsolidation(db, lessonId)).exercises.find((e) => e.exercise.id === id)!;

  beforeAll(async () => {
    db = createClient(url!, anon!, { auth: { persistSession: false } });
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    rootId = (await createNode(db, null, '[test] aitpl root')).id;
    const n = await createNode(db, rootId, 'node');
    lessonId = (await createLesson(db, n.id, '[test] aitpl lesson')).id;
  });

  afterAll(async () => {
    if (rootId) await db.from('nodes').delete().eq('id', rootId);
    if (created.length) await db.from('ai_templates').delete().in('id', created);
  });

  it('creates, edits, lists with usage and deletes', async () => {
    const id = await mk('  [test] A1  ', 'facts');
    let t = (await listAiTemplates(db)).find((x) => x.id === id)!;
    expect(t).toEqual({ id, title: '[test] A1', type: 'facts', criteria: 'c', keywords: '', responseFormat: '', usage: 0 });
    await saveAiTemplate(db, { id, title: '[test] A1b', type: 'argument', criteria: ' c2 ', keywords: ' k ', responseFormat: ' f ' });
    t = (await listAiTemplates(db)).find((x) => x.id === id)!;
    expect([t.title, t.type, t.criteria, t.keywords, t.responseFormat]).toEqual(['[test] A1b', 'argument', 'c2', 'k', 'f']);
    const ex = await saveConsolidationExercise(db, lessonId, argument(id));
    expect(await usage(id)).toBe(1);
    await deleteItem(db, 'consolidation_exercises', ex.id);
    expect(await usage(id)).toBe(0);
    await deleteAiTemplate(db, id);
    expect(await usage(id)).toBeUndefined();
  });

  it('orders by type then title', async () => {
    const a = await mk('[test] zz', 'facts');
    const b = await mk('[test] aa', 'essay_requirement');
    const c = await mk('[test] aa', 'facts');
    const order = (await listAiTemplates(db)).map((t) => t.id).filter((i) => [a, b, c].includes(i));
    expect(order).toEqual([c, a, b]);
  });

  it('rejects invalid templates', async () => {
    const ok = { title: 'x', type: 'facts' as const, criteria: 'c', keywords: '', responseFormat: '' };
    await expect(saveAiTemplate(db, { ...ok, title: ' ' })).rejects.toThrow('Titlul nu poate fi gol.');
    await expect(saveAiTemplate(db, { ...ok, criteria: ' ' })).rejects.toThrow('Completează ce urmărește AI-ul în răspuns.');
    await expect(saveAiTemplate(db, { ...ok, type: 'nope' as never })).rejects.toBeInstanceOf(UserError);
  });

  it('refuses to delete a template in use', async () => {
    const id = await mk('[test] used');
    const ex = await saveConsolidationExercise(db, lessonId, argument(id));
    await expect(deleteAiTemplate(db, id)).rejects.toThrow('Șablonul AI este folosit de un exercițiu.');
    await deleteItem(db, 'consolidation_exercises', ex.id);
    await deleteAiTemplate(db, id);
  });

  it('rejects a template of the wrong type, an unknown id, and a missing template', async () => {
    const facts = await mk('[test] facts', 'facts');
    await expect(saveConsolidationExercise(db, lessonId, argument(facts))).rejects.toThrow('Șablonul AI ales nu se potrivește tipului exercițiului.');
    await expect(saveConsolidationExercise(db, lessonId, argument('00000000-0000-0000-0000-000000000000'))).rejects.toThrow('Șablonul AI ales nu există.');
    await expect(saveConsolidationExercise(db, lessonId, argument(null))).rejects.toThrow('Alege un șablon AI.');
    expect((await getConsolidation(db, lessonId)).exercises).toEqual([]);
  });

  it('replaces links on save', async () => {
    const t = await mk('[test] req', 'essay_requirement');
    const { id } = await saveConsolidationExercise(db, lessonId, essay(['r1', 'r2'], { r1: t, r2: t }));
    expect((await find(id)).ai.requirementTemplates).toEqual({ r1: t, r2: t });
    expect(await usage(t)).toBe(1); // distinct exercises
    await saveConsolidationExercise(db, lessonId, essay(['r1'], { r1: t, r2: t }, id));
    expect((await find(id)).ai.requirementTemplates).toEqual({ r1: t });
    const { data } = await db.from('consolidation_ai_template_links').select('requirement_id').eq('exercise_id', id);
    expect(data).toEqual([{ requirement_id: 'r1' }]);
    await expect(saveConsolidationExercise(db, lessonId, essay(['r1', 'r2'], { r1: t }, id))).rejects.toThrow('Alege un șablon AI pentru cerința 2.');
    await deleteItem(db, 'consolidation_exercises', id);
  });

  it('stores the template in a link, not in the context json, and no links for deterministic types', async () => {
    const t = await mk('[test] arg', 'argument');
    const { id } = await saveConsolidationExercise(db, lessonId, argument(t));
    const { data } = await db.from('consolidation_ai_context').select('context').eq('exercise_id', id).single();
    expect(data?.context).toEqual({ main: 'ctx', requirements: {} });
    expect((await find(id)).ai.templateId).toBe(t);
    const det = await saveConsolidationExercise(db, lessonId, {
      ...base, type: 'short_answer', accepted: ['x'], mistakes: [], ai: ctx(t),
    });
    const { data: links } = await db.from('consolidation_ai_template_links').select('template_id').eq('exercise_id', det.id);
    expect(links).toEqual([]);
    await deleteItem(db, 'consolidation_exercises', id);
    await deleteItem(db, 'consolidation_exercises', det.id);
  });

  it('flags a type mismatch', async () => {
    const t = await mk('[test] flip', 'argument');
    const { id } = await saveConsolidationExercise(db, lessonId, argument(t));
    expect((await find(id)).errors).toEqual([]);
    // The admin API refuses this; flip the type directly in the DB to keep the mismatch flag covered.
    const svc = createClient(url!, process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { error } = await svc.from('ai_templates').update({ type: 'facts' }).eq('id', t);
    if (error) throw error;
    expect((await find(id)).errors).toContain('Șablonul AI ales nu se potrivește tipului exercițiului.');
    await deleteItem(db, 'consolidation_exercises', id);
  });

  it('refuses to change the type of a template in use', async () => {
    const t = await mk('[test] locked', 'argument');
    const { id } = await saveConsolidationExercise(db, lessonId, argument(t));
    await expect(saveAiTemplate(db, { id: t, title: '[test] locked', type: 'facts', criteria: 'c', keywords: '', responseFormat: '' }))
      .rejects.toThrow('Șablonul AI este folosit de un exercițiu; tipul nu se poate schimba.');
    // Same type still saves; unused templates can change type.
    await saveAiTemplate(db, { id: t, title: '[test] locked 2', type: 'argument', criteria: 'c', keywords: '', responseFormat: '' });
    await deleteItem(db, 'consolidation_exercises', id);
    await saveAiTemplate(db, { id: t, title: '[test] locked 2', type: 'facts', criteria: 'c', keywords: '', responseFormat: '' });
  });
});
