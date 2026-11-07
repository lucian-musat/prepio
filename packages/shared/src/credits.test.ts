import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CREDIT_COST,
  MAX_CREDIT_COST,
  MIN_CREDIT_COST,
  checkCost,
  creditsLabel,
  formatLei,
  parseLei,
  pricePerCredit,
  targetKey,
  type ConsolidationExercise,
} from './index';

const base = { id: 'e1', position: 0, prompt: 'P', templateId: null, sources: [], modelAnswer: null, explanation: null };
const ex = (c: object, creditCost?: number) =>
  ({ ...base, ...c, creditCost: creditCost ?? DEFAULT_CREDIT_COST[(c as { type: keyof typeof DEFAULT_CREDIT_COST }).type] }) as unknown as ConsolidationExercise;
const req = (id: string) => ({ id, text: 'T', modelAnswer: null, templateId: null, argument: false });
const essay = (n: number, cost: number) => ex({ type: 'essay', requirements: Array.from({ length: n }, (_, i) => req(`r${i}`)) }, cost);

describe('credit costs', () => {
  it('has the bounds and type defaults', () => {
    expect(MIN_CREDIT_COST).toBe(1);
    expect(MAX_CREDIT_COST).toBe(5);
    expect(DEFAULT_CREDIT_COST).toEqual({
      short_answer: 1, multi_answer: 1, source_info: 1, source_letter: 1, cause_effect: 1,
      facts: 1, comparison: 2, viewpoint: 1, argument: 2, essay: 1,
    });
  });

  it('checkCost uses the default cost of every AI type', () => {
    expect(checkCost(ex({ type: 'facts', count: 2 }), 'exercise')).toBe(1);
    expect(checkCost(ex({ type: 'comparison', variant: 'similarity' }), 'exercise')).toBe(2);
    expect(checkCost(ex({ type: 'viewpoint', count: 1, spans: [] }), 'exercise')).toBe(1);
    expect(checkCost(ex({ type: 'argument' }), 'exercise')).toBe(2);
    expect(checkCost(essay(1, 1), { requirementId: 'r0' })).toBe(1);
  });

  it('checkCost charges one essay requirement its creditCost', () => {
    expect(checkCost(essay(4, 3), { requirementId: 'r2' })).toBe(3);
  });

  it('checkCost is 0 for a non-AI type', () => {
    expect(checkCost(ex({ type: 'short_answer', accepted: ['a'], mistakes: [] }, 3), 'exercise')).toBe(0);
  });

  it('targetKey', () => {
    expect(targetKey('exercise')).toBe('exercise');
    expect(targetKey({ requirementId: 'r1' })).toBe('req:r1');
  });
});

describe('money', () => {
  it('formatLei', () => {
    expect(formatLei(1999)).toBe('19,99 lei');
    expect(formatLei(1000)).toBe('10 lei');
    expect(formatLei(999)).toBe('9,99 lei');
    expect(formatLei(1905)).toBe('19,05 lei');
  });

  it('pricePerCredit', () => {
    expect(pricePerCredit(1999, 50)).toBe('0,40 lei / credit');
    expect(pricePerCredit(999, 20)).toBe('0,50 lei / credit');
  });

  it('parseLei', () => {
    expect(parseLei('19,99')).toBe(1999);
    expect(parseLei('19.99')).toBe(1999);
    expect(parseLei('19')).toBe(1900);
    expect(parseLei(' 9,5 ')).toBe(950);
    expect(parseLei('')).toBeNull();
    expect(parseLei('  ')).toBeNull();
    expect(parseLei('-1')).toBeNull();
    expect(parseLei('1,999')).toBeNull();
    expect(parseLei('abc')).toBeNull();
  });
});

describe('creditsLabel', () => {
  it.each([
    [1, '1 credit'], [2, '2 credite'], [20, '20 de credite'], [105, '105 credite'],
  ])('%i', (n, expected) => expect(creditsLabel(n)).toBe(expected));
});
