/**
 * "{n} lecții" with Romanian plural rules: 1 → "1 lecție"; numbers whose last two digits are
 * 00 or 20–99 (from 20 up) take "de" ("20 de lecții", "100 de lecții"); the rest don't ("19 lecții", "101 lecții").
 */
export function lessonCount(n: number): string {
  if (n === 1) return '1 lecție';
  const rest = n % 100;
  return n >= 20 && (rest === 0 || rest >= 20) ? `${n} de lecții` : `${n} lecții`;
}
