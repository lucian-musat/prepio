import type { Lesson, LessonSummary } from '@prepio/shared';
import { attemptOutcome, lessonAccess, orderedLessons, resumePoint } from './lessonFlow';

const summary = (id: string): LessonSummary => ({ id, nodeId: 'n', title: id, position: 0 }) as LessonSummary;
const ids = (n: number) => Array.from({ length: n }, (_, i) => `q${i + 1}`);
const lesson = (cards: number, questions: number, exercises: number): Lesson =>
  ({
    cards: Array.from({ length: cards }, (_, i) => ({ id: `c${i + 1}` })),
    questions: ids(questions).map((id) => ({ id })),
    exercises: Array.from({ length: exercises }, (_, i) => ({ id: `e${i + 1}` })),
  }) as unknown as Lesson;

describe('orderedLessons', () => {
  it('keeps section order, then lesson order', () => {
    const sections = [
      { path: ['A'], lessons: [summary('1'), summary('2')] },
      { path: ['B'], lessons: [summary('3')] },
    ];
    expect(orderedLessons(sections).map((l) => l.id)).toEqual(['1', '2', '3']);
  });
});

describe('lessonAccess', () => {
  const order = ['1', '2', '3', '4', '5'].map(summary);
  const states = (m: Map<string, string>) => order.map((l) => m.get(l.id));

  it('guided: first unfinished is current, later unfinished are locked', () => {
    expect(states(lessonAccess(order, new Set(['1', '4']), 'guided'))).toEqual([
      'finished', 'current', 'locked', 'finished', 'locked',
    ]);
  });
  it('free: unfinished lessons are open', () => {
    expect(states(lessonAccess(order, new Set(['1', '4']), 'free'))).toEqual([
      'finished', 'open', 'open', 'finished', 'open',
    ]);
  });
  it('guided with everything finished has no current lesson', () => {
    const all = lessonAccess(order, new Set(['1', '2', '3', '4', '5']), 'guided');
    expect([...all.values()].every((s) => s === 'finished')).toBe(true);
  });
  it('guided with nothing finished makes the first lesson current', () => {
    expect(states(lessonAccess(order, new Set(), 'guided'))).toEqual([
      'current', 'locked', 'locked', 'locked', 'locked',
    ]);
  });
});

describe('attemptOutcome', () => {
  const l = lesson(1, 5, 1);
  const all = Object.fromEntries(ids(5).map((id) => [id, true]));

  it('counts wrong answers in lesson order', () => {
    expect(attemptOutcome(l, { ...all, q2: false, q4: false })).toEqual({
      passed: false, correct: 3, total: 5, wrong: [2, 4],
    });
  });
  it('passes when every question is correct', () => {
    expect(attemptOutcome(l, all)).toEqual({ passed: true, correct: 5, total: 5, wrong: [] });
  });
  it('counts an unanswered question as wrong', () => {
    const { q5: _omit, ...rest } = all;
    const out = attemptOutcome(l, rest);
    expect(out.passed).toBe(false);
    expect(out.wrong).toContain(5);
  });
  it('passes a lesson without questions', () => {
    expect(attemptOutcome(lesson(2, 0, 1), {})).toEqual({ passed: true, correct: 0, total: 0, wrong: [] });
  });
});

describe('resumePoint', () => {
  it('is null without a position', () => {
    expect(resumePoint(lesson(2, 2, 1), null)).toBeNull();
  });
  it('is null when the card index is past the end', () => {
    expect(resumePoint(lesson(2, 2, 1), { phase: 'cards', index: 3, results: {} })).toBeNull();
  });
  it('keeps a valid cards position', () => {
    const p = { phase: 'cards' as const, index: 1, results: {} };
    expect(resumePoint(lesson(2, 2, 1), p)).toEqual(p);
  });
  it('moves to the first unanswered question at or after the index', () => {
    const results = { q1: true, q2: false };
    expect(resumePoint(lesson(1, 4, 1), { phase: 'questions', index: 1, results })).toEqual({
      phase: 'questions', index: 2, results,
    });
  });
  it('goes to the first exercise when all questions are answered', () => {
    const results = { q1: true, q2: true };
    expect(resumePoint(lesson(1, 2, 1), { phase: 'questions', index: 0, results })).toEqual({
      phase: 'exercises', index: 0, results,
    });
  });
  it('stays on the last question, results kept, when all are answered and there are no exercises', () => {
    const results = { q1: true, q2: true };
    expect(resumePoint(lesson(1, 2, 0), { phase: 'questions', index: 0, results })).toEqual({
      phase: 'questions', index: 1, results,
    });
  });
  it('is null when the exercise index is past the end', () => {
    expect(resumePoint(lesson(1, 2, 1), { phase: 'exercises', index: 5, results: {} })).toBeNull();
  });
  it('is null when the phase has no items', () => {
    expect(resumePoint(lesson(1, 0, 1), { phase: 'questions', index: 0, results: {} })).toBeNull();
  });
});
