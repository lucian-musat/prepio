import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { aiDefaults } from './index';
import { check } from './seed';

export type SettingChange = { name: 'ai_rules'; current: string; next: string; changed: boolean };
export type AiSettingsResult = { applied: boolean; changes: SettingChange[]; updated: number };

/**
 * Replaces the AI rules (`ai_settings`) with the current defaults, which no longer mention grades. The welcome
 * message is a UI text now (`home.hero.welcome`, edited in the admin). The model and the unused grade columns
 * are left alone. Without `apply`, only plans.
 */
export async function updateAiSettings(client: SupabaseClient, opts: { apply: boolean }): Promise<AiSettingsResult> {
  const ai = check(
    await client.from('ai_settings').select('rules').eq('id', 1).maybeSingle(),
    'read ai_settings',
  ) as { rules: string } | null;
  if (!ai) throw new Error('ai_settings row 1 is missing (run the seed first)');

  const changes: SettingChange[] = [
    { name: 'ai_rules', current: ai.rules, next: aiDefaults.rules, changed: ai.rules !== aiDefaults.rules },
  ];
  const result: AiSettingsResult = { applied: opts.apply, changes, updated: 0 };
  if (!opts.apply) return result;

  if (changes[0]!.changed) {
    check(
      await client.from('ai_settings').update({ rules: aiDefaults.rules }).eq('id', 1).select('id'),
      'update ai_settings',
    );
    result.updated++;
  }
  return result;
}

const indent = (s: string): string =>
  s
    .split('\n')
    .map((l) => `    ${l}`)
    .join('\n');

export function formatAiSettings(r: AiSettingsResult): string {
  const out = [r.applied ? 'Updating AI settings:' : 'Dry run (nothing is changed; pass --apply to write):'];
  for (const c of r.changes) {
    const state = c.changed ? (r.applied ? 'updated' : 'to update') : 'already current (nothing to do)';
    out.push('', `${c.name}: ${state}`);
    if (c.changed) out.push('  current:', indent(c.current), '  new:', indent(c.next));
  }
  const pending = r.changes.filter((c) => c.changed).length;
  out.push('', r.applied ? `Done: ${r.updated} setting(s) updated.` : `Plan: ${pending} setting(s) to update.`);
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
  console.log(formatAiSettings(await updateAiSettings(client, { apply: process.argv.includes('--apply') })));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
