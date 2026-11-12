import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PENDING_CODE_KEY,
  PENDING_CODE_TTL_MS,
  attachReferralCode,
  clearPendingCode,
  fetchReferralPublicSettings,
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
