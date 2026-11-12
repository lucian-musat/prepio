import { describe, expect, it } from 'vitest';
import { fixRomanianDiacritics } from './diacritics';

describe('fixRomanianDiacritics', () => {
  it('turns cedilla s and t into comma-below, both cases', () => {
    expect(fixRomanianDiacritics('menţionat şi Ţara Ştefan')).toBe('menționat și Țara Ștefan');
    expect(fixRomanianDiacritics('ş.a.')).toBe('ș.a.');
  });

  it('leaves everything else alone', () => {
    expect(fixRomanianDiacritics('café — „x” ăâî ȘȚșț 1859!')).toBe('café — „x” ăâî ȘȚșț 1859!');
    expect(fixRomanianDiacritics('')).toBe('');
  });
});
