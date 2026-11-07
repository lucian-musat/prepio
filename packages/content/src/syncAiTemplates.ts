import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { aiTemplateTypeFor, type AiTemplateType, type ConsolidationType } from '@prepio/shared';
import { AI_TEMPLATES } from './aiTemplates';
import { check, ensureAiTemplates } from './consolidation';
import { lessons as seedLessons } from './index';
import type { SeedAiContext, SeedLesson } from './types';

export type AiTemplatesSyncResult = {
  applied: boolean;
  /** Seed AI templates missing in the database (matched by title): inserted (or, in a dry run, to insert). */
  templatesToAdd: string[];
  /** Seed exercises whose stored AI context differs from the seed's (facts only): replaced (or, in a dry run, to replace). */
  contextsToReplace: Array<{ lesson: string; prompt: string }>;
  /** Missing AI template links: `requirementId` is '' for the exercise-level link. */
  linksToAdd: Array<{ lesson: string; prompt: string; requirementId: string; templateTitle: string }>;
  /** Things that could not be matched; the affected item is skipped. */
  problems: string[];
};

type Ctx = { context: Partial<SeedAiContext> | null };
type Row = {
  id: string;
  lesson_id: string;
  type: ConsolidationType;
  prompt: string;
  content: { requirements?: Array<{ id?: string }> } | null;
  consolidation_ai_context: Ctx | Ctx[] | null;
  consolidation_ai_template_links: { requirement_id: string }[];
};

/** The context in a comparable form, so equal contexts compare equal whatever the key order or missing keys. */
const normalize = (c: Partial<SeedAiContext> | null | undefined, ids: string[]): string =>
  JSON.stringify({ main: c?.main ?? '', requirements: ids.map((id) => [id, c?.requirements?.[id] ?? '']) });

/**
 * Brings production up to the AI templates release, for the exercises that exist (never adds or removes exercises):
 * 1. inserts the seed AI templates that are missing (by title);
 * 2. for each seed lesson matched to exactly one published lesson by title, each seed AI exercise matched by type and
 *    prompt gets its AI context replaced with the seed's (`main` and per-requirement facts) when it differs; an essay
 *    whose requirement ids differ from the seed's is a problem and skipped;
 * 3. every AI exercise of any lesson without a link gets the seed template of its type (exercise-level, or one per
 *    current essay requirement). An existing link is never changed.
 * Without `apply`, only plans; a re-run after `apply` plans nothing.
 */
export async function syncAiTemplates(
  client: SupabaseClient,
  opts: { apply: boolean; lessons?: SeedLesson[] },
): Promise<AiTemplatesSyncResult> {
  const seeds = opts.lessons ?? seedLessons;
  const result: AiTemplatesSyncResult = { applied: opts.apply, templatesToAdd: [], contextsToReplace: [], linksToAdd: [], problems: [] };
  const found = await ensureAiTemplates(client, false);
  result.templatesToAdd = found.missing.map((t) => t.title);
  const titleOf = (type: AiTemplateType): string => AI_TEMPLATES.find((t) => t.key === type)!.title;

  const lessonRows = check(await client.from('lessons').select('id, title, status'), 'list lessons') as { id: string; title: string; status: string }[];
  const titles = new Map(lessonRows.map((l) => [l.id, l.title]));
  const exercises = check(
    await client
      .from('consolidation_exercises')
      .select('id, lesson_id, type, prompt, content, consolidation_ai_context(context), consolidation_ai_template_links(requirement_id)')
      .order('position'),
    'list exercises',
  ) as unknown as Row[];
  const requirementIds = (r: Row): string[] => (r.content?.requirements ?? []).map((q) => String(q.id ?? ''));

  // Step 2: contexts of the seed exercises.
  const contexts: Array<{ exercise_id: string; context: SeedAiContext }> = [];
  for (const lesson of seeds) {
    const matches = lessonRows.filter((l) => l.title === lesson.title && l.status === 'published');
    if (matches.length !== 1) {
      result.problems.push(
        `Lesson „${lesson.title}”: ${matches.length ? `${matches.length} published lessons with this title` : 'no published lesson with this title'} (contexts skipped)`,
      );
      continue;
    }
    const stored = exercises.filter((e) => e.lesson_id === matches[0]!.id);
    for (const c of lesson.consolidation) {
      if (!c.ai) continue;
      const hits = stored.filter((e) => e.type === c.type && e.prompt === c.prompt);
      if (hits.length !== 1) {
        result.problems.push(
          `Lesson „${lesson.title}”, exercise „${c.prompt}”: ${hits.length ? `${hits.length} exercises` : 'no exercise'} with this type and prompt (context skipped)`,
        );
        continue;
      }
      const row = hits[0]!;
      const ids = c.type === 'essay' ? c.requirements.map((r) => r.id) : [];
      if (c.type === 'essay' && JSON.stringify([...requirementIds(row)].sort()) !== JSON.stringify([...ids].sort())) {
        result.problems.push(`Lesson „${lesson.title}”, exercise „${c.prompt}”: requirement ids differ from the seed's (context skipped)`);
        continue;
      }
      const ctx = Array.isArray(row.consolidation_ai_context) ? row.consolidation_ai_context[0] : row.consolidation_ai_context;
      if (normalize(ctx?.context, ids) !== normalize(c.ai, ids)) {
        result.contextsToReplace.push({ lesson: lesson.title, prompt: c.prompt });
        contexts.push({ exercise_id: row.id, context: { main: c.ai.main, requirements: c.ai.requirements } });
      }
    }
  }

  // Step 3: missing links, for the AI exercises of every lesson.
  const links: Array<{ exercise_id: string; requirement_id: string; type: AiTemplateType }> = [];
  for (const e of exercises) {
    const type = aiTemplateTypeFor(e.type);
    if (!type) continue;
    const have = new Set(e.consolidation_ai_template_links.map((l) => l.requirement_id));
    const wanted = e.type === 'essay' ? requirementIds(e) : [''];
    for (const requirementId of wanted) {
      if (have.has(requirementId)) continue;
      links.push({ exercise_id: e.id, requirement_id: requirementId, type });
      result.linksToAdd.push({ lesson: titles.get(e.lesson_id) ?? e.lesson_id, prompt: e.prompt, requirementId, templateTitle: titleOf(type) });
    }
  }

  if (!opts.apply) return result;

  const { ids } = await ensureAiTemplates(client, true);
  if (contexts.length) {
    check(await client.from('consolidation_ai_context').upsert(contexts, { onConflict: 'exercise_id' }), 'replace exercise contexts');
  }
  if (links.length) {
    check(
      await client
        .from('consolidation_ai_template_links')
        .insert(links.map((l) => ({ exercise_id: l.exercise_id, requirement_id: l.requirement_id, template_id: ids.get(l.type)! }))),
      'insert AI template links',
    );
  }
  return result;
}

export function formatAiTemplatesSync(r: AiTemplatesSyncResult): string {
  const out = [r.applied ? 'Rolling out AI templates:' : 'Dry run (nothing is changed; pass --apply to write):'];
  if (r.templatesToAdd.length) out.push('', `AI templates ${r.applied ? 'added' : 'to add'}:`, ...r.templatesToAdd.map((t) => `  + ${t}`));
  if (r.contextsToReplace.length) {
    out.push('', `AI contexts ${r.applied ? 'replaced' : 'to replace'} with the seed's facts:`, ...r.contextsToReplace.map((c) => `  ~ ${c.lesson} — ${c.prompt}`));
  }
  if (r.linksToAdd.length) {
    out.push(
      '',
      `AI template links ${r.applied ? 'added' : 'to add'}:`,
      ...r.linksToAdd.map((l) => `  + ${l.lesson} — ${l.prompt}${l.requirementId ? ` [requirement ${l.requirementId}]` : ''} → ${l.templateTitle}`),
    );
  }
  if (r.problems.length) out.push('', 'Problems (skipped):', ...r.problems.map((p) => `  PROBLEM: ${p}`));
  out.push(
    '',
    `${r.applied ? 'Done' : 'Plan'}: ${r.templatesToAdd.length} template(s), ${r.contextsToReplace.length} context(s), ${r.linksToAdd.length} link(s) ${r.applied ? 'written' : 'to write'}; ${r.problems.length} problem(s).`,
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
  const result = await syncAiTemplates(client, { apply: process.argv.includes('--apply') });
  console.log(formatAiTemplatesSync(result));
  if (result.problems.length) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
