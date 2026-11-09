import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ISTORIE_2026_V3 } from './bacSubjects';
import { DEFAULT_BAC_RULES } from './defaults';
import { seed } from './seed';
import { syncBacSubjects } from './syncBacSubjects';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!url || !serviceKey)('syncBacSubjects (integration)', () => {
  let client: SupabaseClient;

  const state = async () => {
    const s = await client.from('bac_subjects').select('id').eq('title', ISTORIE_2026_V3.title);
    const a = await client.from('ai_settings').select('bac_rules').eq('id', 1).single();
    if (s.error) throw s.error;
    if (a.error) throw a.error;
    return { subjects: s.data.map((r) => r.id as string), rules: a.data.bac_rules as string };
  };

  const removeSubject = async () => {
    const { data } = await client.from('bac_subjects').select('id').eq('title', ISTORIE_2026_V3.title);
    for (const { id } of data ?? []) {
      await client.from('bac_items').delete().eq('subject_id', id);
      await client.from('bac_subjects').delete().eq('id', id);
    }
  };

  beforeAll(async () => {
    client = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    await seed(client, { reset: true });
  });

  afterAll(async () => {
    await client.from('ai_settings').update({ bac_rules: DEFAULT_BAC_RULES }).eq('id', 1);
    if ((await state()).subjects.length === 0) await seed(client);
  });

  it('plans without writing, then adds the missing subject and fills empty rules, and is idempotent', async () => {
    await removeSubject();
    await client.from('ai_settings').update({ bac_rules: '' }).eq('id', 1);

    const dry = await syncBacSubjects(client, { apply: false });
    expect(dry.missing).toEqual([ISTORIE_2026_V3.title]);
    expect(dry.rulesEmpty).toBe(true);
    expect(await state()).toEqual({ subjects: [], rules: '' });

    const applied = await syncBacSubjects(client, { apply: true });
    expect(applied.inserted).toBe(1);
    expect(applied.rulesWritten).toBe(true);
    const after = await state();
    expect(after.subjects).toHaveLength(1);
    expect(after.rules).toBe(DEFAULT_BAC_RULES);

    const again = await syncBacSubjects(client, { apply: true });
    expect(again).toMatchObject({ missing: [], rulesEmpty: false, inserted: 0, rulesWritten: false });
    expect(await state()).toEqual(after);
  });

  it('never overwrites rules the owner has written', async () => {
    await client.from('ai_settings').update({ bac_rules: 'Regulile mele.' }).eq('id', 1);
    const r = await syncBacSubjects(client, { apply: true });
    expect(r.rulesWritten).toBe(false);
    expect((await state()).rules).toBe('Regulile mele.');
  });
});
