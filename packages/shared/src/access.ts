/** Paid-access offer, as configured by an admin. Prices are in bani. */
export type AccessOffer = { priceBani: number; bonusCredits: number; durationMonths: number };

/** Full access with `daysLeft <= EXPIRING_DAYS` is reported as `expiring`. */
export const EXPIRING_DAYS = 7;

export type AccessStatus =
  | { plan: 'trial' }
  | { plan: 'expired'; until: Date }
  | { plan: 'full' | 'expiring'; until: Date; daysLeft: number };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Plan from `profiles.access_until`: full ⇔ `until > now`; `daysLeft = ceil((until - now) / 1 day)`. */
export function accessStatus(accessUntil: string | null, now: Date): AccessStatus {
  if (accessUntil === null) return { plan: 'trial' };
  const until = new Date(accessUntil);
  const diff = until.getTime() - now.getTime();
  if (!(diff > 0)) return { plan: 'expired', until };
  const daysLeft = Math.ceil(diff / DAY_MS);
  return { plan: daysLeft <= EXPIRING_DAYS ? 'expiring' : 'full', until, daysLeft };
}

/** True while every lesson is open (`full` or `expiring`). */
export function hasFullAccess(s: AccessStatus): boolean {
  return s.plan === 'full' || s.plan === 'expiring';
}

/**
 * Mirrors `private.extend_access`: `greatest(now, coalesce(until, now)) + months` in UTC calendar
 * months, clamped to the end of the target month (Jan 31 + 1 month = Feb 28/29).
 */
export function extendAccessUntil(accessUntil: string | null, months: number, now: Date): Date {
  const current = accessUntil === null ? now : new Date(accessUntil);
  const base = current.getTime() > now.getTime() ? current : now;
  const total = base.getUTCFullYear() * 12 + base.getUTCMonth() + months;
  const year = Math.floor(total / 12);
  const month = total % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const out = new Date(base.getTime());
  out.setUTCFullYear(year, month, Math.min(base.getUTCDate(), lastDay));
  return out;
}

const RO_MONTHS = [
  'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
  'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie',
];

/** `8 februarie 2027` in Europe/Bucharest. Month names are explicit so no Intl `ro` data is needed. */
export function formatAccessDate(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Bucharest',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return `${get('day')} ${RO_MONTHS[get('month') - 1]} ${get('year')}`;
}

/** `POST /api/access/purchase`. Expected values guard against a stale offer. */
export type AccessPurchaseRequest = {
  expectedPriceBani: number;
  expectedBonusCredits: number;
  expectedDurationMonths: number;
};
export type AccessPurchaseResponse = { orderId: string; accessUntil: string; bonus: number; balance: number };
export type AccessPurchaseErrorCode = 'bad_request' | 'unauthorized' | 'suspended' | 'offer_changed' | 'server_error';
/** `message` is in Romanian; `offer` is the current offer on `offer_changed`. */
export type AccessPurchaseError = { error: AccessPurchaseErrorCode; message: string; offer?: AccessOffer };
