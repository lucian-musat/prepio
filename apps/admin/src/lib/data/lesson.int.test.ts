import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { UserError } from './db';
import { createLesson, createNode } from './tree';
import {
  deleteItem, getLessonForEdit, moveItem, saveCard, saveExercise, saveQuestion, updateLesson, uploadCardImage,
} from './lesson';

config({ path: [resolve(__dirname, '../../../.env.local'), resolve(__dirname, '../../../../../.env')], quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const email = process.env.ADMIN_EMAIL ?? 'admin@prepio.local';
const password = process.env.ADMIN_PASSWORD ?? 'prepio-local-admin';

// 1x1 transparent PNG
const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
);

describe.skipIf(!url || !anon)('lesson data functions (local Supabase)', () => {
  let db: SupabaseClient;
  let rootId: string;
  let lessonId: string;
  const uploaded: string[] = [];

  const rows = async (table: 'cards' | 'questions' | 'writing_exercises', col: string) =>
    (await db.from(table).select(`${col},position`).eq('lesson_id', lessonId).order('position')).data!.map(
      (r) => {
        const x = r as unknown as Record<string, unknown>;
        return [x[col], x.position];
      },
    );

  beforeAll(async () => {
    db = createClient(url!, anon!, { auth: { persistSession: false } });
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    rootId = (await createNode(db, null, '[test] lesson root')).id;
    const n = await createNode(db, rootId, 'node');
    lessonId = (await createLesson(db, n.id, '[test] lesson')).id;
  });

  afterAll(async () => {
    if (uploaded.length) await db.storage.from('images').remove(uploaded);
    if (rootId) await db.from('nodes').delete().eq('id', rootId);
  });

  it('updates the lesson title and rejects an empty one', async () => {
    await updateLesson(db, lessonId, { title: '  [test] nou  ' });
    expect((await db.from('lessons').select('title').eq('id', lessonId).single()).data?.title).toBe('[test] nou');
    await expect(updateLesson(db, lessonId, { title: ' ' })).rejects.toThrow('Titlul nu poate fi gol');
  });

  it('saves, edits, moves and deletes cards with contiguous positions', async () => {
    const a = await saveCard(db, lessonId, { body: 'A', title: 'Ta' });
    const b = await saveCard(db, lessonId, { body: 'B', title: '' });
    const c = await saveCard(db, lessonId, { body: 'C' });
    expect(await rows('cards', 'body')).toEqual([['A', 0], ['B', 1], ['C', 2]]);
    await saveCard(db, lessonId, { id: b.id, body: 'B2', title: 'Tb', image_credit: 'Wikimedia' });
    const row = (await db.from('cards').select('*').eq('id', b.id).single()).data!;
    expect(row).toMatchObject({ body: 'B2', title: 'Tb', image_credit: 'Wikimedia', position: 1 });
    expect((await db.from('cards').select('title').eq('id', c.id).single()).data?.title).toBeNull();
    await moveItem(db, 'cards', a.id, 'down');
    expect((await rows('cards', 'body')).map((r) => r[0])).toEqual(['B2', 'A', 'C']);
    await moveItem(db, 'cards', b.id, 'up'); // already first: no-op
    await deleteItem(db, 'cards', b.id);
    expect(await rows('cards', 'body')).toEqual([['A', 0], ['C', 1]]);
    await expect(saveCard(db, lessonId, { body: '  ' })).rejects.toThrow('Textul cartonașului nu poate fi gol.');
  });

  it('saves questions of all three types and returns validateQuestion messages', async () => {
    const single = await saveQuestion(db, lessonId, {
      type: 'single_choice', prompt: 'Q1', difficulty: 'easy', explanation: '',
      options: [{ id: 'a', text: 'x', correct: true }, { id: 'b', text: 'y', correct: false }],
    });
    await saveQuestion(db, lessonId, {
      type: 'multiple_choice', prompt: 'Q2', difficulty: 'medium', explanation: 'de ce',
      options: [{ id: 'a', text: 'x', correct: true }, { id: 'b', text: 'y', correct: true }],
    });
    const order = await saveQuestion(db, lessonId, {
      type: 'chronological_order', prompt: 'Q3', difficulty: 'hard', explanation: null,
      options: [{ id: 'a', text: 'întâi', label: '1859' }, { id: 'b', text: 'apoi' }],
    });
    expect(await rows('questions', 'prompt')).toEqual([['Q1', 0], ['Q2', 1], ['Q3', 2]]);
    const stored = (await db.from('questions').select('*').eq('id', order.id).single()).data!;
    expect(stored.options).toEqual([{ id: 'a', text: 'întâi', label: '1859' }, { id: 'b', text: 'apoi' }]);
    expect((await db.from('questions').select('explanation').eq('id', single.id).single()).data?.explanation).toBeNull();

    await saveQuestion(db, lessonId, {
      id: single.id, type: 'single_choice', prompt: 'Q1b', difficulty: 'hard', explanation: null,
      options: [{ id: 'a', text: 'x', correct: false }, { id: 'b', text: 'y', correct: true }],
    });
    expect((await db.from('questions').select('prompt,difficulty').eq('id', single.id).single()).data).toEqual({ prompt: 'Q1b', difficulty: 'hard' });

    const err = await saveQuestion(db, lessonId, {
      type: 'single_choice', prompt: 'bad', difficulty: 'easy', explanation: null,
      options: [{ id: 'a', text: 'x', correct: true }, { id: 'b', text: 'y', correct: true }],
    }).then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(UserError);
    expect((err as Error).message).toBe('Alegerea simplă trebuie să aibă exact un răspuns corect.');
    await expect(
      saveQuestion(db, lessonId, {
        type: 'multiple_choice', prompt: 'p', difficulty: 'easy', explanation: null,
        options: [{ id: 'a', text: '', correct: true }, { id: 'b', text: 'y', correct: false }],
      }),
    ).rejects.toThrow('Textul variantei nu poate fi gol.');
    expect(await rows('questions', 'prompt')).toHaveLength(3);

    await moveItem(db, 'questions', order.id, 'up');
    expect((await rows('questions', 'prompt')).map((r) => r[0])).toEqual(['Q1b', 'Q3', 'Q2']);
    await deleteItem(db, 'questions', single.id);
    expect(await rows('questions', 'prompt')).toEqual([['Q3', 0], ['Q2', 1]]);
  });

  it('saves, edits, moves and deletes exercises', async () => {
    const a = await saveExercise(db, lessonId, { prompt: 'E1', criteria: 'c1\nc2' });
    const b = await saveExercise(db, lessonId, { prompt: 'E2', criteria: 'c' });
    await saveExercise(db, lessonId, { id: a.id, prompt: 'E1b', criteria: 'c1' });
    await moveItem(db, 'writing_exercises', b.id, 'up');
    expect(await rows('writing_exercises', 'prompt')).toEqual([['E2', 0], ['E1b', 1]]);
    await expect(saveExercise(db, lessonId, { prompt: '', criteria: 'x' })).rejects.toThrow('Enunțul exercițiului nu poate fi gol.');
    await expect(saveExercise(db, lessonId, { prompt: 'x', criteria: ' ' })).rejects.toThrow('Criteriile nu pot fi goale.');
    await deleteItem(db, 'writing_exercises', b.id);
    expect(await rows('writing_exercises', 'prompt')).toEqual([['E1b', 0]]);
  });

  it('getLessonForEdit returns the lesson with ordered items, null for an unknown id', async () => {
    const data = await getLessonForEdit(db, lessonId);
    expect(data?.lesson.title).toBe('[test] nou');
    expect(data?.cards.map((c) => c.body)).toEqual(['A', 'C']);
    expect(data?.questions.map((q) => q.prompt)).toEqual(['Q3', 'Q2']);
    expect(data?.exercises.map((e) => e.prompt)).toEqual(['E1b']);
    expect(await getLessonForEdit(db, '00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('uploads images (<=5 MB, jpeg/png/webp) to lessons/<id>/<uuid>.<ext>; rejects others', async () => {
    const { path } = await uploadCardImage(db, lessonId, new File([PNG], 'harta.png', { type: 'image/png' }));
    uploaded.push(path);
    expect(path).toMatch(new RegExp(`^lessons/${lessonId}/[0-9a-f-]{36}\\.png$`));
    const res = await fetch(db.storage.from('images').getPublicUrl(path).data.publicUrl);
    expect(res.status).toBe(200);

    await expect(
      uploadCardImage(db, lessonId, new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'mare.png', { type: 'image/png' })),
    ).rejects.toThrow('Imaginea depășește 5 MB.');
    await expect(
      uploadCardImage(db, lessonId, new File(['hi'], 'a.txt', { type: 'text/plain' })),
    ).rejects.toThrow('Sunt acceptate doar imagini JPEG, PNG sau WebP.');
  });

  it('fails with a Romanian error when RLS denies writes (anon)', async () => {
    const anonDb = createClient(url!, anon!, { auth: { persistSession: false } });
    const card = await saveCard(db, lessonId, { body: 'rls' });
    for (const call of [
      () => updateLesson(anonDb, lessonId, { title: 'hacked' }),
      () => saveCard(anonDb, lessonId, { id: card.id, body: 'hacked' }),
      () => deleteItem(anonDb, 'cards', card.id),
      () => moveItem(anonDb, 'cards', card.id, 'up'),
    ]) {
      const err = await call().then(() => null, (e: unknown) => e);
      expect(err).toBeInstanceOf(UserError);
      expect((err as Error).message).toBe('Operația a eșuat. Încearcă din nou.');
    }
    expect((await db.from('cards').select('body').eq('id', card.id).single()).data?.body).toBe('rls');
  });
});
