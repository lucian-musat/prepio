import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REMINDER,
  bucharestDay,
  parseStreak,
  normalizeStreak,
  planReminders,
  streakToast,
  weekDays,
  type StreakSummary,
} from './streak';

const NEW_SERIES = 'Hai să începem o serie nouă 🔥';
const ALIVE_BODY = 'Un exercițiu de 2 minute e de ajuns ca s-o păstrezi.';
const base: StreakSummary = { current: 5, record: 9, todayDone: false, week: [] };

describe('bucharestDay', () => {
  it('uses Bucharest calendar days in winter and summer', () => {
    expect(bucharestDay(new Date('2026-11-12T21:30:00Z'))).toBe('2026-11-12');
    expect(bucharestDay(new Date('2026-11-12T22:10:00Z'))).toBe('2026-11-13');
    expect(bucharestDay(new Date('2026-07-01T21:30:00Z'))).toBe('2026-07-02');
  });
});

describe('weekDays', () => {
  it('returns Monday-Sunday containing the day', () => {
    expect(weekDays('2026-11-13')).toEqual([
      '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15',
    ]);
    expect(weekDays('2026-11-15')[0]).toBe('2026-11-09');
    expect(weekDays('2026-11-09')[0]).toBe('2026-11-09');
  });
});

describe('streakToast', () => {
  it('differs for day 1 and later days', () => {
    expect(streakToast(1)).toBe('🔥 Ai început o serie nouă! Ne vedem mâine.');
    expect(streakToast(6)).toBe('🔥 Seria continuă: 6 zile! Ne vedem mâine.');
    expect(streakToast(20)).toBe('🔥 Seria continuă: 20 de zile! Ne vedem mâine.');
  });
});

describe('parseStreak', () => {
  it('maps snake_case to camelCase', () => {
    expect(parseStreak({ current: 3, record: 5, today_done: true, week: ['2026-11-13'] })).toEqual({
      current: 3, record: 5, todayDone: true, week: ['2026-11-13'],
    });
  });
  it('returns null on a bad shape', () => {
    expect(parseStreak({})).toBeNull();
    expect(parseStreak(null)).toBeNull();
    expect(parseStreak({ current: 1, record: 1, today_done: 'x', week: [] })).toBeNull();
    expect(parseStreak({ current: NaN, record: 1, today_done: true, week: [] })).toBeNull();
    expect(parseStreak({ current: 1, record: -1, today_done: true, week: [] })).toBeNull();
    expect(parseStreak({ current: 1.5, record: 1, today_done: true, week: [] })).toBeNull();
  });
});

function plusDay(day: string, n: number): string {
  const [y = 0, m = 1, d = 1] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Expected reminders, derived from the Bucharest date of each local trigger instant (any machine TZ). */
function expectedFor(now: Date, s: StreakSummary, days = 7) {
  const today = bucharestDay(now);
  const out: { at: Date; alive: boolean }[] = [];
  for (let i = 0; i < days; i++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, 19, 0);
    if (at.getTime() <= now.getTime()) continue;
    const day = bucharestDay(at);
    if (day === today && s.todayDone) continue;
    // streak alive iff the day before this reminder's Bucharest date was worked
    const alive = s.todayDone ? day === plusDay(today, 1) : s.current > 0 && day === today;
    out.push({ at, alive });
  }
  return out;
}

function expectTexts(r: ReturnType<typeof planReminders>, now: Date, s: StreakSummary) {
  const exp = expectedFor(now, s);
  expect(r.map((p) => p.at)).toEqual(exp.map((e) => e.at));
  r.forEach((p, i) => {
    if (exp[i]?.alive) {
      expect(p.title).toBe(`🔥 Seria ta de ${s.current === 1 ? '1 zi' : `${s.current} zile`} te așteaptă`);
      expect(p.body).toBe(ALIVE_BODY);
    } else {
      expect(p.title).toBe(NEW_SERIES);
      expect(p.body).toBe('Rezolvă un exercițiu azi.');
    }
  });
}

describe('planReminders', () => {
  const now = new Date(2026, 10, 13, 10, 0);

  it('plans evenings at the local hour over a 7-day window, texts per Bucharest date', () => {
    const r = planReminders(now, DEFAULT_REMINDER, base);
    expectTexts(r, now, base);
    expect(r.length).toBeGreaterThanOrEqual(6);
    r.forEach((p) => expect([p.at.getHours(), p.at.getMinutes()]).toEqual([19, 0]));
  });

  it('skips the reminder on the Bucharest date of today when already done', () => {
    const s = { ...base, todayDone: true };
    const r = planReminders(now, DEFAULT_REMINDER, s);
    expectTexts(r, now, s);
    expect(r.some((p) => bucharestDay(p.at) === bucharestDay(now))).toBe(false);
  });

  it('skips today when the time has passed', () => {
    const late = new Date(2026, 10, 13, 20, 0);
    const r = planReminders(late, DEFAULT_REMINDER, base);
    expectTexts(r, late, base);
    expect(r[0]?.at).toEqual(new Date(2026, 10, 14, 19, 0));
  });

  it('uses the new-series text when there is no streak', () => {
    const s = { ...base, current: 0 };
    const r = planReminders(now, DEFAULT_REMINDER, s);
    expect(r.length).toBeGreaterThanOrEqual(6);
    for (const p of r) {
      expect(p.title).toBe(NEW_SERIES);
      expect(p.body).toBe('Rezolvă un exercițiu azi.');
    }
  });

  it('uses singular for a 1-day streak', () => {
    const s = { ...base, current: 1, todayDone: true };
    const r = planReminders(now, DEFAULT_REMINDER, s);
    expectTexts(r, now, s);
    expect(r.some((p) => p.title === '🔥 Seria ta de 1 zi te așteaptă')).toBe(true);
  });

  it('student abroad: rings at the local hour, alive/skip decided by the Bucharest date of the trigger', () => {
    // Fixed instant: 2026-11-13 08:00Z = 10:00 in Bucharest, a different wall clock elsewhere.
    const abroad = new Date('2026-11-13T08:00:00Z');
    const s = { ...base, todayDone: true };
    const r = planReminders(abroad, DEFAULT_REMINDER, s);
    expect(r.length).toBeGreaterThan(0);
    for (const p of r) {
      expect(p.at.getHours()).toBe(19); // local hour, whatever the machine TZ
      expect(p.at.getTime()).toBeGreaterThan(abroad.getTime());
      expect(bucharestDay(p.at)).not.toBe(bucharestDay(abroad)); // today's skipped by Bucharest date
    }
    const first = r[0]!;
    const alive = bucharestDay(first.at) === '2026-11-14';
    expect(first.title).toBe(alive ? '🔥 Seria ta de 5 zile te așteaptă' : NEW_SERIES);
  });
});

describe('normalizeStreak', () => {
  const s = (over: Partial<StreakSummary> = {}): StreakSummary => ({ current: 5, record: 9, todayDone: true, week: ['2026-11-10', '2026-11-11'], ...over });

  it('leaves a summary from today unchanged', () => {
    const x = s();
    expect(normalizeStreak(x, '2026-11-11', '2026-11-11')).toBe(x);
  });

  it('keeps the streak but clears todayDone when it was done yesterday', () => {
    expect(normalizeStreak(s(), '2026-11-11', '2026-11-12')).toEqual(s({ todayDone: false }));
  });

  it('empties the week when today starts a new week (Monday)', () => {
    // 2026-11-15 is a Sunday, 2026-11-16 a Monday
    expect(normalizeStreak(s({ week: ['2026-11-15'] }), '2026-11-15', '2026-11-16')).toEqual(s({ todayDone: false, week: [] }));
  });

  it('drops the streak when yesterday was not worked', () => {
    expect(normalizeStreak(s({ todayDone: false }), '2026-11-11', '2026-11-12')).toEqual(s({ current: 0, todayDone: false }));
  });

  it('drops the streak when the summary is older than yesterday, keeping the record', () => {
    expect(normalizeStreak(s(), '2026-11-09', '2026-11-12')).toEqual(s({ current: 0, todayDone: false }));
    expect(normalizeStreak(s(), '2026-11-09', '2026-11-12').record).toBe(9);
  });

  it('empties the week of an old summary from a previous week', () => {
    expect(normalizeStreak(s(), '2026-11-09', '2026-11-17').week).toEqual([]);
  });
});
