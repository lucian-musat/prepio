import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreditsPurchaseError, CreditsPurchaseErrorCode, CreditsPurchaseResponse } from '@prepio/shared';
import { isUuid } from '@/lib/data/db';

export type PurchaseResult = { status: number; json: CreditsPurchaseResponse | CreditsPurchaseError };

const ERRORS: Record<CreditsPurchaseErrorCode, { status: number; message: string }> = {
  bad_request: { status: 400, message: 'Cererea nu este validă.' },
  unauthorized: { status: 401, message: 'Trebuie să fii autentificat.' },
  package_unavailable: { status: 409, message: 'Pachetul nu mai este disponibil. Alege altul.' },
  server_error: { status: 500, message: 'Cumpărarea nu a reușit. Încearcă din nou.' },
};

export function purchaseError(code: CreditsPurchaseErrorCode): PurchaseResult {
  const { status, message } = ERRORS[code];
  return { status, json: { error: code, message } };
}

/** Buys a credit package instantly (no payment provider yet) through the service-role RPC. */
export async function handleCreditsPurchase(body: unknown, userId: string, db: SupabaseClient): Promise<PurchaseResult> {
  const packageId = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).packageId : undefined;
  if (typeof packageId !== 'string' || !isUuid(packageId)) return purchaseError('bad_request');

  const { data, error } = await db.rpc('purchase_credit_package', { p_user: userId, p_package: packageId });
  if (error) {
    if (error.message === 'package_unavailable' || error.message === 'package_not_found') return purchaseError('package_unavailable');
    console.error('[credits/purchase] RPC failed:', error.message);
    return purchaseError('server_error');
  }
  // A table-returning RPC comes back as an array of rows.
  const row = (Array.isArray(data) ? data[0] : data) as { order_id: string; credits: number; balance: number } | undefined;
  if (!row || typeof row.order_id !== 'string' || typeof row.credits !== 'number' || typeof row.balance !== 'number') {
    console.error('[credits/purchase] RPC returned no row');
    return purchaseError('server_error');
  }
  return { status: 200, json: { orderId: row.order_id, credits: row.credits, balance: row.balance } };
}
