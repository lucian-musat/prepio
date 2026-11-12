import type { SupabaseClient } from '@supabase/supabase-js';
import { check } from './db';

export type AccessSourceKind = 'trial' | 'purchase' | 'referral_reward' | 'admin_grant';

export type AdminAccessLedgerEntry = {
  id: number;
  kind: 'purchase' | 'admin_grant' | 'admin_revoke' | 'referral_reward';
  months: number | null;
  untilBefore: string | null;
  untilAfter: string | null;
  reason: string | null;
  createdAt: string;
};

export type AdminReferralRow = {
  id: string;
  firstName: string;
  email: string | null;
  state: string;
  createdAt: string;
  firstPaidAt: string | null;
  rewardCredits: number | null;
  accountDeleted: boolean;
};

const instant = (iso: string | null) => (iso ? new Date(iso).getTime() : NaN);

/**
 * Where the student's current access came from: the latest ledger entry that set the current end (compared as
 * instants). Falls back to the latest non-revoke entry; trial when there is no active access.
 */
export function accessSource(
  entries: AdminAccessLedgerEntry[],
  accessUntil: string | null,
  now: Date,
): { kind: AccessSourceKind; at: string | null } {
  const end = instant(accessUntil);
  if (accessUntil === null || !(end > now.getTime())) return { kind: 'trial', at: null };
  const latestFirst = [...entries].sort((a, b) => b.id - a.id);
  const pick =
    latestFirst.find((e) => e.kind !== 'admin_revoke' && instant(e.untilAfter) === end) ??
    latestFirst.find((e) => e.kind !== 'admin_revoke');
  if (!pick || pick.kind === 'admin_revoke') return { kind: 'trial', at: null };
  return { kind: pick.kind, at: pick.createdAt };
}

const SOURCE_LABELS: Record<AccessSourceKind, string> = {
  purchase: 'Plătit', referral_reward: 'Recomandări', admin_grant: 'Acordat manual', trial: 'Trial',
};
export const accessSourceLabel = (kind: AccessSourceKind): string => SOURCE_LABELS[kind];

export function referralStateLabel(state: string, rewardCredits: number | null): string {
  switch (state) {
    case 'registered': return 'Cont creat, fără abonament';
    case 'pending': return 'Abonat · în așteptare (numără spre abonamentul gratuit)';
    case 'consumed_access': return 'Abonat · a contribuit la abonamentul gratuit';
    case 'converted_credits': return `Abonat · +${rewardCredits ?? 0} credite`;
    case 'over_cap': return 'Abonat · fără recompensă (limită atinsă)';
    case 'not_rewarded_disabled': return 'Abonat · fără recompensă (recomandările erau oprite)';
    default: return state;
  }
}

type ReferralDb = {
  id: string; first_name: string; email: string | null; state: string; created_at: string; first_paid_at: string | null;
  reward_credits: number | null; account_deleted: boolean;
};
type LedgerDb = {
  id: number; kind: AdminAccessLedgerEntry['kind']; months: number | null; until_before: string | null; until_after: string | null;
  reason: string | null; created_at: string;
};

export async function getStudentReferrals(
  db: SupabaseClient,
  userId: string,
): Promise<{ code: string | null; invitedBy: { id: string; name: string } | null; invitees: AdminReferralRow[]; accessEntries: AdminAccessLedgerEntry[] }> {
  const invitees = check(await db.rpc('admin_referrals', { p_user: userId })) as ReferralDb[];
  const context = check(await db.rpc('admin_referral_context', { p_user: userId })) as { code: string | null; inviter_id: string | null; inviter_name: string | null }[];
  // The context RPC returns the inviter's code; the student's own code is read from the table (admins can select it).
  const own = check(await db.from('referral_codes').select('code').eq('user_id', userId).maybeSingle()) as { code: string } | null;
  const ledger = check(
    await db.from('access_ledger').select('id,kind,months,until_before,until_after,reason,created_at').eq('user_id', userId).order('id', { ascending: false }),
  ) as LedgerDb[];
  const inviter = context.find((c) => c.inviter_id);
  return {
    code: own?.code ?? null,
    invitedBy: inviter ? { id: inviter.inviter_id!, name: inviter.inviter_name ?? 'Coleg' } : null,
    invitees: invitees.map((r) => ({
      id: r.id, firstName: r.first_name, email: r.email, state: r.state, createdAt: r.created_at, firstPaidAt: r.first_paid_at,
      rewardCredits: r.reward_credits, accountDeleted: r.account_deleted,
    })),
    accessEntries: ledger.map((l) => ({
      id: l.id, kind: l.kind, months: l.months, untilBefore: l.until_before, untilAfter: l.until_after, reason: l.reason, createdAt: l.created_at,
    })),
  };
}
