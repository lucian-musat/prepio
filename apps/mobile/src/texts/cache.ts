import AsyncStorage from '@react-native-async-storage/async-storage';

/** Device cache of the admin text overrides (AsyncStorage on native, localStorage on web). */
export const TEXT_CACHE_KEY = 'prepio.uiTexts.v1';

type CachedTexts = { rows: Record<string, string>; savedAt: string };

/** The cached overrides, or null when there are none or they can't be read / parsed. Never throws. */
export async function readTextCache(): Promise<Record<string, string> | null> {
  try {
    const raw = await AsyncStorage.getItem(TEXT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedTexts> | null;
    const rows = parsed?.rows;
    if (!rows || typeof rows !== 'object' || Array.isArray(rows)) return null;
    return rows;
  } catch {
    return null;
  }
}

/** Stores the overrides for the next start. A write failure (storage full, unavailable) is ignored. */
export async function writeTextCache(rows: Record<string, string>): Promise<void> {
  try {
    const value: CachedTexts = { rows, savedAt: new Date().toISOString() };
    await AsyncStorage.setItem(TEXT_CACHE_KEY, JSON.stringify(value));
  } catch {
    // The cache is an optimisation: the app works with the defaults or the network.
  }
}
