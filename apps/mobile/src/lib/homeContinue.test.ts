import { applyOverrides, resetTexts } from '../texts/store';
import type { LessonSummary } from '@prepio/shared';
import { continueTarget, lockedReason, resumeLabel } from './homeContinue';
import type { LessonState } from './lessonFlow';
import type { LessonPosition } from './progress';

const lesson = (id: string, position: number): LessonSummary => ({ id, nodeId: 'n', title: `Lecția ${id}`, position });
const order = [lesson('a', 1), lesson('b', 2), lesson('c', 3)];
const states = (...s: LessonState[]) => new Map(order.map((l, i) => [l.id, s[i]]));
const progress = (finished: string[] = [], positions: Record<string, LessonPosition> = {}) => ({
  finished: new Set(finished),
  positions: new Map(Object.entries(positions)),
});
const cards = (index: number): LessonPosition => ({ phase: 'cards', index, results: {} });
const questions = (index: number): LessonPosition => ({ phase: 'questions', index, results: {} });

describe('resumeLabel', () => {
  it('names the card or the question the student left on', () => {
    expect(resumeLabel(cards(3))).toBe('Ai rămas la cardul 4');
    expect(resumeLabel(questions(2))).toBe('Ai rămas la întrebarea 3 din verificare');
  });

  it('is null without a position', () => {
    expect(resumeLabel(null)).toBeNull();
  });
});

describe('continueTarget', () => {
  it('a new student starts the first lesson', () => {
    expect(continueTarget(order, states('current', 'locked', 'locked'), progress())).toEqual({
      lesson: order[0],
      kind: 'first',
      where: null,
    });
  });

  it('resumes the lesson with a saved position', () => {
    expect(continueTarget(order, states('finished', 'current', 'locked'), progress(['a'], { b: cards(3) }))).toEqual({
      lesson: order[1],
      kind: 'resume',
      where: 'Ai rămas la cardul 4',
    });
  });

  it('free mode resumes a saved lesson even when an earlier one is open', () => {
    expect(continueTarget(order, states('open', 'open', 'open'), progress([], { c: questions(0) }))).toMatchObject({
      lesson: order[2],
      kind: 'resume',
    });
  });

  it('offers the next lesson after a finished one', () => {
    expect(continueTarget(order, states('finished', 'current', 'locked'), progress(['a']))).toEqual({
      lesson: order[1],
      kind: 'next',
      where: null,
    });
  });

  it('skips lessons the plan does not include', () => {
    expect(continueTarget(order, states('finished', 'paywall', 'paywall'), progress(['a']))).toBeNull();
  });

  it('is null when every lesson is finished', () => {
    expect(continueTarget(order, states('finished', 'finished', 'finished'), progress(['a', 'b', 'c']))).toBeNull();
  });
});

describe('lockedReason', () => {
  it('guided: the lesson opens after the one before it', () => {
    expect(lockedReason('locked', 3)).toBe('Se deschide după lecția 2');
  });

  it('a lesson outside the plan needs full access', () => {
    expect(lockedReason('paywall', 2)).toBe('Disponibilă cu acces complet');
  });

  it('nothing for an openable lesson', () => {
    expect(lockedReason('open', 2)).toBeNull();
    expect(lockedReason('current', 1)).toBeNull();
    expect(lockedReason('finished', 1)).toBeNull();
  });
});

describe('texts from the catalog', () => {
  afterEach(() => resetTexts());

  it('resumeLabel and lockedReason use the overrides', () => {
    applyOverrides({ 'home.continue.whereQuestion': '[q {n}]', 'home.locked.paywall': '[paywall]' });
    expect(resumeLabel(questions(2))).toBe('[q 3]');
    expect(lockedReason('paywall', 2)).toBe('[paywall]');
  });
});
