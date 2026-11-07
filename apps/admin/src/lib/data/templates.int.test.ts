import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { UserError } from './db';
import { createLesson, createNode } from './tree';
import { deleteItem } from './lesson';
import { saveConsolidationExercise } from './consolidation';
import { deleteTemplate, listTemplates, saveTemplate } from './templates';

config({ path: [resolve(__dirname, '../../../.env.local'), resolve(__dirname, '../../../../../.env')], quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const email = process.env.ADMIN_EMAIL ?? 'admin@prepio.local';
const password = process.env.ADMIN_PASSWORD ?? 'prepio-local-admin';

describe.skipIf(!url || !anon)('template data functions (local Supabase)', () => {
  let db: SupabaseClient;
  let rootId: string;
  let lessonId: string;
  const created: string[] = [];

  const mk = async (title: string, exerciseType: 'essay' | null = null) => {
    const { id } = await saveTemplate(db, { title, exerciseType, points: 'p', body: 'b' });
    created.push(id);
    return id;
  };
  const usage = async (id: string) => (await listTemplates(db)).find((t) => t.id === id)?.usage;

  beforeAll(async () => {
    db = createClient(url!, anon!, { auth: { persistSession: false } });
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    rootId = (await createNode(db, null, '[test] tpl root')).id;
    const n = await createNode(db, rootId, 'node');
    lessonId = (await createLesson(db, n.id, '[test] tpl lesson')).id;
  });

  afterAll(async () => {
    if (rootId) await db.from('nodes').delete().eq('id', rootId);
    if (created.length) await db.from('solution_templates').delete().in('id', created);
  });

  it('creates, lists, edits and deletes a template', async () => {
    const id = await mk('  [test] T1  ', 'essay');
    let t = (await listTemplates(db)).find((x) => x.id === id)!;
    expect(t).toEqual({ id, title: '[test] T1', exerciseType: 'essay', points: 'p', body: 'b', usage: 0 });
    await saveTemplate(db, { id, title: '[test] T1b', exerciseType: null, points: '', body: 'b2' });
    t = (await listTemplates(db)).find((x) => x.id === id)!;
    expect([t.title, t.exerciseType, t.body]).toEqual(['[test] T1b', null, 'b2']);
    await deleteTemplate(db, id);
    expect(await usage(id)).toBeUndefined();
  });

  it('rejects invalid templates', async () => {
    await expect(saveTemplate(db, { title: ' ', exerciseType: null, points: '', body: 'x' })).rejects.toBeInstanceOf(UserError);
    await expect(saveTemplate(db, { title: 'x', exerciseType: null, points: '', body: ' ' })).rejects.toBeInstanceOf(UserError);
  });

  it('counts usage by exercises and essay requirements; deleting a used template fails with the count', async () => {
    const id = await mk('[test] used');
    const base = { prompt: 'P', modelAnswer: null, explanation: null, sources: [], creditCost: 1 };
    const a = await saveConsolidationExercise(db, lessonId, { ...base, type: 'argument', templateId: id, ai: { main: 'c', requirements: {}, templateId: null, requirementTemplates: {} } });
    const b = await saveConsolidationExercise(db, lessonId, {
      ...base, type: 'essay', templateId: null,
      requirements: [{ id: 'r1', text: 'R', modelAnswer: null, templateId: id, argument: false }],
      ai: { main: '', requirements: { r1: 'c' }, templateId: null, requirementTemplates: {} },
    });
    expect(await usage(id)).toBe(2);
    await expect(deleteTemplate(db, id)).rejects.toThrow('Șablonul este folosit de 2 exerciții.');
    await deleteItem(db, 'consolidation_exercises', a.id);
    await expect(deleteTemplate(db, id)).rejects.toThrow('Șablonul este folosit de un exercițiu.');
    await deleteItem(db, 'consolidation_exercises', b.id);
    await deleteTemplate(db, id);
  });
});
