import { describe, expect, it } from 'vitest';
import { planLabel, formatDay, formatDayTime, formatRelative, initials } from './format';

describe('student page formatting', () => {
  it('formats a day as d MMM yyyy in Bucharest time', () => {
    expect(formatDay('2026-11-04T10:00:00Z')).toBe('4 nov 2026');
    expect(formatDay('2026-09-30T22:30:00Z')).toBe('1 oct 2026');
  });

  it('formats a timeline date and time', () => {
    expect(formatDayTime('2026-11-06T16:40:00Z')).toBe('6 nov, 18:40');
  });

  it('formats today and yesterday relatively, older as a date', () => {
    const now = new Date('2026-11-06T12:00:00Z');
    expect(formatRelative('2026-11-06T08:12:00Z', now)).toBe('azi 10:12');
    expect(formatRelative('2026-11-05T08:12:00Z', now)).toBe('ieri 10:12');
    expect(formatRelative('2026-11-01T08:12:00Z', now)).toBe('1 nov 2026');
  });

  it('builds initials from a name or an email', () => {
    expect(initials('Madalin Anghel', 'm@x.ro')).toBe('MA');
    expect(initials(null, 'carolina@x.ro')).toBe('C');
    expect(initials('  ', null)).toBe('?');
    expect(initials('[test] Madalin Anghel', null)).toBe('TM');
    expect(initials('Ștefan', null)).toBe('Ș');
  });
});

describe('planLabel', () => {
  const now = new Date('2026-11-08T12:00:00Z');
  it('is Trial without access', () => {
    expect(planLabel(null, now)).toBe('Trial');
  });
  it('names the end date once access has ended', () => {
    expect(planLabel('2026-11-08T12:00:00Z', now)).toBe('Expirat pe 8 noiembrie 2026');
    expect(planLabel('2026-10-01T00:00:00Z', now)).toBe('Expirat pe 1 octombrie 2026');
  });
  it('names the end date while access is active', () => {
    expect(planLabel('2027-02-08T10:00:00Z', now)).toBe('Acces până la 8 februarie 2027');
  });
});
