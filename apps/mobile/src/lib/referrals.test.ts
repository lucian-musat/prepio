import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PENDING_CODE_KEY,
  PENDING_CODE_TTL_MS,
  attachReferralCode,
  clearPendingCode,
  fetchMyReferrals,
  fetchReferralPublicSettings,
  fetchReferralSummary,
  getPendingCode,
  inviteUrl,
  lookupReferralCode,
  normalizeCode,
  storePendingCode,
} from './referrals';
import { getSupabase } from './supabase';

jest.mock('./supabase', () => ({ getSupabase: jest.fn() }));

const rpc = jest.fn();
beforeEach(async () => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  await AsyncStorage.clear();
  (getSupabase as jest.Mock).mockReturnValue({ rpc });
});

it('normalizes what a person types', () => {
  expect(normalizeCode('ab-cd 2345')).toBe('ABCD2345');
  expect(normalizeCode('  ')).toBe('');
});

it('builds the invite link', () => {
  expect(inviteUrl('ABCD2345')).toBe('https://prepio.ro/invita/ABCD2345');
});

describe('pending code', () => {
  it('round-trips and clears', async () => {
    expect(await getPendingCode()).toBeNull();
    await storePendingCode('ABCD2345');
    expect(await getPendingCode()).toBe('ABCD2345');
    await clearPendingCode();
    expect(await getPendingCode()).toBeNull();
  });

  it('drops a code older than 7 days and a malformed value', async () => {
    await AsyncStorage.setItem(PENDING_CODE_KEY, JSON.stringify({ code: 'ABCD2345', at: Date.now() - PENDING_CODE_TTL_MS - 1000 }));
    expect(await getPendingCode()).toBeNull();
    expect(await AsyncStorage.getItem(PENDING_CODE_KEY)).toBeNull();
    await AsyncStorage.setItem(PENDING_CODE_KEY, 'nope');
    expect(await getPendingCode()).toBeNull();
    expect(await AsyncStorage.getItem(PENDING_CODE_KEY)).toBeNull();
  });

  it('never throws when the storage fails', async () => {
    const boom = new Error('blocked');
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(boom);
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(boom);
    jest.spyOn(AsyncStorage, 'removeItem').mockRejectedValueOnce(boom);
    await expect(storePendingCode('ABCD2345')).resolves.toBeUndefined();
    await expect(getPendingCode()).resolves.toBeNull();
    await expect(clearPendingCode()).resolves.toBeUndefined();
  });
});

describe('RPCs', () => {
  it('lookup maps the row', async () => {
    rpc.mockResolvedValue({ data: [{ valid: true, inviter_first_name: 'Ana' }], error: null });
    expect(await lookupReferralCode('ABCD2345')).toEqual({ valid: true, inviterFirstName: 'Ana' });
    expect(rpc).toHaveBeenCalledWith('referral_lookup', { p_code: 'ABCD2345' });
  });

  it('lookup without a row is invalid; an error throws', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await lookupReferralCode('X')).toEqual({ valid: false, inviterFirstName: null });
    rpc.mockResolvedValue({ data: null, error: new Error('down') });
    await expect(lookupReferralCode('X')).rejects.toThrow('down');
  });

  it('attach returns the server answer and throws on error', async () => {
    rpc.mockResolvedValue({ data: 'attached', error: null });
    expect(await attachReferralCode('ABCD2345')).toBe('attached');
    expect(rpc).toHaveBeenCalledWith('referral_attach', { p_code: 'ABCD2345' });
    rpc.mockResolvedValue({ data: null, error: new Error('down') });
    await expect(attachReferralCode('ABCD2345')).rejects.toThrow('down');
  });

  it('reads the public settings', async () => {
    rpc.mockResolvedValue({
      data: [{ enabled: true, threshold: 3, credits_per_invitee: 50, duration_months: 6, max_rewarded: 10 }],
      error: null,
    });
    expect(await fetchReferralPublicSettings()).toEqual({
      enabled: true,
      threshold: 3,
      creditsPerInvitee: 50,
      durationMonths: 6,
      maxRewarded: 10,
    });
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(fetchReferralPublicSettings()).rejects.toThrow();
  });
});

describe('student reads', () => {
  it('maps the summary row', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          code: 'ABCD2345', enabled: true, threshold: 5, credits_per_invitee: 40, duration_months: 3, has_access: false,
          pending_count: 2, invitee_count: 4, credits_earned: 80, free_periods_earned: 1,
        },
      ],
      error: null,
    });
    expect(await fetchReferralSummary()).toEqual({
      code: 'ABCD2345', enabled: true, threshold: 5, creditsPerInvitee: 40, durationMonths: 3, hasAccess: false,
      pendingCount: 2, inviteeCount: 4, creditsEarned: 80, freePeriodsEarned: 1,
    });
    expect(rpc).toHaveBeenCalledWith('my_referral_summary');
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(fetchReferralSummary()).rejects.toThrow();
    rpc.mockResolvedValue({ data: null, error: new Error('down') });
    await expect(fetchReferralSummary()).rejects.toThrow('down');
  });

  it('maps the invitee rows', async () => {
    rpc.mockResolvedValue({
      data: [
        { id: 'r1', first_name: 'Ana', email: 'a@x.ro', state: 'pending', created_at: 't1', first_paid_at: 't2', reward_credits: null, account_deleted: false },
      ],
      error: null,
    });
    expect(await fetchMyReferrals()).toEqual([
      { id: 'r1', firstName: 'Ana', email: 'a@x.ro', state: 'pending', createdAt: 't1', firstPaidAt: 't2', rewardCredits: 0, accountDeleted: false },
    ]);
    expect(rpc).toHaveBeenCalledWith('my_referrals');
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await fetchMyReferrals()).toEqual([]);
    rpc.mockResolvedValue({ data: null, error: new Error('down') });
    await expect(fetchMyReferrals()).rejects.toThrow('down');
  });
});
