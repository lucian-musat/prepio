import type { SupabaseClient } from '@supabase/supabase-js';
import { parseLei } from '@prepio/shared';
import { check, UserError } from './db';

export type AccessSettings = { priceBani: number; bonusCredits: number; durationMonths: number };
export type AccessSettingsInput = { price: string; bonusCredits: number; durationMonths: number };

export async function getAccessSettings(db: SupabaseClient): Promise<AccessSettings> {
  const r = check(await db.from('access_settings').select('price_bani,bonus_credits,duration_months').eq('id', 1).single()) as {
    price_bani: number;
    bonus_credits: number;
    duration_months: number;
  };
  return { priceBani: r.price_bani, bonusCredits: r.bonus_credits, durationMonths: r.duration_months };
}

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

/** Same ranges as the access_settings checks. */
export function validateAccessSettings(i: AccessSettingsInput): { priceBani: number; bonusCredits: number; durationMonths: number } {
  const priceBani = parseLei(i.price);
  if (priceBani === null || priceBani < 1) throw new UserError('Prețul trebuie să fie mai mare de 0.');
  if (priceBani > 10000000) throw new UserError('Prețul nu poate depăși 100000 lei.');
  if (!isInt(i.bonusCredits) || i.bonusCredits < 0 || i.bonusCredits > 10000) {
    throw new UserError('Creditele incluse trebuie să fie un număr întreg între 0 și 10000.');
  }
  if (!isInt(i.durationMonths) || i.durationMonths < 1 || i.durationMonths > 24) {
    throw new UserError('Durata trebuie să fie între 1 și 24 de luni.');
  }
  return { priceBani, bonusCredits: i.bonusCredits, durationMonths: i.durationMonths };
}

export async function saveAccessSettings(db: SupabaseClient, input: AccessSettingsInput): Promise<void> {
  const v = validateAccessSettings(input);
  const { error } = await db.rpc('admin_save_access_settings', { p_price_bani: v.priceBani, p_bonus: v.bonusCredits, p_months: v.durationMonths });
  if (error) {
    console.error('[data] admin_save_access_settings failed:', error);
    if (error.code === '42501' || error.message === 'forbidden') throw new UserError('Nu ai permisiunea să modifici oferta de acces.');
    throw new UserError('Oferta de acces nu a putut fi salvată. Încearcă din nou.');
  }
}
