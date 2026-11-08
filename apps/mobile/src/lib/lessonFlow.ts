import type { Lesson, LessonSummary } from '@prepio/shared';
import type { HomeData } from './content';
import type { LearningMode } from './learningMode';
import type { LessonPosition } from './progress';

/** All lessons flattened in tree (section) order, then lesson order. */
export const orderedLessons = (sections: HomeData['sections']): LessonSummary[] =>
  sections.flatMap((s) => s.lessons);

export type LessonState = 'finished' | 'current' | 'open' | 'locked' | 'paywall';

/**
 * Guided: only the first unfinished lesson is playable; free: every unfinished lesson is open.
 * A lesson the plan does not include (`canOpen` false) is `paywall`, finished or not (the caller keeps the
 * finished mark from its progress); the guided / free rules apply among the lessons that can be opened.
 */
export function lessonAccess(
  order: LessonSummary[],
  finished: Set<string>,
  mode: LearningMode,
  canOpen: (lessonId: string) => boolean,
): Map<string, LessonState> {
  const access = new Map<string, LessonState>();
  let currentTaken = false;
  for (const lesson of order) {
    if (!canOpen(lesson.id)) {
      access.set(lesson.id, 'paywall');
    } else if (finished.has(lesson.id)) {
      access.set(lesson.id, 'finished');
    } else if (mode === 'free') {
      access.set(lesson.id, 'open');
    } else if (!currentTaken) {
      currentTaken = true;
      access.set(lesson.id, 'current');
    } else {
      access.set(lesson.id, 'locked');
    }
  }
  return access;
}

/** `wrong` holds 1-based question numbers in lesson order. */
export type AttemptOutcome = { passed: boolean; correct: number; total: number; wrong: number[] };

export function attemptOutcome(lesson: Lesson, results: Record<string, boolean>): AttemptOutcome {
  // Only the questions are graded.
  const wrong: number[] = [];
  lesson.questions.forEach((q, i) => {
    if (results[q.id] !== true) wrong.push(i + 1); // unanswered counts as wrong
  });
  const total = lesson.questions.length;
  return { passed: wrong.length === 0, correct: total - wrong.length, total, wrong };
}

/** Where to resume a saved position; null when it no longer fits the lesson (start over). */
export function resumePoint(lesson: Lesson, position: LessonPosition | null): LessonPosition | null {
  if (!position) return null;
  const { phase, index, results } = position;
  if (phase === 'questions') {
    if (lesson.questions.length === 0) return null;
    for (let i = index; i < lesson.questions.length; i++) {
      if (!(lesson.questions[i].id in results)) return { phase, index: i, results };
    }
    // Every question answered: stay on the last question with the results kept, so
    // leaving before its „Continuă” doesn't throw the attempt away (re-answering it finishes the lesson).
    return { phase, index: lesson.questions.length - 1, results };
  }
  if (phase === 'cards') return index < lesson.cards.length ? position : null;
  return null; // a position saved in a phase that no longer exists (the old exercises phase)
}
