import type { Lesson, LessonSummary } from '@prepio/shared';
import { attemptOutcome, lessonAccess, orderedLessons, resumePoint } from './lessonFlow';

const summary = (id: string): LessonSummary => ({ id, nodeId: 'n', title: id, position: 0 }) as LessonSummary;
const ids = (n: number) => Array.from({ length: n }, (_, i) => `q${i + 1}`);
const lesson = (cards: number, questions: number): Lesson =>
  ({
    cards: Array.from({ length: cards }, (_, i) => ({ id: `c${i + 1}` })),
    questions: ids(questions).map((id) => ({ id })),
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
  const all = () => true;
  const order = ['1', '2', '3', '4', '5'].map(summary);
  const states = (m: Map<string, string>) => order.map((l) => m.get(l.id));

  it('guided: first unfinished is current, later unfinished are locked', () => {
    expect(states(lessonAccess(order, new Set(['1', '4']), 'guided', all))).toEqual([
      'finished', 'current', 'locked', 'finished', 'locked',
    ]);
  });
  it('free: unfinished lessons are open', () => {
    expect(states(lessonAccess(order, new Set(['1', '4']), 'free', all))).toEqual([
      'finished', 'open', 'open', 'finished', 'open',
    ]);
  });
  it('guided with everything finished has no current lesson', () => {
    const res = lessonAccess(order, new Set(['1', '2', '3', '4', '5']), 'guided', all);
    expect([...res.values()].every((s) => s === 'finished')).toBe(true);
  });
  it('guided with nothing finished makes the first lesson current', () => {
    expect(states(lessonAccess(order, new Set(), 'guided', all))).toEqual([
      'current', 'locked', 'locked', 'locked', 'locked',
    ]);
  });

  describe('with paywall', () => {
    const only = (...ids: string[]) => (id: string) => ids.includes(id);
    it('trial + guided: lesson 1 current, the rest paywall', () => {
      expect(states(lessonAccess(order, new Set(), 'guided', only('1')))).toEqual([
        'current', 'paywall', 'paywall', 'paywall', 'paywall',
      ]);
    });
    it('trial + free: lesson 1 open, the rest paywall', () => {
      expect(states(lessonAccess(order, new Set(), 'free', only('1')))).toEqual([
        'open', 'paywall', 'paywall', 'paywall', 'paywall',
      ]);
    });
    it('trial with the free lesson finished: it stays finished, no current lesson', () => {
      expect(states(lessonAccess(order, new Set(['1']), 'guided', only('1')))).toEqual([
        'finished', 'paywall', 'paywall', 'paywall', 'paywall',
      ]);
    });
    it('expired with lesson 2 finished: lesson 2 is paywall (Home keeps the check from progress)', () => {
      expect(states(lessonAccess(order, new Set(['2']), 'guided', only('1')))).toEqual([
        'current', 'paywall', 'paywall', 'paywall', 'paywall',
      ]);
    });
    it('the free lesson moved to position 2: openness follows canOpen', () => {
      expect(states(lessonAccess(order, new Set(), 'guided', only('2')))).toEqual([
        'paywall', 'current', 'paywall', 'paywall', 'paywall',
      ]);
    });
    it('guided among openable lessons: later openable unfinished are locked', () => {
      expect(states(lessonAccess(order, new Set(), 'guided', only('1', '2')))).toEqual([
        'current', 'locked', 'paywall', 'paywall', 'paywall',
      ]);
    });
  });
});

describe('attemptOutcome', () => {
  const l = lesson(1, 5);
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
    expect(attemptOutcome(lesson(2, 0), {})).toEqual({ passed: true, correct: 0, total: 0, wrong: [] });
  });
});

describe('resumePoint', () => {
  it('is null without a position', () => {
    expect(resumePoint(lesson(2, 2), null)).toBeNull();
  });
  it('is null when the card index is past the end', () => {
    expect(resumePoint(lesson(2, 2), { phase: 'cards', index: 3, results: {} })).toBeNull();
  });
  it('keeps a valid cards position', () => {
    const p = { phase: 'cards' as const, index: 1, results: {} };
    expect(resumePoint(lesson(2, 2), p)).toEqual(p);
  });
  it('moves to the first unanswered question at or after the index', () => {
    const results = { q1: true, q2: false };
    expect(resumePoint(lesson(1, 4), { phase: 'questions', index: 1, results })).toEqual({
      phase: 'questions', index: 2, results,
    });
  });
  it('stays on the last question, results kept, when all are answered', () => {
    const results = { q1: true, q2: true };
    expect(resumePoint(lesson(1, 2), { phase: 'questions', index: 0, results })).toEqual({
      phase: 'questions', index: 1, results,
    });
  });
  it('is null for a saved exercises position (the phase no longer exists)', () => {
    const old = { phase: 'exercises', index: 0, results: {} } as never;
    expect(resumePoint(lesson(1, 2), old)).toBeNull();
  });
  it('is null when the phase has no items', () => {
    expect(resumePoint(lesson(1, 0), { phase: 'questions', index: 0, results: {} })).toBeNull();
  });
});
