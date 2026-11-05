/** Lower-case, diacritics stripped, every non-alphanumeric run collapsed to one space. */
export function normalizeAnswer(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const ROMAN_VALUES: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
const ROMAN_SHAPE = /^m{0,3}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/;

function toCanonicalRoman(n: number): string {
  const table: Array<[number, string]> = [[10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  let out = '';
  for (const [v, sym] of table) {
    while (n >= v) {
      out += sym;
      n -= v;
    }
  }
  return out;
}

/** Value of a Roman numeral token, only when it is the canonical form of 1..21. */
function romanCentury(token: string): number | null {
  if (!/^[ivx]+$/.test(token)) return null;
  let total = 0;
  for (let i = 0; i < token.length; i++) {
    const v = ROMAN_VALUES[token[i]!]!;
    total += i + 1 < token.length && v < ROMAN_VALUES[token[i + 1]!]! ? -v : v;
  }
  return total >= 1 && total <= 21 && toCanonicalRoman(total) === token ? total : null;
}

const CENTURY_NOISE = new Set(['secolul', 'sec', 'al', 'lea']);

/** Century number (1..21) from "XIV", "14", "al XIV-lea", "secolul al XIV-lea", "sec. XIV"; otherwise null. */
export function parseCentury(s: string): number | null {
  const tokens = normalizeAnswer(s)
    .split(' ')
    .filter((t) => t && !CENTURY_NOISE.has(t));
  if (tokens.length !== 1) return null;
  const t = tokens[0] ?? '';
  if (/^\d+$/.test(t)) {
    const n = Number(t);
    return n >= 1 && n <= 21 ? n : null;
  }
  return romanCentury(t);
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length]!;
}

export type VariantMatch =
  | { kind: 'exact' | 'typo'; accepted: string }
  | { kind: 'mistake'; message: string }
  | { kind: 'none' };

function sameAnswer(normAnswer: string, answer: string, accepted: string): boolean {
  if (normAnswer === normalizeAnswer(accepted)) return true;
  const c = parseCentury(answer);
  return c !== null && c === parseCentury(accepted);
}

/** Typos are tolerated only for long, digit-free, non-Roman accepted answers. */
function typoAllowed(normAccepted: string): boolean {
  if (normAccepted.replace(/ /g, '').length < 5) return false;
  if (/\d/.test(normAccepted)) return false;
  if (!normAccepted.includes(' ') && normAccepted !== '' && ROMAN_SHAPE.test(normAccepted)) return false;
  return true;
}

export function matchVariants(
  answer: string,
  accepted: string[],
  mistakes: { answer: string; message: string }[] = [],
): VariantMatch {
  const norm = normalizeAnswer(answer);
  if (!norm) return { kind: 'none' };
  for (const m of mistakes) {
    if (sameAnswer(norm, answer, m.answer)) return { kind: 'mistake', message: m.message };
  }
  for (const a of accepted) {
    if (sameAnswer(norm, answer, a)) return { kind: 'exact', accepted: a };
  }
  for (const a of accepted) {
    const na = normalizeAnswer(a);
    if (!typoAllowed(na)) continue;
    if (levenshtein(norm, na) <= Math.max(1, Math.floor(na.length / 8))) return { kind: 'typo', accepted: a };
  }
  return { kind: 'none' };
}

/** Assigns each answer to the group it matches; a repeat hit on an already-claimed group is a duplicate. */
export function matchGroups(
  answers: string[],
  groups: { id: string; variants: string[] }[],
): Array<{ groupId: string | null; duplicate: boolean }> {
  const claimed = new Set<string>();
  return answers.map((answer) => {
    let groupId: string | null = null;
    let typoId: string | null = null;
    for (const g of groups) {
      const m = matchVariants(answer, g.variants);
      if (m.kind === 'exact') {
        groupId = g.id;
        break;
      }
      if (m.kind === 'typo' && typoId === null) typoId = g.id;
    }
    groupId ??= typoId;
    if (groupId === null) return { groupId: null, duplicate: false };
    const duplicate = claimed.has(groupId);
    claimed.add(groupId);
    return { groupId, duplicate };
  });
}
