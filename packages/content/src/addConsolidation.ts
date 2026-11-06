import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONSOLIDATION_TYPE_LABELS } from '@prepio/shared';
import { check, ensureTemplates, toExercise, writeConsolidation } from './consolidation';
import { lessons } from './index';

export type AddConsolidationResult = {
  applied: boolean;
  /** One line per template, source and exercise inserted (or, in a dry run, to insert). */
  planned: string[];
  /** Lessons left alone, with the reason. */
  skipped: string[];
  /** Seed lessons that could not be matched to exactly one published lesson. */
  problems: number;
};

type LessonRow = { id: string; consolidation_exercises: { type: string }[] };

/**
 * Brings production up to the seed's consolidation content without touching what is there:
 * - inserts the seed solution templates that are missing (matched by title);
 * - for each published lesson whose title is a seed lesson's title and which has no consolidation exercise other than
 *   an essay (the essays converted by the migration), inserts the seed sources and the seed non-essay exercises
 *   (with source links, templates and AI contexts) after the existing ones.
 * Idempotent: a re-run plans nothing. Without `apply`, only plans.
 */
export async function addConsolidation(client: SupabaseClient, opts: { apply: boolean }): Promise<AddConsolidationResult> {
  const result: AddConsolidationResult = { applied: opts.apply, planned: [], skipped: [], problems: 0 };

  const { ids: templateIds, missing } = await ensureTemplates(client, opts.apply);
  for (const t of missing) result.planned.push(`template: ${t.title}`);
  // A dry run has no ids for the missing templates yet; placeholders let it convert (and so check) every exercise.
  for (const t of missing) if (!templateIds.has(t.key)) templateIds.set(t.key, `(new) ${t.key}`);

  for (const lesson of lessons) {
    const rows = check(
      await client.from('lessons').select('id, consolidation_exercises(type)').eq('title', lesson.title).eq('status', 'published'),
      `find lesson ${lesson.title}`,
    ) as LessonRow[];
    if (rows.length !== 1) {
      result.skipped.push(`${lesson.title}: ${rows.length ? `${rows.length} published lessons with this title` : 'no published lesson with this title'}`);
      result.problems++;
      continue;
    }
    const [row] = rows as [LessonRow];
    if (row.consolidation_exercises.some((e) => e.type !== 'essay')) {
      result.skipped.push(`${lesson.title}: already has consolidation exercises (nothing to add)`);
      continue;
    }

    const items = lesson.consolidation.filter((c) => c.type !== 'essay');
    // Convert first: a broken quote or key fails before anything is written.
    const keys = new Map(lesson.sources.map((s) => [s.key, s.key]));
    const bodies = new Map(lesson.sources.map((s) => [s.key, s.body]));
    for (const c of items) toExercise(c, keys, bodies, templateIds, randomUUID);

    for (const s of lesson.sources) result.planned.push(`source: ${lesson.title} — ${s.title ?? s.author}`);
    for (const c of items) result.planned.push(`exercise: ${lesson.title} — ${CONSOLIDATION_TYPE_LABELS[c.type]}: ${c.prompt}`);
    if (opts.apply) await writeConsolidation(client, row.id, lesson.sources, items, templateIds, randomUUID);
  }
  return result;
}

export function formatConsolidation(r: AddConsolidationResult): string {
  const verb = r.applied ? 'added' : 'to add';
  const out = [r.applied ? 'Adding consolidation content:' : 'Dry run (nothing is changed; pass --apply to write):', ''];
  for (const p of r.planned) out.push(`  + ${verb}: ${p}`);
  if (!r.planned.length) out.push('  nothing to add');
  for (const s of r.skipped) out.push(`  = skipped: ${s}`);
  const count = (prefix: string) => r.planned.filter((p) => p.startsWith(prefix)).length;
  out.push(
    '',
    `${r.applied ? 'Done' : 'Plan'}: ${count('template')} template(s), ${count('source')} source(s), ` +
      `${count('exercise')} exercise(s) ${verb}; ${r.problems} lesson(s) not found.`,
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
  const result = await addConsolidation(client, { apply: process.argv.includes('--apply') });
  console.log(formatConsolidation(result));
  if (result.problems) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
