import AsyncStorage from '@react-native-async-storage/async-storage';
import { acceptTerms, clearConsent, getStoredConsent, storeConsent, TERMS_CONSENT_KEY } from './termsConsent';
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

  it('stores the version and reads it back', async () => {
    await storeConsent(TERMS_VERSION);
    await expect(getStoredConsent()).resolves.toBe(TERMS_VERSION);
    expect(await AsyncStorage.getItem(TERMS_CONSENT_KEY)).toBe(TERMS_VERSION);
  });

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

  it('throws when the RPC answers with an error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'terms_version_mismatch' } });
    await expect(acceptTerms()).rejects.toMatchObject({ message: 'terms_version_mismatch' });
  });
});
