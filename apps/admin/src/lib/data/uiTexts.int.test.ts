import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { TEXTS } from '@prepio/shared';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { UserError } from './db';
import { listUiTexts, resetUiText, saveUiText } from './uiTexts';

config({ path: [resolve(__dirname, '../../../.env.local'), resolve(__dirname, '../../../../../.env')], quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL ?? 'admin@prepio.local';
const password = process.env.ADMIN_PASSWORD ?? 'prepio-local-admin';

const NAME_KEY = 'home.hero.welcomeBack';
const WELCOME = 'home.hero.welcome';
const ORPHAN = 'zztest.gone.key';

describe.skipIf(!url || !anon || !serviceKey)('ui texts data functions (local Supabase)', () => {
  let db: SupabaseClient;
  let service: SupabaseClient;
  let before: { key: string; value: string }[];

  const row = async (key: string) => (await listUiTexts(db, service)).find((r) => r.key === key)!;

  beforeAll(async () => {
    db = createClient(url!, anon!, { auth: { persistSession: false } });
    service = createClient(url!, serviceKey!, { auth: { persistSession: false } });
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    before = (await service.from('ui_texts').select('key,value')).data ?? [];
  });

  afterEach(async () => {
    await service.from('ui_texts').delete().in('key', [NAME_KEY, WELCOME, ORPHAN]);
  });

  afterAll(async () => {
    await service.from('ui_texts').delete().in('key', [NAME_KEY, WELCOME, ORPHAN]);
    const keep = before.filter((r) => [NAME_KEY, WELCOME].includes(r.key));
    if (keep.length) await service.from('ui_texts').upsert(keep);
  });

  it('lists catalog keys as defaults, sorted by group then key', async () => {
    const rows = await listUiTexts(db, service);
    const r = rows.find((x) => x.key === NAME_KEY)!;
    expect(r).toMatchObject({ value: null, orphan: false, group: 'home', vars: ['nume'], defaultText: TEXTS[NAME_KEY].default });
    const ids = rows.filter((x) => !x.orphan).map((x) => `${x.group}|${x.key}`);
    expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)));
  });

  it('saves an override and lists it with the editor email', async () => {
    await saveUiText(db, NAME_KEY, '[test] Salut, {nume}!');
    const r = await row(NAME_KEY);
    expect(r.value).toBe('[test] Salut, {nume}!');
    expect(r.updatedBy).toBe(email);
    expect(r.updatedAt).not.toBeNull();
  });

  it('falls back to the short user id without a service client', async () => {
    await saveUiText(db, NAME_KEY, '[test] Salut, {nume}!');
    const r = (await listUiTexts(db)).find((x) => x.key === NAME_KEY)!;
    expect(r.updatedBy).toMatch(/^[0-9a-f]{8}$/);
  });

  it('removes the override when the value equals the default', async () => {
    await saveUiText(db, NAME_KEY, '[test] Salut, {nume}!');
    await saveUiText(db, NAME_KEY, TEXTS[NAME_KEY].default);
    expect((await row(NAME_KEY)).value).toBeNull();
    const res = await service.from('ui_texts').select('key').eq('key', NAME_KEY);
    expect(res.data).toEqual([]);
  });

  it('rejects a missing variable and saves nothing', async () => {
    await expect(saveUiText(db, NAME_KEY, 'Salut!')).rejects.toBeInstanceOf(UserError);
    expect((await row(NAME_KEY)).value).toBeNull();
  });

  it('rejects an unknown key', async () => {
    await expect(saveUiText(db, 'nope.missing', 'x')).rejects.toBeInstanceOf(UserError);
  });

  it('resets back to the default', async () => {
    await saveUiText(db, NAME_KEY, '[test] Salut, {nume}!');
    await resetUiText(db, NAME_KEY);
    expect((await row(NAME_KEY)).value).toBeNull();
  });

  it('saves an empty value for an optional key', async () => {
    await saveUiText(db, WELCOME, '');
    expect((await row(WELCOME)).value).toBe('');
    await saveUiText(db, WELCOME, '   ');
    expect((await row(WELCOME)).value).toBe('');
  });

  it('lists an orphan override and reset deletes it', async () => {
    const ins = await service.from('ui_texts').insert({ key: ORPHAN, value: '[test] orfan' });
    expect(ins.error).toBeNull();
    const r = await row(ORPHAN);
    expect(r).toMatchObject({ orphan: true, value: '[test] orfan', group: null, defaultText: null });
    await resetUiText(db, ORPHAN);
    expect((await listUiTexts(db, service)).some((x) => x.key === ORPHAN)).toBe(false);
  });
});
