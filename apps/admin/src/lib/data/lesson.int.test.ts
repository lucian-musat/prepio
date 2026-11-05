import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { UserError } from './db';
import { createLesson, createNode } from './tree';
import {
  type CardInput, deleteItem, getLessonForEdit, moveItem, saveCard, saveQuestion, updateLesson, uploadCardImage,
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

  const rows = async (table: 'cards' | 'questions', col: string) =>
    (await db.from(table).select(`${col},position`).eq('lesson_id', lessonId).order('position')).data!.map(
      (r) => {
        const x = r as unknown as Record<string, unknown>;
        return [x[col], x.position];
      },
    );

  const texts = async () =>
    (await db.from('cards').select('content,position').eq('lesson_id', lessonId).order('position')).data!.map(
      (r) => [(r.content as { text: string }).text, r.position],
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

  it('saves, edits, moves and deletes text cards with contiguous positions', async () => {
    const a = await saveCard(db, lessonId, { type: 'text', text: 'A', title: 'Ta' });
    const b = await saveCard(db, lessonId, { type: 'text', text: 'B', title: '' });
    const c = await saveCard(db, lessonId, { type: 'text', text: ' C ', title: null });
    expect(await texts()).toEqual([['A', 0], ['B', 1], ['C', 2]]);
    await saveCard(db, lessonId, { id: b.id, type: 'text', text: 'B2', title: 'Tb' });
    const row = (await db.from('cards').select('*').eq('id', b.id).single()).data!;
    expect(row).toMatchObject({ type: 'text', content: { text: 'B2' }, title: 'Tb', position: 1 });
    expect((await db.from('cards').select('title').eq('id', c.id).single()).data?.title).toBeNull();
    await moveItem(db, 'cards', a.id, 'down');
    expect((await texts()).map((r) => r[0])).toEqual(['B2', 'A', 'C']);
    await moveItem(db, 'cards', b.id, 'up'); // already first: no-op
    await deleteItem(db, 'cards', b.id);
    expect(await texts()).toEqual([['A', 0], ['C', 1]]);
    await expect(saveCard(db, lessonId, { type: 'text', text: '  ', title: null })).rejects.toThrow('Textul nu poate fi gol.');
  });

  describe('typed cards', () => {
    const ownPath = (name: string) => `lessons/${lessonId}/${name}`;
    const put = async (name: string) => {
      const path = ownPath(name);
      const { error } = await db.storage.from('images').upload(path, PNG, { contentType: 'image/png', upsert: true });
      if (error) throw error;
      uploaded.push(path);
      return path;
    };
    const exists = async (path: string) => {
      const dir = path.slice(0, path.lastIndexOf('/'));
      const { data } = await db.storage.from('images').list(dir);
      return (data ?? []).some((f) => `${dir}/${f.name}` === path);
    };
    const read = async (id: string) => (await getLessonForEdit(db, lessonId))!.cards.find((c) => c.id === id)!;

    it('saves and reads back one card of each type', async () => {
      const img = await put('rt.png');
      const inputs: CardInput[] = [
        { type: 'text', title: 'T', text: 'hello' },
        { type: 'images', title: null, images: [{ path: img, alt: 'o poză', credit: null }], display: 'gallery', text: null },
        { type: 'video', title: null, youtubeId: 'dQw4w9WgXcQ', startSeconds: 5, endSeconds: 10, text: null },
        {
          type: 'timeline', title: null,
          points: [
            { id: 'p1', date: '1859', title: 'Unirea', details: null, key: true, imagePath: null },
            { id: 'p2', date: '1877', title: 'Independența', details: 'detalii', key: false, imagePath: null },
          ],
        },
        {
          type: 'schema', title: null, causesLabel: 'Cauze', consequencesLabel: 'Urmări',
          causes: [{ id: 'c1', text: 'a', detail: null }],
          central: { id: 'x', text: 'centru', detail: null },
          consequences: [{ id: 'k1', text: 'b', detail: null }],
        },
        { type: 'link', title: null, url: 'https://ro.wikipedia.org', pageTitle: 'Wiki', description: null, image: null, text: null },
      ];
      const ids: string[] = [];
      for (const input of inputs) ids.push((await saveCard(db, lessonId, input)).id);
      for (const [i, input] of inputs.entries()) {
        expect(await read(ids[i])).toMatchObject({ ...input, id: ids[i] });
      }
      for (const id of ids) await deleteItem(db, 'cards', id);
    });

    it('rejects an invalid timeline with the shared message', async () => {
      const err = await saveCard(db, lessonId, {
        type: 'timeline', title: null,
        points: [{ id: 'p1', date: '1859', title: 'x', details: null, key: false, imagePath: null }],
      }).then(() => null, (e: unknown) => e);
      expect(err).toBeInstanceOf(UserError);
      expect((err as Error).message).toBe('Axa cronologică are nevoie de cel puțin 2 puncte.');
    });

    it("rejects image paths outside this lesson's folder", async () => {
      const other = '00000000-0000-0000-0000-000000000001';
      for (const path of [`lessons/${other}/x.png`, 'evil/x.png', '']) {
        const err = await saveCard(db, lessonId, {
          type: 'images', title: null, images: [{ path, alt: 'a', credit: null }], display: 'single', text: null,
        }).then(() => null, (e: unknown) => e);
        expect(err).toBeInstanceOf(UserError);
        expect((err as Error).message).toBe('Imagine invalidă.');
      }
      const err = await saveCard(db, lessonId, {
        type: 'link', title: null, url: 'https://a.ro', pageTitle: 't', description: null,
        image: { kind: 'path', path: `lessons/${other}/x.png` }, text: null,
      }).then(() => null, (e: unknown) => e);
      expect((err as Error).message).toBe('Imagine invalidă.');
    });

    it('drops unknown content keys and trims strings', async () => {
      const { id } = await saveCard(db, lessonId, {
        type: 'text', title: ' ', text: '  hi  ', evil: 'x', body: 'old',
      } as unknown as CardInput);
      const row = (await db.from('cards').select('title,content').eq('id', id).single()).data!;
      expect(row).toEqual({ title: null, content: { text: 'hi' } });
      await deleteItem(db, 'cards', id);
    });

    it('deletes the replaced image object from storage on update', async () => {
      const oldP = await put('old.png');
      const keep = await put('keep.png');
      const newP = await put('new.png');
      const img = (path: string) => ({ path, alt: 'a', credit: null });
      const { id } = await saveCard(db, lessonId, {
        type: 'images', title: null, images: [img(oldP), img(keep)], display: 'gallery', text: null,
      });
      await saveCard(db, lessonId, {
        id, type: 'images', title: null, images: [img(newP), img(keep)], display: 'gallery', text: null,
      });
      expect(await exists(oldP)).toBe(false);
      expect(await exists(keep)).toBe(true);
      expect(await exists(newP)).toBe(true);
      await deleteItem(db, 'cards', id);
      expect(await exists(keep)).toBe(false);
      expect(await exists(newP)).toBe(false);
    });

    it('deletes timeline and link images with the card', async () => {
      const t = await put('tl.png');
      const l = await put('lk.png');
      const tl = await saveCard(db, lessonId, {
        type: 'timeline', title: null,
        points: [
          { id: 'a', date: '1', title: 'a', details: null, key: false, imagePath: t },
          { id: 'b', date: '2', title: 'b', details: null, key: false, imagePath: null },
        ],
      });
      const lk = await saveCard(db, lessonId, {
        type: 'link', title: null, url: 'https://a.ro', pageTitle: 't', description: null,
        image: { kind: 'path', path: l }, text: null,
      });
      await deleteItem(db, 'cards', tl.id);
      await deleteItem(db, 'cards', lk.id);
      expect(await exists(t)).toBe(false);
      expect(await exists(l)).toBe(false);
    });

    it('rejects traversal, empty names, backslashes and absolute paths', async () => {
      const other = '00000000-0000-0000-0000-000000000001';
      for (const path of [
        `lessons/${lessonId}/../${other}/x.png`, 'seed/../lessons/x/y.png', `lessons/${lessonId}/`,
        `lessons/${lessonId}/a\\b.png`, `/lessons/${lessonId}/x.png`, `lessons/${lessonId}/..`, 'seed/', `lessons/${lessonId}/a/b.png`,
      ]) {
        const err = await saveCard(db, lessonId, {
          type: 'images', title: null, images: [{ path, alt: 'a', credit: null }], display: 'single', text: null,
        }).then(() => null, (e: unknown) => e);
        expect((err as Error | null)?.message, path).toBe('Imagine invalidă.');
      }
    });

    it('keeps an object still referenced by another card of the lesson', async () => {
      const shared = await put('shared.png');
      const mk = (p: string) => ({
        type: 'images' as const, title: null, images: [{ path: p, alt: 'a', credit: null }], display: 'single' as const, text: null,
      });
      const a = await saveCard(db, lessonId, mk(shared));
      const b = await saveCard(db, lessonId, mk(shared));
      const other = await put('shared2.png');
      await saveCard(db, lessonId, { id: a.id, ...mk(other) });
      expect(await exists(shared)).toBe(true);
      await deleteItem(db, 'cards', a.id);
      expect(await exists(shared)).toBe(true);
      await deleteItem(db, 'cards', b.id);
      expect(await exists(shared)).toBe(false);
    });

    it('cannot update a card of another lesson and leaves its images intact', async () => {
      const n = await createNode(db, rootId, 'node2');
      const otherLesson = (await createLesson(db, n.id, '[test] other')).id;
      const path = `lessons/${otherLesson}/keep.png`;
      await db.storage.from('images').upload(path, PNG, { contentType: 'image/png', upsert: true });
      uploaded.push(path);
      const card = await saveCard(db, otherLesson, {
        type: 'images', title: null, images: [{ path, alt: 'a', credit: null }], display: 'single', text: null,
      });
      await expect(saveCard(db, lessonId, { id: card.id, type: 'text', title: null, text: 'x' })).rejects.toThrow();
      expect(await exists(path)).toBe(true);
      expect((await db.from('cards').select('type').eq('id', card.id).single()).data?.type).toBe('images');
    });

    it('rejects an unknown card type', async () => {
      const err = await saveCard(db, lessonId, { type: 'bogus', title: null } as unknown as CardInput).then(() => null, (e: unknown) => e);
      expect(err).toBeInstanceOf(UserError);
    });

    it('never deletes seed/ objects', async () => {
      const seedName = (await db.storage.from('images').list('seed')).data?.find((f) => f.id)?.name;
      expect(seedName, 'seeded images are required (pnpm seed)').toBeTruthy();
      const path = `seed/${seedName}`;
      const mk = (p: string) => ({
        type: 'images' as const, title: null, images: [{ path: p, alt: 'a', credit: null }], display: 'single' as const, text: null,
      });
      const { id } = await saveCard(db, lessonId, mk(path));
      const other = await put('swap.png');
      await saveCard(db, lessonId, { id, ...mk(other) });
      expect(await exists(path)).toBe(true);
      await saveCard(db, lessonId, { id, ...mk(path) });
      await deleteItem(db, 'cards', id);
      expect(await exists(path)).toBe(true);
    });
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

  it('getLessonForEdit returns the lesson with ordered items, null for an unknown id', async () => {
    const data = await getLessonForEdit(db, lessonId);
    expect(data?.lesson.title).toBe('[test] nou');
    expect(data?.cards.map((c) => (c.type === 'text' ? c.text : null))).toEqual(['A', 'C']);
    expect(data?.questions.map((q) => q.prompt)).toEqual(['Q3', 'Q2']);
    expect(data?.consolidation).toEqual({ sources: [], exercises: [], templates: expect.any(Array) });
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

  it('refuses to upload for a non-UUID or unknown lesson id and stores nothing', async () => {
    const png = () => new File([PNG], 'x.png', { type: 'image/png' });
    const before = (await db.storage.from('images').list('lessons')).data?.length ?? 0;
    for (const bad of ['foo/bar', '../x', 'not-a-uuid', '00000000-0000-0000-0000-000000000000']) {
      const err = await uploadCardImage(db, bad, png()).then(() => null, (e: unknown) => e);
      expect(err).toBeInstanceOf(UserError);
      expect((err as Error).message).toBe('Lecția nu există.');
    }
    expect((await db.storage.from('images').list('lessons')).data?.length ?? 0).toBe(before);
    expect((await db.storage.from('images').list('lessons/foo')).data ?? []).toHaveLength(0);
  });

  it('fails with a Romanian error when RLS denies writes (anon)', async () => {
    const anonDb = createClient(url!, anon!, { auth: { persistSession: false } });
    const card = await saveCard(db, lessonId, { type: 'text', title: null, text: 'rls' });
    for (const call of [
      () => updateLesson(anonDb, lessonId, { title: 'hacked' }),
      () => saveCard(anonDb, lessonId, { id: card.id, type: 'text', title: null, text: 'hacked' }),
      () => deleteItem(anonDb, 'cards', card.id),
      () => moveItem(anonDb, 'cards', card.id, 'up'),
    ]) {
      const err = await call().then(() => null, (e: unknown) => e);
      expect(err).toBeInstanceOf(UserError);
      expect((err as Error).message).toBe('Operația a eșuat. Încearcă din nou.');
    }
    expect((await db.from('cards').select('content').eq('id', card.id).single()).data?.content).toEqual({ text: 'rls' });
  });
});
