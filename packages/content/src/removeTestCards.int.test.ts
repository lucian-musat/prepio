import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { removeTestCards } from './removeTestCards';
import { seed } from './seed';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LESSON = 'Constituția din 1866 și monarhia constituțională';

describe.skipIf(!url || !serviceKey)('removeTestCards (integration)', () => {
  let client: SupabaseClient;

  const lessonId = async (): Promise<string> => {
    const { data, error } = await client.from('lessons').select('id').eq('title', LESSON).single();
    if (error) throw error;
    return data.id;
  };
  const cardTitles = async (): Promise<(string | null)[]> => {
    const { data, error } = await client.from('cards').select('title').eq('lesson_id', await lessonId());
    if (error) throw error;
    return data.map((c) => c.title);
  };
  const addCard = async (title: string): Promise<void> => {
    const { error } = await client
      .from('cards')
      .insert({ lesson_id: await lessonId(), type: 'text', title, position: 0, content: { text: 'test' } });
    if (error) throw error;
  };

  beforeAll(async () => {
    client = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    await seed(client, { reset: true });
  });

  afterAll(async () => {
    await seed(client, { reset: true });
  });

  it('plans without deleting, then deletes only the test card and keeps the seeded ones', async () => {
    const before = await cardTitles();
    await addCard('card test');

    const dry = await removeTestCards(client, { apply: false });
    expect(dry.cards).toEqual([expect.objectContaining({ lesson: LESSON, title: 'card test', status: 'ok', type: 'text' })]);
    expect(await cardTitles()).toContain('card test');

    const applied = await removeTestCards(client, { apply: true });
    expect(applied).toMatchObject({ removed: 1, problems: 0 });
    expect((await cardTitles()).sort()).toEqual([...before].sort());

    const again = await removeTestCards(client, { apply: true });
    expect(again).toMatchObject({ removed: 0, problems: 0 });
    expect(again.cards[0]).toMatchObject({ status: 'not_found' });
  });

  it('leaves the card alone when the lesson has several cards with that title', async () => {
    await addCard('card test');
    await addCard('card test');
    const result = await removeTestCards(client, { apply: true });
    expect(result).toMatchObject({ removed: 0, problems: 1 });
    expect(result.cards[0]).toMatchObject({ status: 'ambiguous', matches: 2 });
    expect((await cardTitles()).filter((t) => t === 'card test')).toHaveLength(2);
  });
});
