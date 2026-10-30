import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { aiDefaults, lessons, tree, welcomeMessage } from './index';
import { seed } from './seed';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

const countNodes = (nodes: typeof tree): number =>
  nodes.reduce((n, node) => n + 1 + countNodes(node.children ?? []), 0);

const ADMIN = { adminEmail: 'seed-test-admin@prepio.local', adminPassword: 'seed-test-password' };

async function count(client: SupabaseClient, table: string): Promise<number> {
  const { count: c, error } = await client.from(table).select('*', { count: 'exact', head: true });
  if (error) throw error;
  return c ?? 0;
}

describe.skipIf(!url || !serviceKey)('seed (integration)', () => {
  let client: SupabaseClient;
  let userId: string | undefined;

  beforeAll(() => {
    client = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
  });

  afterAll(async () => {
    if (userId) await client.auth.admin.deleteUser(userId);
  });

  it('loads the content package and is idempotent', async () => {
    const result = await seed(client, ADMIN);
    expect(result).toEqual({ nodes: 14, lessons: 3 });
    expect(countNodes(tree)).toBe(14);

    const snapshot = async () => ({
      nodes: await count(client, 'nodes'),
      lessons: await count(client, 'lessons'),
      cards: await count(client, 'cards'),
      questions: await count(client, 'questions'),
      writing_exercises: await count(client, 'writing_exercises'),
    });
    const first = await snapshot();
    expect(first).toEqual({
      nodes: 14,
      lessons: 3,
      cards: lessons.reduce((n, l) => n + l.cards.length, 0),
      questions: lessons.reduce((n, l) => n + l.questions.length, 0),
      writing_exercises: lessons.reduce((n, l) => n + l.exercises.length, 0),
    });

    const { data: dbLessons, error } = await client
      .from('lessons')
      .select('title,status,cards(id),questions(id),writing_exercises(id)');
    if (error) throw error;
    for (const l of lessons) {
      const row = dbLessons!.find((r) => r.title === l.title);
      expect(row, l.title).toBeDefined();
      expect(row!.status).toBe('published');
      expect(row!.cards).toHaveLength(l.cards.length);
      expect(row!.questions).toHaveLength(l.questions.length);
      expect(row!.writing_exercises).toHaveLength(l.exercises.length);
    }

    await seed(client);
    expect(await snapshot()).toEqual(first);
  });

  it('sets settings and ai_settings without overwriting existing values', async () => {
    const { data: s } = await client.from('settings').select('*').eq('id', 1).single();
    expect(s?.welcome_message).toBe(welcomeMessage);
    const { data: ai } = await client.from('ai_settings').select('*').eq('id', 1).single();
    expect(ai).toMatchObject({
      rules: aiDefaults.rules,
      grade_min: aiDefaults.gradeMin,
      grade_max: aiDefaults.gradeMax,
      model: aiDefaults.model,
    });

    await client.from('settings').update({ welcome_message: 'Mesaj editat' }).eq('id', 1);
    await seed(client);
    const { data: after } = await client.from('settings').select('*').eq('id', 1).single();
    expect(after?.welcome_message).toBe('Mesaj editat');
    await client.from('settings').update({ welcome_message: welcomeMessage }).eq('id', 1);
  });

  it('uploads every card image to the images bucket', async () => {
    const { data: cards, error } = await client.from('cards').select('image_path').not('image_path', 'is', null);
    if (error) throw error;
    expect(cards!.length).toBeGreaterThan(0);
    for (const { image_path } of cards!) {
      expect(image_path).toMatch(/^seed\//);
      const { data, error: e } = await client.storage.from('images').download(image_path);
      expect(e, image_path).toBeNull();
      expect(data!.size).toBeGreaterThan(0);
    }
  });

  it('creates the admin user who can sign in', async () => {
    const { data: list } = await client.auth.admin.listUsers({ perPage: 1000 });
    const user = list?.users.find((u) => u.email === ADMIN.adminEmail);
    expect(user).toBeDefined();
    userId = user?.id;

    const authClient = createClient(url!, anonKey ?? serviceKey!, { auth: { persistSession: false } });
    const { data, error } = await authClient.auth.signInWithPassword({
      email: ADMIN.adminEmail,
      password: ADMIN.adminPassword,
    });
    expect(error).toBeNull();
    expect(data.session).not.toBeNull();
  });
});
