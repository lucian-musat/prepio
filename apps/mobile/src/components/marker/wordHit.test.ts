import { wordAt, type WordBox } from './wordHit';

// Two lines of 24 px: words 0-2 on the first (with a gap between 1 and 2), 3-4 on the second, 4 px apart.
const boxes: WordBox[] = [
  { i: 0, x: 0, y: 0, width: 40, height: 24 },
  { i: 1, x: 40, y: 0, width: 30, height: 24 },
  { i: 2, x: 90, y: 0, width: 50, height: 24 },
  { i: 3, x: 0, y: 28, width: 60, height: 24 },
  { i: 4, x: 60, y: 28, width: 20, height: 24 },
];

it('a point inside a box returns that word', () => {
  expect(wordAt(boxes, 10, 10)).toBe(0);
  expect(wordAt(boxes, 45, 23)).toBe(1);
  expect(wordAt(boxes, 70, 30)).toBe(4);
});

it('a point in the gap between two words on one line returns the nearest', () => {
  expect(wordAt(boxes, 74, 10)).toBe(1);
  expect(wordAt(boxes, 86, 10)).toBe(2);
});

it('a point beyond the end of a line returns the last word of that line', () => {
  expect(wordAt(boxes, 300, 10)).toBe(2);
  expect(wordAt(boxes, 300, 40)).toBe(4);
});

it('a point before the start of a line returns its first word', () => {
  expect(wordAt(boxes, -20, 40)).toBe(3);
});

it('a point between two lines picks the nearer line', () => {
  expect(wordAt(boxes, 10, 25)).toBe(0);
  expect(wordAt(boxes, 10, 27.5)).toBe(3);
});

it('a point above the first line or below the last returns null', () => {
  expect(wordAt(boxes, 10, -1)).toBeNull();
  expect(wordAt(boxes, 10, 53)).toBeNull();
});

it('no boxes (not laid out yet) returns null', () => {
  expect(wordAt([], 0, 0)).toBeNull();
});
