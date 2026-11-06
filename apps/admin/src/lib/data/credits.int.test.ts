import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { UserError } from './db';
import { getCreditSettings, saveCreditSettings, type CreditSettingsInput } from './credits';

config({ path: [resolve(__dirname, '../../../.env.local'), resolve(__dirname, '../../../../../.env')], quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const email = process.env.ADMIN_EMAIL ?? 'admin@prepio.local';
const password = process.env.ADMIN_PASSWORD ?? 'prepio-local-admin';

describe.skipIf(!url || !anon)('credit settings data functions (local Supabase)', () => {
  let db: SupabaseClient;
  let original: CreditSettingsInput;

  beforeAll(async () => {
    db = createClient(url!, anon!, { auth: { persistSession: false } });
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    original = await getCreditSettings(db);
  });

  afterAll(async () => {
    if (!original) return;
    // Packages are never deleted: leftovers from the tests are kept at the end, deactivated.
    const known = new Set(original.packages.map((p) => p.id));
    const extras = (await getCreditSettings(db)).packages
      .filter((p) => !known.has(p.id))
      .map((p) => ({ ...p, active: false, featured: false }));
    await saveCreditSettings(db, { ...original, packages: [...original.packages, ...extras] });
  });

  it('returns the welcome credits and the seeded active packages in order', async () => {
    const s = await getCreditSettings(db);
    expect(s.welcomeCredits).toBe(12);
    const active = s.packages.filter((p) => p.active);
    expect(active).toHaveLength(3);
    expect(active.filter((p) => p.featured)).toHaveLength(1);
    expect(s.packages[0].id).toBeTruthy();
  });

  it('reorders, edits a price, adds a package and restores', async () => {
    const [a, b, c] = original.packages;
    await saveCreditSettings(db, {
      welcomeCredits: 5,
      packages: [{ ...c, priceBani: c.priceBani + 100, featured: false }, { ...a, featured: false }, { ...b, featured: false }, { credits: 7, priceBani: 777, featured: true, active: true }],
    });
    const s = await getCreditSettings(db);
    expect(s.welcomeCredits).toBe(5);
    expect(s.packages.map((p) => p.id).slice(0, 3)).toEqual([c.id, a.id, b.id]);
    expect(s.packages[0].priceBani).toBe(c.priceBani + 100);
    const added = s.packages.find((p) => p.active && p.credits === 7 && p.priceBani === 777)!;
    expect(added).toMatchObject({ credits: 7, priceBani: 777, featured: true, active: true });
    expect(added.id).toBeTruthy();
    expect(s.packages.filter((p) => p.featured)).toHaveLength(1);
    const extras = s.packages.filter((p) => !original.packages.some((o) => o.id === p.id)).map((p) => ({ ...p, active: false, featured: false }));
    await saveCreditSettings(db, { ...original, packages: [...original.packages, ...extras] });
    expect((await getCreditSettings(db)).packages.slice(0, 3)).toEqual(original.packages.slice(0, 3));
  });

  const pkg = (o = {}) => ({ credits: 10, priceBani: 500, featured: false, active: true, ...o });
  const WELCOME = 'Creditele de bun venit trebuie să fie un număr întreg între 0 și 1000.';
  it.each([
    ['welcome too high', { welcomeCredits: 1001 }, WELCOME],
    ['welcome fractional', { welcomeCredits: 1.5 }, WELCOME],
    ['welcome negative', { welcomeCredits: -1 }, WELCOME],
    ['credits zero', { packages: [pkg(), pkg({ credits: 0 })] }, 'Pachetul 2: numărul de credite trebuie să fie între 1 și 10000.'],
    ['credits too high', { packages: [pkg({ credits: 10001 })] }, 'Pachetul 1: numărul de credite trebuie să fie între 1 și 10000.'],
    ['price zero', { packages: [pkg({ priceBani: 0 })] }, 'Pachetul 1: prețul trebuie să fie mai mare de 0.'],
    ['featured inactive', { packages: [pkg(), pkg({ featured: true, active: false })] }, 'Doar un pachet activ poate fi marcat «cel mai ales».'],
    ['two featured', { packages: [pkg({ featured: true }), pkg({ featured: true })] }, 'Doar un pachet activ poate fi marcat «cel mai ales».'],
    ['none active', { packages: [pkg({ active: false })] }, 'Trebuie să existe cel puțin un pachet activ.'],
  ])('rejects %s and saves nothing', async (_n, patch, message) => {
    const before = await getCreditSettings(db);
    const bad = { welcomeCredits: 3, packages: [pkg()], ...patch } as CreditSettingsInput;
    await expect(saveCreditSettings(db, bad)).rejects.toThrow(message);
    await expect(saveCreditSettings(db, bad)).rejects.toBeInstanceOf(UserError);
    expect(await getCreditSettings(db)).toEqual(before);
  });
});
