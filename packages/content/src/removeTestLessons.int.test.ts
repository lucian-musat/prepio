import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { lessons } from './index';
import { removeTestLessons } from './removeTestLessons';
import { seed } from './seed';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!url || !serviceKey)('removeTestLessons (integration)', () => {
  let client: SupabaseClient;

  const titles = async (): Promise<string[]> => {
    const { data, error } = await client.from('lessons').select('title').order('title');
    if (error) throw error;
    return data.map((l) => l.title);
  };

  const addLesson = async (title: string): Promise<string> => {
    const { data: node, error: nodeErr } = await client.from('nodes').select('id').limit(1).single();
    if (nodeErr) throw nodeErr;
    const { data, error } = await client
      .from('lessons')
      .insert({ node_id: node.id, title, status: 'published' })
      .select('id')
      .single();
    if (error) throw error;
    const card = await client.from('cards').insert({ lesson_id: data.id, type: 'text', content: { text: 'x' } });
    if (card.error) throw card.error;
    const img = await client.storage
      .from('images')
      .upload(`lessons/${data.id}/pic.png`, new Uint8Array([1, 2, 3]), { contentType: 'image/png' });
    if (img.error) throw img.error;
    return data.id;
  };

  beforeAll(async () => {
    client = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    await seed(client, { reset: true });
  });

  afterAll(async () => {
    await seed(client, { reset: true });
  });

  it('plans without deleting, then deletes only the exact titles and their images', async () => {
    const id = await addLesson('test');
    await addLesson('test 2');
    await addLesson('test 3');
    const seeded = lessons.map((l) => l.title);

    const dry = await removeTestLessons(client, { apply: false });
    expect(dry.lessons.map((l) => [l.title, l.status])).toEqual([
      ['test', 'ok'],
      ['test 2', 'ok'],
    ]);
    expect(dry.lessons[0]).toMatchObject({ cards: 1, questions: 0, exercises: 0, images: [`lessons/${id}/pic.png`] });
    expect(await titles()).toEqual(expect.arrayContaining(['test', 'test 2', 'test 3']));

    const applied = await removeTestLessons(client, { apply: true });
    expect(applied).toMatchObject({ removed: 2, problems: 0 });
    const left = await titles();
    expect(left).not.toContain('test');
    expect(left).not.toContain('test 2');
    expect(left).toEqual(expect.arrayContaining(['test 3', ...seeded]));
    const { data: files } = await client.storage.from('images').list(`lessons/${id}`);
    expect(files ?? []).toHaveLength(0);

    const again = await removeTestLessons(client, { apply: true });
    expect(again).toMatchObject({ removed: 0, problems: 0 });
    expect(again.lessons.every((l) => l.status === 'not_found')).toBe(true);
  });

  it('leaves a title alone when several lessons have it', async () => {
    await addLesson('test');
    await addLesson('test');
    const result = await removeTestLessons(client, { apply: true, titles: ['test'] });
    expect(result).toMatchObject({ removed: 0, problems: 1 });
    expect(result.lessons[0]).toMatchObject({ status: 'ambiguous', matches: 2 });
    expect((await titles()).filter((t) => t === 'test')).toHaveLength(2);
  });
});
