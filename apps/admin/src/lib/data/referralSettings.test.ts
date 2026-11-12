import { describe, expect, it } from 'vitest';
import { UserError } from './db';
import { monthsText, validateReferralSettings } from './referralSettings';

const ok = { enabled: true, threshold: 5, creditsPerInvitee: 40, maxRewarded: 100 };

describe('validateReferralSettings', () => {
  it('accepts a valid input unchanged', () => {
    expect(validateReferralSettings(ok)).toEqual(ok);
  });

  it.each([1, 100])('accepts threshold %i', (threshold) => {
    expect(validateReferralSettings({ ...ok, threshold }).threshold).toBe(threshold);
  });
  it.each([0, 101, 2.5, NaN])('rejects threshold %s', (threshold) => {
    expect(() => validateReferralSettings({ ...ok, threshold })).toThrow(UserError);
  });

  it.each([0, 10000])('accepts credits %i', (creditsPerInvitee) => {
    expect(validateReferralSettings({ ...ok, creditsPerInvitee }).creditsPerInvitee).toBe(creditsPerInvitee);
  });
  it.each([-1, 10001, 1.5, NaN])('rejects credits %s', (creditsPerInvitee) => {
    expect(() => validateReferralSettings({ ...ok, creditsPerInvitee })).toThrow(UserError);
  });

  it.each([1, 10000])('accepts max %i', (maxRewarded) => {
    expect(validateReferralSettings({ ...ok, maxRewarded }).maxRewarded).toBe(maxRewarded);
  });
  it.each([0, 10001, 1.5, NaN])('rejects max %s', (maxRewarded) => {
    expect(() => validateReferralSettings({ ...ok, maxRewarded })).toThrow(UserError);
  });
});

describe('monthsText', () => {
  it('uses Romanian plurals', () => {
    expect([1, 3, 12, 20].map(monthsText)).toEqual(['o lună', '3 luni', '12 luni', '20 de luni']);
  });
});
