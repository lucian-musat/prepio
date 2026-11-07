import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONSOLIDATION_TYPES, validateExercise, type Source } from '@prepio/shared';
import { check, ensureTemplates, toExercise, withPendingTemplates, writeConsolidation } from './consolidation';
import { lessons as seedLessons } from './index';
import { TEMPLATES } from './templates';
import type { SeedLesson } from './types';

/** Sources and exercises of a lesson, counted: `types` maps each exercise type to how many the lesson has. */
export type ConsolidationCounts = { sources: number; exercises: number; types: Record<string, number> };

export type LessonSync =
  | { title: string; status: 'problem'; reason: string }
  | { title: string; status: 'in_sync'; current: ConsolidationCounts }
  | { title: string; status: 'replace'; current: ConsolidationCounts; next: ConsolidationCounts; attempts: number; runs: number };

export type SyncResult = {
  applied: boolean;
  lessons: LessonSync[];
  /** Seed templates missing in the database (matched by title): inserted (or, in a dry run, to insert) when a lesson is written. */
  missingTemplates: string[];
  /** Seed templates whose stored points, body or type differ from the seed: reported, never changed. */
  changedTemplates: string[];
  /** Lessons written. */
  replaced: number;
  /** Seed lessons that could not be matched to exactly one published lesson. */
  problems: number;
};

type ExerciseRow = { id: string; type: string; prompt: string };
type SourceRow = { id: string; title: string | null; body: string };

function counts(sources: number, types: string[]): ConsolidationCounts {
  const byType: Record<string, number> = {};
  // In the BAC order, then any type the code no longer knows.
  for (const t of [...CONSOLIDATION_TYPES, ...types.filter((x) => !CONSOLIDATION_TYPES.includes(x as never))]) {
    const n = types.filter((x) => x === t).length;
    if (n) byType[t] = n;
  }
  return { sources, exercises: types.length, types: byType };
}

/** Converts and validates every seed exercise (with its AI context) against the seed sources; throws listing every error. */
function validateSeed(lessons: SeedLesson[], templateKeys: string[]): void {
  const errors: string[] = [];
  const templates = new Map(templateKeys.map((k) => [k, k]));
  for (const l of lessons) {
    const ids = new Map(l.sources.map((s) => [s.key, s.key]));
    const bodies = new Map(l.sources.map((s) => [s.key, s.body]));
    const sources: Source[] = l.sources.map((s, position) => ({ id: s.key, position, ...s }));
    for (const c of l.consolidation) {
      try {
        const { exercise, ai } = toExercise(c, ids, bodies, templates, randomUUID);
        for (const e of validateExercise(exercise, sources, withPendingTemplates(exercise, ai))) errors.push(`${l.title} — ${c.prompt}: ${e}`);
      } catch (err) {
        errors.push(`${l.title}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  if (errors.length) throw new Error(`Invalid seed exercise(s), nothing written:\n${errors.map((e) => `  ${e}`).join('\n')}`);
}

async function lessonState(client: SupabaseClient, lessonId: string) {
  const exercises = check(
    await client.from('consolidation_exercises').select('id, type, prompt').eq('lesson_id', lessonId).order('position'),
    'list exercises',
  ) as ExerciseRow[];
  const sources = check(
    await client.from('sources').select('id, title, body').eq('lesson_id', lessonId).order('position'),
    'list sources',
  ) as SourceRow[];
  return { exercises, sources };
}

async function countRows(client: SupabaseClient, table: string, column: string, values: string[]): Promise<number> {
  if (!values.length) return 0;
  const { count, error } = await client.from(table).select('*', { count: 'exact', head: true }).in(column, values);
  if (error) throw new Error(`count ${table}: ${error.message}`);
  return count ?? 0;
}

/**
 * Replaces one lesson's consolidation set with the seed's, never leaving it empty or half-written:
 * 1. the seed set is inserted after the current one (`writeConsolidation`; a failed insert removes what it inserted,
 *    so the old set stays as it was);
 * 2. the lesson's consolidation runs are deleted, then the old exercises (their attempts, AI contexts and source
 *    links go by cascade), then the old sources;
 * 3. the new exercises and sources are renumbered from 0.
 * A failure in 2 or 3 leaves the new set in place (possibly next to old rows) and is reported; a re-run replaces it again.
 */
async function replaceLesson(
  client: SupabaseClient,
  lessonId: string,
  lesson: SeedLesson,
  old: { exercises: ExerciseRow[]; sources: SourceRow[] },
  templateIds: Map<string, string>,
): Promise<void> {
  await writeConsolidation(client, lessonId, lesson.sources, lesson.consolidation, templateIds, randomUUID);
  try {
    check(await client.from('consolidation_runs').delete().eq('lesson_id', lessonId), 'delete consolidation runs');
    if (old.exercises.length) {
      check(await client.from('consolidation_exercises').delete().in('id', old.exercises.map((e) => e.id)), 'delete old exercises');
    }
    if (old.sources.length) check(await client.from('sources').delete().in('id', old.sources.map((s) => s.id)), 'delete old sources');
    const now = await lessonState(client, lessonId);
    for (const [table, rows] of [
      ['consolidation_exercises', now.exercises],
      ['sources', now.sources],
    ] as const) {
      for (const [position, row] of rows.entries()) {
        check(await client.from(table).update({ position }).eq('id', row.id), `renumber ${table}`);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `${message} (lesson ${lessonId}: the seed set was written, but the old rows were not fully removed or renumbered: re-run to fix)`,
    );
  }
}

/**
 * Brings the consolidation content of production up to the seed: for each seed lesson matched to exactly one published
 * lesson by title (otherwise reported as a problem and skipped), REPLACES its sources and consolidation exercises with
 * the seed's, deleting the old exercises with their student attempts, and the lesson's consolidation runs. A lesson
 * whose exercises (type and prompt, in order) and sources (title and body, in order) already equal the seed's is left
 * alone, so a re-run after `--apply` plans nothing. Every seed exercise is validated before anything is written (an
 * invalid one aborts the run). Missing seed templates are inserted (only when a lesson is written); existing templates
 * are never changed, those that differ from the seed are only reported. The demo lesson is not handled here
 * (`pnpm content:cloud:demo --apply` refreshes it). Without `apply`, only plans.
 */
export async function syncConsolidation(
  client: SupabaseClient,
  opts: { apply: boolean; lessons?: SeedLesson[] },
): Promise<SyncResult> {
  const lessons = opts.lessons ?? seedLessons;
  validateSeed(lessons, TEMPLATES.map((t) => t.key));
  const result: SyncResult = { applied: opts.apply, lessons: [], missingTemplates: [], changedTemplates: [], replaced: 0, problems: 0 };

  const found = await ensureTemplates(client, false);
  result.missingTemplates = found.missing.map((t) => t.title);
  const stored = check(
    await client.from('solution_templates').select('title, exercise_type, points, body').in('title', TEMPLATES.map((t) => t.title)),
    'read templates',
  ) as { title: string; exercise_type: string | null; points: string; body: string }[];
  for (const t of TEMPLATES) {
    const row = stored.find((r) => r.title === t.title);
    if (row && (row.exercise_type !== t.exerciseType || row.points !== t.points || row.body !== t.body)) result.changedTemplates.push(t.title);
  }

  const toWrite: Array<{ id: string; lesson: SeedLesson; old: Awaited<ReturnType<typeof lessonState>> }> = [];
  for (const lesson of lessons) {
    const rows = check(
      await client.from('lessons').select('id').eq('title', lesson.title).eq('status', 'published'),
      `find lesson ${lesson.title}`,
    ) as { id: string }[];
    if (rows.length !== 1) {
      result.lessons.push({
        title: lesson.title,
        status: 'problem',
        reason: rows.length ? `${rows.length} published lessons with this title` : 'no published lesson with this title',
      });
      result.problems++;
      continue;
    }
    const id = rows[0]!.id;
    const old = await lessonState(client, id);
    const current = counts(old.sources.length, old.exercises.map((e) => e.type));
    const same = <T>(a: T[], b: T[]) => JSON.stringify(a) === JSON.stringify(b);
    if (
      same(old.exercises.map((e) => [e.type, e.prompt]), lesson.consolidation.map((c) => [c.type, c.prompt])) &&
      same(old.sources.map((s) => [s.title, s.body]), lesson.sources.map((s) => [s.title, s.body]))
    ) {
      result.lessons.push({ title: lesson.title, status: 'in_sync', current });
      continue;
    }
    const exerciseIds = old.exercises.map((e) => e.id);
    result.lessons.push({
      title: lesson.title,
      status: 'replace',
      current,
      next: counts(lesson.sources.length, lesson.consolidation.map((c) => c.type)),
      attempts: await countRows(client, 'consolidation_attempts', 'exercise_id', exerciseIds),
      runs: await countRows(client, 'consolidation_runs', 'lesson_id', [id]),
    });
    toWrite.push({ id, lesson, old });
  }

  if (!toWrite.length) result.missingTemplates = [];
  if (!opts.apply || !toWrite.length) return result;

  const { ids: templateIds } = await ensureTemplates(client, true);
  for (const w of toWrite) {
    await replaceLesson(client, w.id, w.lesson, w.old, templateIds);
    result.replaced++;
  }
  return result;
}

const describeCounts = (c: ConsolidationCounts): string =>
  `${c.sources} source(s), ${c.exercises} exercise(s)` +
  (c.exercises ? `: ${Object.entries(c.types).map(([t, n]) => (n > 1 ? `${t} ×${n}` : t)).join(', ')}` : '');

export function formatSync(r: SyncResult): string {
  const out = [r.applied ? 'Replacing consolidation content with the seed:' : 'Dry run (nothing is changed; pass --apply to write):'];
  for (const l of r.lessons) {
    out.push('', `Lesson „${l.title}”`);
    if (l.status === 'problem') out.push(`  PROBLEM: ${l.reason} (skipped)`);
    else if (l.status === 'in_sync') out.push(`  already in sync (${describeCounts(l.current)})`);
    else {
      out.push(
        `  now: ${describeCounts(l.current)}`,
        `  new: ${describeCounts(l.next)}`,
        `  student data ${r.applied ? 'removed' : 'to remove'}: ${l.attempts} attempt(s) on the old exercises, ${l.runs} consolidation run(s)`,
        `  ${r.applied ? 'replaced' : 'to replace'}`,
      );
    }
  }
  if (r.missingTemplates.length) {
    out.push('', `Templates ${r.applied ? 'added' : 'to add'}:`, ...r.missingTemplates.map((t) => `  + ${t}`));
  }
  if (r.changedTemplates.length) {
    out.push('', 'Templates that differ from the seed (left as they are; edit them in the admin if needed):', ...r.changedTemplates.map((t) => `  ~ ${t}`));
  }
  const replace = r.lessons.filter((l) => l.status === 'replace').length;
  const inSync = r.lessons.filter((l) => l.status === 'in_sync').length;
  out.push(
    '',
    r.applied
      ? `Done: ${r.replaced} lesson(s) replaced, ${inSync} already in sync, ${r.problems} problem(s); ${r.missingTemplates.length} template(s) added.`
      : `Plan: ${replace} lesson(s) to replace, ${inSync} already in sync, ${r.problems} problem(s); ${r.missingTemplates.length} template(s) to add.`,
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
  const result = await syncConsolidation(client, { apply: process.argv.includes('--apply') });
  console.log(formatSync(result));
  if (result.problems) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
