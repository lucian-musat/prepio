import type { ConsolidationSummary } from './consolidation';
import type { LastTest } from './lastTest';
import type { LessonPosition } from './progress';

export type ZoneProgress = { learn?: string; check?: string; consolidate?: string };

/**
 * The progress lines of a lesson's start screen: where the student left the cards or the test, the last failed
 * test's score (when no test is in progress), and the consolidation score once an exercise was tried. Empty without
 * progress.
 */
export function describeProgress(
  position: LessonPosition | null,
  lastTest: LastTest | null,
  counts: { cards: number; questions: number },
  consolidation: ConsolidationSummary | null = null,
): ZoneProgress {
  const out: ZoneProgress = {};
  if (position?.phase === 'cards') out.learn = `Ai rămas la cardul ${position.index + 1} din ${counts.cards}`;
  if (position?.phase === 'questions') out.check = `Ai rămas la întrebarea ${position.index + 1} din ${counts.questions}`;
  else if (lastTest) out.check = `Ultima încercare: ${lastTest.correct} din ${lastTest.total} corecte`;
  if (consolidation && consolidation.done > 0) out.consolidate = `${consolidation.correct} din ${consolidation.count} rezolvate corect`;
  return out;
}
