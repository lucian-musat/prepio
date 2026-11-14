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
  expect(t('home.hero.welcome')).toBe('');
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

it('tPlural takes the singular from the first key and the plural from the second, with the „de” rule', () => {
  applyOverrides({ 'lesson.count.one': '[unu]', 'lesson.count.many': '[multe]' });
  expect(tPlural(1, 'lesson.count.one', 'lesson.count.many')).toBe('1 [unu]');
  expect(tPlural(2, 'lesson.count.one', 'lesson.count.many')).toBe('2 [multe]');
  expect(tPlural(19, 'lesson.count.one', 'lesson.count.many')).toBe('19 [multe]');
  expect(tPlural(20, 'lesson.count.one', 'lesson.count.many')).toBe('20 de [multe]');
  expect(tPlural(101, 'lesson.count.one', 'lesson.count.many')).toBe('101 [multe]');
  expect(tPlural(120, 'lesson.count.one', 'lesson.count.many')).toBe('120 de [multe]');
});

it('tPlural uses the catalog defaults without overrides', () => {
  expect(tPlural(1, 'lesson.count.one', 'lesson.count.many')).toBe(`1 ${TEXTS['lesson.count.one'].default}`);
  expect(tPlural(20, 'lesson.count.one', 'lesson.count.many')).toBe(`20 de ${TEXTS['lesson.count.many'].default}`);
});
