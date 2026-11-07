import { AI_TYPES } from './consolidation/exercises';
import type { ConsolidationEvaluateRequest, ConsolidationExercise } from './consolidation/types';
import { plural } from './plural';

export type CreditPackage = { id: string; credits: number; priceBani: number; featured: boolean };
export type CreditLedgerKind = 'welcome' | 'purchase' | 'check' | 'refund' | 'admin';

/** `POST /api/credits/purchase`. */
export type CreditsPurchaseRequest = { packageId: string };
export type CreditsPurchaseResponse = { orderId: string; credits: number; balance: number };
export type CreditsPurchaseErrorCode = 'unauthorized' | 'bad_request' | 'package_unavailable' | 'suspended' | 'server_error';
/** `message` is in Romanian. */
export type CreditsPurchaseError = { error: CreditsPurchaseErrorCode; message: string };

type Target = ConsolidationEvaluateRequest['target'];

/** Credits one check of `target` costs: 0 for non-AI types, else the exercise's `creditCost`. */
export function checkCost(ex: ConsolidationExercise, _target: Target): number {
  if (!AI_TYPES.has(ex.type)) return 0;
  return ex.creditCost;
}

/** Stable text form of a check target, stored on the ledger row: `exercise` or `req:<id>`. */
export function targetKey(target: Target): string {
  return typeof target === 'object' ? `req:${target.requirementId}` : target;
}

/** `1999 → '19,99 lei'`, `1000 → '10 lei'`. */
export function formatLei(bani: number): string {
  const lei = Math.floor(bani / 100);
  const rest = bani % 100;
  return rest === 0 ? `${lei} lei` : `${lei},${String(rest).padStart(2, '0')} lei`;
}

/** `(1999, 50) → '0,40 lei / credit'`, rounded to the ban. */
export function pricePerCredit(bani: number, credits: number): string {
  const each = Math.round(bani / credits);
  return `${Math.floor(each / 100)},${String(each % 100).padStart(2, '0')} lei / credit`;
}

/** Admin price input to bani: `'19,99' | '19.99' | '19'`; null when empty, negative, malformed or with more than 2 decimals. */
export function parseLei(s: string): number | null {
  const m = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(s.trim());
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
}

/** „1 credit”, „2 credite”, „20 de credite”. */
export function creditsLabel(n: number): string {
  return plural(n, 'credit', 'credite');
}
