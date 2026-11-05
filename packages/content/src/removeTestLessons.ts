import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUCKET, check } from './seed';

/** Leftover lessons created by hand while testing the admin; guided mode would put them ahead of the real ones. */
export const TEST_LESSON_TITLES = ['test', 'test 2'] as const;

export type RemovalPlan =
  | { title: string; status: 'not_found' | 'ambiguous'; matches: number }
  | { title: string; status: 'ok'; id: string; lessonStatus: string; cards: number; questions: number; exercises: number; images: string[] };
export type RemovalResult = { applied: boolean; lessons: RemovalPlan[]; removed: number; problems: number };

type LessonRow = {
  id: string;
  status: string;
  cards: { count: number }[];
  questions: { count: number }[];
  consolidation_exercises: { count: number }[];
};

async function lessonImages(client: SupabaseClient, id: string): Promise<string[]> {
  const { data, error } = await client.storage.from(BUCKET).list(`lessons/${id}`, { limit: 1000 });
  if (error) throw new Error(`list ${BUCKET}/lessons/${id}: ${error.message}`);
  return data.map((f) => `lessons/${id}/${f.name}`);
}

/**
 * Deletes the lessons whose title is exactly one of `titles` (cards, questions, exercises and progress go with
 * them by cascade) and their uploaded images. A title matching zero or several lessons is reported and left
 * alone. Without `apply`, only plans.
 */
export async function removeTestLessons(
  client: SupabaseClient,
  opts: { apply: boolean; titles?: readonly string[] },
): Promise<RemovalResult> {
  const result: RemovalResult = { applied: opts.apply, lessons: [], removed: 0, problems: 0 };
  for (const title of opts.titles ?? TEST_LESSON_TITLES) {
    const rows = check(
      await client
        .from('lessons')
        .select('id, status, cards(count), questions(count), consolidation_exercises(count)')
        .eq('title', title),
      `find lesson ${title}`,
    ) as LessonRow[];
    if (rows.length !== 1) {
      result.lessons.push({ title, status: rows.length ? 'ambiguous' : 'not_found', matches: rows.length });
      if (rows.length) result.problems++;
      continue;
    }
    const [row] = rows as [LessonRow];
    const images = await lessonImages(client, row.id);
    result.lessons.push({
      title,
      status: 'ok',
      id: row.id,
      lessonStatus: row.status,
      cards: row.cards[0]?.count ?? 0,
      questions: row.questions[0]?.count ?? 0,
      exercises: row.consolidation_exercises[0]?.count ?? 0,
      images,
    });
    if (!opts.apply) continue;

    check(await client.from('lessons').delete().eq('id', row.id).select('id'), `delete lesson ${title}`);
    if (images.length) {
      const { error } = await client.storage.from(BUCKET).remove(images);
      if (error) throw new Error(`remove images of ${title}: ${error.message}`);
    }
    result.removed++;
  }
  return result;
}

export function formatRemoval(r: RemovalResult): string {
  const out = [r.applied ? 'Removing test lessons:' : 'Dry run (nothing is changed; pass --apply to delete):'];
  for (const l of r.lessons) {
    out.push('', `Lesson „${l.title}”`);
    if (l.status !== 'ok') {
      out.push(l.status === 'not_found' ? '  not found (nothing to do)' : `  SKIPPED: ${l.matches} lessons with this title`);
    } else {
      out.push(
        `  id ${l.id}, ${l.lessonStatus}, ${l.cards} card(s), ${l.questions} question(s), ${l.exercises} exercise(s), ` +
          `${l.images.length} image(s)`,
        `  ${r.applied ? 'deleted' : 'to delete'}`,
      );
    }
  }
  out.push('', r.applied ? `Done: ${r.removed} lesson(s) deleted, ${r.problems} skipped.` : `Plan: ${r.lessons.filter((l) => l.status === 'ok').length} lesson(s) to delete, ${r.problems} skipped.`);
  return out.join('\n');
}

async function main(): Promise<void> {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  // Local runs read the repo .env files; values already in the environment (the cloud wrapper) take precedence.
  config({ path: [resolve(root, '.env.local'), resolve(root, '.env')], quiet: true });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example)');
  const unknown = process.argv.slice(2).filter((a) => a !== '--apply');
  if (unknown.length) throw new Error(`Unknown argument(s): ${unknown.join(' ')} (only --apply is supported)`);

  console.log(`Target: ${new URL(url).host}`);
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const result = await removeTestLessons(client, { apply: process.argv.includes('--apply') });
  console.log(formatRemoval(result));
  if (result.problems) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
