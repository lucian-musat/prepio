import { color, type ConsolidationExercise, type ConsolidationType, type TextKey, type Verdict } from '@prepio/shared';
import { VERDICT_TONE } from '../../components/consolidation/verdictTone';
import type { Attempt } from '../../lib/consolidation';
import { t, tPlural } from '../../texts/store';
import { essayProgress } from './checking';

export type StatusTone = { fg: string; bg: string; edge: string };

/** Colours of an exercise without a verdict („Nerezolvat”, an essay with no requirement right). */
export const MUTED: StatusTone = { fg: color.textMuted, bg: color.surfaceMuted, edge: color.border };

const VERDICT_KEY: Record<Verdict, TextKey> = {
  ok: 'consolidation.verdict.ok',
  almost: 'consolidation.verdict.almost',
  no: 'consolidation.verdict.no',
};

const TYPE_KEY: Record<ConsolidationType, TextKey> = {
  short_answer: 'consolidation.type.shortAnswer',
  multi_answer: 'consolidation.type.multiAnswer',
  source_info: 'consolidation.type.sourceInfo',
  source_letter: 'consolidation.type.sourceLetter',
  cause_effect: 'consolidation.type.causeEffect',
  facts: 'consolidation.type.facts',
  comparison: 'consolidation.type.comparison',
  viewpoint: 'consolidation.type.viewpoint',
  argument: 'consolidation.type.argument',
  essay: 'consolidation.type.essay',
};

/** „Corect” / „Aproape” / „Mai lucrează”. */
export const verdictLabel = (v: Verdict) => t(VERDICT_KEY[v]);

/** The student's name of an exercise type („Răspuns scurt”, …). */
export const typeLabel = (type: ConsolidationType) => t(TYPE_KEY[type]);

/** „3 cerințe” (an essay's requirement count). */
export const requirementCount = (n: number) => tPlural(n, 'consolidation.requirementCount.one', 'consolidation.requirementCount.many');

/**
 * An exercise's state from its latest attempt (end screen chips, exercise map): the verdict; an essay without a combined
 * verdict (not every requirement checked yet) shows „n din N”; no attempt is „Nerezolvat”.
 */
export function exerciseStatus(ex: ConsolidationExercise, attempt: Attempt | undefined): { chip: string; tone: StatusTone } {
  if (attempt?.verdict) return { chip: verdictLabel(attempt.verdict), tone: VERDICT_TONE[attempt.verdict] };
  if (ex.type === 'essay' && attempt) {
    const { ok, total } = essayProgress(ex, attempt.feedback);
    return {
      chip: t('consolidation.status.essayProgress', { corecte: ok, total }),
      tone: ok === total ? VERDICT_TONE.ok : ok > 0 ? VERDICT_TONE.almost : MUTED,
    };
  }
  return { chip: t('consolidation.status.unsolved'), tone: MUTED };
}
