import { describe, expect, it } from 'vitest';
import { TEXTS, TEXT_GROUP_LABELS, isTextKey } from './index';
import { textVars } from './format';
import type { TextEntry } from './types';

const entries = Object.entries(TEXTS) as [string, TextEntry][];

describe('text catalog', () => {
  it('has entries', () => {
    expect(entries.length).toBeGreaterThan(0);
  });
  it.each(entries)('%s is well formed', (key, entry) => {
    expect(entry.default.trim()).not.toBe('');
    expect([...textVars(entry.default)].sort()).toEqual([...(entry.vars ?? [])].sort());
    expect(TEXT_GROUP_LABELS[entry.group]).toBeTruthy();
    expect(key).toMatch(/^[a-z][a-zA-Z0-9]*(\.[a-z0-9][a-zA-Z0-9]*)+$/);
    expect(entry.group).toBe(key.split('.')[0]);
  });
  it('isTextKey recognises catalog keys only', () => {
    expect(isTextKey('home.hero.welcome')).toBe(true);
    expect(isTextKey('toString')).toBe(false);
    expect(isTextKey('nope.nope')).toBe(false);
  });
});
