import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cardFromRow, cardImagePaths, type CardRow } from '@prepio/shared';
import { aiDefaults, lessons, tree, welcomeMessage, type SeedCard } from './index';
import { seed } from './seed';

/** The source card as it should be stored: every image file name prefixed with `seed/`. */
function withSeedPaths(card: SeedCard): SeedCard {
  const seedPath = (file: string) => `seed/${file}`;
  switch (card.type) {
    case 'images':
      return { ...card, images: card.images.map((i) => ({ ...i, path: seedPath(i.path) })) };
    case 'timeline':
      return {
        ...card,
        points: card.points.map((p) => ({ ...p, imagePath: p.imagePath && seedPath(p.imagePath) })),
      };
    case 'link':
      return card.image?.kind === 'path' ? { ...card, image: { kind: 'path', path: seedPath(card.image.path) } } : card;
    default:
      return card;
  }
}

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

const countNodes = (nodes: typeof tree): number =>
  nodes.reduce((n, node) => n + 1 + countNodes(node.children ?? []), 0);

const ADMIN = { adminEmail: 'seed-test-admin@prepio.local', adminPassword: 'seed-test-password' };
const ADMIN2 = { adminEmail: 'seed-test-admin2@prepio.local', adminPassword: 'seed-test-password2' };
const EXISTING = { adminEmail: 'seed-test-existing@prepio.local', adminPassword: 'seed-test-password3' };

const EXPECTED = {
  nodes: 14,
  lessons: 3,
  cards: lessons.reduce((n, l) => n + l.cards.length, 0),
  questions: lessons.reduce((n, l) => n + l.questions.length, 0),
  consolidation_exercises: lessons.reduce((n, l) => n + l.exercises.length, 0),
};

async function count(client: SupabaseClient, table: string): Promise<number> {
  const { count: c, error } = await client.from(table).select('*', { count: 'exact', head: true });
  if (error) throw error;
  return c ?? 0;
}

async function userId(client: SupabaseClient, email: string): Promise<string | undefined> {
  const { data } = await client.auth.admin.listUsers({ perPage: 1000 });
  return data?.users.find((u) => u.email === email)?.id;
}

describe.skipIf(!url || !serviceKey)('seed (integration)', () => {
  let client: SupabaseClient;

  const isListedAdmin = async (email: string): Promise<boolean> => {
    const id = await userId(client, email);
    if (!id) return false;
    const { data, error } = await client.from('admins').select('user_id').eq('user_id', id);
    if (error) throw error;
    return data.length === 1;
  };

  const snapshot = async () => ({
    nodes: await count(client, 'nodes'),
    lessons: await count(client, 'lessons'),
    cards: await count(client, 'cards'),
    questions: await count(client, 'questions'),
    consolidation_exercises: await count(client, 'consolidation_exercises'),
  });

  beforeAll(() => {
    client = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
  });

  afterAll(async () => {
    for (const email of [ADMIN.adminEmail, ADMIN2.adminEmail, EXISTING.adminEmail]) {
      const id = await userId(client, email);
      if (id) await client.auth.admin.deleteUser(id);
    }
    await client.from('nodes').delete().like('title', '[test]%');
  });

  it('seeds an empty database without needing reset', async () => {
    const del = await client.from('nodes').delete().not('id', 'is', null);
    expect(del.error).toBeNull();
    expect(await count(client, 'lessons')).toBe(0);

    const result = await seed(client);
    expect(result).toEqual({ contentSeeded: true, nodes: 14, lessons: 3 });
    expect(countNodes(tree)).toBe(14);
    expect(await snapshot()).toEqual(EXPECTED);
  });

  it('with reset replaces the content and is idempotent', async () => {
    const result = await seed(client, { ...ADMIN, reset: true });
    expect(result).toEqual({ contentSeeded: true, nodes: 14, lessons: 3 });
    const first = await snapshot();
    expect(first).toEqual(EXPECTED);

    const { data: dbLessons, error } = await client
      .from('lessons')
      .select('title,status,cards(id),questions(id),consolidation_exercises(id)');
    if (error) throw error;
    for (const l of lessons) {
      const row = dbLessons!.find((r) => r.title === l.title);
      expect(row, l.title).toBeDefined();
      expect(row!.status).toBe('published');
      expect(row!.cards).toHaveLength(l.cards.length);
      expect(row!.questions).toHaveLength(l.questions.length);
      expect(row!.consolidation_exercises).toHaveLength(l.exercises.length);
    }

    expect(await seed(client, { reset: true })).toEqual({ contentSeeded: true, nodes: 14, lessons: 3 });
    expect(await snapshot()).toEqual(first);
  });

  it('without reset leaves existing content (incl. owner-authored lessons) untouched', async () => {
    const node = await client.from('nodes').insert({ title: '[test] owner node' }).select('id').single();
    if (node.error) throw node.error;
    const lesson = await client
      .from('lessons')
      .insert({ node_id: node.data.id, title: '[test] owner lesson', status: 'draft' })
      .select('id')
      .single();
    if (lesson.error) throw lesson.error;
    const before = await snapshot();
    const { data: idsBefore } = await client.from('lessons').select('id').order('id');

    // Missing settings rows and a missing image must still be restored without reset.
    const { data: settingsRow } = await client.from('settings').select('*').eq('id', 1).single();
    const { data: aiRow } = await client.from('ai_settings').select('*').eq('id', 1).single();
    expect((await client.from('settings').delete().eq('id', 1)).error).toBeNull();
    expect((await client.from('ai_settings').delete().eq('id', 1)).error).toBeNull();
    expect((await client.storage.from('images').remove(['seed/cuza.jpg'])).error).toBeNull();

    try {
      const result = await seed(client, ADMIN2);
      expect(result).toEqual({ contentSeeded: false });

      expect(await snapshot()).toEqual(before);
      const { data: idsAfter } = await client.from('lessons').select('id').order('id');
      expect(idsAfter).toEqual(idsBefore);
      const { data: owner } = await client.from('lessons').select('title').eq('id', lesson.data.id).single();
      expect(owner?.title).toBe('[test] owner lesson');

      const { data: s } = await client.from('settings').select('welcome_message').eq('id', 1).single();
      expect(s?.welcome_message).toBe(welcomeMessage);
      const { data: ai } = await client.from('ai_settings').select('model').eq('id', 1).single();
      expect(ai?.model).toBe(aiDefaults.model);
      const img = await client.storage.from('images').download('seed/cuza.jpg');
      expect(img.error).toBeNull();
      expect(await isListedAdmin(ADMIN2.adminEmail)).toBe(true);
    } finally {
      await client.from('nodes').delete().eq('id', node.data.id);
      if (settingsRow) await client.from('settings').upsert(settingsRow);
      if (aiRow) await client.from('ai_settings').upsert(aiRow);
    }
    expect(await snapshot()).toEqual(EXPECTED);
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
    await seed(client, { reset: true });
    const { data: after } = await client.from('settings').select('*').eq('id', 1).single();
    expect(after?.welcome_message).toBe('Mesaj editat');
    await client.from('settings').update({ welcome_message: welcomeMessage }).eq('id', 1);
  });

  it('stores every card so that it reads back equal to the source (image paths under seed/)', async () => {
    const { data: dbLessons, error } = await client
      .from('lessons')
      .select('title,cards(id,position,title,type,content)')
      .order('position', { referencedTable: 'cards' });
    if (error) throw error;
    for (const l of lessons) {
      const row = dbLessons!.find((r) => r.title === l.title);
      expect(row, l.title).toBeDefined();
      const readBack = (row!.cards as CardRow[]).map((r) => {
        const { id: _id, position: _position, ...card } = cardFromRow(r);
        return card;
      });
      expect(readBack).toEqual(l.cards.map(withSeedPaths));
    }
  });

  it('uploads every card image to the images bucket', async () => {
    const { data: rows, error } = await client.from('cards').select('id,position,title,type,content');
    if (error) throw error;
    const paths = new Set((rows as CardRow[]).flatMap((r) => cardImagePaths(cardFromRow(r))));
    expect(paths.size).toBeGreaterThan(0);
    for (const path of paths) {
      expect(path).toMatch(/^seed\//);
      const { data, error: e } = await client.storage.from('images').download(path);
      expect(e, path).toBeNull();
      expect(data!.size).toBeGreaterThan(0);
    }
  });

  it('creates the admin user who can sign in', async () => {
    expect(await userId(client, ADMIN.adminEmail)).toBeDefined();
    expect(await isListedAdmin(ADMIN.adminEmail)).toBe(true);

    const authClient = createClient(url!, anonKey ?? serviceKey!, { auth: { persistSession: false } });
    const { data, error } = await authClient.auth.signInWithPassword({
      email: ADMIN.adminEmail,
      password: ADMIN.adminPassword,
    });
    expect(error).toBeNull();
    expect(data.session).not.toBeNull();
  });

  it('adds an already existing admin user to admins', async () => {
    const created = await client.auth.admin.createUser({
      email: EXISTING.adminEmail,
      password: EXISTING.adminPassword,
      email_confirm: true,
    });
    expect(created.error).toBeNull();
    expect(await isListedAdmin(EXISTING.adminEmail)).toBe(false);

    await seed(client, EXISTING);
    expect(await isListedAdmin(EXISTING.adminEmail)).toBe(true);
    await seed(client, EXISTING); // idempotent
    expect(await isListedAdmin(EXISTING.adminEmail)).toBe(true);
  });
});
