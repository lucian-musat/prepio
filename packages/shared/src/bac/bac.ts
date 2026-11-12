import { checkExercise } from '../consolidation/check';
import { AI_TYPES, exerciseFromRow, validateExercise } from '../consolidation/exercises';
import { judgeMark } from '../consolidation/marks';
import { tokenizeSource, type TokenizedSource } from '../consolidation/sourceText';
import type {
  ConsolidationType,
  ExerciseAnswer,
  ExerciseFeedback,
  Source,
  SourceRef,
} from '../consolidation/types';
import type {
  BacAnswers,
  BacBarem,
  BacEssayStyle,
  BacItem,
  BacItemResult,
  BacSection,
  BacStepRule,
} from './types';

export const BAC_TOTAL_POINTS = 90;
/** Total words of the essay (all requirements together) that earn the length point. */
export const BAC_ESSAY_WORDS = { min: 300, max: 900 } as const;
export const DEFAULT_ESSAY_STYLE: BacEssayStyle = { language: 2, structure: 1, order: 2, length: 1 };
export const BAC_GRADE_NOTE = 'Notă orientativă. Un profesor te-ar putea nota diferit.';

const MAX_ITEM_POINTS = 30;
const NOT_FILLED = 'Necompletat.';

/** Every score a rule allows: ascending, unique, always with 0 and `rule.points`. */
export function allowedSteps(rule: BacStepRule): number[] {
  const all = rule.steps === null ? Array.from({ length: Math.max(0, Math.floor(rule.points)) + 1 }, (_, i) => i) : rule.steps;
  const steps = new Set<number>([0, rule.points]);
  for (const s of all) if (Number.isInteger(s) && s >= 0 && s <= rule.points) steps.add(s);
  return [...steps].sort((a, b) => a - b);
}

/** The largest step not above `points`, or 0 (strict: never rounds up). */
export function clampToStep(points: number, steps: number[]): number {
  let best = 0;
  for (const s of steps) if (s <= points && s > best) best = s;
  return best;
}

export function bacGrade(points: number): number {
  return Math.round((10 + points) * 10) / 100;
}

export function formatGrade(g: number): string {
  return g.toFixed(2).replace('.', ',');
}

const blank = (s: string | null | undefined) => !s || s.trim() === '';
const stylePoints = (s: BacEssayStyle) => s.language + s.structure + s.order + s.length;

function stepsInRange(rule: BacStepRule, max: number): boolean {
  return rule.steps === null || rule.steps.every((s) => Number.isInteger(s) && s >= 0 && s <= max);
}

/** Romanian messages; empty array when the item is ready to publish. */
export function validateBacItem(item: BacItem, sources: Source[], barem: BacBarem | null): string[] {
  const errors = [...validateExercise(item, sources, null)];
  if (!Number.isInteger(item.points) || item.points < 1 || item.points > MAX_ITEM_POINTS) {
    errors.push(`Punctajul trebuie să fie între 1 și ${MAX_ITEM_POINTS}.`);
  }
  if (item.templateId === null) errors.push('Alege un „Cum rezolv”.');
  if (!barem || blank(barem.text)) errors.push('Baremul este obligatoriu.');

  const requirements = barem?.essay?.requirements ?? {};
  const badSteps =
    !!barem && (!stepsInRange(barem, item.points) || Object.values(requirements).some((r) => !stepsInRange(r, r.points)));
  if (badSteps) errors.push(`Treptele de punctaj trebuie să fie între 0 și ${item.points}.`);

  if (item.type === 'essay') {
    const sum = item.requirements.reduce((t, r) => t + (requirements[r.id]?.points ?? 0), 0);
    const style = barem?.essay?.style ?? DEFAULT_ESSAY_STYLE;
    const rest = stylePoints(style);
    if (sum + rest !== item.points) {
      errors.push(`Cerințele eseului (${sum} p) și ordonarea ideilor (${rest} p) trebuie să însumeze ${item.points} p.`);
    }
    item.requirements.forEach((r, i) => {
      if (blank(requirements[r.id]?.text)) errors.push(`Baremul cerinței ${i + 1} este obligatoriu.`);
      if ((requirements[r.id]?.points ?? 0) < 1) errors.push(`Cerința ${i + 1} trebuie să aibă cel puțin 1 punct.`);
    });
  }
  return errors;
}

/** `errorsByItem` is keyed by item id (the output of `validateBacItem`). */
export function validateBacSubject(items: BacItem[], errorsByItem: Map<string, string[]>): string[] {
  if (items.length === 0) return ['Subiectul nu are nicio cerință.'];
  const errors: string[] = [];
  const total = items.reduce((t, i) => t + i.points, 0);
  if (total !== BAC_TOTAL_POINTS) errors.push(`Subiectul nu poate fi publicat: totalul este ${total} din ${BAC_TOTAL_POINTS}.`);
  for (const i of items) {
    if ((errorsByItem.get(i.id) ?? []).length > 0) {
      errors.push(`Subiectul nu poate fi publicat: cerința ${i.section}.${i.number} are erori.`);
    }
  }
  return errors;
}

export function wordCount(text: string): number {
  const t = text.trim();
  return t === '' ? 0 : t.split(/\s+/).length;
}

/** The length point: the whole essay's word count is within `BAC_ESSAY_WORDS`. */
export function essayLengthPoints(parts: Record<string, string>, style: BacEssayStyle): number {
  const words = Object.values(parts).reduce((t, p) => t + wordCount(p), 0);
  return words >= BAC_ESSAY_WORDS.min && words <= BAC_ESSAY_WORDS.max ? style.length : 0;
}

export const firstSentence = (s: string): string => {
  const t = s.trim();
  return /^.*?[.!?](?=\s|$)/.exec(t)?.[0] ?? t;
};

/** One short sentence for a student: the first improvement line (else the title) of the check. */
function feedbackLine(fb: ExerciseFeedback): string {
  const withImprove = fb.items.find((i) => i.improve.length > 0);
  return firstSentence(withImprove ? withImprove.improve[0]! : (fb.items[0]?.title ?? ''));
}

const isEmpty = (a: ExerciseAnswer | undefined): boolean => {
  if (!a) return true;
  switch (a.type) {
    case 'short_answer':
      return blank(a.text);
    case 'multi_answer':
      return a.texts.every(blank);
    case 'source_info':
      return a.marks.length === 0;
    case 'source_letter':
      return a.letter === null;
    case 'cause_effect':
      return !a.cause || !a.effect;
    default:
      return true;
  }
};

/**
 * Distinct expected spans that a mark covers while staying within the span's limit (its sentence
 * unless the admin set one) — the same notion as an "ok" mark in consolidation. Extra words inside
 * the limit still count; a mark running past it does not. A repeated mark on one span counts once.
 */
function coveredSpans(item: Extract<BacItem, { type: 'source_info' }>, sources: Source[], fb: ExerciseFeedback): number {
  const tokens = new Map<string, TokenizedSource>();
  const tok = (id: string): TokenizedSource => {
    let t = tokens.get(id);
    if (!t) tokens.set(id, (t = tokenizeSource(sources.find((s) => s.id === id)?.body ?? '')));
    return t;
  };
  const marks = (fb.marks ?? []).filter((m) => m.verdict !== 'no');
  const covers = marks.map((m) =>
    item.spans.flatMap((span, i) => (span.sourceId === m.sourceId && judgeMark(tok(span.sourceId), m, span) === 'ok' ? [i] : [])),
  );
  const owner = new Map<number, number>(); // span index -> mark index
  const augment = (mi: number, seen: Set<number>): boolean => {
    for (const si of covers[mi]!) {
      if (seen.has(si)) continue;
      seen.add(si);
      const holder = owner.get(si);
      if (holder === undefined || augment(holder, seen)) {
        owner.set(si, mi);
        return true;
      }
    }
    return false;
  };
  marks.forEach((_, mi) => augment(mi, new Set()));
  return owner.size;
}

/** Deterministic part of the grading; null for types the AI judges. Strict: no partial credit beyond whole units. */
export function scoreDeterministic(item: BacItem, sources: Source[], answer: ExerciseAnswer | undefined): BacItemResult | null {
  if (AI_TYPES.has(item.type as ConsolidationType)) return null;
  const result = (points: number, feedback: string): BacItemResult => ({
    itemId: item.id,
    section: item.section as BacSection,
    number: item.number,
    points,
    max: item.points,
    feedback,
  });
  if (!answer || answer.type !== item.type || isEmpty(answer)) return result(0, NOT_FILLED);

  const fb = checkExercise(item, sources, answer);
  const unitsScore = (count: number, hits: number) => Math.floor(item.points / Math.max(1, count)) * Math.min(hits, count);
  let points = 0;
  switch (item.type) {
    case 'short_answer':
    case 'source_letter':
      points = fb.verdict === 'ok' ? item.points : 0;
      break;
    case 'multi_answer':
      points = unitsScore(item.count, (fb.fields ?? []).filter((f) => f === 'ok').length);
      break;
    case 'source_info':
      points = unitsScore(item.count, coveredSpans(item, sources, fb));
      break;
    case 'cause_effect':
      points = fb.verdict === 'ok' && !fb.swapped ? item.points : 0;
      break;
  }
  return result(points, points >= item.points ? '' : feedbackLine(fb));
}

export function bacItemFromRow(
  row: {
    id: string;
    section: number;
    position: number;
    type: ConsolidationType;
    prompt: string;
    content: Record<string, unknown>;
    template_id: string | null;
    points: number;
  },
  number: number,
  sources: SourceRef[],
): BacItem {
  // `credit_cost` is not stored on BAC items: exerciseFromRow falls back to the type default.
  const ex = exerciseFromRow(
    { id: row.id, position: row.position, type: row.type, prompt: row.prompt, content: row.content, template_id: row.template_id },
    sources,
  );
  return { ...ex, section: row.section as BacSection, number, points: row.points };
}

/** Keeps only answers for known items whose answer type matches the item type. */
export function sanitizeAnswers(items: BacItem[], answers: BacAnswers): BacAnswers {
  const out: BacAnswers = {};
  for (const item of items) {
    const a = answers[item.id];
    if (a && typeof a === 'object' && a.type === item.type) out[item.id] = a;
  }
  return out;
}
