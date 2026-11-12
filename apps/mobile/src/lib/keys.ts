import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useFocused } from './pageTitle';

/** The parts of a DOM KeyboardEvent the lesson shortcuts read. */
export type KeyEventLike = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  target: unknown;
};

const FIELDS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** Typing in a field and browser shortcuts (with a modifier) are never taken over. */
export function ignoresKeys(e: KeyEventLike): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  const t = e.target as { tagName?: string; isContentEditable?: boolean } | null;
  return !!t && (FIELDS.has(String(t.tagName).toUpperCase()) || t.isContentEditable === true);
}

/** Cards: ← previous, → next. */
export function cardKey(e: KeyEventLike): 'next' | 'prev' | null {
  if (ignoresKeys(e)) return null;
  if (e.key === 'ArrowRight') return 'next';
  if (e.key === 'ArrowLeft') return 'prev';
  return null;
}

const LETTERS = 'abcdefghi';

/** Questions: 1–9 or A–I pick option n (of `count`), Enter checks or goes on. */
export function choiceKey(e: KeyEventLike, count: number): { pick: number } | { enter: true } | null {
  if (ignoresKeys(e)) return null;
  if (e.key === 'Enter') return { enter: true };
  const k = e.key.toLowerCase();
  const n = /^[1-9]$/.test(k) ? Number(k) - 1 : LETTERS.indexOf(k);
  return n >= 0 && n < count ? { pick: n } : null;
}

/**
 * Web only: calls `onKey` for keydown while this screen is focused (a stacked screen underneath stays mounted and
 * must not react). The handler may change every render; the listener reads the latest one.
 */
export function useWebKeys(onKey: (e: KeyEventLike & { preventDefault: () => void }) => void) {
  const focused = useFocused();
  const handler = useRef(onKey);
  handler.current = onKey;
  useEffect(() => {
    if (Platform.OS !== 'web' || !focused || typeof window === 'undefined') return;
    // The window seen at subscribe time, so the cleanup never depends on the global still being there.
    const w = window;
    if (typeof w.addEventListener !== 'function') return;
    const listen = (e: KeyboardEvent) => handler.current(e);
    w.addEventListener('keydown', listen);
    return () => w.removeEventListener('keydown', listen);
  }, [focused]);
}
