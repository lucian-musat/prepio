import type { SupabaseClient } from '@supabase/supabase-js';
import { plural } from '@prepio/shared';
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
  /** The free-access grant (access_ledger id) this invitee was consumed by; null otherwise. */
  accessLedgerId: number | null;
};

/** Where the current access came from; `entryId` is the access_ledger entry that set it (null for trial). */
export type AccessSource = { kind: AccessSourceKind; at: string | null; entryId: number | null };

const instant = (iso: string | null) => (iso ? new Date(iso).getTime() : NaN);

/**
 * Where the student's current access came from: the latest ledger entry that set the current end (compared as
 * instants). Falls back to the latest non-revoke entry; trial when there is no active access.
 */
export function accessSource(
  entries: AdminAccessLedgerEntry[],
  accessUntil: string | null,
  now: Date,
): AccessSource {
  const end = instant(accessUntil);
  if (accessUntil === null || !(end > now.getTime())) return { kind: 'trial', at: null, entryId: null };
  const latestFirst = [...entries]
    .sort((a, b) => b.id - a.id)
    .filter((e): e is AdminAccessLedgerEntry & { kind: AccessSourceKind } => e.kind !== 'admin_revoke');
  const pick = latestFirst.find((e) => instant(e.untilAfter) === end) ?? latestFirst[0];
  if (!pick) return { kind: 'trial', at: null, entryId: null };
  return { kind: pick.kind, at: pick.createdAt, entryId: pick.id };
}

const SOURCE_LABELS: Record<AccessSourceKind, string> = {
  purchase: 'Plătit', referral_reward: 'Recomandări', admin_grant: 'Acordat manual', trial: 'Trial',
};
/** The invitees whose free access is the current one (spec: "Recomandări, with the invitees that earned it"). */
export function currentAccessContributors(
  invitees: AdminReferralRow[], source: Pick<AccessSource, 'kind' | 'entryId'> | undefined,
): AdminReferralRow[] {
  if (source?.kind !== 'referral_reward' || source.entryId === null) return [];
  return invitees.filter((r) => r.accessLedgerId === source.entryId);
}

export const accessSourceLabel = (kind: AccessSourceKind): string => SOURCE_LABELS[kind];

export function referralStateLabel(state: string, rewardCredits: number | null): string {
  switch (state) {
    case 'registered': return 'Cont creat, fără abonament';
    case 'pending': return 'Abonat · în așteptare (numără spre abonamentul gratuit)';
    case 'consumed_access': return 'Abonat · a contribuit la abonamentul gratuit';
    case 'converted_credits': return `Abonat · +${plural(rewardCredits ?? 0, 'credit', 'credite')}`;
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

const ACCESS_ENTRIES_LIMIT = 50;

/** The student's latest access ledger entries, newest first (enough to name the source of the current access). */
export async function getAccessEntries(db: SupabaseClient, userId: string): Promise<AdminAccessLedgerEntry[]> {
  const ledger = check(
    await db.from('access_ledger').select('id,kind,months,until_before,until_after,reason,created_at')
      .eq('user_id', userId).order('id', { ascending: false }).limit(ACCESS_ENTRIES_LIMIT),
  ) as LedgerDb[];
  return ledger.map((l) => ({
    id: l.id, kind: l.kind, months: l.months, untilBefore: l.until_before, untilAfter: l.until_after, reason: l.reason, createdAt: l.created_at,
  }));
}

export type ReferralDetails = { code: string | null; invitedBy: { id: string; name: string } | null; invitees: AdminReferralRow[] };

/** The student's own code, who invited them and the people they invited. */
export async function getReferralDetails(db: SupabaseClient, userId: string): Promise<ReferralDetails> {
  const [inviteesRes, contextRes, ownRes, grantsRes] = await Promise.all([
    db.rpc('admin_referrals', { p_user: userId }),
    db.rpc('admin_referral_context', { p_user: userId }),
    db.from('referral_codes').select('code').eq('user_id', userId).maybeSingle(),
    // Which grant consumed each invitee (admins read every referral row).
    db.from('referrals').select('id,access_ledger_id').eq('inviter_id', userId),
  ]);
  const invitees = check(inviteesRes) as ReferralDb[];
  const grants = new Map((check(grantsRes) as { id: string; access_ledger_id: number | null }[]).map((g) => [g.id, g.access_ledger_id]));
  const context = check(contextRes) as { code: string | null; inviter_id: string | null; inviter_name: string | null }[];
  // The context RPC returns the inviter's code; the student's own code is read from the table (admins can select it).
  const own = check(ownRes) as { code: string } | null;
  const inviter = context.find((c) => c.inviter_id);
  return {
    code: own?.code ?? null,
    invitedBy: inviter ? { id: inviter.inviter_id!, name: inviter.inviter_name ?? 'Coleg' } : null,
    invitees: invitees.map((r) => ({
      id: r.id, firstName: r.first_name, email: r.email, state: r.state, createdAt: r.created_at, firstPaidAt: r.first_paid_at,
      rewardCredits: r.reward_credits, accountDeleted: r.account_deleted, accessLedgerId: grants.get(r.id) ?? null,
    })),
  };
}

/**
 * Secondary data must never break the student page: on any failure the access source is undefined (the header then
 * shows no access line rather than a misleading "Trial").
 */
export async function loadAccessSource(
  db: SupabaseClient, userId: string, accessUntil: string | null, now: Date,
): Promise<AccessSource | undefined> {
  try {
    return accessSource(await getAccessEntries(db, userId), accessUntil, now);
  } catch (e) {
    console.error('[student] access source unavailable:', e);
    return undefined;
  }
}

/** The Recomandari tab data, or null when it could not be loaded. */
export async function loadReferralDetails(db: SupabaseClient, userId: string): Promise<ReferralDetails | null> {
  try {
    return await getReferralDetails(db, userId);
  } catch (e) {
    console.error('[student] referrals unavailable:', e);
    return null;
  }
}
