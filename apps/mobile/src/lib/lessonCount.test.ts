import { applyOverrides, resetTexts } from '../texts/store';
import { lessonCount } from './lessonCount';

it.each([
  [0, '0 lecții'],
  [1, '1 lecție'],
  [2, '2 lecții'],
  [19, '19 lecții'],
  [20, '20 de lecții'],
  [99, '99 de lecții'],
  [100, '100 de lecții'],
  [101, '101 lecții'],
  [119, '119 lecții'],
  [120, '120 de lecții'],
  [200, '200 de lecții'],
])('%i → %s', (n, label) => {
  expect(lessonCount(n)).toBe(label);
});

it('lessonCount takes its nouns from the catalog, keeping the „de” rule', () => {
  applyOverrides({ 'lesson.count.one': '[one]', 'lesson.count.many': '[many]' });
  try {
    expect(lessonCount(1)).toBe('1 [one]');
    expect(lessonCount(20)).toBe('20 de [many]');
  } finally {
    resetTexts();
  }
});
