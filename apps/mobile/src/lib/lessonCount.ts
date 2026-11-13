import { tPlural } from '../texts/store';

/**
 * "{n} {noun}" with Romanian plural rules: 1 → "1 lecție"; numbers whose last two digits are
 * 00 or 20–99 (from 20 up) take "de" ("20 de lecții", "100 de lecții"); the rest don't ("19 lecții", "101 lecții").
 */
export function countLabel(n: number, one: string, many: string): string {
  if (n === 1) return `1 ${one}`;
  const rest = n % 100;
  return n >= 20 && (rest === 0 || rest >= 20) ? `${n} de ${many}` : `${n} ${many}`;
}

/** "{n} lecții", the nouns from the texts. */
export const lessonCount = (n: number): string => tPlural(n, 'lesson.count.one', 'lesson.count.many');
