import type { ConsolidationExercise, ExerciseAnswer, ExerciseFeedback, FeedbackItem, Verdict } from '@prepio/shared';
import type { MarkerConfig, MarkerMark } from '../../components/marker/markerReducer';

const filled = (s: string | undefined) => !!s && s.trim() !== '';

/** The empty answer an exercise opens with (a run always starts from empty inputs). */
export function emptyAnswer(ex: ConsolidationExercise): ExerciseAnswer {
  switch (ex.type) {
    case 'short_answer':
      return { type: ex.type, text: '' };
    case 'multi_answer':
      return { type: ex.type, texts: Array.from({ length: ex.count }, () => '') };
    case 'source_info':
      return { type: ex.type, marks: [] };
    case 'source_letter':
      return { type: ex.type, letter: null };
    case 'cause_effect':
      return { type: ex.type, cause: null, effect: null };
    case 'facts':
      return { type: ex.type, texts: Array.from({ length: ex.count }, () => '') };
    case 'comparison':
      return { type: ex.type, text: '' };
    case 'viewpoint':
      return { type: ex.type, text: '', marks: [] };
    case 'argument':
      return { type: ex.type, text: '' };
    case 'essay':
      return { type: ex.type, parts: Object.fromEntries(ex.requirements.map((r) => [r.id, ''])) };
  }
}

/** „Verifică” is enabled only for a complete answer: every field written, the required marks set. */
export function isComplete(ex: ConsolidationExercise, a: ExerciseAnswer): boolean {
  if (a.type !== ex.type) return false;
  switch (a.type) {
    case 'short_answer':
    case 'comparison':
    case 'argument':
      return filled(a.text);
    case 'multi_answer':
    case 'facts':
      return a.texts.length > 0 && a.texts.every(filled);
    case 'source_info':
      return a.marks.length >= (ex as Extract<ConsolidationExercise, { type: 'source_info' }>).count;
    case 'source_letter':
      return a.letter !== null;
    case 'cause_effect':
      return !!a.cause && !!a.effect;
    case 'viewpoint':
      return filled(a.text) && a.marks.length >= (ex as Extract<ConsolidationExercise, { type: 'viewpoint' }>).count;
    case 'essay': {
      const reqs = (ex as Extract<ConsolidationExercise, { type: 'essay' }>).requirements;
      return reqs.length > 0 && reqs.every((r) => filled(a.parts[r.id]));
    }
  }
}

/** The marker the exercise needs: each pen holds at most what the requirement asks for (null: no marking). */
export function markerConfig(ex: ConsolidationExercise): MarkerConfig | null {
  switch (ex.type) {
    case 'source_info':
      return { pens: ['info'], limits: { info: ex.count } };
    case 'viewpoint':
      return { pens: ['support'], limits: { support: ex.count } };
    case 'cause_effect':
      return { pens: ['cause', 'effect'], limits: { cause: 1, effect: 1 }, autoNext: { cause: 'effect' } };
    default:
      return null;
  }
}

/**
 * True when the deterministic check already found an input problem (an empty, too short or repeated field):
 * that is shown at once and the AI isn't asked. A viewpoint mark the check rejected isn't such a problem: the
 * AI still judges the point of view (the mark is reported as it is).
 */
export function aiBlocked(ex: ConsolidationExercise, det: ExerciseFeedback, a: ExerciseAnswer): boolean {
  if (ex.type === 'viewpoint' && a.type === 'viewpoint') return !filled(a.text) || a.marks.length < ex.count;
  return det.items.some((i) => i.verdict === 'no');
}

/** One item: its verdict; several: `ok` / `no` when they all agree, otherwise `almost`. */
export function combineVerdict(items: FeedbackItem[]): Verdict | null {
  if (items.length === 0) return null;
  if (items.every((i) => i.verdict === 'ok')) return 'ok';
  if (items.every((i) => i.verdict === 'no')) return 'no';
  return 'almost';
}

/** `feedback` with `items` added, an item with the same key replaced in place. */
export function mergeItems(feedback: ExerciseFeedback | null, items: FeedbackItem[]): ExerciseFeedback {
  const out = [...(feedback?.items ?? [])];
  for (const it of items) {
    const at = out.findIndex((x) => x.key === it.key);
    if (at >= 0) out[at] = it;
    else out.push(it);
  }
  return { ...(feedback ?? { verdict: null }), items: out };
}

const keyIndex = (key: string) => Number(/-(\d+)$/.exec(key)?.[1] ?? 0);

/**
 * The final feedback of an AI-checked exercise (not the essay): the AI items merged into the deterministic ones.
 * Viewpoint: the AI's `viewpoint` first, then `support-*` (the AI's where it judged them, otherwise the
 * deterministic ones); the support marks take their item's colour. Facts: the AI items in fact order.
 */
export function mergeAiFeedback(ex: ConsolidationExercise, det: ExerciseFeedback, ai: FeedbackItem[]): ExerciseFeedback {
  let items: FeedbackItem[];
  if (ex.type === 'viewpoint') {
    const support = det.items.map((d) => ai.find((x) => x.key === d.key) ?? d);
    items = [...ai.filter((x) => x.key === 'viewpoint'), ...support];
  } else {
    items = mergeItems(det, ai).items;
    if (ex.type === 'facts') items.sort((a, b) => keyIndex(a.key) - keyIndex(b.key));
  }
  const out: ExerciseFeedback = { ...det, items, verdict: combineVerdict(items) };
  if (det.marks) {
    out.marks = det.marks.map((m, i) => ({ ...m, verdict: items.find((x) => x.key === `support-${i}`)?.verdict ?? m.verdict }));
  }
  return out;
}

/** Requirements judged `ok` out of all of them (the essay's progress caption and its chip while it has no verdict). */
export function essayProgress(ex: Extract<ConsolidationExercise, { type: 'essay' }>, feedback: ExerciseFeedback | null) {
  const ok = ex.requirements.filter((r) => feedback?.items.some((i) => i.key === r.id && i.verdict === 'ok')).length;
  return { ok, total: ex.requirements.length };
}

/**
 * Whether a stored answer still fits the exercise, so it can be shown again (coming back to an exercise): the same
 * type, as many fields as asked for, no more marks than the marker holds, a text for every essay requirement.
 */
export function restorable(ex: ConsolidationExercise, a: ExerciseAnswer): boolean {
  if (a.type !== ex.type) return false;
  switch (ex.type) {
    case 'multi_answer':
    case 'facts':
      return 'texts' in a && Array.isArray(a.texts) && a.texts.length === ex.count;
    case 'source_info':
    case 'viewpoint':
      return 'marks' in a && Array.isArray(a.marks) && a.marks.length <= ex.count;
    case 'essay':
      return 'parts' in a && !!a.parts && ex.requirements.every((r) => typeof a.parts[r.id] === 'string');
    default:
      return true;
  }
}

/** A stored answer's marks as the marker holds them (each with its pen), so the source shows them again. */
export function markerMarks(a: ExerciseAnswer): MarkerMark[] {
  switch (a.type) {
    case 'source_info':
      return a.marks.map((m) => ({ ...m, pen: 'info' as const }));
    case 'viewpoint':
      return a.marks.map((m) => ({ ...m, pen: 'support' as const }));
    case 'cause_effect':
      return [
        ...(a.cause ? [{ ...a.cause, pen: 'cause' as const }] : []),
        ...(a.effect ? [{ ...a.effect, pen: 'effect' as const }] : []),
      ];
    default:
      return [];
  }
}
