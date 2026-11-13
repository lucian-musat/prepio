import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check } from './seed';

/** Leftover cards added by hand while testing the admin, by the exact title of their lesson and of the card. */
export const TEST_CARDS = [{ lesson: 'Constituția din 1866 și monarhia constituțională', title: 'card test' }] as const;

type TestCard = { lesson: string; title: string };
export type CardRemovalPlan =
  | (TestCard & { status: 'not_found' | 'ambiguous'; matches: number })
  | (TestCard & { status: 'ok'; id: string; type: string; position: number });
export type CardRemovalResult = { applied: boolean; cards: CardRemovalPlan[]; removed: number; problems: number };

/**
 * Deletes each card whose lesson title and card title match one of `cards` exactly. A lesson or card title that
 * matches zero or several rows is reported and left alone. Without `apply`, only plans.
 */
export async function removeTestCards(
  client: SupabaseClient,
  opts: { apply: boolean; cards?: readonly TestCard[] },
): Promise<CardRemovalResult> {
  const result: CardRemovalResult = { applied: opts.apply, cards: [], removed: 0, problems: 0 };
  for (const { lesson, title } of opts.cards ?? TEST_CARDS) {
    const rows = check(
      await client.from('cards').select('id, type, position, lessons!inner(title)').eq('lessons.title', lesson).eq('title', title),
      `find card ${title}`,
    ) as { id: string; type: string; position: number }[];
    if (rows.length !== 1) {
      result.cards.push({ lesson, title, status: rows.length ? 'ambiguous' : 'not_found', matches: rows.length });
      if (rows.length) result.problems++;
      continue;
    }
    const [row] = rows as [{ id: string; type: string; position: number }];
    result.cards.push({ lesson, title, status: 'ok', id: row.id, type: row.type, position: row.position });
    if (!opts.apply) continue;
    check(await client.from('cards').delete().eq('id', row.id).select('id'), `delete card ${title}`);
    result.removed++;
  }
  return result;
}

export function formatCardRemoval(r: CardRemovalResult): string {
  const out = [r.applied ? 'Removing test cards:' : 'Dry run (nothing is changed; pass --apply to delete):'];
  for (const c of r.cards) {
    out.push('', `Card „${c.title}” in „${c.lesson}”`);
    if (c.status !== 'ok') {
      out.push(c.status === 'not_found' ? '  not found (nothing to do)' : `  SKIPPED: ${c.matches} cards with this title`);
    } else {
      out.push(`  id ${c.id}, ${c.type}, position ${c.position}`, `  ${r.applied ? 'deleted' : 'to delete'}`);
    }
  }
  const planned = r.cards.filter((c) => c.status === 'ok').length;
  out.push('', r.applied ? `Done: ${r.removed} card(s) deleted, ${r.problems} skipped.` : `Plan: ${planned} card(s) to delete, ${r.problems} skipped.`);
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
  const result = await removeTestCards(client, { apply: process.argv.includes('--apply') });
  console.log(formatCardRemoval(result));
  if (result.problems) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
