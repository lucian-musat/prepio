import { color, VERDICT_LABELS, type ConsolidationExercise } from '@prepio/shared';
import { VERDICT_TONE } from '../../components/consolidation/verdictTone';
import type { Attempt } from '../../lib/consolidation';
import { essayProgress } from './checking';

export type StatusTone = { fg: string; bg: string; edge: string };

/** Colours of an exercise without a verdict („Nerezolvat”, an essay with no requirement right). */
export const MUTED: StatusTone = { fg: color.textMuted, bg: color.surfaceMuted, edge: color.border };

/**
 * An exercise's state from its latest attempt (end screen chips, exercise map): the verdict; an essay without a combined
 * verdict (not every requirement checked yet) shows „n din N”; no attempt is „Nerezolvat”.
 */
export function exerciseStatus(ex: ConsolidationExercise, attempt: Attempt | undefined): { chip: string; tone: StatusTone } {
  if (attempt?.verdict) return { chip: VERDICT_LABELS[attempt.verdict], tone: VERDICT_TONE[attempt.verdict] };
  if (ex.type === 'essay' && attempt) {
    const { ok, total } = essayProgress(ex, attempt.feedback);
    return { chip: `${ok} din ${total}`, tone: ok === total ? VERDICT_TONE.ok : ok > 0 ? VERDICT_TONE.almost : MUTED };
  }
  return { chip: 'Nerezolvat', tone: MUTED };
}
