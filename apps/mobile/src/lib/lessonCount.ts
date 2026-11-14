import { tPlural } from '../texts/store';

/** "{n} lecții", the nouns from the texts (Romanian plural rules of the shared `plural`). */
export const lessonCount = (n: number): string => tPlural(n, 'lesson.count.one', 'lesson.count.many');
