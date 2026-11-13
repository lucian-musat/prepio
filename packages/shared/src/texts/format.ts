import type { TextEntry } from './types';

const TOKEN = /\{([A-Za-z][A-Za-z0-9]*)\}/g;

/** The `{name}` tokens of a text, in order of first appearance, unique. */
export function textVars(s: string): string[] {
  const out: string[] = [];
  for (const m of s.matchAll(TOKEN)) if (!out.includes(m[1]!)) out.push(m[1]!);
  return out;
}

/** Replaces each `{name}` present in `vars`; other tokens are left as is. */
export function formatText(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(TOKEN, (token, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : token,
  );
}

/** `null` when the value is acceptable for the entry, otherwise a Romanian admin message. */
export function validateTextValue(entry: Pick<TextEntry, 'vars' | 'optional'>, value: string): string | null {
  if (!entry.optional && value.trim() === '') return 'Textul nu poate fi gol.';

  if (/[{}]/.test(value.replace(TOKEN, ''))) {
    return 'Acoladele { } nu sunt închise corect. Folosește doar variabile ca {nume}.';
  }

  const declared = entry.vars ?? [];
  const used = textVars(value);
  const missing = declared.filter((v) => !used.includes(v));
  const unknown = used.filter((v) => !declared.includes(v));
  const list = (names: string[]) => names.map((v) => `{${v}}`).join(', ');
  const problems: string[] = [];
  if (missing.length) problems.push(`Lipsește variabila ${list(missing)}.`);
  if (unknown.length) problems.push(`Variabilă necunoscută: ${list(unknown)}.`);
  return problems.length ? problems.join(' ') : null;
}
