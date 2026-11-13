import { TEXTS } from '@prepio/shared';
import { applyOverrides, resetTexts, t, tPlural } from './store';

afterEach(resetTexts);

it('returns the catalog default without overrides', () => {
  expect(t('home.hero.welcome')).toBe(TEXTS['home.hero.welcome'].default);
});

it('returns a valid override', () => {
  applyOverrides({ 'home.hero.welcome': 'Salut' });
  expect(t('home.hero.welcome')).toBe('Salut');
});

it('formats the variables of the default and of an override', () => {
  expect(t('home.hero.welcomeBack', { nume: 'Ana' })).toBe('Bine ai revenit, Ana!');
  applyOverrides({ 'home.hero.welcomeBack': 'Salut din nou, {nume}!' });
  expect(t('home.hero.welcomeBack', { nume: 'Ana' })).toBe('Salut din nou, Ana!');
});

it('falls back to the default when an override misses a declared variable', () => {
  applyOverrides({ 'home.hero.welcomeBack': 'Bine ai revenit!' });
  expect(t('home.hero.welcomeBack', { nume: 'Ana' })).toBe('Bine ai revenit, Ana!');
});

it('ignores unknown keys and non-string values without throwing', () => {
  expect(() =>
    applyOverrides({ 'no.such.key': 'x', 'home.hero.welcome': 42 as unknown as string }),
  ).not.toThrow();
  expect(t('home.hero.welcome')).toBe(TEXTS['home.hero.welcome'].default);
});

it('returns an empty string for an optional key overridden with ""', () => {
  applyOverrides({ 'home.hero.welcome': '' });
  expect(t('home.hero.welcome')).toBe('');
});

it('returns an empty string for an optional key overridden with whitespace only', () => {
  applyOverrides({ 'home.hero.welcome': '   ' });
});

it('falls back to the default for a non-optional key overridden with ""', () => {
  applyOverrides({ 'home.hero.welcomeBack': '' });
  expect(t('home.hero.welcomeBack', { nume: 'Ana' })).toBe('Bine ai revenit, Ana!');
});

it('replaces the previous overrides on each apply', () => {
  applyOverrides({ 'home.hero.welcome': 'Salut' });
  applyOverrides({});
  expect(t('home.hero.welcome')).toBe(TEXTS['home.hero.welcome'].default);
});

it('tPlural combines the two texts with the Romanian count rule', () => {
  applyOverrides({ 'home.hero.welcome': 'lecție' });
  expect(tPlural(1, 'home.hero.welcome', 'home.hero.welcome')).toBe('1 lecție');
});
