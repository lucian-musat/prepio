import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cardImagePaths, cardToRow } from '@prepio/shared';
import { writeBacSubjects } from './bacSubjects';
import { check, ensureAiTemplates, ensureTemplates, writeConsolidation } from './consolidation';
import { DEFAULT_BAC_RULES } from './defaults';
import { aiDefaults, lessons, tree, welcomeMessage } from './index';
import type { SeedCard, SeedNode } from './types';

export { check };

export const IMAGES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../images');
export const BUCKET = 'images';

export type SeedOptions = {
  adminEmail?: string;
  adminPassword?: string;
  /** Replace all content (deletes every node, cascading to owner-authored lessons). */
  reset?: boolean;
};
export type SeedResult = { contentSeeded: true; nodes: number; lessons: number } | { contentSeeded: false };

type NodeRow = { id: string; parent_id: string | null; title: string; position: number };

function flattenTree(nodes: SeedNode[], parentId: string | null, ids: Map<string, string>, out: NodeRow[]): void {
  nodes.forEach((n, position) => {
    const id = randomUUID();
    ids.set(n.key, id);
    out.push({ id, parent_id: parentId, title: n.title, position });
    flattenTree(n.children ?? [], id, ids, out);
  });
}

export function contentType(file: string): string {
  const ext = file.slice(file.lastIndexOf('.') + 1).toLowerCase();
  return ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
}

export const seedPath = (file: string): string => `seed/${file}`;

/** Rewrites the card's image file names to their storage paths (`seed/<file>`). */
export function withStoragePaths(card: SeedCard): SeedCard {
  switch (card.type) {
    case 'images':
      return { ...card, images: card.images.map((i) => ({ ...i, path: seedPath(i.path) })) };
    case 'timeline':
      return { ...card, points: card.points.map((p) => ({ ...p, imagePath: p.imagePath && seedPath(p.imagePath) })) };
    case 'link':
      return card.image?.kind === 'path' ? { ...card, image: { kind: 'path', path: seedPath(card.image.path) } } : card;
    default:
      return card;
  }
}

async function uploadImages(client: SupabaseClient): Promise<void> {
  const files = new Set(lessons.flatMap((l) => l.cards.flatMap((c) => cardImagePaths(c))));
  for (const file of files) {
    const body = await readFile(resolve(IMAGES_DIR, file));
    const { error } = await client.storage
      .from(BUCKET)
      .upload(seedPath(file), body, { upsert: true, contentType: contentType(file) });
    if (error) throw new Error(`upload ${file}: ${error.message}`);
  }
}

async function ensureAdmin(client: SupabaseClient, email: string, password: string): Promise<void> {
  const { data, error } = await client.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`list users: ${error.message}`);
  let id = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
  if (!id) {
    const created = await client.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error) throw new Error(`create admin: ${created.error.message}`);
    id = created.data.user.id;
  }
  // Only users listed in `admins` get write access (RLS via is_admin()).
  check(await client.from('admins').upsert({ user_id: id }, { onConflict: 'user_id', ignoreDuplicates: true }), 'admins');
}

/**
 * Loads the content package. Non-destructive by default: when any lesson already exists the content is left
 * untouched unless `reset` is set (then the whole tree is replaced; idempotent). Always uploads the seed images,
 * inserts missing settings rows (never overwrites the owner's edits) and ensures the admin user.
 */
export async function seed(client: SupabaseClient, opts: SeedOptions = {}): Promise<SeedResult> {
  await uploadImages(client);

  const existing = await client.from('lessons').select('id', { count: 'exact', head: true });
  if (existing.error) throw new Error(`count lessons: ${existing.error.message}`);
  const result: SeedResult =
    opts.reset || !existing.count ? { contentSeeded: true, ...(await replaceContent(client)) } : { contentSeeded: false };

  // Only create when missing: never overwrite the owner's edits.
  check(
    await client.from('settings').upsert({ id: 1, welcome_message: welcomeMessage }, { onConflict: 'id', ignoreDuplicates: true }),
    'settings',
  );
  check(
    await client.from('ai_settings').upsert(
      { id: 1, rules: aiDefaults.rules, model: aiDefaults.model },
      { onConflict: 'id', ignoreDuplicates: true },
    ),
    'ai_settings',
  );
  check(await client.from('ai_settings').update({ bac_rules: DEFAULT_BAC_RULES }).eq('id', 1).eq('bac_rules', ''), 'ai_settings bac_rules');

  if (opts.adminEmail && opts.adminPassword) await ensureAdmin(client, opts.adminEmail, opts.adminPassword);

  return result;
}

async function replaceContent(client: SupabaseClient): Promise<{ nodes: number; lessons: number }> {
  // Cascades to lessons, cards, questions, sources and consolidation exercises.
  check(await client.from('nodes').delete().not('id', 'is', null), 'clear nodes');
  // Templates (solution and AI) are libraries shared by all lessons: the missing ones are added, existing ones (by title) are kept.
  const { ids: templateIds } = await ensureTemplates(client, true);
  const { ids: aiTemplateIds } = await ensureAiTemplates(client, true);

  const ids = new Map<string, string>();
  const nodeRows: NodeRow[] = [];
  flattenTree(tree, null, ids, nodeRows);
  check(await client.from('nodes').insert(nodeRows), 'insert nodes');

  const perNode = new Map<string, number>();
  for (const lesson of lessons) {
    const nodeId = ids.get(lesson.nodeKey);
    if (!nodeId) throw new Error(`lesson ${lesson.key}: unknown node ${lesson.nodeKey}`);
    const position = perNode.get(nodeId) ?? 0;
    perNode.set(nodeId, position + 1);

    const lessonId = randomUUID();
    check(
      await client.from('lessons').insert({ id: lessonId, node_id: nodeId, title: lesson.title, position, status: lesson.status }),
      `insert lesson ${lesson.key}`,
    );
    if (lesson.cards.length) {
      check(
        await client.from('cards').insert(
          lesson.cards.map((c, i) => ({ lesson_id: lessonId, position: i, ...cardToRow(withStoragePaths(c)) })),
        ),
        `insert cards ${lesson.key}`,
      );
    }
    if (lesson.questions.length) {
      check(
        await client.from('questions').insert(
          lesson.questions.map((q, i) => ({
            lesson_id: lessonId,
            position: i,
            type: q.type,
            prompt: q.prompt,
            difficulty: q.difficulty,
            explanation: q.explanation,
            options: q.options,
          })),
        ),
        `insert questions ${lesson.key}`,
      );
    }
    await writeConsolidation(client, lessonId, lesson.sources, lesson.consolidation, templateIds, aiTemplateIds, randomUUID);
  }
  // BAC subjects are not lesson content: a reset keeps them (they may have students' attempts); missing ones are added by title.
  await writeBacSubjects(client, templateIds, randomUUID);

  return { nodes: nodeRows.length, lessons: lessons.length };
}

async function main(): Promise<void> {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  config({ path: [resolve(root, '.env.local'), resolve(root, '.env')], quiet: true });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example)');
  const reset = process.env.SEED_RESET === '1' || process.argv.includes('--reset');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const result = await seed(client, {
    adminEmail: process.env.ADMIN_EMAIL,
    adminPassword: process.env.ADMIN_PASSWORD,
    reset,
  });
  if (result.contentSeeded) {
    console.log(`Seeded ${result.nodes} nodes and ${result.lessons} lessons${reset ? ' (reset)' : ''}.`);
  } else {
    console.log(
      'Lessons already exist: content left untouched (images, settings and admin user ensured). ' +
        'Run with SEED_RESET=1 (or --reset) to replace ALL content, including lessons written in the admin.',
    );
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
