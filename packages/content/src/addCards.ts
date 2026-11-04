import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cardImagePaths, cardToRow } from '@prepio/shared';
import { EXTRA_CARDS } from './extraCards';
import { lessons } from './index';
import { BUCKET, IMAGES_DIR, check, contentType, seedPath, withStoragePaths } from './seed';
import type { SeedCard } from './types';

export type LessonPlan =
  | { key: string; title: string; status: 'not_found' | 'ambiguous'; matches: number }
  | { key: string; title: string; status: 'ok'; add: string[]; skip: string[]; upload: string[] };
export type AddCardsResult = { applied: boolean; lessons: LessonPlan[]; added: number; uploaded: number; problems: number };

type ExistingCard = { type: string; title: string | null; position: number };

const label = (c: SeedCard): string => `${c.type}: ${c.title ?? '(fără titlu)'}`;

async function storedFiles(client: SupabaseClient): Promise<Set<string>> {
  const names = new Set<string>();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.storage.from(BUCKET).list('seed', { limit: 1000, offset });
    if (error) throw new Error(`list ${BUCKET}/seed: ${error.message}`);
    data.forEach((f) => names.add(f.name));
    if (data.length < 1000) return names;
  }
}

/**
 * Adds the cards from `EXTRA_CARDS` to already seeded lessons, found by their exact seed title. A card is
 * skipped when its lesson already has a card with the same type and title, so the run is idempotent.
 * Missing images are uploaded under `seed/` (existing files are never overwritten). Without `apply`, only plans.
 */
export async function addCards(client: SupabaseClient, opts: { apply: boolean }): Promise<AddCardsResult> {
  const result: AddCardsResult = { applied: opts.apply, lessons: [], added: 0, uploaded: 0, problems: 0 };
  const stored = await storedFiles(client);

  for (const [key, extras] of Object.entries(EXTRA_CARDS)) {
    const source = lessons.find((l) => l.key === key);
    if (!source) throw new Error(`EXTRA_CARDS: unknown lesson key ${key}`);

    const rows = check(
      await client.from('lessons').select('id, cards(type, title, position)').eq('title', source.title),
      `find lesson ${source.title}`,
    ) as Array<{ id: string; cards: ExistingCard[] }>;
    if (rows.length !== 1) {
      result.lessons.push({ key, title: source.title, status: rows.length ? 'ambiguous' : 'not_found', matches: rows.length });
      result.problems++;
      continue;
    }
    const [lesson] = rows as [{ id: string; cards: ExistingCard[] }];

    const has = (c: SeedCard) => lesson.cards.some((e) => e.type === c.type && e.title === c.title);
    const toAdd = extras.filter((c) => !has(c));
    const upload = [...new Set(toAdd.flatMap((c) => cardImagePaths(c)))].filter((f) => !stored.has(f));
    result.lessons.push({
      key,
      title: source.title,
      status: 'ok',
      add: toAdd.map(label),
      skip: extras.filter(has).map(label),
      upload,
    });
    if (!opts.apply || toAdd.length === 0) continue;

    for (const file of upload) {
      const body = await readFile(resolve(IMAGES_DIR, file));
      const { error } = await client.storage
        .from(BUCKET)
        .upload(seedPath(file), body, { upsert: false, contentType: contentType(file) });
      if (error) throw new Error(`upload ${file}: ${error.message}`);
      stored.add(file);
      result.uploaded++;
    }

    const start = Math.max(-1, ...lesson.cards.map((c) => c.position)) + 1;
    check(
      await client
        .from('cards')
        .insert(toAdd.map((c, i) => ({ lesson_id: lesson.id, position: start + i, ...cardToRow(withStoragePaths(c)) }))),
      `insert cards into ${source.title}`,
    );
    result.added += toAdd.length;
  }
  return result;
}

export function formatResult(r: AddCardsResult): string {
  const out = [r.applied ? 'Applying extra cards:' : 'Dry run (nothing is changed; pass --apply to write):'];
  for (const l of r.lessons) {
    out.push('', `Lesson „${l.title}”`);
    if (l.status !== 'ok') {
      out.push(`  SKIPPED: ${l.status === 'not_found' ? 'no lesson with this title' : `${l.matches} lessons with this title`}`);
      continue;
    }
    const verb = r.applied ? 'added' : 'to add';
    for (const t of l.add) out.push(`  + ${verb}: ${t}`);
    for (const t of l.skip) out.push(`  = already present: ${t}`);
    for (const f of l.upload) out.push(`  ^ image ${r.applied ? 'uploaded' : 'to upload'}: seed/${f}`);
    if (!l.add.length) out.push('  nothing to add');
  }
  out.push(
    '',
    r.applied
      ? `Done: ${r.added} card(s) added, ${r.uploaded} image(s) uploaded, ${r.problems} lesson(s) skipped.`
      : `Plan: ${r.lessons.reduce((n, l) => n + (l.status === 'ok' ? l.add.length : 0), 0)} card(s) to add, ` +
          `${r.problems} lesson(s) skipped.`,
  );
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
  const result = await addCards(client, { apply: process.argv.includes('--apply') });
  console.log(formatResult(result));
  if (result.problems) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
