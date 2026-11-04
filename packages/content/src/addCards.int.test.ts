import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { cardFromRow, type CardRow } from '@prepio/shared';
import { addCards } from './addCards';
import { EXTRA_CARDS } from './extraCards';
import { lessons } from './index';
import { seed, withStoragePaths } from './seed';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type Row = CardRow & { lesson_id: string };

const EXTRA_COUNT = Object.values(EXTRA_CARDS).reduce((n, c) => n + c.length, 0);
// An image used only by extra cards would be enough, but every seed image is shared; removing one still
// checks that a missing file is uploaded (and that the dry run does not upload it).
const REMOVED_IMAGE = 'hora-unirii-aman.jpg';

describe.skipIf(!url || !serviceKey)('addCards (integration)', () => {
  let client: SupabaseClient;

  const cards = async (): Promise<Row[]> => {
    const { data, error } = await client
      .from('cards')
      .select('id,lesson_id,position,title,type,content')
      .order('lesson_id')
      .order('position');
    if (error) throw error;
    return data as Row[];
  };

  const lessonId = async (title: string): Promise<string> => {
    const { data, error } = await client.from('lessons').select('id').eq('title', title).single();
    if (error) throw error;
    return data.id;
  };

  const imageExists = async (file: string): Promise<boolean> => {
    const { data, error } = await client.storage.from('images').list('seed', { search: file });
    if (error) throw error;
    return data.some((f) => f.name === file);
  };

  beforeAll(async () => {
    client = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    await seed(client, { reset: true });
    // Simulate the production database, seeded before the extra cards existed.
    for (const [key, extras] of Object.entries(EXTRA_CARDS)) {
      const id = await lessonId(lessons.find((l) => l.key === key)!.title);
      for (const c of extras) {
        const del = await client.from('cards').delete().eq('lesson_id', id).eq('type', c.type).eq('title', c.title!);
        if (del.error) throw del.error;
      }
    }
    expect((await client.storage.from('images').remove([`seed/${REMOVED_IMAGE}`])).error).toBeNull();
  });

  afterAll(async () => {
    await seed(client, { reset: true });
  });

  it('dry run plans every extra card and changes nothing', async () => {
    const before = await cards();
    const result = await addCards(client, { apply: false });
    expect(result.problems).toBe(0);
    expect(result.added).toBe(0);
    expect(result.lessons.flatMap((l) => (l.status === 'ok' ? l.add : []))).toHaveLength(EXTRA_COUNT);
    expect(result.lessons.some((l) => l.status === 'ok' && l.upload.includes(REMOVED_IMAGE))).toBe(true);
    expect(await cards()).toEqual(before);
    expect(await imageExists(REMOVED_IMAGE)).toBe(false);
  });

  it('--apply appends exactly the extra cards and leaves existing cards untouched', async () => {
    const before = await cards();
    const result = await addCards(client, { apply: true });
    expect(result).toMatchObject({ problems: 0, added: EXTRA_COUNT, uploaded: 1 });
    expect(await imageExists(REMOVED_IMAGE)).toBe(true);

    const after = await cards();
    expect(after).toHaveLength(before.length + EXTRA_COUNT);
    for (const [key, extras] of Object.entries(EXTRA_CARDS)) {
      const id = await lessonId(lessons.find((l) => l.key === key)!.title);
      const old = before.filter((r) => r.lesson_id === id);
      const now = after.filter((r) => r.lesson_id === id);
      expect(now.slice(0, old.length)).toEqual(old);
      const added = now.slice(old.length);
      const maxOld = Math.max(...old.map((r) => r.position));
      expect(added.map((r) => r.position)).toEqual(extras.map((_, i) => maxOld + 1 + i));
      expect(
        added.map((r) => {
          const { id: _id, position: _p, ...card } = cardFromRow(r);
          return card;
        }),
      ).toEqual(extras.map(withStoragePaths));
    }
  });

  it('a second --apply inserts nothing (idempotent)', async () => {
    const before = await cards();
    const result = await addCards(client, { apply: true });
    expect(result).toMatchObject({ problems: 0, added: 0, uploaded: 0 });
    for (const l of result.lessons) if (l.status === 'ok') expect(l.add).toEqual([]);
    expect(await cards()).toEqual(before);
  });

  it('reports and skips a lesson whose title is not found', async () => {
    const title = lessons.find((l) => l.key === 'constitutia-1866')!.title;
    const id = await lessonId(title);
    expect((await client.from('lessons').update({ title: `[test] ${title}` }).eq('id', id)).error).toBeNull();
    try {
      const before = await cards();
      const result = await addCards(client, { apply: true });
      expect(result.problems).toBe(1);
      expect(result.lessons.find((l) => l.key === 'constitutia-1866')).toMatchObject({ status: 'not_found' });
      expect(await cards()).toEqual(before);
    } finally {
      await client.from('lessons').update({ title }).eq('id', id);
    }
  });
});
