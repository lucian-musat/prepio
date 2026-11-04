import { countLabel, lessonCount } from './lessonCount';

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

it.each([
  [1, '1 card'],
  [2, '2 carduri'],
  [20, '20 de carduri'],
])('countLabel %i → %s', (n, label) => {
  expect(countLabel(n, 'card', 'carduri')).toBe(label);
});
