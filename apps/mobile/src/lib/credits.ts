import {
  type ConsolidationType,
  type CreditLedgerKind,
  type CreditPackage,
  type CreditsPurchaseError,
  type CreditsPurchaseErrorCode,
  type CreditsPurchaseResponse,
} from '@prepio/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { accountSuspended, apiErrorText, bearerToken, missingApiUrl, offlineText, sessionExpired, sessionExpiredText } from './api';
import { t } from '../texts/store';
import { typeLabel } from '../screens/consolidation/status';
import { creditCount } from './counts';
import { fetchMyReferrals } from './referrals';
import { ownUserId } from './ownUser';
import { apiUrl, getSupabase } from './supabase';

export class CreditsApiError extends Error {
  code: CreditsPurchaseErrorCode;
  constructor(code: CreditsPurchaseErrorCode, message: string) {
    super(message);
    this.name = 'CreditsApiError';
    this.code = code;
  }
}

export const PURCHASE_TIMEOUT_MS = 15_000;

export type StudentLedgerEntry = {
  id: number;
  delta: number;
  balanceAfter: number;
  kind: CreditLedgerKind;
  target: string | null;
  reason: string | null;
  createdAt: string;
  /** `referral`: the invitee's first name (the snapshot when the account is deleted); null when there is none. */
  referralName?: string | null;
  /** `access_bonus`: the bonus credits of a free access earned through referrals (not of a purchase). */
  fromReferral?: boolean;
  /** A BAC grading row (`bac:<subject id>`): the subject's title, when the student can read it (published). */
  bacTitle?: string;
  /** `lesson`: the title of the exercise's lesson, when the student can read it (published). */
  exercise: { type: ConsolidationType; prompt: string; requirements?: string[]; lesson?: string } | null;
};

const DEFAULT_LEDGER_LIMIT = 30;

type JoinedExercise = {
  type: ConsolidationType;
  prompt: string;
  content?: { requirements?: Array<{ id: string }> } | null;
  lessons?: { title: string | null } | Array<{ title: string | null }> | null;
};

/** Active packages, in the admin's order. */
export async function fetchCreditPackages(client: SupabaseClient = getSupabase()): Promise<CreditPackage[]> {
  const { data, error } = await client
    .from('credit_packages')
    .select('id,credits,price_bani,featured')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, credits: r.credits, priceBani: r.price_bani, featured: r.featured }));
}

/** The student's own ledger, newest first; `before` is the id of the last row already loaded. */
export async function fetchLedger(
  opts: { before?: number; limit?: number } = {},
  client: SupabaseClient = getSupabase(),
): Promise<StudentLedgerEntry[]> {
  const userId = await ownUserId(client);
  let q = client
    .from('credit_ledger')
    .select('id,delta,balance_after,kind,target,reason,created_at,referral_id,consolidation_exercises(type,prompt,content,lessons(title))')
    .eq('user_id', userId)
    .order('id', { ascending: false })
    .limit(opts.limit ?? DEFAULT_LEDGER_LIMIT);
  if (opts.before !== undefined) q = q.lt('id', opts.before);
  const { data, error } = await q;
  if (error) throw error;
  // A referral reward names its invitee; the first names come from my_referrals (a student cannot read profiles).
  const names = new Map<string, string | null>();
  if ((data ?? []).some((r) => r.kind === 'referral' && r.referral_id)) {
    try {
      for (const ref of await fetchMyReferrals(client)) names.set(ref.id, ref.firstName || null);
    } catch (e) {
      console.warn('[credits] referral names could not be loaded:', e); // the rows keep the plain label
    }
  }
  // BAC grading rows name their subject: the published titles, read in one query (a failure keeps the plain label).
  const bacIds = [...new Set((data ?? []).flatMap((r) => (typeof r.target === 'string' && r.target.startsWith('bac:') ? [r.target.slice(4)] : [])))];
  const bacTitles = new Map<string, string>();
  if (bacIds.length) {
    try {
      const { data: subjects, error: subErr } = await client.from('bac_subjects').select('id,title').in('id', bacIds);
      if (subErr) throw subErr;
      for (const s of subjects ?? []) if (s.title?.trim()) bacTitles.set(s.id, s.title.trim());
    } catch (e) {
      console.warn('[credits] BAC subject titles could not be loaded:', e);
    }
  }
  return (data ?? []).map((r) => {
    const bacTitle = typeof r.target === 'string' && r.target.startsWith('bac:') ? bacTitles.get(r.target.slice(4)) : undefined;
    const joined = r.consolidation_exercises as JoinedExercise | JoinedExercise[] | null;
    const ex = Array.isArray(joined) ? (joined[0] ?? null) : joined;
    const reqs = ex?.type === 'essay' ? ex.content?.requirements?.map((x) => x.id) : undefined;
    const lessonRow = Array.isArray(ex?.lessons) ? (ex.lessons[0] ?? null) : (ex?.lessons ?? null);
    const lesson = lessonRow?.title?.trim() || undefined;
    return {
      id: r.id,
      delta: r.delta,
      balanceAfter: r.balance_after,
      kind: r.kind,
      target: r.target,
      reason: r.reason,
      createdAt: r.created_at,
      ...(r.kind === 'referral' ? { referralName: (r.referral_id && names.get(r.referral_id)) || null } : {}),
      ...(r.kind === 'access_bonus' && r.referral_id ? { fromReferral: true } : {}),
      ...(bacTitle ? { bacTitle } : {}),
      exercise: ex
        ? { type: ex.type, prompt: ex.prompt, ...(reqs ? { requirements: reqs } : {}), ...(lesson ? { lesson } : {}) }
        : null,
    };
  });
}

/** The student's current balance from their own profile row (null when there is no row). */
export async function fetchCreditBalance(userId: string, client: SupabaseClient = getSupabase()): Promise<number | null> {
  const { data, error } = await client.from('profiles').select('credit_balance').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data ? data.credit_balance : null;
}

/** A check or refund row names its exercise (type, essay part) and its lesson: „Punct de vedere · Cuza”. */
export function ledgerLabel(e: StudentLedgerEntry): string {
  // BAC paper grading rows target `bac:<subject id>`, named after the subject when its title is known.
  if ((e.kind === 'check' || e.kind === 'refund') && e.target?.startsWith('bac:')) {
    const label = e.kind === 'refund' ? t('credits.ledger.bacRefund') : t('credits.ledger.bacCheck');
    return e.bacTitle ? `${label} · ${e.bacTitle}` : label;
  }
  const lesson = (e.kind === 'check' || e.kind === 'refund') && e.exercise?.lesson ? ` · ${e.exercise.lesson}` : '';
  return base(e) + lesson;
}

function base(e: StudentLedgerEntry): string {
  switch (e.kind) {
    case 'welcome':
      return t('credits.ledger.welcome');
    case 'purchase':
      return t('credits.ledger.purchase', { credite: creditCount(e.delta) });
    case 'access_bonus':
      return e.fromReferral ? t('credits.ledger.accessBonusReferral') : t('credits.ledger.accessBonus');
    case 'refund':
      return t('credits.ledger.refund');
    case 'referral':
      return e.referralName ? t('credits.ledger.referralNamed', { nume: e.referralName }) : t('credits.ledger.referral');
    case 'admin':
      return e.reason?.trim() ? t('credits.ledger.adminReason', { motiv: e.reason.trim() }) : t('credits.ledger.admin');
    case 'check': {
      if (!e.exercise) return t('credits.ledger.check');
      const base = e.exercise.type === 'essay' ? t('credits.ledger.essay') : typeLabel(e.exercise.type);
      if (e.exercise.type !== 'essay') return base;
      // Old ledger rows still carry the removed whole-essay target.
      if (e.target === 'whole') return `${base} · ${t('credits.ledger.essayWhole')}`;
      if (e.target?.startsWith('req:')) {
        const n = (e.exercise.requirements ?? []).indexOf(e.target.slice(4)) + 1;
        if (n > 0) return `${base} · ${t('credits.ledger.essayRequirement', { n })}`;
      }
      return base;
    }
  }
}

/** Buys a package (the server fulfils it as a mock payment for now). Throws CreditsApiError; 401 also signs out. */
export async function purchaseCredits(packageId: string): Promise<CreditsPurchaseResponse> {
  const base = apiUrl();
  if (!base) {
    missingApiUrl('purchaseCredits');
    throw new CreditsApiError('server_error', t('errors.purchase.notConfigured'));
  }
  const token = await bearerToken(() => new CreditsApiError('server_error', offlineText()));
  if (!token) return sessionExpired(new CreditsApiError('unauthorized', sessionExpiredText()));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PURCHASE_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(`${base}/api/credits/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ packageId }),
        signal: controller.signal,
      });
    } catch {
      throw new CreditsApiError('server_error', controller.signal.aborted ? t('errors.purchase.timeout') : offlineText());
    }
    if (res.status === 401) return sessionExpired(new CreditsApiError('unauthorized', sessionExpiredText()));
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // Non-JSON (gateway page): generic message below.
    }
    if (!res.ok) {
      const e = body as Partial<CreditsPurchaseError> | null;
      const error = e?.error
        ? new CreditsApiError(e.error, apiErrorText('credits', e.error))
        : new CreditsApiError('server_error', t('errors.purchase.failed'));
      if (res.status === 403 && error.code === 'suspended') return accountSuspended(error);
      throw error;
    }
    const ok = body as Partial<CreditsPurchaseResponse> | null;
    if (!ok || typeof ok.balance !== 'number') {
      throw new CreditsApiError('server_error', controller.signal.aborted ? t('errors.purchase.timeout') : t('errors.purchase.failed'));
    }
    return ok as CreditsPurchaseResponse;
  } finally {
    clearTimeout(timer);
  }
}
