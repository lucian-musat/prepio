import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { UserError } from './db';
import { getSettings, saveSettings, type SettingsInput } from './settings';

config({ path: [resolve(__dirname, '../../../.env.local'), resolve(__dirname, '../../../../../.env')], quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const email = process.env.ADMIN_EMAIL ?? 'admin@prepio.local';
const password = process.env.ADMIN_PASSWORD ?? 'prepio-local-admin';

describe.skipIf(!url || !anon)('settings data functions (local Supabase)', () => {
  let db: SupabaseClient;
  let original: SettingsInput;

  beforeAll(async () => {
    db = createClient(url!, anon!, { auth: { persistSession: false } });
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    original = await getSettings(db);
  });

  afterAll(async () => {
    if (original) await saveSettings(db, original);
  });

  const valid: SettingsInput = { welcomeMessage: '[test] Bun venit', rules: '[test] reguli', model: 'test-model' };

  it('persists both rows', async () => {
    await saveSettings(db, valid);
    expect(await getSettings(db)).toEqual(valid);
  });

  it.each([
    ['empty model', { model: '  ' }],
    ['empty welcome message', { welcomeMessage: ' ' }],
    ['empty rules', { rules: '' }],
  ])('rejects %s and saves nothing', async (_n, patch) => {
    await saveSettings(db, valid);
    const bad = { ...valid, welcomeMessage: '[test] changed', ...patch };
    await expect(saveSettings(db, bad)).rejects.toBeInstanceOf(UserError);
    expect(await getSettings(db)).toEqual(valid);
  });

  it('fails for an unauthenticated client', async () => {
    const anonDb = createClient(url!, anon!, { auth: { persistSession: false } });
    await expect(saveSettings(anonDb, { ...valid, welcomeMessage: '[test] anon' })).rejects.toBeInstanceOf(UserError);
    expect((await getSettings(db)).welcomeMessage).not.toBe('[test] anon');
  });
});
