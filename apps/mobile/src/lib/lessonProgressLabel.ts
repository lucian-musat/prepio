import type { ConsolidationSummary } from './consolidation';
import type { LastTest } from './lastTest';
import type { LessonPosition } from './progress';
import { t } from '../texts/store';

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
  if (position?.phase === 'cards') out.learn = t('lesson.progress.card', { n: position.index + 1, total: counts.cards });
  if (position?.phase === 'questions') out.check = t('lesson.progress.question', { n: position.index + 1, total: counts.questions });
  else if (lastTest) out.check = t('lesson.progress.lastTest', { corecte: lastTest.correct, total: lastTest.total });
  if (consolidation && consolidation.done > 0) out.consolidate = t('lesson.progress.consolidation', { corecte: consolidation.correct, total: consolidation.count });
  return out;
}
