import type { DistributiveOmit } from '../types';
import type {
  AiContext,
  AnswerSpan,
  ConsolidationContent,
  ConsolidationExercise,
  ConsolidationRow,
  ConsolidationType,
  EssayRequirement,
  SolutionTemplate,
  Source,
  SourceLabel,
  SourceRef,
  Verdict,
} from './types';

export const CONSOLIDATION_TYPES: readonly ConsolidationType[] = [
  'short_answer',
  'multi_answer',
  'source_info',
  'source_letter',
  'cause_effect',
  'facts',
  'comparison',
  'viewpoint',
  'argument',
  'essay',
];

export const CONSOLIDATION_TYPE_LABELS: Record<ConsolidationType, string> = {
  short_answer: 'Răspuns scurt',
  multi_answer: 'Răspunsuri multiple',
  source_info: 'Informație din sursă',
  source_letter: 'Litera sursei',
  cause_effect: 'Cauză-efect',
  facts: 'Prezentare fapte',
  comparison: 'Asemănare / deosebire',
  viewpoint: 'Punct de vedere',
  argument: 'Argumentare',
  essay: 'Eseu pe cerințe',
};

/** Types whose answer is (partly) judged by the AI and so need an admin-written context. */
export const AI_TYPES: ReadonlySet<ConsolidationType> = new Set<ConsolidationType>([
  'facts',
  'comparison',
  'viewpoint',
  'argument',
  'essay',
]);

export const MIN_CREDIT_COST = 1;
export const MAX_CREDIT_COST = 5;
/** Credits per check when the admin hasn't set one; the essay's is per requirement. Non-AI types are never charged. */
export const DEFAULT_CREDIT_COST: Record<ConsolidationType, number> = {
  short_answer: 1,
  multi_answer: 1,
  source_info: 1,
  source_letter: 1,
  cause_effect: 1,
  facts: 1,
  comparison: 2,
  viewpoint: 1,
  argument: 2,
  essay: 1,
};

export const VERDICT_LABELS: Record<Verdict, string> = { ok: 'Corect', almost: 'Aproape', no: 'Mai lucrează' };

export function emptyExerciseContent(type: ConsolidationType, newId: () => string): ConsolidationContent {
  switch (type) {
    case 'short_answer':
      return { type, accepted: [], mistakes: [] };
    case 'multi_answer':
      return {
        type,
        count: 2,
        groups: [
          { id: newId(), variants: [] },
          { id: newId(), variants: [] },
        ],
      };
    case 'source_info':
      return { type, count: 1, spans: [] };
    case 'source_letter':
      return { type, correct: 'A', evidence: null };
    case 'cause_effect':
      return { type, pairs: [] };
    case 'facts':
      return { type, count: 2 };
    case 'comparison':
      return { type, variant: 'similarity' };
    case 'viewpoint':
      return { type, count: 2, spans: [] };
    case 'argument':
      return { type };
    case 'essay':
      return {
        type,
        requirements: [{ id: newId(), text: '', modelAnswer: null, templateId: null, argument: false }],
      };
  }
}

// --- Coercion helpers: row content is untrusted JSON, wrong types fall back to defaults. ---

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const arr = (v: unknown): Json[] => (Array.isArray(v) ? v.map((x) => (isObj(x) ? x : {})) : []);
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const label = (v: unknown): SourceLabel => (v === 'B' ? 'B' : 'A');
const isType = (v: unknown): v is ConsolidationType => CONSOLIDATION_TYPES.includes(v as ConsolidationType);

/** Same contract as the card allocator: a stored id is kept unless empty or already used, else `<prefix>-<i>`. */
const idAllocator = () => {
  const used = new Set<string>();
  return (stored: unknown, prefix: string, i: number): string => {
    let candidate = typeof stored === 'string' && stored !== '' && !used.has(stored) ? stored : '';
    if (!candidate) {
      candidate = `${prefix}-${i}`;
      for (let n = 2; used.has(candidate); n++) candidate = `${prefix}-${i}-${n}`;
    }
    used.add(candidate);
    return candidate;
  };
};
type Alloc = ReturnType<typeof idAllocator>;

const span = (v: unknown, alloc: Alloc, prefix: string, i: number): AnswerSpan => {
  const o = isObj(v) ? v : {};
  const ls = numOrNull(o.limitStart);
  const le = numOrNull(o.limitEnd);
  const both = ls !== null && le !== null;
  return {
    id: alloc(o.id, prefix, i),
    sourceId: str(o.sourceId),
    start: num(o.start, 0),
    end: num(o.end, 0),
    text: str(o.text),
    limitStart: both ? ls : null,
    limitEnd: both ? le : null,
  };
};

/** Missing or repeated ids become `group-<i>`, `span-<i>`, `pair-<i>` (`cause-<i>`/`effect-<i>` for pair spans), `req-<i>`. */
export function exerciseFromRow(row: ConsolidationRow, sources: SourceRef[]): ConsolidationExercise {
  const c: Json = isObj(row.content) ? row.content : {};
  const alloc = idAllocator();
  const head = {
    id: row.id,
    position: row.position,
    prompt: row.prompt,
    templateId: row.template_id,
    sources: sources.map((s) => ({ sourceId: s.sourceId, label: s.label })),
    modelAnswer: strOrNull(c.modelAnswer),
    explanation: strOrNull(c.explanation),
    creditCost: num(row.credit_cost, DEFAULT_CREDIT_COST[row.type]),
  };
  switch (row.type) {
    case 'short_answer':
      return {
        ...head,
        type: 'short_answer',
        accepted: strArr(c.accepted),
        mistakes: arr(c.mistakes).map((m) => ({ answer: str(m.answer), message: str(m.message) })),
      };
    case 'multi_answer':
      return {
        ...head,
        type: 'multi_answer',
        count: num(c.count, 2),
        groups: arr(c.groups).map((g, i) => ({ id: alloc(g.id, 'group', i), variants: strArr(g.variants) })),
      };
    case 'source_info':
      return {
        ...head,
        type: 'source_info',
        count: num(c.count, 1),
        spans: arr(c.spans).map((s, i) => span(s, alloc, 'span', i)),
      };
    case 'source_letter':
      return {
        ...head,
        type: 'source_letter',
        correct: label(c.correct),
        evidence: isObj(c.evidence) ? span(c.evidence, alloc, 'evidence', 0) : null,
      };
    case 'cause_effect':
      return {
        ...head,
        type: 'cause_effect',
        pairs: arr(c.pairs).map((p, i) => ({
          id: alloc(p.id, 'pair', i),
          cause: span(p.cause, alloc, 'cause', i),
          effect: span(p.effect, alloc, 'effect', i),
          explanation: strOrNull(p.explanation),
        })),
      };
    case 'facts':
      return { ...head, type: 'facts', count: num(c.count, 2) };
    case 'comparison':
      return { ...head, type: 'comparison', variant: c.variant === 'difference' ? 'difference' : 'similarity' };
    case 'viewpoint':
      return {
        ...head,
        type: 'viewpoint',
        count: num(c.count, 2),
        spans: arr(c.spans).map((s, i) => span(s, alloc, 'span', i)),
      };
    case 'argument':
      return { ...head, type: 'argument' };
    case 'essay':
      return {
        ...head,
        type: 'essay',
        requirements: arr(c.requirements).map(
          (r, i): EssayRequirement => ({
            id: alloc(r.id, 'req', i),
            text: str(r.text),
            modelAnswer: strOrNull(r.modelAnswer),
            templateId: strOrNull(r.templateId),
            argument: r.argument === true,
          }),
        ),
      };
  }
}

/** Inverse of `exerciseFromRow`; `modelAnswer` and `explanation` are stored inside `content`. */
export function exerciseToRow(ex: DistributiveOmit<ConsolidationExercise, 'id' | 'position' | 'sources'>): {
  type: ConsolidationType;
  prompt: string;
  content: Record<string, unknown>;
  template_id: string | null;
  credit_cost: number;
} {
  const { type, prompt, templateId, creditCost, ...content } = ex;
  return { type, prompt, content, template_id: templateId, credit_cost: creditCost };
}

export function sourceFromRow(row: Record<string, unknown>): Source {
  return {
    id: str(row.id),
    position: num(row.position, 0),
    title: strOrNull(row.title),
    author: str(row.author),
    work: str(row.work),
    body: str(row.body),
  };
}

export function templateFromRow(row: Record<string, unknown>): SolutionTemplate {
  return {
    id: str(row.id),
    title: str(row.title),
    exerciseType: isType(row.exercise_type) ? row.exercise_type : null,
    points: str(row.points),
    body: str(row.body),
  };
}

const blank = (s: string | null | undefined) => !s || s.trim() === '';

export function validateTemplate(t: Omit<SolutionTemplate, 'id'>): string[] {
  const errors: string[] = [];
  if (blank(t.title)) errors.push('Titlul șablonului nu poate fi gol.');
  if (blank(t.body)) errors.push('Conținutul șablonului nu poate fi gol.');
  return errors;
}

const SOURCE_COUNTS: Record<ConsolidationType, [number, number]> = {
  short_answer: [0, 2],
  multi_answer: [0, 2],
  source_info: [1, 1],
  source_letter: [2, 2],
  cause_effect: [1, 1],
  facts: [0, 1],
  comparison: [0, 1],
  viewpoint: [1, 1],
  argument: [0, 1],
  essay: [0, 1],
};

function sourceCountMessage(type: ConsolidationType, [min, max]: [number, number]): string {
  if (min === max) return `Exercițiul „${CONSOLIDATION_TYPE_LABELS[type]}” cere exact ${min === 1 ? 'o sursă' : `${min} surse`}.`;
  return `Exercițiul „${CONSOLIDATION_TYPE_LABELS[type]}” poate avea între ${min} și ${max} surse.`;
}

function spansOf(ex: ConsolidationExercise): AnswerSpan[] {
  switch (ex.type) {
    case 'source_info':
    case 'viewpoint':
      return ex.spans;
    case 'source_letter':
      return ex.evidence ? [ex.evidence] : [];
    case 'cause_effect':
      return ex.pairs.flatMap((p) => [p.cause, p.effect]);
    default:
      return [];
  }
}

const countMessage = (n: number, max: number, what: string): string | null =>
  Number.isInteger(n) && n >= 1 && n <= max ? null : `Numărul de ${what} cerute trebuie să fie între 1 și ${max}.`;

/** Romanian messages; empty array when valid. `ai` null (student loader) skips the AI-context rule. */
export function validateExercise(ex: ConsolidationExercise, sources: Source[], ai: AiContext | null): string[] {
  const errors: string[] = [];
  const push = (m: string | null) => {
    if (m) errors.push(m);
  };
  if (blank(ex.prompt)) errors.push('Enunțul nu poate fi gol.');

  const range = SOURCE_COUNTS[ex.type];
  if (ex.sources.length < range[0] || ex.sources.length > range[1]) errors.push(sourceCountMessage(ex.type, range));
  if (ex.sources.length > 2) errors.push('Un exercițiu poate avea cel mult 2 surse.');

  switch (ex.type) {
    case 'short_answer':
      if (!ex.accepted.some((a) => !blank(a))) errors.push('Adaugă cel puțin o variantă acceptată.');
      break;
    case 'multi_answer':
      if (ex.groups.length === 0) errors.push('Adaugă cel puțin un grup de răspunsuri acceptate.');
      else push(countMessage(ex.count, ex.groups.length, 'răspunsuri'));
      ex.groups.forEach((g, i) => {
        if (!g.variants.some((v) => !blank(v))) errors.push(`Grupul ${i + 1} are nevoie de cel puțin o variantă.`);
      });
      break;
    case 'source_info':
    case 'viewpoint':
      if (ex.spans.length === 0) errors.push('Marchează în sursă cel puțin o informație corectă.');
      else if (!Number.isInteger(ex.count) || ex.count < 1 || ex.count > ex.spans.length) {
        errors.push(`Numărul de informații cerute trebuie să fie între 1 și ${ex.spans.length}.`);
      }
      break;
    case 'cause_effect':
      if (ex.pairs.length === 0) errors.push('Marchează cel puțin o pereche cauză-efect validă.');
      break;
    case 'facts':
      push(countMessage(ex.count, 4, 'fapte'));
      break;
    case 'essay':
      if (ex.requirements.length < 1 || ex.requirements.length > 6) {
        errors.push('Eseul are nevoie de 1 până la 6 cerințe.');
      }
      ex.requirements.forEach((r, i) => {
        if (blank(r.text)) errors.push(`Cerința ${i + 1}: textul nu poate fi gol.`);
      });
      break;
  }

  if (AI_TYPES.has(ex.type)) {
    const c = ex.creditCost;
    if (!Number.isInteger(c) || c < MIN_CREDIT_COST || c > MAX_CREDIT_COST) {
      errors.push(`Costul verificării trebuie să fie între ${MIN_CREDIT_COST} și ${MAX_CREDIT_COST} credite.`);
    }
  }

  const ids = new Set(ex.sources.map((s) => s.sourceId));
  for (const s of spansOf(ex)) {
    const src = ids.has(s.sourceId) ? sources.find((x) => x.id === s.sourceId) : undefined;
    const degenerate = blank(s.text) || s.start < 0 || s.start >= s.end;
    if (!src || degenerate || s.end > src.body.length || src.body.slice(s.start, s.end) !== s.text) {
      errors.push(`Răspunsul marcat „${s.text}” nu mai există în sursă.`);
    }
  }
  if (ex.type === 'source_letter' && ex.evidence) {
    const correctId = ex.sources.find((s) => s.label === ex.correct)?.sourceId;
    if (ex.evidence.sourceId !== correctId) errors.push('Fragmentul-dovadă trebuie să fie din sursa corectă.');
  }

  if (ai) {
    if (ex.type === 'essay') {
      ex.requirements.forEach((r, i) => {
        if (blank(ai.requirements[r.id])) errors.push(`Contextul pentru AI este obligatoriu pentru cerința ${i + 1}.`);
      });
    } else if (AI_TYPES.has(ex.type) && blank(ai.main)) {
      errors.push('Contextul pentru AI este obligatoriu.');
    }
  }
  return errors;
}
