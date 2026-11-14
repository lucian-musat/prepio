import { plural } from './plural';
import { defaultText, type TextFn } from './texts/catalog';

export type StreakSummary = { current: number; record: number; todayDone: boolean; week: string[] };

export function parseStreak(json: unknown): StreakSummary | null {
  if (!json || typeof json !== 'object') return null;
  const j = json as Record<string, unknown>;
  const count = (x: unknown) => typeof x === 'number' && Number.isInteger(x) && x >= 0;
  if (
    !count(j.current) ||
    !count(j.record) ||
    typeof j.today_done !== 'boolean' ||
    !Array.isArray(j.week) ||
    !j.week.every((d) => typeof d === 'string')
  ) {
    return null;
  }
  return { current: j.current as number, record: j.record as number, todayDone: j.today_done, week: j.week as string[] };
}

const dayFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Bucharest',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The calendar day (YYYY-MM-DD) of an instant in Europe/Bucharest. */
export function bucharestDay(d: Date): string {
  const parts = dayFormat.formatToParts(d);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year').padStart(4, '0')}-${part('month').padStart(2, '0')}-${part('day').padStart(2, '0')}`;
}

function parseDay(day: string): Date {
  const [y = 0, m = 1, d = 1] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDays(day: string, n: number): string {
  const d = parseDay(day);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The 7 Monday-Sunday dates containing `today` (YYYY-MM-DD). */
export function weekDays(today: string): string[] {
  const offset = (parseDay(today).getUTCDay() + 6) % 7; // Monday = 0
  const monday = addDays(today, -offset);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/**
 * Brings a summary confirmed on the Bucharest day `asOf` up to `today` (both YYYY-MM-DD) without a server call:
 * a day that has passed is no longer done, and a streak not worked on the day before `today` is gone. The record
 * is unchanged, and the week is emptied when it is no longer the same Monday-Sunday week.
 */
export function normalizeStreak(s: StreakSummary, asOf: string, today: string): StreakSummary {
  if (asOf >= today) return s;
  const week = weekDays(asOf)[0] === weekDays(today)[0] ? s.week : [];
  if (asOf === addDays(today, -1) && s.todayDone) return { ...s, todayDone: false, week };
  return { ...s, current: 0, todayDone: false, week };
}

/** „5 zile”, the nouns from the texts. */
const days = (n: number, text: TextFn) => plural(n, text('streak.day.one'), text('streak.day.many'));

/** The first-exercise-of-the-day message. `text`: the app passes its `t` (admin overrides applied). */
export function streakToast(current: number, text: TextFn = defaultText): string {
  if (current <= 1) return text('streak.toast.first');
  return text('streak.toast.continued', { zile: days(current, text) });
}

export type ReminderTime = { hour: number; minute: number };
export const DEFAULT_REMINDER: ReminderTime = { hour: 19, minute: 0 };
export type PlannedReminder = { at: Date; title: string; body: string };

/** Local evening reminders for the next `count` calendar days (starting today); `text` as in `streakToast`. */
export function planReminders(
  now: Date,
  time: ReminderTime,
  s: StreakSummary,
  count = 7,
  text: TextFn = defaultText,
): PlannedReminder[] {
  const today = bucharestDay(now);
  const lastWorked = s.todayDone ? today : s.current > 0 ? addDays(today, -1) : null;
  const out: PlannedReminder[] = [];
  for (let i = 0; i < count; i++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, time.hour, time.minute);
    if (at.getTime() <= now.getTime()) continue;
    const day = bucharestDay(at);
    if (day === today && s.todayDone) continue;
    const alive = lastWorked !== null && addDays(day, -1) === lastWorked;
    out.push(
      alive
        ? {
            at,
            title: text('notifications.reminder.aliveTitle', { zile: days(s.current, text) }),
            body: text('notifications.reminder.aliveBody'),
          }
        : { at, title: text('notifications.reminder.newTitle'), body: text('notifications.reminder.newBody') },
    );
  }
  return out;
}
