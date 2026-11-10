import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccessOffer, AccessPurchaseError, AccessPurchaseErrorCode, AccessPurchaseResponse } from '@prepio/shared';
import { isSuspended } from '@/lib/account/suspended';
import { captureFailure } from '@/lib/sentry';

export type PurchaseResult = { status: number; json: AccessPurchaseResponse | AccessPurchaseError };

const ERRORS: Record<AccessPurchaseErrorCode, { status: number; message: string }> = {
  bad_request: { status: 400, message: 'Cererea nu este validă.' },
  unauthorized: { status: 401, message: 'Trebuie să fii autentificat.' },
  suspended: { status: 403, message: 'Contul tău este suspendat.' },
  offer_changed: { status: 409, message: 'Oferta s-a schimbat. Verifică noul preț.' },
  server_error: { status: 500, message: 'Plata nu a reușit. Încearcă din nou.' },
};

export function purchaseError(code: AccessPurchaseErrorCode, offer?: AccessOffer): PurchaseResult {
  const { status, message } = ERRORS[code];
  return { status, json: offer ? { error: code, message, offer } : { error: code, message } };
}

/** A server_error answer, reported to Sentry (sanitized) under `stage`. */
function serverError(stage: string, e?: unknown): PurchaseResult {
  const r = purchaseError('server_error');
  captureFailure('access/purchase', stage, e, r.status);
  return r;
}

/** Postgres `int` maximum: larger values would make the RPC fail instead of answering bad_request. */
const PG_INT_MAX = 2147483647;
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= PG_INT_MAX;

/** Buys full access instantly (no payment provider yet) through the service-role RPC. Stale expected values → 409. */
export async function handleAccessPurchase(body: unknown, userId: string, db: SupabaseClient): Promise<PurchaseResult> {
  const b = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const { expectedPriceBani: price, expectedBonusCredits: bonus, expectedDurationMonths: months } = b;
  if (!isCount(price) || !isCount(bonus) || !isCount(months)) return purchaseError('bad_request');

  try {
    if (await isSuspended(db, userId)) return purchaseError('suspended');
  } catch (e) {
    console.error('[access/purchase] suspension lookup failed:', e);
    return serverError('suspension_lookup', e);
  }

  const { data, error } = await db.rpc('purchase_access', { p_user: userId, p_price_bani: price, p_bonus: bonus, p_months: months });
  if (error) {
    if (error.message === 'offer_changed') {
      const { data: s, error: sErr } = await db.from('access_settings').select('price_bani,bonus_credits,duration_months').eq('id', 1).single();
      const row = s as { price_bani: number; bonus_credits: number; duration_months: number } | null;
      if (sErr || !row) {
        console.error('[access/purchase] reading the current offer failed:', sErr?.message);
        return serverError('offer_read', sErr ?? undefined);
      }
      return purchaseError('offer_changed', { priceBani: row.price_bani, bonusCredits: row.bonus_credits, durationMonths: row.duration_months });
    }
    console.error('[access/purchase] RPC failed:', error.message);
    return serverError('rpc', error);
  }
  // A table-returning RPC comes back as an array of rows.
  const row = (Array.isArray(data) ? data[0] : data) as
    | { order_id: string; access_until: string; bonus: number; balance: number }
    | undefined;
  if (!row || typeof row.order_id !== 'string' || typeof row.access_until !== 'string' || typeof row.bonus !== 'number' || typeof row.balance !== 'number') {
    console.error('[access/purchase] RPC returned no row');
    return serverError('rpc_empty');
  }
  return { status: 200, json: { orderId: row.order_id, accessUntil: row.access_until, bonus: row.bonus, balance: row.balance } };
}
