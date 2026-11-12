import { Platform } from 'react-native';

/**
 * The address a sign-in code was sent to, carried from the email screen to the code screen without putting it in
 * the URL (where it would land in the browser history and in server logs). On web it also survives a reload of the
 * code page through sessionStorage, which is cleared when the tab closes.
 */
const KEY = 'prepio.pendingEmail';
let memory = '';

type SessionLike = { getItem(k: string): string | null; setItem(k: string, v: string): void };
const session = (): SessionLike | null =>
  Platform.OS === 'web' ? ((globalThis as unknown as { sessionStorage?: SessionLike }).sessionStorage ?? null) : null;

export function setPendingEmail(email: string): void {
  memory = email;
  try {
    session()?.setItem(KEY, email);
  } catch {
    // Blocked storage: memory still carries it within this page load.
  }
}

export function getPendingEmail(): string {
  if (memory) return memory;
  try {
    return session()?.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}
