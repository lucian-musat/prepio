import { plural } from './plural';

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

export function streakToast(current: number): string {
  if (current <= 1) return '🔥 Ai început o serie nouă! Ne vedem mâine.';
  return `🔥 Seria continuă: ${plural(current, 'zi', 'zile')}! Ne vedem mâine.`;
}

export type ReminderTime = { hour: number; minute: number };
export const DEFAULT_REMINDER: ReminderTime = { hour: 19, minute: 0 };
export type PlannedReminder = { at: Date; title: string; body: string };

/** Local evening reminders for the next `days` calendar days (starting today). */
export function planReminders(
  now: Date,
  time: ReminderTime,
  s: StreakSummary,
  days = 7,
): PlannedReminder[] {
  const today = bucharestDay(now);
  const lastWorked = s.todayDone ? today : s.current > 0 ? addDays(today, -1) : null;
  const out: PlannedReminder[] = [];
  for (let i = 0; i < days; i++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, time.hour, time.minute);
    if (at.getTime() <= now.getTime()) continue;
    const day = bucharestDay(at);
    if (day === today && s.todayDone) continue;
    const alive = lastWorked !== null && addDays(day, -1) === lastWorked;
    out.push(
      alive
        ? {
            at,
            title: `🔥 Seria ta de ${plural(s.current, 'zi', 'zile')} te așteaptă`,
            body: 'Un exercițiu de 2 minute e de ajuns ca s-o păstrezi.',
          }
        : { at, title: 'Hai să începem o serie nouă 🔥', body: 'Rezolvă un exercițiu azi.' },
    );
  }
  return out;
}
