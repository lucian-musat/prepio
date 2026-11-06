import { describe, expect, it } from 'vitest';
import { levenshtein, matchGroups, matchVariants, normalizeAnswer, parseCentury } from './normalize';

describe('normalizeAnswer', () => {
  it('strips diacritics, punctuation, case and extra spaces', () => {
    expect(normalizeAnswer('  Țara  Românească! ')).toBe('tara romaneasca');
    expect(normalizeAnswer('Ţara Româneasca')).toBe('tara romaneasca');
  });
});

describe('parseCentury', () => {
  it.each(['XIV', '14', 'al XIV-lea', 'secolul al XIV-lea', 'sec. XIV', 'Secolul 14'])('parses %s', (s) => {
    expect(parseCentury(s)).toBe(14);
  });
  it('returns null for non-centuries', () => {
    expect(parseCentury('Moldova')).toBeNull();
    expect(parseCentury('XIV și XV')).toBeNull();
    expect(parseCentury('IIII')).toBeNull();
    expect(parseCentury('VX')).toBeNull();
    expect(parseCentury('22')).toBeNull();
    expect(parseCentury('0')).toBeNull();
  });
});

describe('levenshtein', () => {
  it('computes edit distance', () => {
    expect(levenshtein('abc', 'abc')).toBe(0);
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('', 'ab')).toBe(2);
  });
});

describe('matchVariants', () => {
  it('matches exact ignoring case and diacritics', () => {
    expect(matchVariants('statutul dezvoltator', ['Statutul Dezvoltător'])).toEqual({
      kind: 'exact',
      accepted: 'Statutul Dezvoltător',
    });
  });
  it('tolerates a typo in long answers', () => {
    expect(matchVariants('Statutul Dezvoltatr', ['Statutul Dezvoltător'])).toEqual({
      kind: 'typo',
      accepted: 'Statutul Dezvoltător',
    });
  });
  it('does not tolerate digit or Roman answers', () => {
    expect(matchVariants('XV', ['XIV']).kind).toBe('none');
    expect(matchVariants('1859', ['1858']).kind).toBe('none');
  });
  it.each([
    ['secolul al XIV-lea', 'secolul al XV-lea'],
    ['al XIV-lea', 'al XV-lea'],
    ['Carol II', 'Carol I'],
    ['Napoleon II', 'Napoleon III'],
    ['Carol I', 'Carol II'],
    ['Regulamentele Organice 1831', 'Regulamentele Organice 1832'],
  ])('does not treat %s vs accepted %s as a typo', (answer, accepted) => {
    expect(matchVariants(answer, [accepted]).kind).toBe('none');
  });
  it('allows two edits for answers of 16+ characters, one below', () => {
    expect(matchVariants('Statutul Dezvoltar', ['Statutul Dezvoltător']).kind).toBe('typo');
    expect(matchVariants('Statutul Dezvolar', ['Statutul Dezvoltător']).kind).toBe('none');
    expect(matchVariants('Secularizarr', ['Secularizarea']).kind).toBe('none');
    expect(matchVariants('Secularizare', ['Secularizarea']).kind).toBe('typo');
  });
  it('matches centuries in different forms', () => {
    expect(matchVariants('secolul al XIV-lea', ['XIV']).kind).toBe('exact');
  });
  it('does not tolerate typos in short answers', () => {
    expect(matchVariants('Carol', ['Cuza']).kind).toBe('none');
    expect(matchVariants('Cuzo', ['Cuza']).kind).toBe('none');
  });
  it('returns the configured mistake first', () => {
    expect(
      matchVariants('Constituția din 1866', ['Statutul Dezvoltător'], [{ answer: 'Constituția din 1866', message: 'M' }]),
    ).toEqual({ kind: 'mistake', message: 'M' });
  });
  it('returns none for empty answers', () => {
    expect(matchVariants('', ['Cuza']).kind).toBe('none');
  });
});

describe('matchGroups', () => {
  const groups = [
    { id: 'g1', variants: ['Moldova'] },
    { id: 'g2', variants: ['Țara Românească', 'Muntenia', 'Valahia'] },
  ];
  it('flags a second answer for the same group as duplicate', () => {
    expect(matchGroups(['Muntenia', 'Valahia'], groups)).toEqual([
      { groupId: 'g2', duplicate: false },
      { groupId: 'g2', duplicate: true },
    ]);
  });
  it('assigns a typo to its group', () => {
    expect(matchGroups(['Tara Romaneasa', 'Moldva', 'Mldva'], groups)).toEqual([
      { groupId: 'g2', duplicate: false },
      { groupId: 'g1', duplicate: false },
      { groupId: null, duplicate: false },
    ]);
  });
  it('does not match neighbouring Roman numerals or centuries as typos', () => {
    const rulers = [
      { id: 'c1', variants: ['Carol I'] },
      { id: 'n3', variants: ['Napoleon III'] },
      { id: 's15', variants: ['secolul al XV-lea'] },
      { id: 'a15', variants: ['al XV-lea'] },
    ];
    expect(matchGroups(['Carol II', 'Napoleon II', 'secolul al XIV-lea', 'al XIV-lea'], rulers)).toEqual([
      { groupId: null, duplicate: false },
      { groupId: null, duplicate: false },
      { groupId: null, duplicate: false },
      { groupId: null, duplicate: false },
    ]);
    expect(matchGroups(['Carol I', 'al XV-lea'], rulers).map((r) => r.groupId)).toEqual(['c1', 's15']);
  });
  it('gives null for empty or unmatched answers', () => {
    expect(matchGroups(['', 'Moldova'], groups)).toEqual([
      { groupId: null, duplicate: false },
      { groupId: 'g1', duplicate: false },
    ]);
  });
});
