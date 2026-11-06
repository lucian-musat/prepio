import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { aiDefaults, welcomeMessage } from './index';
import { seed } from './seed';
import { updateAiSettings } from './updateAiSettings';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!url || !serviceKey)('updateAiSettings (integration)', () => {
  let client: SupabaseClient;

  const read = async () => {
    const s = await client.from('settings').select('welcome_message').eq('id', 1).single();
    const a = await client.from('ai_settings').select('rules, model, grade_min, grade_max').eq('id', 1).single();
    if (s.error) throw s.error;
    if (a.error) throw a.error;
    return { welcome: s.data.welcome_message as string, ...a.data };
  };

  beforeAll(async () => {
    client = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    await seed(client, { reset: true });
  });

  afterAll(async () => {
    await client.from('settings').update({ welcome_message: welcomeMessage }).eq('id', 1);
    await client.from('ai_settings').update({ rules: aiDefaults.rules, model: aiDefaults.model }).eq('id', 1);
  });

  it('plans without writing, then replaces only the welcome message and the rules, and is idempotent', async () => {
    await client.from('settings').update({ welcome_message: 'old welcome' }).eq('id', 1);
    await client.from('ai_settings').update({ rules: 'Acordă o notă de la 1 la 10.', model: 'custom-model' }).eq('id', 1);
    const before = await read();

    const dry = await updateAiSettings(client, { apply: false });
    expect(dry.changes.map((c) => [c.name, c.changed, c.current])).toEqual([
      ['welcome_message', true, 'old welcome'],
      ['ai_rules', true, 'Acordă o notă de la 1 la 10.'],
    ]);
    expect(await read()).toEqual(before);

    const applied = await updateAiSettings(client, { apply: true });
    expect(applied.updated).toBe(2);
    expect(await read()).toEqual({ ...before, welcome: welcomeMessage, rules: aiDefaults.rules });

    const again = await updateAiSettings(client, { apply: false });
    expect(again.changes.every((c) => !c.changed)).toBe(true);
  });
});
