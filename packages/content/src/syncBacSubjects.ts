import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BAC_SUBJECTS, writeBacSubjects } from './bacSubjects';
import { ensureTemplates } from './consolidation';
import { DEFAULT_BAC_RULES } from './defaults';
import { check } from './seed';

export type BacSyncResult = { applied: boolean; missing: string[]; rulesEmpty: boolean; inserted: number; rulesWritten: boolean };

/**
 * Adds every seed BAC subject that is missing by title (an existing subject, and its students' attempts, is never
 * touched) and fills „Reguli de notare BAC” with the default only while it is empty. Without `apply`, only plans.
 */
export async function syncBacSubjects(client: SupabaseClient, opts: { apply: boolean }): Promise<BacSyncResult> {
  const existing = check(
    await client.from('bac_subjects').select('title').in('title', BAC_SUBJECTS.map((s) => s.title)),
    'find BAC subjects',
  ) as { title: string }[];
  const missing = BAC_SUBJECTS.filter((s) => !existing.some((e) => e.title === s.title)).map((s) => s.title);
  const ai = check(await client.from('ai_settings').select('bac_rules').eq('id', 1).maybeSingle(), 'read ai_settings') as {
    bac_rules: string;
  } | null;
  if (!ai) throw new Error('ai_settings row 1 is missing (run the seed first)');
  const rulesEmpty = ai.bac_rules.trim() === '';

  const result: BacSyncResult = { applied: opts.apply, missing, rulesEmpty, inserted: 0, rulesWritten: false };
  if (!opts.apply) return result;

  result.inserted = await writeBacSubjects(client, async () => (await ensureTemplates(client, true)).ids, randomUUID);
  if (rulesEmpty) {
    const rows = check(
      await client.from('ai_settings').update({ bac_rules: DEFAULT_BAC_RULES }).eq('id', 1).eq('bac_rules', ai.bac_rules).select('id'),
      'update ai_settings bac_rules',
    ) as { id: number }[];
    result.rulesWritten = rows.length > 0;
  }
  return result;
}

export function formatBacSync(r: BacSyncResult): string {
  const out = [r.applied ? 'Syncing BAC subjects:' : 'Dry run (nothing is changed; pass --apply to write):'];
  out.push(
    r.missing.length
      ? `BAC subjects missing: ${r.missing.map((t) => `„${t}”`).join(', ')}`
      : 'BAC subjects: all present (nothing to do)',
  );
  out.push(r.rulesEmpty ? '„Reguli de notare BAC”: empty → default' : '„Reguli de notare BAC”: already set (left alone)');
  if (r.applied) out.push('', `Done: ${r.inserted} subject(s) inserted, rules ${r.rulesWritten ? 'written' : 'unchanged'}.`);
  else out.push('', `Plan: ${r.missing.length} subject(s) to insert, rules ${r.rulesEmpty ? 'to write' : 'unchanged'}.`);
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
  console.log(formatBacSync(await syncBacSubjects(client, { apply: process.argv.includes('--apply') })));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
