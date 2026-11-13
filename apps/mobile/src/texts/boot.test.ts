import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import { TEXTS } from '@prepio/shared';
import { bootTexts, fetchTextOverrides } from './boot';
import { readTextCache, TEXT_CACHE_KEY, writeTextCache } from './cache';
import { resetTexts, t } from './store';

const DEFAULT = TEXTS['home.hero.welcome'].default;

type Rows = { key: string; value: string }[];

/** A stub client whose `from('ui_texts').select()` resolves with `rows` after `delayMs` (never, when null). */
function stubClient(opts: { rows?: Rows; delayMs?: number | null; error?: boolean }) {
  const select = jest.fn(
    () =>
      new Promise((resolve) => {
        if (opts.delayMs === null) return;
        const result = opts.error ? { data: null, error: { message: 'boom' } } : { data: opts.rows ?? [], error: null };
        if (!opts.delayMs) resolve(result);
        else setTimeout(() => resolve(result), opts.delayMs);
      }),
  );
  const from = jest.fn(() => ({ select }));
  return { client: { from } as unknown as SupabaseClient, from, select };
}

/** Lets pending promise chains (AsyncStorage mock, then-callbacks) settle. */
async function flush() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

beforeEach(async () => {
  jest.useFakeTimers();
  resetTexts();
  await AsyncStorage.clear();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('fetchTextOverrides selects key and value from ui_texts', async () => {
  const { client, from, select } = stubClient({ rows: [{ key: 'home.hero.welcome', value: 'Salut' }] });
  await expect(fetchTextOverrides(client)).resolves.toEqual({ 'home.hero.welcome': 'Salut' });
  expect(from).toHaveBeenCalledWith('ui_texts');
  expect(select).toHaveBeenCalledWith('key,value');
});

it('(a) uses the cache without waiting for the network', async () => {
  await writeTextCache({ 'home.hero.welcome': 'Din cache' });
  const { client } = stubClient({ delayMs: null });
  await expect(bootTexts({ client })).resolves.toBe('cache');
  expect(t('home.hero.welcome')).toBe('Din cache');
});

it('(b) a fresh fetch after a cache hit only updates the cache', async () => {
  await writeTextCache({ 'home.hero.welcome': 'Vechi' });
  const { client } = stubClient({ rows: [{ key: 'home.hero.welcome', value: 'Nou' }], delayMs: 100 });
  await expect(bootTexts({ client })).resolves.toBe('cache');
  await jest.advanceTimersByTimeAsync(100);
  await flush();
  expect(t('home.hero.welcome')).toBe('Vechi');
  await expect(readTextCache()).resolves.toEqual({ 'home.hero.welcome': 'Nou' });
});

it('(c) without a cache, a fast network result is applied and cached', async () => {
  const { client } = stubClient({ rows: [{ key: 'home.hero.welcome', value: 'Din rețea' }], delayMs: 200 });
  const boot = bootTexts({ client });
  await jest.advanceTimersByTimeAsync(200);
  await expect(boot).resolves.toBe('network');
  expect(t('home.hero.welcome')).toBe('Din rețea');
  await expect(readTextCache()).resolves.toEqual({ 'home.hero.welcome': 'Din rețea' });
});

it('(d) without a cache, a stalled network gives the defaults at 1500 ms', async () => {
  const { client } = stubClient({ delayMs: null });
  let result: string | undefined;
  void bootTexts({ client }).then((r) => (result = r));
  await jest.advanceTimersByTimeAsync(1499);
  expect(result).toBeUndefined();
  await jest.advanceTimersByTimeAsync(1);
  expect(result).toBe('defaults');
  expect(t('home.hero.welcome')).toBe(DEFAULT);
});

it('(e) a slow network gives the defaults at 1500 ms and still writes the cache later', async () => {
  const { client } = stubClient({ rows: [{ key: 'home.hero.welcome', value: 'Târziu' }], delayMs: 3000 });
  const boot = bootTexts({ client });
  await jest.advanceTimersByTimeAsync(1500);
  await expect(boot).resolves.toBe('defaults');
  await expect(readTextCache()).resolves.toBeNull();
  await jest.advanceTimersByTimeAsync(1500);
  await flush();
  expect(t('home.hero.welcome')).toBe(DEFAULT);
  await expect(readTextCache()).resolves.toEqual({ 'home.hero.welcome': 'Târziu' });
});

it('(f) a failing cache read never rejects', async () => {
  jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));
  const { client } = stubClient({ rows: [{ key: 'home.hero.welcome', value: 'Din rețea' }] });
  const boot = bootTexts({ client });
  await jest.advanceTimersByTimeAsync(1500);
  await expect(boot).resolves.toMatch(/^(network|defaults)$/);
});

it('(g) invalid cached JSON is treated as no cache', async () => {
  await AsyncStorage.setItem(TEXT_CACHE_KEY, '{oops');
  await expect(readTextCache()).resolves.toBeNull();
  const { client } = stubClient({ delayMs: null });
  const boot = bootTexts({ client });
  await jest.advanceTimersByTimeAsync(1500);
  await expect(boot).resolves.toBe('defaults');
});

it('(h) a fetch error gives the defaults and leaves the cache untouched', async () => {
  const { client } = stubClient({ error: true });
  const boot = bootTexts({ client });
  await jest.advanceTimersByTimeAsync(0);
  await expect(boot).resolves.toBe('defaults');
  await jest.advanceTimersByTimeAsync(3000);
  await flush();
  await expect(AsyncStorage.getItem(TEXT_CACHE_KEY)).resolves.toBeNull();
});

it('a cache hit whose background fetch fails keeps the cache and does not throw', async () => {
  await writeTextCache({ 'home.hero.welcome': 'Din cache' });
  const { client } = stubClient({ error: true });
  await expect(bootTexts({ client })).resolves.toBe('cache');
  await flush();
  await expect(readTextCache()).resolves.toEqual({ 'home.hero.welcome': 'Din cache' });
});

it('writeTextCache stores { rows, savedAt } and swallows write failures', async () => {
  await writeTextCache({ 'home.hero.welcome': 'X' });
  const raw = JSON.parse((await AsyncStorage.getItem(TEXT_CACHE_KEY))!);
  expect(raw.rows).toEqual({ 'home.hero.welcome': 'X' });
  expect(typeof raw.savedAt).toBe('string');
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('full'));
  await expect(writeTextCache({})).resolves.toBeUndefined();
});
