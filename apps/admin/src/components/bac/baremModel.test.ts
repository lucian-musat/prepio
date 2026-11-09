import { describe, expect, it } from 'vitest';
import { DEFAULT_ESSAY_STYLE } from '@prepio/shared';
import { baremToDraft, draftToBarem, essayRequirementPoints, formatSteps, parseSteps } from './baremModel';

describe('barem draft', () => {
  it('parses steps: empty = every integer, comma list sorted and unique, anything else invalid', () => {
    expect(parseSteps('')).toBeNull();
    expect(parseSteps('  ')).toBeNull();
    expect(parseSteps('10, 0,7 ,7')).toEqual([0, 7, 10]);
    expect(parseSteps('0, 1.5')).toBeUndefined();
    expect(parseSteps('0, x')).toBeUndefined();
    expect(parseSteps('0,,2')).toBeUndefined();
    expect(formatSteps(null)).toBe('');
    expect(formatSteps([0, 7, 10])).toBe('0, 7, 10');
  });

  it('round-trips a plain barem', () => {
    const b = { text: 'Carol I', points: 2, steps: [0, 2], essay: null };
    expect(draftToBarem(baremToDraft(b), 2, null)).toEqual({ barem: b });
  });

  it('round-trips an essay barem and keeps only the current requirements', () => {
    const b = {
      text: 'General', points: 30, steps: null,
      essay: { requirements: { r1: { text: 'R1', points: 6, steps: [0, 3, 6] }, old: { text: 'X', points: 1, steps: null } }, style: DEFAULT_ESSAY_STYLE },
    };
    const d = baremToDraft(b);
    expect(essayRequirementPoints(d, ['r1'])).toBe(6);
    expect(draftToBarem(d, 30, ['r1'])).toEqual({
      barem: { ...b, essay: { requirements: { r1: { text: 'R1', points: 6, steps: [0, 3, 6] } }, style: DEFAULT_ESSAY_STYLE } },
    });
  });

  it('a new essay starts with the default style and 0 p per requirement', () => {
    const d = baremToDraft(undefined);
    expect(d.style).toEqual(DEFAULT_ESSAY_STYLE);
    expect(draftToBarem(d, 6, ['r1'])).toEqual({
      barem: { text: '', points: 6, steps: null, essay: { requirements: { r1: { text: '', points: 0, steps: null } }, style: DEFAULT_ESSAY_STYLE } },
    });
  });

  it('reports bad steps', () => {
    const d = { ...baremToDraft(undefined), steps: '0, a' };
    expect(draftToBarem(d, 2, null)).toEqual({ error: 'Treptele de punctaj trebuie să fie numere întregi, separate prin virgulă.' });
  });
});
