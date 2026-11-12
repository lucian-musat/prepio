import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import { plural } from '@prepio/shared';
import { getSupabase } from './supabase';

/**
 * The invite code a visitor arrived with (link) or typed on Welcome, kept on this device with the time it was
 * stored until the sign-in it was meant for attaches it (AuthProvider), or it goes stale. AsyncStorage is
 * localStorage on the web, like the Supabase session, so it survives the OAuth redirect.
 */
export const PENDING_CODE_KEY = 'prepio.pendingReferralCode';
/** A pending code older than this is dropped: it was left behind and is no longer an intention. */
export const PENDING_CODE_TTL_MS = 7 * 24 * 60 * 60_000;

export const INVITE_URL_BASE = 'https://prepio.ro/invita/';

export type ReferralPublicSettings = {
  enabled: boolean;
  threshold: number;
  creditsPerInvitee: number;
  durationMonths: number;
  maxRewarded: number;
};

export type ReferralSummary = {
  code: string | null;
  enabled: boolean;
  threshold: number;
  creditsPerInvitee: number;
  durationMonths: number;
  hasAccess: boolean;
  pendingCount: number;
  inviteeCount: number;
  creditsEarned: number;
  freePeriodsEarned: number;
};

export type ReferralRow = {
  id: string;
  firstName: string | null;
  email: string | null;
  state: string;
  createdAt: string;
  firstPaidAt: string | null;
  rewardCredits: number;
  accountDeleted: boolean;
};

export type ReferralAttachResult = 'attached' | 'invalid' | 'disabled' | 'not_allowed' | 'self';

/** Upper-case letters and digits only: what a person types or pastes ("ab-cd 2345") becomes the stored form. */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function inviteUrl(code: string): string {
  return `${INVITE_URL_BASE}${encodeURIComponent(code)}`;
}

/** Best-effort, like the consent: without storage the code is simply not remembered. */
export async function storePendingCode(code: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_CODE_KEY, JSON.stringify({ code, at: Date.now() }));
  } catch {
    // Blocked / unavailable storage.
  }
}

/** The pending code (normalized), or null: nothing stored, storage unavailable, or stale / malformed (then removed). */
export async function getPendingCode(): Promise<string | null> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(PENDING_CODE_KEY);
  } catch {
    return null;
  }
  if (raw == null) return null;
  let code: string | null = null;
  try {
    const v: unknown = JSON.parse(raw);
    const { code: c, at } = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
    const age = typeof at === 'number' ? Date.now() - at : NaN;
    if (typeof c === 'string' && age >= 0 && age <= PENDING_CODE_TTL_MS) code = normalizeCode(c) || null;
  } catch {
    // Malformed: dropped below.
  }
  if (!code) await clearPendingCode();
  return code;
}

export async function clearPendingCode(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_CODE_KEY);
  } catch {
    // Blocked / unavailable storage.
  }
}

/** Whether the code belongs to a student, and the first name of that student. Throws on a network / server error. */
export async function lookupReferralCode(code: string): Promise<{ valid: boolean; inviterFirstName: string | null }> {
  const { data, error } = await getSupabase().rpc('referral_lookup', { p_code: code });
  if (error) throw error;
  const row = (data as Array<{ valid: boolean; inviter_first_name: string | null }> | null)?.[0];
  return { valid: !!row?.valid, inviterFirstName: row?.inviter_first_name ?? null };
}

/** Attaches the code to the signed-in student. The server decides (new accounts only). Throws on error. */
export async function attachReferralCode(code: string): Promise<ReferralAttachResult> {
  const { data, error } = await getSupabase().rpc('referral_attach', { p_code: code });
  if (error) throw error;
  return data as ReferralAttachResult;
}

/** The programme's public numbers; readable signed out. Throws on error (the caller hides the feature). */
export async function fetchReferralPublicSettings(): Promise<ReferralPublicSettings> {
  const { data, error } = await getSupabase().rpc('referral_public_settings');
  if (error) throw error;
  const row = (
    data as Array<{
      enabled: boolean;
      threshold: number;
      credits_per_invitee: number;
      duration_months: number;
      max_rewarded: number;
    }> | null
  )?.[0];
  if (!row) throw new Error('referral settings missing');
  return {
    enabled: row.enabled,
    threshold: row.threshold,
    creditsPerInvitee: row.credits_per_invitee,
    durationMonths: row.duration_months,
    maxRewarded: row.max_rewarded,
  };
}

/** The student's own code, programme numbers and totals. Throws on error (the caller hides the feature / shows retry). */
export async function fetchReferralSummary(client: SupabaseClient = getSupabase()): Promise<ReferralSummary> {
  const { data, error } = await client.rpc('my_referral_summary');
  if (error) throw error;
  const row = (
    data as Array<{
      code: string | null;
      enabled: boolean;
      threshold: number;
      credits_per_invitee: number;
      duration_months: number;
      has_access: boolean;
      pending_count: number;
      invitee_count: number;
      credits_earned: number;
      free_periods_earned: number;
    }> | null
  )?.[0];
  if (!row) throw new Error('referral summary missing');
  return {
    code: row.code,
    enabled: row.enabled,
    threshold: row.threshold,
    creditsPerInvitee: row.credits_per_invitee,
    durationMonths: row.duration_months,
    hasAccess: row.has_access,
    pendingCount: row.pending_count,
    inviteeCount: row.invitee_count,
    creditsEarned: row.credits_earned,
    freePeriodsEarned: row.free_periods_earned,
  };
}

/** The student's invitees, newest first (the server hides what a student must not see). Throws on error. */
export async function fetchMyReferrals(client: SupabaseClient = getSupabase()): Promise<ReferralRow[]> {
  const { data, error } = await client.rpc('my_referrals');
  if (error) throw error;
  return (
    (data as Array<{
      id: string;
      first_name: string | null;
      email: string | null;
      state: string;
      created_at: string;
      first_paid_at: string | null;
      reward_credits: number | null;
      account_deleted: boolean;
    }> | null) ?? []
  ).map((r) => ({
    id: r.id,
    firstName: r.first_name,
    email: r.email,
    state: r.state,
    createdAt: r.created_at,
    firstPaidAt: r.first_paid_at,
    rewardCredits: r.reward_credits ?? 0,
    accountDeleted: r.account_deleted,
  }));
}

/** „o lună”, „3 luni”, „12 luni”: a duration in months, in Romanian. */
export function monthsText(n: number): string {
  return n === 1 ? 'o lună' : plural(n, 'lună', 'luni');
}
