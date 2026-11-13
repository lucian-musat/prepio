import { formatText, isTextKey, plural, TEXTS, validateTextValue, type TextEntry, type TextKey } from '@prepio/shared';

/**
 * The admin overrides in force for this session. Filled once at start-up (useTextsBoot), before the first screen
 * renders, and never changed while the app runs: a newer set only reaches the device cache, for the next start.
 */
let overrides: Partial<Record<TextKey, string>> = {};

/** Replaces the overrides; keeps only catalog keys whose value passes the catalog rules (else the default stays). */
export function applyOverrides(rows: Record<string, string>): void {
  const next: Partial<Record<TextKey, string>> = {};
  for (const [key, value] of Object.entries(rows)) {
    if (!isTextKey(key) || typeof value !== 'string') continue;
    const entry: TextEntry = TEXTS[key]; // widened: an entry without `vars`/`optional` is not a weak-type match
    if (validateTextValue(entry, value) === null) next[key] = value;
  }
  overrides = next;
}

/** For tests: back to the catalog defaults. */
export function resetTexts(): void {
  overrides = {};
}

/** The text for `key` (the override, else the default) with its `{name}` variables filled in. */
export function t(key: TextKey, vars?: Record<string, string | number>): string {
  const override = overrides[key];
  // A blank override of an optional key hides the text (never an invisible paragraph).
  if (override !== undefined && (TEXTS[key] as TextEntry).optional && override.trim() === '') return '';
  return formatText(override ?? TEXTS[key].default, vars);
}

/** A Romanian count with the singular / plural nouns taken from the texts. */
export function tPlural(n: number, oneKey: TextKey, manyKey: TextKey): string {
  return plural(n, t(oneKey), t(manyKey));
}
