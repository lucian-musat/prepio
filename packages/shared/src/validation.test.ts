import { describe, expect, it } from 'vitest';
import { validateLesson, validateQuestion } from './validation';
import type { Card, Lesson, Question } from './types';

const base = { id: 'q1', position: 0, prompt: 'Care?', difficulty: 'easy' as const, explanation: null };
const opt = (id: string, correct: boolean) => ({ id, text: id.toUpperCase(), correct });

const validSingle: Question = {
  ...base,
  type: 'single_choice',
  options: [opt('a', true), opt('b', false)],
};
const validMulti: Question = {
  ...base,
  type: 'multiple_choice',
  options: [opt('a', true), opt('b', true), opt('c', false)],
};
const validOrder: Question = {
  ...base,
  type: 'chronological_order',
  options: [
    { id: 'x', text: 'X' },
    { id: 'y', text: 'Y' },
  ],
};

describe('validateQuestion', () => {
  it('accepts valid questions', () => {
    expect(validateQuestion(validSingle)).toEqual([]);
    expect(validateQuestion(validMulti)).toEqual([]);
    expect(validateQuestion(validOrder)).toEqual([]);
  });

  it('single_choice needs exactly one correct option', () => {
    expect(validateQuestion({ ...validSingle, options: [opt('a', false), opt('b', false)] })).not.toEqual([]);
    expect(validateQuestion({ ...validSingle, options: [opt('a', true), opt('b', true)] })).not.toEqual([]);
  });

  it('multiple_choice needs >=1 correct and >=2 options', () => {
    expect(validateQuestion({ ...validMulti, options: [opt('a', false), opt('b', false)] })).not.toEqual([]);
    expect(validateQuestion({ ...validMulti, options: [opt('a', true)] })).not.toEqual([]);
  });

  it('chronological_order needs >=2 items', () => {
    expect(validateQuestion({ ...validOrder, options: [{ id: 'x', text: 'X' }] })).not.toEqual([]);
  });

  it('rejects duplicate option ids', () => {
    expect(validateQuestion({ ...validSingle, options: [opt('a', true), opt('a', false)] })).not.toEqual([]);
  });

  it('rejects an empty prompt', () => {
    expect(validateQuestion({ ...validSingle, prompt: '   ' })).not.toEqual([]);
  });

  it('reports messages in Romanian', () => {
    expect(validateQuestion({ ...validSingle, prompt: '' }).join(' ')).toMatch(/Enunțul/);
  });
});

const textCard: Card = { id: 'c1', position: 0, title: null, type: 'text', text: 'Text' };
const lesson: Lesson = {
  id: 'l1',
  nodeId: 'n1',
  title: 'Lecția 1',
  position: 0,
  status: 'draft',
  cards: [textCard],
  questions: [validSingle],
  exercises: [{ id: 'e1', position: 0, prompt: 'Scrie', criteria: 'Criterii' }],
};

describe('validateLesson', () => {
  it('accepts a valid lesson, including a minimal one', () => {
    expect(validateLesson(lesson)).toEqual([]);
    expect(validateLesson({ ...lesson, cards: [], questions: [], exercises: [] })).toEqual([]);
  });

  it('rejects an empty title', () => {
    expect(validateLesson({ ...lesson, title: ' ' })).not.toEqual([]);
  });

  it('rejects empty card bodies', () => {
    expect(validateLesson({ ...lesson, cards: [{ ...textCard, text: '' }] })).not.toEqual([]);
  });

  it('prefixes card errors with the card number', () => {
    const bad = { ...textCard, id: 'c2', text: ' ' };
    expect(validateLesson({ ...lesson, cards: [textCard, bad] })).toContain(
      'Cartonașul 2: Textul nu poate fi gol.',
    );
  });

  it('aggregates question errors', () => {
    const bad = { ...validSingle, prompt: '' };
    const bad2: Question = { ...validSingle, id: 'q2', options: [opt('a', false), opt('b', false)] };
    const errors = validateLesson({ ...lesson, questions: [bad, bad2] });
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects exercises with empty prompt or criteria', () => {
    expect(validateLesson({ ...lesson, exercises: [{ id: 'e', position: 0, prompt: '', criteria: 'c' }] })).not.toEqual([]);
    expect(validateLesson({ ...lesson, exercises: [{ id: 'e', position: 0, prompt: 'p', criteria: ' ' }] })).not.toEqual([]);
  });
});
