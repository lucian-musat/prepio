import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REMINDER,
  bucharestDay,
  parseStreak,
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
  });
});

describe('planReminders', () => {
  const now = new Date(2026, 10, 13, 10, 0);

  it('plans 7 evenings starting today when not done', () => {
    const r = planReminders(now, DEFAULT_REMINDER, base);
    expect(r).toHaveLength(7);
    expect(r[0]?.at).toEqual(new Date(2026, 10, 13, 19, 0));
    expect(r[0]?.title).toBe('🔥 Seria ta de 5 zile te așteaptă');
    expect(r[0]?.body).toBe(ALIVE_BODY);
    expect(r[1]?.at).toEqual(new Date(2026, 10, 14, 19, 0));
    expect(r[1]?.title).toBe(NEW_SERIES);
    expect(r[1]?.body).toBe('Rezolvă un exercițiu azi.');
  });

  it('skips today when already done', () => {
    const r = planReminders(now, DEFAULT_REMINDER, { ...base, todayDone: true });
    expect(r).toHaveLength(6);
    expect(r[0]?.at).toEqual(new Date(2026, 10, 14, 19, 0));
    expect(r[0]?.title).toBe('🔥 Seria ta de 5 zile te așteaptă');
    expect(r[1]?.title).toBe(NEW_SERIES);
  });

  it('skips today when the time has passed', () => {
    const r = planReminders(new Date(2026, 10, 13, 20, 0), DEFAULT_REMINDER, base);
    expect(r[0]?.at).toEqual(new Date(2026, 10, 14, 19, 0));
    expect(r).toHaveLength(6);
    expect(r[0]?.title).toBe(NEW_SERIES);
  });

  it('uses the new-series text when there is no streak', () => {
    const r = planReminders(now, DEFAULT_REMINDER, { ...base, current: 0 });
    expect(r).toHaveLength(7);
    for (const p of r) {
      expect(p.title).toBe(NEW_SERIES);
      expect(p.body).toBe('Rezolvă un exercițiu azi.');
    }
  });

  it('uses singular for a 1-day streak', () => {
    const r = planReminders(now, DEFAULT_REMINDER, { ...base, current: 1 });
    expect(r[0]?.title).toBe('🔥 Seria ta de 1 zi te așteaptă');
  });
});
