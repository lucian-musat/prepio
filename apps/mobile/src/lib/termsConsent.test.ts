import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  acceptTerms,
  clearConsent,
  CONSENT_TTL_MS,
  getStoredConsent,
  isTermsVersionMismatch,
  storeConsent,
  TermsAcceptError,
  TERMS_CONSENT_KEY,
} from './termsConsent';
import { getSupabase } from './supabase';
import { TERMS_VERSION } from './legal';

jest.mock('./supabase', () => ({ getSupabase: jest.fn() }));

const rpc = jest.fn();

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  (getSupabase as jest.Mock).mockReturnValue({ rpc });
});

describe('stored consent', () => {
  it('is null when nothing was stored', async () => {
    await expect(getStoredConsent()).resolves.toBeNull();
  });

  it('stores the version with the time it was given and reads it back', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    await storeConsent(TERMS_VERSION);
    expect(JSON.parse((await AsyncStorage.getItem(TERMS_CONSENT_KEY))!)).toEqual({ version: TERMS_VERSION, at: 1_000_000 });
    now.mockReturnValue(1_000_000 + CONSENT_TTL_MS);
    await expect(getStoredConsent()).resolves.toBe(TERMS_VERSION);
    now.mockRestore();
  });

  it('a consent older than 15 minutes is ignored and removed', async () => {
    expect(CONSENT_TTL_MS).toBe(15 * 60_000);
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    await storeConsent(TERMS_VERSION);
    now.mockReturnValue(1_000_000 + CONSENT_TTL_MS + 1);
    await expect(getStoredConsent()).resolves.toBeNull();
    expect(await AsyncStorage.getItem(TERMS_CONSENT_KEY)).toBeNull();
    now.mockRestore();
  });

  it('a consent dated in the future is ignored and removed', async () => {
    await AsyncStorage.setItem(TERMS_CONSENT_KEY, JSON.stringify({ version: TERMS_VERSION, at: Date.now() + 60_000 }));
    await expect(getStoredConsent()).resolves.toBeNull();
    expect(await AsyncStorage.getItem(TERMS_CONSENT_KEY)).toBeNull();
  });

  it.each([TERMS_VERSION, 'not json', '{}', '{"version":"2026-11-10"}', '{"version":1,"at":1}', 'null'])(
    'a malformed value (%s) is ignored and removed',
    async (raw) => {
      await AsyncStorage.setItem(TERMS_CONSENT_KEY, raw);
      await expect(getStoredConsent()).resolves.toBeNull();
      expect(await AsyncStorage.getItem(TERMS_CONSENT_KEY)).toBeNull();
    },
  );

  it('clearConsent forgets it', async () => {
    await storeConsent(TERMS_VERSION);
    await clearConsent();
    await expect(getStoredConsent()).resolves.toBeNull();
  });

  it('a failing storage reads as no consent and never throws', async () => {
    const get = jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('blocked'));
    const set = jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('blocked'));
    const remove = jest.spyOn(AsyncStorage, 'removeItem').mockRejectedValueOnce(new Error('blocked'));
    await expect(getStoredConsent()).resolves.toBeNull();
    await expect(storeConsent(TERMS_VERSION)).resolves.toBeUndefined();
    await expect(clearConsent()).resolves.toBeUndefined();
    get.mockRestore();
    set.mockRestore();
    remove.mockRestore();
  });
});

describe('acceptTerms', () => {
  it('calls accept_terms with the current version', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await acceptTerms();
    expect(rpc).toHaveBeenCalledWith('accept_terms', { p_version: TERMS_VERSION });
  });

  it('a version mismatch throws a TermsAcceptError with the code', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'terms_version_mismatch' } });
    const err = await acceptTerms().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TermsAcceptError);
    expect(err).toMatchObject({ code: 'terms_version_mismatch', message: 'terms_version_mismatch' });
    expect(isTermsVersionMismatch(err)).toBe(true);
  });

  it('any other error is thrown as it is and is not a mismatch', async () => {
    const other = { code: '08006', message: 'connection failure' };
    rpc.mockResolvedValue({ data: null, error: other });
    const err = await acceptTerms().catch((e: unknown) => e);
    expect(err).toBe(other);
    expect(isTermsVersionMismatch(err)).toBe(false);
    expect(isTermsVersionMismatch(new Error('terms_version_mismatch'))).toBe(false);
  });
});
