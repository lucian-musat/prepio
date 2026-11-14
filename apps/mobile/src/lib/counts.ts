import { tPlural } from '../texts/store';

/** „1 credit”, „2 credite”, „20 de credite”: the nouns from the texts. */
export const creditCount = (n: number): string => tPlural(n, 'credits.count.one', 'credits.count.many');

/** „1 zi”, „5 zile”, „20 de zile”. */
export const dayCount = (n: number): string => tPlural(n, 'streak.day.one', 'streak.day.many');

/** „1 lună”, „3 luni”. */
export const monthCount = (n: number): string => tPlural(n, 'access.month.one', 'access.month.many');

/** „1 coleg”, „3 colegi”. */
export const colleagueCount = (n: number): string => tPlural(n, 'invite.colleague.one', 'invite.colleague.many');
