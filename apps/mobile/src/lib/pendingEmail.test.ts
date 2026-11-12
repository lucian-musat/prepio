import { Platform } from 'react-native';
import { getPendingEmail, setPendingEmail } from './pendingEmail';

const store = new Map<string, string>();
const fakeSession = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
const g = globalThis as unknown as { sessionStorage?: unknown };
const originalOS = Platform.OS;

beforeEach(() => {
  store.clear();
  setPendingEmail('');
});
afterEach(() => {
  Platform.OS = originalOS;
  delete g.sessionStorage;
});

it('keeps the email in memory between the email and the code screen', () => {
  setPendingEmail('ana@example.com');
  expect(getPendingEmail()).toBe('ana@example.com');
});

it('on web, survives a reload of the code page through sessionStorage', () => {
  Platform.OS = 'web';
  g.sessionStorage = fakeSession;
  setPendingEmail('ana@example.com');
  expect(store.get('prepio.pendingEmail')).toBe('ana@example.com');
  jest.isolateModules(() => {
    // A fresh module has an empty memory, as after a reload (and its own react-native instance).
    jest.requireActual<typeof import('react-native')>('react-native').Platform.OS = 'web';
    const fresh = jest.requireActual<typeof import('./pendingEmail')>('./pendingEmail');
    expect(fresh.getPendingEmail()).toBe('ana@example.com');
  });
});

it('returns an empty string when nothing was stored or storage throws', () => {
  Platform.OS = 'web';
  g.sessionStorage = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
  };
  setPendingEmail('ana@example.com');
  expect(getPendingEmail()).toBe('ana@example.com'); // memory still works
  jest.isolateModules(() => {
    jest.requireActual<typeof import('react-native')>('react-native').Platform.OS = 'web';
    const fresh = jest.requireActual<typeof import('./pendingEmail')>('./pendingEmail');
    expect(fresh.getPendingEmail()).toBe('');
  });
});
