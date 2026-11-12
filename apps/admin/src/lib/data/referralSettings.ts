import type { SupabaseClient } from '@supabase/supabase-js';
import { check, UserError } from './db';

export type ReferralSettings = { enabled: boolean; threshold: number; creditsPerInvitee: number; maxRewarded: number };

export async function getReferralSettings(db: SupabaseClient): Promise<ReferralSettings> {
  const r = check(
    await db.from('referral_settings').select('enabled,threshold,credits_per_invitee,max_rewarded').eq('id', 1).single(),
  ) as { enabled: boolean; threshold: number; credits_per_invitee: number; max_rewarded: number };
  return { enabled: r.enabled, threshold: r.threshold, creditsPerInvitee: r.credits_per_invitee, maxRewarded: r.max_rewarded };
}

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

/** Same ranges as the referral_settings checks. */
export function validateReferralSettings(i: ReferralSettings): ReferralSettings {
  if (!isInt(i.threshold) || i.threshold < 1 || i.threshold > 100) {
    throw new UserError('Numărul de invitați trebuie să fie un număr întreg între 1 și 100.');
  }
  if (!isInt(i.creditsPerInvitee) || i.creditsPerInvitee < 0 || i.creditsPerInvitee > 10000) {
    throw new UserError('Creditele pe invitat trebuie să fie un număr întreg între 0 și 10000.');
  }
  if (!isInt(i.maxRewarded) || i.maxRewarded < 1 || i.maxRewarded > 10000) {
    throw new UserError('Limita de invitați recompensați trebuie să fie un număr întreg între 1 și 10000.');
  }
  return { enabled: Boolean(i.enabled), threshold: i.threshold, creditsPerInvitee: i.creditsPerInvitee, maxRewarded: i.maxRewarded };
}

export async function saveReferralSettings(db: SupabaseClient, input: ReferralSettings): Promise<void> {
  const v = validateReferralSettings(input);
  const { error } = await db.rpc('admin_save_referral_settings', {
    p_enabled: v.enabled,
    p_threshold: v.threshold,
    p_credits: v.creditsPerInvitee,
    p_max: v.maxRewarded,
  });
  if (error) {
    console.error('[data] admin_save_referral_settings failed:', error);
    if (error.code === '42501' || error.message === 'forbidden') throw new UserError('Nu ai permisiunea să modifici setările recomandărilor.');
    throw new UserError('Setările recomandărilor nu au putut fi salvate. Încearcă din nou.');
  }
}
