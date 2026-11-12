import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { accessSource, accessSourceLabel, loadAccessSource, loadReferralDetails, referralStateLabel, type AdminAccessLedgerEntry } from './referrals';

const entry = (id: number, kind: AdminAccessLedgerEntry['kind'], untilAfter: string, createdAt = '2026-11-01T10:00:00Z'): AdminAccessLedgerEntry => ({
  id, kind, months: 3, untilBefore: null, untilAfter, reason: null, createdAt,
});
const NOW = new Date('2026-11-12T12:00:00Z');

describe('accessSource', () => {
  it('is trial when there is no access end', () => {
    expect(accessSource([entry(1, 'purchase', '2027-01-01T00:00:00Z')], null, NOW)).toEqual({ kind: 'trial', at: null });
  });
  it('is trial when the access already ended', () => {
    expect(accessSource([entry(1, 'purchase', '2026-11-01T00:00:00Z')], '2026-11-01T00:00:00Z', NOW)).toEqual({ kind: 'trial', at: null });
  });
  it('names the entry that set the current end', () => {
    const entries = [entry(1, 'purchase', '2027-01-01T00:00:00Z', '2026-10-01T00:00:00Z'), entry(2, 'referral_reward', '2027-04-01T00:00:00Z', '2026-11-02T00:00:00Z')];
    expect(accessSource(entries, '2027-04-01T00:00:00Z', NOW)).toEqual({ kind: 'referral_reward', at: '2026-11-02T00:00:00Z' });
    expect(accessSource([entry(3, 'admin_grant', '2027-04-01T00:00:00Z')], '2027-04-01T00:00:00Z', NOW).kind).toBe('admin_grant');
    expect(accessSource([entry(3, 'purchase', '2027-04-01T00:00:00Z')], '2027-04-01T00:00:00Z', NOW).kind).toBe('purchase');
  });
  it('picks the latest of several entries with the same end', () => {
    const entries = [entry(1, 'purchase', '2027-04-01T00:00:00Z'), entry(2, 'admin_grant', '2027-04-01T00:00:00Z')];
    expect(accessSource(entries, '2027-04-01T00:00:00Z', NOW).kind).toBe('admin_grant');
  });
  it('compares instants, not strings, across time-zone formats', () => {
    const entries = [entry(1, 'purchase', '2027-01-01T00:00:00Z'), entry(2, 'referral_reward', '2027-04-01T02:00:00+02:00')];
    expect(accessSource(entries, '2027-04-01T00:00:00+00:00', NOW).kind).toBe('referral_reward');
  });
  it('falls back to the latest non-revoke entry when no entry matches', () => {
    const entries = [entry(1, 'purchase', '2027-01-01T00:00:00Z'), entry(2, 'admin_grant', '2027-02-01T00:00:00Z')];
    expect(accessSource(entries, '2027-09-09T00:00:00Z', NOW).kind).toBe('admin_grant');
  });
  it('never reports a revoke: it falls back to the latest other entry', () => {
    const entries = [entry(1, 'purchase', '2027-01-01T00:00:00Z'), entry(2, 'admin_revoke', '2027-04-01T00:00:00Z')];
    expect(accessSource(entries, '2027-04-01T00:00:00Z', NOW).kind).toBe('purchase');
  });
  it('is trial when active access has no ledger entries at all', () => {
    expect(accessSource([], '2027-04-01T00:00:00Z', NOW)).toEqual({ kind: 'trial', at: null });
  });
});

describe('labels', () => {
  it('names the access sources', () => {
    expect(accessSourceLabel('purchase')).toBe('Plătit');
    expect(accessSourceLabel('referral_reward')).toBe('Recomandări');
    expect(accessSourceLabel('admin_grant')).toBe('Acordat manual');
    expect(accessSourceLabel('trial')).toBe('Trial');
  });
  it('describes every referral state', () => {
    expect(referralStateLabel('registered', null)).toBe('Cont creat, fără abonament');
    expect(referralStateLabel('pending', null)).toBe('Abonat · în așteptare (numără spre abonamentul gratuit)');
    expect(referralStateLabel('consumed_access', null)).toBe('Abonat · a contribuit la abonamentul gratuit');
    expect(referralStateLabel('converted_credits', 40)).toBe('Abonat · +40 de credite');
    expect(referralStateLabel('over_cap', null)).toBe('Abonat · fără recompensă (limită atinsă)');
    expect(referralStateLabel('not_rewarded_disabled', null)).toBe('Abonat · fără recompensă (recomandările erau oprite)');
  });
});

describe('guarded loading', () => {
  const failing = {
    rpc: async () => ({ data: null, error: { message: 'function does not exist' } }),
    from: () => { throw new Error('boom'); },
  } as unknown as SupabaseClient;

  it('gives no access source (not "trial") and no details when the queries fail', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(await loadAccessSource(failing, 'u1', '2027-04-01T00:00:00Z', NOW)).toBeUndefined();
      expect(await loadReferralDetails(failing, 'u1')).toBeNull();
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('computes the source from the latest ledger entries when the query works', async () => {
    const rows = [{ id: 2, kind: 'referral_reward', months: 3, until_before: null, until_after: '2027-04-01T00:00:00Z', reason: null, created_at: '2026-11-02T00:00:00Z' }];
    const q: Record<string, unknown> = {};
    q.select = () => q; q.eq = () => q; q.order = () => q;
    q.limit = (n: number) => { expect(n).toBe(50); return Promise.resolve({ data: rows, error: null }); };
    const ok = { from: () => q } as unknown as SupabaseClient;
    expect(await loadAccessSource(ok, 'u1', '2027-04-01T00:00:00Z', NOW)).toEqual({ kind: 'referral_reward', at: '2026-11-02T00:00:00Z' });
  });
});
