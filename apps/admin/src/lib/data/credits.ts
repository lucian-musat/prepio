import type { SupabaseClient } from '@supabase/supabase-js';
import { check, UserError } from './db';

export type PackageInput = { id?: string; credits: number; priceBani: number; featured: boolean; active: boolean };
export type CreditSettingsInput = { welcomeCredits: number; packages: PackageInput[] };

type PackageRow = { id: string; credits: number; price_bani: number; featured: boolean; active: boolean };

/** All packages (active or not) in display order. */
export async function getCreditSettings(db: SupabaseClient): Promise<CreditSettingsInput> {
  const s = check(await db.from('credit_settings').select('welcome_credits').eq('id', 1).single()) as { welcome_credits: number };
  const rows = check(
    await db.from('credit_packages').select('id,credits,price_bani,featured,active').order('sort_order').order('created_at'),
  ) as PackageRow[];
  return {
    welcomeCredits: s.welcome_credits,
    packages: rows.map((r) => ({ id: r.id, credits: r.credits, priceBani: r.price_bani, featured: r.featured, active: r.active })),
  };
}

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

function validate(i: CreditSettingsInput) {
  if (!isInt(i.welcomeCredits) || i.welcomeCredits < 0 || i.welcomeCredits > 1000) {
    throw new UserError('Creditele de bun venit trebuie să fie un număr întreg între 0 și 1000.');
  }
  i.packages.forEach((p, idx) => {
    if (!isInt(p.credits) || p.credits < 1 || p.credits > 10000) {
      throw new UserError(`Pachetul ${idx + 1}: numărul de credite trebuie să fie între 1 și 10000.`);
    }
    if (!isInt(p.priceBani) || p.priceBani <= 0) throw new UserError(`Pachetul ${idx + 1}: prețul trebuie să fie mai mare de 0.`);
  });
  if (i.packages.some((p) => p.featured && !p.active) || i.packages.filter((p) => p.featured).length > 1) throw new UserError('Doar un pachet activ poate fi marcat «cel mai ales».');
  if (!i.packages.some((p) => p.active)) throw new UserError('Trebuie să existe cel puțin un pachet activ.');
}

/** `input.packages` must be the full list (the RPC clears `featured` on every package first); order = display order. */
export async function saveCreditSettings(db: SupabaseClient, input: CreditSettingsInput): Promise<void> {
  validate(input);
  check(
    await db.rpc('admin_save_credit_settings', {
      p_welcome: input.welcomeCredits,
      p_packages: input.packages.map((p) => ({
        ...(p.id ? { id: p.id } : {}),
        credits: p.credits,
        price_bani: p.priceBani,
        featured: p.featured,
        active: p.active,
      })),
    }),
  );
}
