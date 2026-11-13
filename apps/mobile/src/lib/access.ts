import type { AccessOffer, AccessPurchaseError, AccessPurchaseErrorCode, AccessPurchaseResponse } from '@prepio/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { accountSuspended, apiErrorText, bearerToken, missingApiUrl, offlineText, sessionExpired, sessionExpiredText } from './api';
import { t } from '../texts/store';
import { apiUrl, getSupabase } from './supabase';

export class AccessApiError extends Error {
  code: AccessPurchaseErrorCode;
  /** Only on `offer_changed`: the offer as the server has it now. */
  offer?: AccessOffer;
  constructor(code: AccessPurchaseErrorCode, message: string, offer?: AccessOffer) {
    super(message);
    this.name = 'AccessApiError';
    this.code = code;
    this.offer = offer;
  }
}

export const ACCESS_PURCHASE_TIMEOUT_MS = 15_000;

export type AccessHistoryEntry = {
  kind: 'purchase' | 'admin_grant' | 'admin_revoke' | 'referral_reward';
  months: number | null;
  untilAfter: string;
  createdAt: string;
  priceBani: number | null;
};

/** The current offer (price, bonus credits, months), readable by every signed-in student. */
export async function fetchAccessOffer(client: SupabaseClient = getSupabase()): Promise<AccessOffer> {
  const { data, error } = await client
    .from('access_settings')
    .select('price_bani,bonus_credits,duration_months')
    .eq('id', 1)
    .single();
  if (error) throw error;
  return { priceBani: data.price_bani, bonusCredits: data.bonus_credits, durationMonths: data.duration_months };
}

/** The student's own `access_until` (ISO), or null when never bought / no row. */
export async function fetchAccessUntil(userId: string, client: SupabaseClient = getSupabase()): Promise<string | null> {
  const { data, error } = await client.from('profiles').select('access_until').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data?.access_until ?? null;
}

/** The free lesson as the server computes it (`free_lesson_id()`, the function RLS uses); null when nothing is published. */
export async function fetchFreeLessonId(client: SupabaseClient = getSupabase()): Promise<string | null> {
  const { data, error } = await client.rpc('free_lesson_id');
  if (error) throw error;
  return (data as string | null) ?? null;
}

/** Whether the signed-in user is an admin (admins always have every lesson open, like on the server). */
export async function fetchIsAdmin(client: SupabaseClient = getSupabase()): Promise<boolean> {
  const { data, error } = await client.rpc('is_admin');
  if (error) throw error;
  return data === true;
}

/** The student's own access ledger, newest first; purchases carry the price paid. Admin id / reason are not read. */
export async function fetchAccessHistory(userId: string, client: SupabaseClient = getSupabase()): Promise<AccessHistoryEntry[]> {
  const { data, error } = await client
    .from('access_ledger')
    .select('kind,months,until_after,created_at,order_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  const orderIds = rows.map((r) => r.order_id).filter((id): id is string => !!id);
  const prices = new Map<string, number>();
  if (orderIds.length) {
    const orders = await client.from('access_orders').select('id,price_bani').in('id', orderIds);
    if (orders.error) throw orders.error;
    for (const o of orders.data ?? []) prices.set(o.id, o.price_bani);
  }
  return rows.map((r) => ({
    kind: r.kind,
    months: r.months ?? null,
    untilAfter: r.until_after,
    createdAt: r.created_at,
    priceBani: r.order_id ? (prices.get(r.order_id) ?? null) : null,
  }));
}

/**
 * Buys access at the offer the student saw (the server fulfils it as a mock payment for now).
 * Throws AccessApiError; 401 also signs out, 403 suspended re-reads the profile, 409 offer_changed carries the new offer.
 */
export async function purchaseAccess(offer: AccessOffer): Promise<AccessPurchaseResponse> {
  const base = apiUrl();
  if (!base) {
    missingApiUrl('purchaseAccess');
    throw new AccessApiError('server_error', t('errors.purchase.notConfigured'));
  }
  const token = await bearerToken(() => new AccessApiError('server_error', offlineText()));
  if (!token) return sessionExpired(new AccessApiError('unauthorized', sessionExpiredText()));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ACCESS_PURCHASE_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(`${base}/api/access/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          expectedPriceBani: offer.priceBani,
          expectedBonusCredits: offer.bonusCredits,
          expectedDurationMonths: offer.durationMonths,
        }),
        signal: controller.signal,
      });
    } catch {
      throw new AccessApiError('server_error', controller.signal.aborted ? t('errors.purchase.timeout') : offlineText());
    }
    if (res.status === 401) return sessionExpired(new AccessApiError('unauthorized', sessionExpiredText()));
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // Non-JSON (gateway page): generic message below.
    }
    if (!res.ok) {
      const e = body as Partial<AccessPurchaseError> | null;
      const error = e?.error
        ? new AccessApiError(e.error, apiErrorText('access', e.error), e.offer)
        : new AccessApiError('server_error', t('errors.purchase.failed'), e?.offer);
      if (res.status === 403 && error.code === 'suspended') return accountSuspended(error);
      throw error;
    }
    const ok = body as Partial<AccessPurchaseResponse> | null;
    if (!ok || typeof ok.accessUntil !== 'string') {
      throw new AccessApiError('server_error', controller.signal.aborted ? t('errors.purchase.timeout') : t('errors.purchase.failed'));
    }
    return ok as AccessPurchaseResponse;
  } finally {
    clearTimeout(timer);
  }
}
