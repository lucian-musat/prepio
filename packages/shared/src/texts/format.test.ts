import { describe, expect, it } from 'vitest';
import { formatText, textVars, validateTextValue } from './format';

describe('textVars', () => {
  it('lists unique tokens in order', () => {
    expect(textVars('Bine ai revenit, {nume}! Ai {n} lecții, {nume}')).toEqual(['nume', 'n']);
  });
});

describe('formatText', () => {
  it('replaces declared tokens', () => {
    expect(formatText('Bine ai revenit, {nume}!', { nume: 'Ana' })).toBe('Bine ai revenit, Ana!');
    expect(formatText('{n} din {m}', { n: 3, m: 10 })).toBe('3 din 10');
  });
  it('leaves text without variables and unknown tokens as is', () => {
    expect(formatText('fără variabile')).toBe('fără variabile');
    expect(formatText('Hei {x}', { nume: 'Ana' })).toBe('Hei {x}');
  });
});

describe('validateTextValue', () => {
  const g = { vars: ['nume'] };
  const o = { optional: true };
  it('accepts a valid value', () => {
    expect(validateTextValue(g, 'Hei, {nume}')).toBeNull();
    expect(validateTextValue(o, '')).toBeNull();
  });
  it('reports missing variables', () => {
    expect(validateTextValue(g, 'Hei')).toContain('{nume}');
  });
  it('reports unknown variables', () => {
    expect(validateTextValue(g, 'Hei {nume} {x}')).toContain('{x}');
    const m = validateTextValue(g, 'Hei {Nume}');
    expect(m).toContain('{nume}');
    expect(m).toContain('{Nume}');
  });
  it('reports unbalanced braces', () => {
    expect(validateTextValue(g, 'Hei {nume')).toMatch(/acolade/i);
  });
  it('rejects empty text on a required key', () => {
    expect(validateTextValue(g, '   ')).toBe('Textul nu poate fi gol.');
    expect(validateTextValue({}, '')).toBe('Textul nu poate fi gol.');
  });
});
