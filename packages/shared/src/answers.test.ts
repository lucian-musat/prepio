import { describe, expect, it } from 'vitest';
import { checkAnswer, shuffleForDisplay } from './answers';
import type { Question } from './types';

const base = { id: 'q', position: 0, prompt: 'P?', difficulty: 'easy' as const, explanation: null };

const single: Question = {
  ...base,
  type: 'single_choice',
  options: [
    { id: 'a', text: 'A', correct: false },
    { id: 'b', text: 'B', correct: true },
    { id: 'c', text: 'C', correct: false },
  ],
};
const multi: Question = {
  ...base,
  type: 'multiple_choice',
  options: [
    { id: 'a', text: 'A', correct: true },
    { id: 'b', text: 'B', correct: true },
    { id: 'c', text: 'C', correct: false },
  ],
};
const order: Question = {
  ...base,
  type: 'chronological_order',
  options: [
    { id: 'x', text: 'X' },
    { id: 'y', text: 'Y' },
    { id: 'z', text: 'Z' },
  ],
};

describe('checkAnswer', () => {
  it('single_choice: only the exact correct id', () => {
    expect(checkAnswer(single, { type: 'single_choice', selected: ['b'] })).toBe(true);
    expect(checkAnswer(single, { type: 'single_choice', selected: ['a'] })).toBe(false);
    expect(checkAnswer(single, { type: 'single_choice', selected: [] })).toBe(false);
    expect(checkAnswer(single, { type: 'single_choice', selected: ['b', 'a'] })).toBe(false);
  });

  it('multiple_choice: exact set, order-independent', () => {
    expect(checkAnswer(multi, { type: 'multiple_choice', selected: ['a', 'b'] })).toBe(true);
    expect(checkAnswer(multi, { type: 'multiple_choice', selected: ['b', 'a'] })).toBe(true);
    expect(checkAnswer(multi, { type: 'multiple_choice', selected: ['a'] })).toBe(false);
    expect(checkAnswer(multi, { type: 'multiple_choice', selected: ['a', 'b', 'c'] })).toBe(false);
    expect(checkAnswer(multi, { type: 'multiple_choice', selected: [] })).toBe(false);
  });

  it('chronological_order: must equal stored order', () => {
    expect(checkAnswer(order, { type: 'chronological_order', order: ['x', 'y', 'z'] })).toBe(true);
    expect(checkAnswer(order, { type: 'chronological_order', order: ['y', 'x', 'z'] })).toBe(false);
    expect(checkAnswer(order, { type: 'chronological_order', order: ['x', 'y'] })).toBe(false);
  });

  it('mismatched answer type is wrong', () => {
    expect(checkAnswer(single, { type: 'multiple_choice', selected: ['b'] })).toBe(false);
    expect(checkAnswer(multi, { type: 'single_choice', selected: ['a'] })).toBe(false);
    expect(checkAnswer(order, { type: 'single_choice', selected: ['x'] })).toBe(false);
    expect(checkAnswer(single, { type: 'chronological_order', order: ['b'] })).toBe(false);
  });
});

describe('shuffleForDisplay', () => {
  const lcg = (seed: number) => () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const rngs: Array<[string, () => number]> = [
    ['zero', () => 0],
    ['almost one', () => 0.999],
    ['lcg 1', lcg(1)],
    ['lcg 42', lcg(42)],
  ];

  for (let n = 2; n <= 6; n++) {
    for (const [name, rng] of rngs) {
      it(`never returns the original order (n=${n}, rng=${name})`, () => {
        const items = Array.from({ length: n }, (_, i) => ({ id: `i${i}` }));
        const original = items.map((i) => i.id);
        // repeat so stateful rngs are exercised across several calls
        for (let k = 0; k < 20; k++) {
          const out = shuffleForDisplay(items, rng).map((i) => i.id);
          expect(out).not.toEqual(original);
          expect([...out].sort()).toEqual([...original].sort());
        }
      });
    }
  }

  it('returns a single item unchanged', () => {
    const items = [{ id: 'only' }];
    expect(shuffleForDisplay(items)).toEqual(items);
  });

  it('does not mutate the input', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const copy = items.map((i) => ({ ...i }));
    shuffleForDisplay(items, () => 0);
    expect(items).toEqual(copy);
  });

  it('with the default rng, two items always come back swapped', () => {
    const items = [{ id: 'a' }, { id: 'b' }];
    for (let k = 0; k < 50; k++) {
      expect(shuffleForDisplay(items).map((i) => i.id)).toEqual(['b', 'a']);
    }
  });
});
