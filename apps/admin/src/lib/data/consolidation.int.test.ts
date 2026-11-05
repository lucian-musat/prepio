import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AiContext, AnswerSpan } from '@prepio/shared';
import { UserError } from './db';
import { createLesson, createNode } from './tree';
import { deleteItem, getLessonForEdit, moveItem } from './lesson';
import {
  deleteSource, getConsolidation, saveConsolidationExercise, saveSource, sourceImpact, type ExerciseInput,
} from './consolidation';
import { saveTemplate } from './templates';

config({ path: [resolve(__dirname, '../../../.env.local'), resolve(__dirname, '../../../../../.env')], quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const email = process.env.ADMIN_EMAIL ?? 'admin@prepio.local';
const password = process.env.ADMIN_PASSWORD ?? 'prepio-local-admin';

const BODY = 'Bismarck a creat imperiul german în 1871. Apoi a condus țara.';
const NO_AI: AiContext = { main: '', requirements: {} };
const AI: AiContext = { main: 'Fapte de referință', requirements: {} };

describe.skipIf(!url || !anon)('consolidation data functions (local Supabase)', () => {
  let db: SupabaseClient;
  let rootId: string;
  let lessonId: string;
  let otherLessonId: string;
  let srcA: string;
  let srcB: string;
  let foreignSrc: string;
  let templateId: string;

  const spanOf = (sourceId: string, text: string, body = BODY): AnswerSpan => {
    const start = body.indexOf(text);
    return { id: 'sp1', sourceId, start, end: start + text.length, text, limitStart: null, limitEnd: null };
  };
  const find = async (id: string) => (await getConsolidation(db, lessonId)).exercises.find((e) => e.exercise.id === id)!;
  const source = (id: string, body: string) => ({ id, title: null, author: 'Autor', work: 'Opera', body });

  beforeAll(async () => {
    db = createClient(url!, anon!, { auth: { persistSession: false } });
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    rootId = (await createNode(db, null, '[test] cons root')).id;
    const n = await createNode(db, rootId, 'node');
    lessonId = (await createLesson(db, n.id, '[test] cons lesson')).id;
    otherLessonId = (await createLesson(db, n.id, '[test] other lesson')).id;
    srcA = (await saveSource(db, lessonId, { title: null, author: 'Autor', work: 'Opera', body: BODY })).id;
    srcB = (await saveSource(db, lessonId, { title: 'B', author: 'Autor B', work: 'Opera B', body: 'Alt text.' })).id;
    foreignSrc = (await saveSource(db, otherLessonId, { title: null, author: '', work: '', body: 'Text străin.' })).id;
    templateId = (await saveTemplate(db, { title: '[test] șablon', exerciseType: null, points: '', body: 'corp' })).id;
  });

  afterAll(async () => {
    if (rootId) await db.from('nodes').delete().eq('id', rootId);
    if (templateId) await db.from('solution_templates').delete().eq('id', templateId);
  });

  it('source CRUD: saves, orders, edits and trims', async () => {
    const c = await getConsolidation(db, lessonId);
    expect(c.sources.map((s) => [s.id, s.position, s.author])).toEqual([[srcA, 0, 'Autor'], [srcB, 1, 'Autor B']]);
    await saveSource(db, lessonId, { id: srcB, title: '  ', author: ' X ', work: 'W', body: ' Alt text. ' });
    const b = (await getConsolidation(db, lessonId)).sources.find((s) => s.id === srcB)!;
    expect([b.title, b.author, b.body]).toEqual([null, 'X', 'Alt text.']);
    await expect(saveSource(db, lessonId, { title: null, author: '', work: '', body: '  ' })).rejects.toBeInstanceOf(UserError);
  });

  it('a source edit that shifts a span re-anchors it', async () => {
    const { id } = await saveConsolidationExercise(db, lessonId, {
      type: 'source_info', prompt: 'Ce a creat?', templateId: null, sources: [{ sourceId: srcA, label: 'A' }],
      modelAnswer: null, explanation: null, count: 1, spans: [spanOf(srcA, 'imperiul german')], ai: NO_AI,
    });
    const body2 = `Prefață nouă. ${BODY}`;
    await saveSource(db, lessonId, source(srcA, body2));
    const e = await find(id);
    expect(e.errors).toEqual([]);
    const sp = (e.exercise as { spans: AnswerSpan[] }).spans[0];
    expect(sp.start).toBe(body2.indexOf('imperiul german'));
    expect(body2.slice(sp.start, sp.end)).toBe('imperiul german');
    await saveSource(db, lessonId, source(srcA, BODY));
    await deleteItem(db, 'consolidation_exercises', id);
  });

  it('a source edit that removes the span text leaves a detached error; sourceImpact lists it', async () => {
    const { id } = await saveConsolidationExercise(db, lessonId, {
      type: 'source_info', prompt: 'Ce a creat?', templateId: null, sources: [{ sourceId: srcA, label: 'A' }],
      modelAnswer: null, explanation: null, count: 1, spans: [spanOf(srcA, 'imperiul german')], ai: NO_AI,
    });
    const newBody = 'Bismarck a creat altceva în 1871.';
    expect(await sourceImpact(db, srcA, BODY)).toEqual([]);
    expect(await sourceImpact(db, srcA, newBody)).toEqual([{ exerciseId: id, prompt: 'Ce a creat?', detached: ['imperiul german'] }]);
    await saveSource(db, lessonId, source(srcA, newBody));
    const e = await find(id);
    expect(e.errors.some((m) => m.includes('imperiul german'))).toBe(true);
    await saveSource(db, lessonId, source(srcA, BODY));
    await deleteItem(db, 'consolidation_exercises', id);
  });

  it('deleting a used source is a UserError; an unused one is deleted and positions close up', async () => {
    const { id } = await saveConsolidationExercise(db, lessonId, {
      type: 'source_info', prompt: 'P', templateId: null, sources: [{ sourceId: srcA, label: 'A' }],
      modelAnswer: null, explanation: null, count: 1, spans: [spanOf(srcA, 'imperiul german')], ai: NO_AI,
    });
    await expect(deleteSource(db, srcA)).rejects.toThrow('Sursa este folosită de un exercițiu.');
    await deleteItem(db, 'consolidation_exercises', id);
    const tmp = (await saveSource(db, lessonId, { title: null, author: '', work: '', body: 'temp' })).id;
    await deleteSource(db, tmp);
    expect((await getConsolidation(db, lessonId)).sources.map((x) => [x.id, x.position])).toEqual([[srcA, 0], [srcB, 1]]);
  });

  const s = (...ids: string[]) => ids.map((sourceId, i) => ({ sourceId, label: (i ? 'B' : 'A') as 'A' | 'B' }));
  const common = { templateId: null, modelAnswer: null, explanation: null } as const;
  const cases: Array<[string, () => ExerciseInput]> = [
    ['short_answer', () => ({ ...common, type: 'short_answer', prompt: 'P', sources: [], accepted: ['x'], mistakes: [{ answer: 'y', message: 'm' }], ai: NO_AI })],
    ['multi_answer', () => ({ ...common, type: 'multi_answer', prompt: 'P', sources: s(srcA), count: 1, groups: [{ id: 'g1', variants: ['a', 'b'] }], ai: NO_AI })],
    ['source_info', () => ({ ...common, type: 'source_info', prompt: 'P', sources: s(srcA), count: 1, spans: [spanOf(srcA, 'imperiul german')], ai: NO_AI })],
    ['source_letter', () => ({ ...common, type: 'source_letter', prompt: 'P', sources: s(srcA, srcB), correct: 'A', evidence: spanOf(srcA, 'Bismarck'), ai: NO_AI })],
    ['cause_effect', () => ({ ...common, type: 'cause_effect', prompt: 'P', sources: s(srcA), pairs: [{ id: 'p1', cause: { ...spanOf(srcA, 'Bismarck'), id: 'c1' }, effect: { ...spanOf(srcA, 'imperiul german'), id: 'e1' }, explanation: 'de ce' }], ai: NO_AI })],
    ['facts', () => ({ ...common, type: 'facts', prompt: 'P', sources: s(srcA), count: 2, ai: AI })],
    ['comparison', () => ({ ...common, type: 'comparison', prompt: 'P', sources: s(srcA), variant: 'difference', ai: AI })],
    ['viewpoint', () => ({ ...common, type: 'viewpoint', prompt: 'P', sources: s(srcA), count: 1, spans: [spanOf(srcA, 'Apoi a condus țara')], ai: AI })],
    ['argument', () => ({ ...common, type: 'argument', prompt: 'P', sources: [], ai: AI })],
    ['essay', () => ({ ...common, type: 'essay', prompt: 'P', sources: s(srcA), requirements: [{ id: 'r1', text: 'Cerința', modelAnswer: 'mod', templateId: null, argument: true }], ai: { main: '', requirements: { r1: 'ctx r1' } } })],
  ];

  it.each(cases)('saves and reads back a %s exercise', async (_t, make) => {
    const input = make();
    const { id } = await saveConsolidationExercise(db, lessonId, { ...input, modelAnswer: 'model', explanation: 'expl' });
    const got = await find(id);
    const { ai, ...rest } = input;
    expect(got.exercise).toEqual({ ...rest, modelAnswer: 'model', explanation: 'expl', id, position: expect.any(Number) });
    expect(got.ai).toEqual(ai);
    expect(got.errors).toEqual([]);
    // an update keeps the position
    const pos = got.exercise.position;
    await saveConsolidationExercise(db, lessonId, { ...input, id, prompt: 'P2' });
    const again = await find(id);
    expect([again.exercise.prompt, again.exercise.position]).toEqual(['P2', pos]);
    await deleteItem(db, 'consolidation_exercises', id);
  });

  it('non-AI types store an empty AI context', async () => {
    const { id } = await saveConsolidationExercise(db, lessonId, { ...cases[0][1](), ai: AI });
    expect((await find(id)).ai).toEqual(NO_AI);
    await deleteItem(db, 'consolidation_exercises', id);
  });

  it('rejects an AI type without context', async () => {
    await expect(saveConsolidationExercise(db, lessonId, { ...cases[8][1](), ai: NO_AI })).rejects.toThrow('Contextul pentru AI este obligatoriu.');
  });

  it('rejects a source of another lesson', async () => {
    const bad = { ...cases[2][1](), sources: s(foreignSrc), spans: [spanOf(foreignSrc, 'străin', 'Text străin.')] } as ExerciseInput;
    await expect(saveConsolidationExercise(db, lessonId, bad)).rejects.toBeInstanceOf(UserError);
    expect((await getConsolidation(db, lessonId)).exercises).toEqual([]);
  });

  it('rejects an unknown template and accepts an existing one', async () => {
    const base = cases[0][1]();
    await expect(saveConsolidationExercise(db, lessonId, { ...base, templateId: '00000000-0000-0000-0000-000000000000' })).rejects.toBeInstanceOf(UserError);
    const { id } = await saveConsolidationExercise(db, lessonId, { ...base, templateId });
    expect((await find(id)).exercise.templateId).toBe(templateId);
    await deleteItem(db, 'consolidation_exercises', id);
  });

  it('rejects invalid exercises with the validation messages', async () => {
    await expect(saveConsolidationExercise(db, lessonId, { ...cases[0][1](), prompt: '  ' })).rejects.toThrow('Enunțul nu poate fi gol.');
  });

  it('moves and deletes consolidation exercises with renumbering', async () => {
    const a = await saveConsolidationExercise(db, lessonId, { ...cases[0][1](), prompt: 'E1' });
    const b = await saveConsolidationExercise(db, lessonId, { ...cases[0][1](), prompt: 'E2' });
    await moveItem(db, 'consolidation_exercises', b.id, 'up');
    expect((await getConsolidation(db, lessonId)).exercises.map((e) => [e.exercise.prompt, e.exercise.position])).toEqual([['E2', 0], ['E1', 1]]);
    await deleteItem(db, 'consolidation_exercises', b.id);
    expect((await getConsolidation(db, lessonId)).exercises.map((e) => [e.exercise.id, e.exercise.position])).toEqual([[a.id, 0]]);
    await deleteItem(db, 'consolidation_exercises', a.id);
  });

  it('getLessonForEdit returns consolidation', async () => {
    const data = await getLessonForEdit(db, lessonId);
    expect(data?.consolidation.sources.map((x) => x.id)).toEqual([srcA, srcB]);
    expect(data?.consolidation.exercises).toEqual([]);
    expect(data?.consolidation.templates.map((t) => t.id)).toContain(templateId);
  });
});
