import type { LessonSummary } from '@prepio/shared';
import type { LessonState } from './lessonFlow';
import type { LessonPosition, Progress } from './progress';

/** Where the student left a lesson, for the Home continue card; null without a saved position. */
export function resumeLabel(position: LessonPosition | null): string | null {
  if (!position) return null;
  return position.phase === 'cards'
    ? `Ai rămas la cardul ${position.index + 1}`
    : `Ai rămas la întrebarea ${position.index + 1} din verificare`;
}

export type ContinueTarget = { lesson: LessonSummary; kind: 'first' | 'resume' | 'next'; where: string | null };

const PLAYABLE: ReadonlySet<LessonState | undefined> = new Set(['current', 'open']);

/**
 * The lesson Home puts first: one with a saved position (resume), else the first playable unfinished lesson
 * („first” when the student has no progress at all, „next” otherwise). Null when nothing is left to play
 * (everything finished, or the rest is outside the plan).
 */
export function continueTarget(order: LessonSummary[], access: Map<string, LessonState>, progress: Progress): ContinueTarget | null {
  const playable = order.filter((l) => PLAYABLE.has(access.get(l.id)));
  const saved = playable.find((l) => progress.positions.has(l.id));
  if (saved) return { lesson: saved, kind: 'resume', where: resumeLabel(progress.positions.get(saved.id) ?? null) };
  const next = playable[0];
  if (!next) return null;
  const fresh = progress.finished.size === 0 && progress.positions.size === 0;
  return { lesson: next, kind: fresh ? 'first' : 'next', where: null };
}

/** Why a lesson on Home can't be opened (`number` is its 1-based place in the Home order); null when it can. */
export function lockedReason(state: LessonState | undefined, number: number): string | null {
  if (state === 'locked') return `Se deschide după lecția ${number - 1}`;
  if (state === 'paywall') return 'Disponibilă cu acces complet';
  return null;
}
