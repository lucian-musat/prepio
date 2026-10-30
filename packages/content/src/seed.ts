import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { aiDefaults, lessons, tree, welcomeMessage } from './index';
import type { SeedNode } from './types';

const IMAGES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../images');
const BUCKET = 'images';

export type SeedOptions = { adminEmail?: string; adminPassword?: string };

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

type NodeRow = { id: string; parent_id: string | null; title: string; position: number };

function flattenTree(nodes: SeedNode[], parentId: string | null, ids: Map<string, string>, out: NodeRow[]): void {
  nodes.forEach((n, position) => {
    const id = randomUUID();
    ids.set(n.key, id);
    out.push({ id, parent_id: parentId, title: n.title, position });
    flattenTree(n.children ?? [], id, ids, out);
  });
}

function contentType(file: string): string {
  const ext = file.slice(file.lastIndexOf('.') + 1).toLowerCase();
  return ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
}

async function uploadImages(client: SupabaseClient): Promise<void> {
  const files = new Set(lessons.flatMap((l) => l.cards.map((c) => c.image).filter((f): f is string => !!f)));
  for (const file of files) {
    const body = await readFile(resolve(IMAGES_DIR, file));
    const { error } = await client.storage
      .from(BUCKET)
      .upload(`seed/${file}`, body, { upsert: true, contentType: contentType(file) });
    if (error) throw new Error(`upload ${file}: ${error.message}`);
  }
}

async function ensureAdmin(client: SupabaseClient, email: string, password: string): Promise<void> {
  const { data, error } = await client.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`list users: ${error.message}`);
  if (data.users.some((u) => u.email?.toLowerCase() === email.toLowerCase())) return;
  const created = await client.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw new Error(`create admin: ${created.error.message}`);
}

/** Replaces the content tree and lessons with the content package. Idempotent; keeps owner-edited settings. */
export async function seed(client: SupabaseClient, opts: SeedOptions = {}): Promise<{ nodes: number; lessons: number }> {
  await uploadImages(client);

  // Cascades to lessons, cards, questions and writing_exercises.
  check(await client.from('nodes').delete().not('id', 'is', null), 'clear nodes');

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
          lesson.cards.map((c, i) => ({
            lesson_id: lessonId,
            position: i,
            title: c.title,
            body: c.body,
            image_path: c.image ? `seed/${c.image}` : null,
            image_credit: c.imageCredit,
          })),
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
    if (lesson.exercises.length) {
      check(
        await client.from('writing_exercises').insert(
          lesson.exercises.map((e, i) => ({ lesson_id: lessonId, position: i, prompt: e.prompt, criteria: e.criteria })),
        ),
        `insert exercises ${lesson.key}`,
      );
    }
  }

  // Only create when missing: never overwrite the owner's edits.
  check(
    await client.from('settings').upsert({ id: 1, welcome_message: welcomeMessage }, { onConflict: 'id', ignoreDuplicates: true }),
    'settings',
  );
  check(
    await client.from('ai_settings').upsert(
      { id: 1, rules: aiDefaults.rules, grade_min: aiDefaults.gradeMin, grade_max: aiDefaults.gradeMax, model: aiDefaults.model },
      { onConflict: 'id', ignoreDuplicates: true },
    ),
    'ai_settings',
  );

  if (opts.adminEmail && opts.adminPassword) await ensureAdmin(client, opts.adminEmail, opts.adminPassword);

  return { nodes: nodeRows.length, lessons: lessons.length };
}

async function main(): Promise<void> {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  config({ path: [resolve(root, '.env.local'), resolve(root, '.env')], quiet: true });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example)');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const result = await seed(client, { adminEmail: process.env.ADMIN_EMAIL, adminPassword: process.env.ADMIN_PASSWORD });
  console.log(`Seeded ${result.nodes} nodes and ${result.lessons} lessons.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
