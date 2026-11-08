import { describe, expect, it } from 'vitest';
import { accessStatus, extendAccessUntil, formatAccessDate, hasFullAccess } from './index';

const now = new Date('2027-01-10T10:00:00Z');
const plus = (ms: number) => new Date(now.getTime() + ms).toISOString();
const DAY = 24 * 60 * 60 * 1000;

describe('accessStatus', () => {
  it('null is trial', () => expect(accessStatus(null, now)).toEqual({ plan: 'trial' }));
  it('past is expired with that date', () => {
    const s = accessStatus('2027-01-01T00:00:00Z', now);
    expect(s).toEqual({ plan: 'expired', until: new Date('2027-01-01T00:00:00Z') });
  });
  it('equal to now is expired', () => expect(accessStatus(now.toISOString(), now).plan).toBe('expired'));
  it('30 days is full', () => {
    expect(accessStatus(plus(30 * DAY), now)).toMatchObject({ plan: 'full', daysLeft: 30 });
  });
  it('7 days is expiring', () => {
    expect(accessStatus(plus(7 * DAY), now)).toMatchObject({ plan: 'expiring', daysLeft: 7 });
  });
  it('6 days 1 hour is expiring with 7 days left', () => {
    expect(accessStatus(plus(6 * DAY + 3600_000), now)).toMatchObject({ plan: 'expiring', daysLeft: 7 });
  });
  it('7 days 1 ms is full with 8 days left', () => {
    expect(accessStatus(plus(7 * DAY + 1), now)).toMatchObject({ plan: 'full', daysLeft: 8 });
  });
});

describe('hasFullAccess', () => {
  it('is true for full and expiring only', () => {
    expect(hasFullAccess(accessStatus(plus(30 * DAY), now))).toBe(true);
    expect(hasFullAccess(accessStatus(plus(DAY), now))).toBe(true);
    expect(hasFullAccess({ plan: 'trial' })).toBe(false);
    expect(hasFullAccess(accessStatus('2027-01-01T00:00:00Z', now))).toBe(false);
  });
});

describe('extendAccessUntil', () => {
  const before = new Date('2027-01-01T00:00:00Z');
  it('clamps to month end', () => {
    expect(extendAccessUntil('2027-01-31T12:00:00Z', 1, before).toISOString()).toBe('2027-02-28T12:00:00.000Z');
  });
  it('clamps to leap February', () => {
    expect(extendAccessUntil('2028-01-31T12:00:00Z', 1, before).toISOString()).toBe('2028-02-29T12:00:00.000Z');
  });
  it('adds to an active date', () => {
    expect(extendAccessUntil('2027-01-15T08:00:00Z', 3, before).toISOString()).toBe('2027-04-15T08:00:00.000Z');
  });
  it('extends a past date from now', () => {
    const n = new Date('2027-01-31T10:00:00Z');
    expect(extendAccessUntil('2026-01-01T00:00:00Z', 3, n).toISOString()).toBe('2027-04-30T10:00:00.000Z');
  });
  it('extends null from now', () => {
    expect(extendAccessUntil(null, 3, new Date('2027-11-08T09:30:00Z')).toISOString()).toBe('2028-02-08T09:30:00.000Z');
  });
  it('crosses year end', () => {
    expect(extendAccessUntil('2027-11-30T00:00:00Z', 3, before).toISOString()).toBe('2028-02-29T00:00:00.000Z');
  });
});

describe('formatAccessDate', () => {
  it('uses Europe/Bucharest', () => {
    expect(formatAccessDate(new Date('2027-02-07T23:30:00Z'))).toBe('8 februarie 2027');
  });
  it('uses the same day when still the same in Bucharest', () => {
    expect(formatAccessDate(new Date('2027-08-15T12:00:00Z'))).toBe('15 august 2027');
  });
});
