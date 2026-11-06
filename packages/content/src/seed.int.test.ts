import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cardFromRow, cardImagePaths, validateExercise, type CardRow } from '@prepio/shared';
import { loadConsolidation } from './consolidation.testutil';
import { aiDefaults, lessons, tree, welcomeMessage, type SeedCard } from './index';
import { seed } from './seed';
import { TEMPLATES } from './templates';

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
  consolidation_exercises: lessons.reduce((n, l) => n + l.consolidation.length, 0),
  sources: lessons.reduce((n, l) => n + l.sources.length, 0),
  consolidation_exercise_sources: lessons.reduce((n, l) => n + l.consolidation.reduce((m, c) => m + c.sources.length, 0), 0),
  consolidation_ai_context: lessons.reduce((n, l) => n + l.consolidation.length, 0),
  seed_templates: TEMPLATES.length,
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
    sources: await count(client, 'sources'),
    consolidation_exercise_sources: await count(client, 'consolidation_exercise_sources'),
    consolidation_ai_context: await count(client, 'consolidation_ai_context'),
    seed_templates: await seedTemplates(),
  });

  /** Templates are not lesson content: a reset keeps them, and the seed only inserts the missing ones (by title). */
  const seedTemplates = async (): Promise<number> => {
    const { data, error } = await client.from('solution_templates').select('title').in('title', TEMPLATES.map((t) => t.title));
    if (error) throw error;
    return data.length;
  };

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
      expect(row!.consolidation_exercises).toHaveLength(l.consolidation.length);
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
    expect(ai).toMatchObject({ rules: aiDefaults.rules, model: aiDefaults.model });

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

  it('stores the sources, templates and consolidation exercises (with links and AI contexts) of every lesson', async () => {
    const { data: tpl, error: tplErr } = await client.from('solution_templates').select('id,title,exercise_type,points,body');
    if (tplErr) throw tplErr;
    for (const t of TEMPLATES) {
      expect(tpl.find((r) => r.title === t.title), t.title).toMatchObject({ exercise_type: t.exerciseType, points: t.points, body: t.body });
    }
    const templateKey = new Map(tpl.map((r) => [r.id as string, TEMPLATES.find((t) => t.title === r.title)?.key ?? null]));

    const { data: dbLessons, error } = await client.from('lessons').select('id,title');
    if (error) throw error;
    for (const l of lessons) {
      const id = dbLessons.find((r) => r.title === l.title)!.id as string;
      const stored = await loadConsolidation(client, id);
      expect(stored.sources.map((s) => [s.title, s.author, s.work, s.body])).toEqual(l.sources.map((s) => [s.title, s.author, s.work, s.body]));
      expect(stored.exercises.length).toBeGreaterThanOrEqual(5);
      expect(stored.exercises.map((e) => [e.exercise.type, e.exercise.prompt])).toEqual(l.consolidation.map((c) => [c.type, c.prompt]));
      stored.exercises.forEach(({ exercise, ai }, i) => {
        const seedEx = l.consolidation[i]!;
        expect(exercise.position).toBe(i);
        expect(ai, exercise.prompt).not.toBeNull();
        expect(validateExercise(exercise, stored.sources, ai), exercise.prompt).toEqual([]);
        expect(exercise.templateId === null ? null : templateKey.get(exercise.templateId)).toBe(seedEx.template);
        const sourceKeys = exercise.sources.map((r) => l.sources[stored.sources.findIndex((s) => s.id === r.sourceId)]?.key);
        expect(sourceKeys).toEqual(seedEx.sources);
        if (seedEx.ai) expect(ai).toEqual(seedEx.ai);
      });

      // The essay keeps its requirements (templates resolved) and one AI context per requirement.
      const essays = stored.exercises.filter((e) => e.exercise.type === 'essay');
      expect(essays).toHaveLength(1);
      const [{ exercise, ai }] = essays as [(typeof essays)[number]];
      const seedEssay = l.consolidation.find((c) => c.type === 'essay')!;
      if (exercise.type !== 'essay' || seedEssay.type !== 'essay') throw new Error('not an essay');
      expect(exercise.requirements.map((r) => [r.id, r.text, r.modelAnswer, r.argument])).toEqual(
        seedEssay.requirements.map((r) => [r.id, r.text, r.modelAnswer, r.argument]),
      );
      expect(exercise.requirements.map((r) => r.templateId && templateKey.get(r.templateId))).toEqual(seedEssay.requirements.map((r) => r.template));
      expect(ai).toEqual({ main: '', requirements: seedEssay.ai!.requirements });
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
