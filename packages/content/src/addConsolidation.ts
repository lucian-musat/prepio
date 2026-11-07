import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONSOLIDATION_TYPE_LABELS } from '@prepio/shared';
import { check, ensureAiTemplates, ensureTemplates, toExercise, writeConsolidation } from './consolidation';
import { lessons } from './index';

export type AddConsolidationResult = {
  applied: boolean;
  /** One line per template, AI template, source and exercise inserted (or, in a dry run, to insert). */
  planned: string[];
  /** Lessons left alone, with the reason. */
  skipped: string[];
  /** Seed lessons that could not be matched to exactly one published lesson. */
  problems: number;
};

type LessonRow = { id: string; consolidation_exercises: { type: string }[]; sources: { id: string }[] };

/**
 * Brings production up to the seed's consolidation content without touching what is there:
 * - for each published lesson whose title is a seed lesson's title, with no consolidation exercise other than an
 *   essay (the essays converted by the migration) and no source, inserts the seed sources and the seed non-essay
 *   exercises (with source links, templates and AI contexts) after the existing ones. A lesson with sources but no
 *   non-essay exercise (a partial run or manual edits) is reported as a problem and left for a check by hand;
 * - inserts the seed solution and AI templates that are missing (matched by title), only when a lesson is written;
 *   each AI exercise is linked to the seed AI template of its type.
 * Idempotent: a re-run plans nothing. A failed lesson write is rolled back (see `writeConsolidation`) and aborts the
 * run. Without `apply`, only plans.
 */
export async function addConsolidation(client: SupabaseClient, opts: { apply: boolean }): Promise<AddConsolidationResult> {
  const result: AddConsolidationResult = { applied: opts.apply, planned: [], skipped: [], problems: 0 };

  const found = await ensureTemplates(client, false);
  const foundAi = await ensureAiTemplates(client, false);
  // Missing templates have no id yet; placeholders let every exercise be converted (and so checked) up front.
  const placeholders = new Map(found.ids);
  for (const t of found.missing) placeholders.set(t.key, `(new) ${t.key}`);
  const aiPlaceholders = new Map(foundAi.ids);
  for (const t of foundAi.missing) aiPlaceholders.set(t.key, `(new) ${t.key}`);

  const toWrite: Array<{ id: string; lesson: (typeof lessons)[number]; items: (typeof lessons)[number]['consolidation'] }> = [];
  const lessonLines: string[] = [];
  for (const lesson of lessons) {
    const rows = check(
      await client
        .from('lessons')
        .select('id, consolidation_exercises(type), sources(id)')
        .eq('title', lesson.title)
        .eq('status', 'published'),
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
    if (row.sources.length) {
      result.skipped.push(
        `${lesson.title}: PROBLEM: has ${row.sources.length} source(s) but no exercise besides essays ` +
          '(partial or manual state — check by hand)',
      );
      result.problems++;
      continue;
    }

    const items = lesson.consolidation.filter((c) => c.type !== 'essay');
    const keys = new Map(lesson.sources.map((s) => [s.key, s.key]));
    const bodies = new Map(lesson.sources.map((s) => [s.key, s.body]));
    for (const c of items) toExercise(c, keys, bodies, placeholders, aiPlaceholders, randomUUID);

    for (const s of lesson.sources) lessonLines.push(`source: ${lesson.title} — ${s.title ?? s.author}`);
    for (const c of items) lessonLines.push(`exercise: ${lesson.title} — ${CONSOLIDATION_TYPE_LABELS[c.type]}: ${c.prompt}`);
    toWrite.push({ id: row.id, lesson, items });
  }

  if (!toWrite.length) {
    if (found.missing.length) result.skipped.push(`${found.missing.length} missing template(s) not added: no lesson to write`);
    if (foundAi.missing.length) result.skipped.push(`${foundAi.missing.length} missing AI template(s) not added: no lesson to write`);
    return result;
  }
  for (const t of found.missing) result.planned.push(`template: ${t.title}`);
  for (const t of foundAi.missing) result.planned.push(`ai template: ${t.title}`);
  result.planned.push(...lessonLines);
  if (!opts.apply) return result;

  const { ids: templateIds } = await ensureTemplates(client, true);
  const { ids: aiTemplateIds } = await ensureAiTemplates(client, true);
  for (const w of toWrite) await writeConsolidation(client, w.id, w.lesson.sources, w.items, templateIds, aiTemplateIds, randomUUID);
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
    `${r.applied ? 'Done' : 'Plan'}: ${count('template')} template(s), ${count('ai template')} AI template(s), ${count('source')} source(s), ` +
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
