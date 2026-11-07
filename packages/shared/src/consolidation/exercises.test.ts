import { describe, expect, it } from 'vitest';
import {
  AI_TYPES,
  CONSOLIDATION_TYPES,
  CONSOLIDATION_TYPE_LABELS,
  VERDICT_LABELS,
  emptyExerciseContent,
  exerciseFromRow,
  exerciseToRow,
  sourceFromRow,
  templateFromRow,
  validateExercise,
  validateTemplate,
  aiTemplateFromRow,
  aiTemplateTypeFor,
} from './exercises';
import type {
  AiContext,
  AnswerSpan,
  ConsolidationExercise,
  ConsolidationRow,
  ConsolidationType,
  Source,
  SourceRef,
} from './types';

const BODY_A = 'Domnul era ales pe viață. Adunarea electivă hotăra.';
const SRC_A: Source = { id: 'sa', position: 0, title: null, author: 'X', work: 'Y', body: BODY_A };
const SRC_B: Source = { id: 'sb', position: 1, title: null, author: 'X', work: 'Y', body: 'Altă sursă.' };
const REF_A: SourceRef = { sourceId: 'sa', label: 'A' };
const REF_B: SourceRef = { sourceId: 'sb', label: 'B' };

const spanOf = (id: string, text: string, sourceId = 'sa', body = BODY_A): AnswerSpan => {
  const start = body.indexOf(text);
  return { id, sourceId, start, end: start + text.length, text, limitStart: null, limitEnd: null };
};
const S1 = spanOf('s1', 'Domnul era ales pe viață');
const S2 = spanOf('s2', 'Adunarea electivă hotăra');

const base = { id: 'e1', position: 0, prompt: 'Enunț', templateId: null, modelAnswer: null, explanation: null, creditCost: 1 };
const make = (c: object, sources: SourceRef[] = []) =>
  ({ ...base, sources, ...c }) as unknown as ConsolidationExercise;
const row = (type: ConsolidationType, content: Record<string, unknown>): ConsolidationRow => ({
  id: 'e1',
  position: 3,
  type,
  prompt: 'P',
  content,
  template_id: null,
});

describe('constants', () => {
  it('has ten types with labels, AI types and verdict labels', () => {
    expect(CONSOLIDATION_TYPES).toHaveLength(10);
    expect(Object.keys(CONSOLIDATION_TYPE_LABELS).sort()).toEqual([...CONSOLIDATION_TYPES].sort());
    expect(CONSOLIDATION_TYPE_LABELS.cause_effect).toBe('Cauză-efect');
    expect([...AI_TYPES].sort()).toEqual(['argument', 'comparison', 'essay', 'facts', 'viewpoint']);
    expect(VERDICT_LABELS).toEqual({ ok: 'Corect', almost: 'Aproape', no: 'Mai lucrează' });
  });
  it('emptyExerciseContent gives a content of the requested type for every type', () => {
    let n = 0;
    for (const t of CONSOLIDATION_TYPES) expect(emptyExerciseContent(t, () => `id${n++}`).type).toBe(t);
  });
});

describe('exerciseFromRow', () => {
  it('coerces garbage to defaults', () => {
    const ex = exerciseFromRow(
      row('multi_answer', { count: 'x', groups: [42, { variants: [1, 'a'] }], modelAnswer: 5 }),
      [REF_A],
    );
    expect(ex).toMatchObject({
      type: 'multi_answer',
      count: 2,
      modelAnswer: null,
      explanation: null,
      groups: [
        { id: 'group-0', variants: [] },
        { id: 'group-1', variants: ['a'] },
      ],
    });
    const none = exerciseFromRow({ ...row('source_info', {}), content: null as never }, []);
    expect(none).toMatchObject({ type: 'source_info', count: 1, spans: [] });
  });
  it('makes duplicate or missing span and pair ids unique', () => {
    const sp = { sourceId: 'sa', start: 0, end: 1, text: 'D' };
    const info = exerciseFromRow(row('source_info', { spans: [{ ...sp, id: 'x' }, { ...sp, id: 'x' }, sp] }), [REF_A]);
    expect(info.type === 'source_info' && info.spans.map((s) => s.id)).toEqual(['x', 'span-1', 'span-2']);
    const ce = exerciseFromRow(
      row('cause_effect', { pairs: [{ id: 'p', cause: sp, effect: sp }, { id: 'p', cause: sp, effect: sp }] }),
      [REF_A],
    );
    if (ce.type !== 'cause_effect') throw new Error('type');
    const ids = ce.pairs.flatMap((p) => [p.id, p.cause.id, p.effect.id]);
    expect(new Set(ids).size).toBe(6);
  });
  it('keeps half a limit as null and reads model answer and explanation from content', () => {
    const ex = exerciseFromRow(
      row('source_info', {
        modelAnswer: 'M',
        explanation: 'E',
        spans: [{ id: 'a', sourceId: 'sa', start: 0, end: 1, text: 'D', limitStart: 0 }],
      }),
      [REF_A],
    );
    expect(ex.modelAnswer).toBe('M');
    expect(ex.explanation).toBe('E');
    expect(ex.type === 'source_info' && ex.spans[0]).toMatchObject({ limitStart: null, limitEnd: null });
  });
  it('round trips through exerciseToRow for every type', () => {
    const exs: ConsolidationExercise[] = [
      make({ type: 'short_answer', accepted: ['a'], mistakes: [{ answer: 'b', message: 'm' }], modelAnswer: 'M' }),
      make({ type: 'multi_answer', count: 1, groups: [{ id: 'g', variants: ['a'] }], explanation: 'E' }, [REF_A, REF_B]),
      make({ type: 'source_info', count: 1, spans: [S1] }, [REF_A]),
      make({ type: 'source_letter', correct: 'B', evidence: S1 }, [REF_A, REF_B]),
      make({ type: 'cause_effect', pairs: [{ id: 'p', cause: S1, effect: S2, explanation: 'x' }] }, [REF_A]),
      make({ type: 'facts', count: 3 }),
      make({ type: 'comparison', variant: 'difference', creditCost: 4 }),
      make({ type: 'viewpoint', count: 1, spans: [S1] }, [REF_A]),
      make({ type: 'argument', templateId: 't1' }),
      make({
        type: 'essay',
        requirements: [{ id: 'r', text: 'T', modelAnswer: 'M', templateId: 't', argument: true }],
      }),
    ];
    for (const ex of exs) {
      const { id, position, sources, ...rest } = ex;
      const r = exerciseToRow(rest);
      expect(r.type).toBe(ex.type);
      expect(r.content).not.toHaveProperty('type');
      expect(r.content).not.toHaveProperty('creditCost');
      expect(r.credit_cost).toBe(ex.creditCost);
      expect(exerciseFromRow({ id, position, ...r }, sources)).toEqual(ex);
    }
  });
});

describe('credit cost', () => {
  it('a missing credit_cost falls back to the type default', () => {
    expect(exerciseFromRow(row('comparison', {}), []).creditCost).toBe(2);
    expect(exerciseFromRow(row('argument', {}), []).creditCost).toBe(2);
    expect(exerciseFromRow(row('facts', { count: 2 }), []).creditCost).toBe(1);
    expect(exerciseFromRow(row('viewpoint', {}), []).creditCost).toBe(1);
    expect(exerciseFromRow(row('essay', {}), []).creditCost).toBe(1);
    expect(exerciseFromRow(row('short_answer', {}), []).creditCost).toBe(1);
    expect(exerciseFromRow({ ...row('facts', {}), credit_cost: 3 }, []).creditCost).toBe(3);
    expect(exerciseFromRow({ ...row('argument', {}), credit_cost: 'x' as never }, []).creditCost).toBe(2);
  });
});

describe('sourceFromRow / templateFromRow', () => {
  it('coerces rows', () => {
    expect(sourceFromRow({ id: 's', position: 2, title: 7, author: 'a', body: 'b' })).toEqual({
      id: 's',
      position: 2,
      title: null,
      author: 'a',
      work: '',
      body: 'b',
    });
    expect(templateFromRow({ id: 't', title: 'T', exercise_type: 'essay', points: 'p', body: 'b' })).toEqual({
      id: 't',
      title: 'T',
      exerciseType: 'essay',
      points: 'p',
      body: 'b',
    });
    expect(templateFromRow({ id: 't', exercise_type: 'nope' }).exerciseType).toBeNull();
  });
  it('validateTemplate', () => {
    expect(validateTemplate({ title: 'T', exerciseType: null, points: '', body: 'b' })).toEqual([]);
    expect(validateTemplate({ title: ' ', exerciseType: null, points: '', body: '' })).toHaveLength(2);
  });
});

describe('validateExercise', () => {
  const srcs = [SRC_A, SRC_B];
  const v = (c: object, refs: SourceRef[], ai: AiContext | null = null, extra: object = {}) =>
    validateExercise(make({ ...c, ...extra }, refs), srcs, ai);
  const ctx: AiContext = { main: 'ctx', requirements: {}, templateId: 't1', requirementTemplates: {} };

  it('prompt must not be blank', () => {
    const c = { type: 'argument' };
    expect(v(c, [])).toEqual([]);
    expect(v(c, [], null, { prompt: '  ' })).toEqual(['Enunțul nu poate fi gol.']);
  });

  describe('source counts', () => {
    const info = { type: 'source_info', count: 1, spans: [S1] };
    it('exactly 1 for source_info, cause_effect, viewpoint', () => {
      expect(v(info, [REF_A])).toEqual([]);
      expect(v(info, [])[0]).toBe('Exercițiul „Informație din sursă” cere exact o sursă.');
      expect(v(info, [REF_A, REF_B]).length).toBeGreaterThan(0);
      const ce = { type: 'cause_effect', pairs: [{ id: 'p', cause: S1, effect: S2, explanation: null }] };
      expect(v(ce, [REF_A])).toEqual([]);
      expect(v(ce, [])[0]).toMatch(/exact o sursă/);
      const vp = { type: 'viewpoint', count: 1, spans: [S1] };
      expect(v(vp, [REF_A], ctx)).toEqual([]);
      expect(v(vp, [], ctx)[0]).toMatch(/exact o sursă/);
    });
    it('exactly 2 for source_letter', () => {
      const c = { type: 'source_letter', correct: 'A', evidence: null };
      expect(v(c, [REF_A, REF_B])).toEqual([]);
      expect(v(c, [REF_A])).toHaveLength(1);
    });
    it('0-2 for short and multi answer, at most 2 overall', () => {
      const c = { type: 'short_answer', accepted: ['a'], mistakes: [] };
      expect(v(c, [])).toEqual([]);
      expect(v(c, [REF_A, REF_B])).toEqual([]);
      expect(v(c, [REF_A, REF_B, { sourceId: 'sc', label: 'A' }])).toEqual([
        'Exercițiul „Răspuns scurt” poate avea între 0 și 2 surse.',
        'Un exercițiu poate avea cel mult 2 surse.',
      ]);
    });
    it('0-1 for AI types other than viewpoint', () => {
      const c = { type: 'comparison', variant: 'similarity' };
      expect(v(c, [REF_A], ctx)).toEqual([]);
      expect(v(c, [REF_A, REF_B], ctx)).toHaveLength(1);
    });
  });

  it('short_answer needs an accepted variant', () => {
    expect(v({ type: 'short_answer', accepted: [], mistakes: [] }, [])).toEqual(['Adaugă cel puțin o variantă acceptată.']);
    expect(v({ type: 'short_answer', accepted: [' '], mistakes: [] }, [])).toHaveLength(1);
  });
  it('multi_answer: count within groups, every group has a variant', () => {
    const g = (id: string, variants: string[]) => ({ id, variants });
    const ok = { type: 'multi_answer', count: 2, groups: [g('a', ['x']), g('b', ['y']), g('c', ['z'])] };
    expect(v(ok, [])).toEqual([]);
    expect(v({ ...ok, count: 4 }, [])).toEqual(['Numărul de răspunsuri cerute trebuie să fie între 1 și 3.']);
    expect(v({ ...ok, count: 0 }, [])).toHaveLength(1);
    expect(v({ ...ok, groups: [g('a', ['x']), g('b', [])], count: 1 }, [])).toEqual(['Grupul 2 are nevoie de cel puțin o variantă.']);
    expect(v({ ...ok, groups: [] }, [])).toEqual(['Adaugă cel puțin un grup de răspunsuri acceptate.']);
  });
  it('source_info and viewpoint: 1 <= count <= spans', () => {
    const info = { type: 'source_info', count: 2, spans: [S1, S2] };
    expect(v(info, [REF_A])).toEqual([]);
    expect(v({ ...info, count: 3 }, [REF_A])).toEqual(['Numărul de informații cerute trebuie să fie între 1 și 2.']);
    expect(v({ ...info, count: 0 }, [REF_A])).toHaveLength(1);
    expect(v({ ...info, spans: [] }, [REF_A])).toEqual(['Marchează în sursă cel puțin o informație corectă.']);
    const vp = { type: 'viewpoint', count: 3, spans: [S1, S2] };
    expect(v(vp, [REF_A], ctx)).toHaveLength(1);
  });
  it('cause_effect needs a pair', () => {
    expect(v({ type: 'cause_effect', pairs: [] }, [REF_A])).toEqual(['Marchează cel puțin o pereche cauză-efect validă.']);
  });
  it('facts: 1..4', () => {
    expect(v({ type: 'facts', count: 4 }, [], ctx)).toEqual([]);
    expect(v({ type: 'facts', count: 5 }, [], ctx)).toHaveLength(1);
    expect(v({ type: 'facts', count: 0 }, [], ctx)).toHaveLength(1);
  });
  it('AI types need an integer credit cost of 1..5; other types ignore it', () => {
    const msg = 'Costul verificării trebuie să fie între 1 și 5 credite.';
    expect(v({ type: 'facts', count: 2, creditCost: 5 }, [], ctx)).toEqual([]);
    expect(v({ type: 'facts', count: 2, creditCost: 0 }, [], ctx)).toEqual([msg]);
    expect(v({ type: 'facts', count: 2, creditCost: 6 }, [], ctx)).toEqual([msg]);
    expect(v({ type: 'facts', count: 2, creditCost: 1.5 }, [], ctx)).toEqual([msg]);
    expect(v({ type: 'short_answer', accepted: ['a'], mistakes: [], creditCost: 0 }, [])).toEqual([]);
    expect(v({ type: 'short_answer', accepted: ['a'], mistakes: [], creditCost: 6 }, [])).toEqual([]);
  });
  it('essay: 1-6 requirements, none blank', () => {
    const r = (id: string, text = 'T') => ({ id, text, modelAnswer: null, templateId: null, argument: false });
    const reqCtx = { a: 'x', b: 'x', c: 'x', d: 'x', e: 'x', f: 'x', g: 'x' };
    const ai: AiContext = { main: '', requirements: reqCtx, templateId: null, requirementTemplates: { ...reqCtx } };
    expect(v({ type: 'essay', requirements: [r('a')] }, [], ai)).toEqual([]);
    expect(v({ type: 'essay', requirements: [] }, [], ai)).toEqual(['Eseul are nevoie de 1 până la 6 cerințe.']);
    expect(v({ type: 'essay', requirements: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((i) => r(i)) }, [], ai)).toEqual([
      'Eseul are nevoie de 1 până la 6 cerințe.',
    ]);
    expect(v({ type: 'essay', requirements: [r('a'), r('b', ' ')] }, [], ai)).toEqual(['Cerința 2: textul nu poate fi gol.']);
  });

  describe('anchored spans', () => {
    const msg = (t: string) => `Răspunsul marcat „${t}” nu mai există în sursă.`;
    it('detached text', () => {
      const moved = { ...S1, start: 5, end: 5 + S1.text.length };
      expect(v({ type: 'source_info', count: 1, spans: [moved] }, [REF_A])).toEqual([msg(S1.text)]);
    });
    it('source not among the exercise sources', () => {
      const other = spanOf('o', 'Altă sursă', 'sb', SRC_B.body);
      expect(v({ type: 'source_info', count: 1, spans: [other] }, [REF_A])).toEqual([msg('Altă sursă')]);
      expect(v({ type: 'source_info', count: 1, spans: [{ ...S1, sourceId: 'gone' }] }, [REF_A])).toEqual([msg(S1.text)]);
    });
    it('checks letter evidence and pair spans too', () => {
      const bad = { ...S2, start: 0, end: S2.text.length };
      expect(v({ type: 'source_letter', correct: 'A', evidence: bad }, [REF_A, REF_B])).toEqual([msg(S2.text)]);
      const pairs = [{ id: 'p', cause: S1, effect: bad, explanation: null }];
      expect(v({ type: 'cause_effect', pairs }, [REF_A])).toEqual([msg(S2.text)]);
    });
  });

  describe('AI context', () => {
    it.each([
      ['facts', { type: 'facts', count: 2 }],
      ['comparison', { type: 'comparison', variant: 'similarity' }],
      ['viewpoint', { type: 'viewpoint', count: 1, spans: [S1] }],
      ['argument', { type: 'argument' }],
    ])('%s needs ai.main', (_t, c) => {
      const refs = c.type === 'viewpoint' ? [REF_A] : [];
      expect(v(c, refs, ctx)).toEqual([]);
      expect(v(c, refs, { ...ctx, main: ' ' })).toEqual(['Contextul pentru AI este obligatoriu.']);
      expect(v(c, refs, null)).toEqual([]);
    });
    it('essay needs every requirement context', () => {
      const reqs = [
        { id: 'a', text: 'T', modelAnswer: null, templateId: null, argument: false },
        { id: 'b', text: 'T', modelAnswer: null, templateId: null, argument: false },
      ];
      const c = { type: 'essay', requirements: reqs };
      const essayAi: AiContext = { main: '', requirements: {}, templateId: null, requirementTemplates: { a: 't', b: 't' } };
      expect(v(c, [], { ...essayAi, requirements: { a: 'x', b: 'y' } })).toEqual([]);
      expect(v(c, [], { ...essayAi, requirements: { a: 'x', b: ' ' } })).toEqual([
        'Contextul pentru AI este obligatoriu pentru cerința 2.',
      ]);
      expect(v(c, [], null)).toEqual([]);
    });
    it('non-AI types never need it', () => {
      expect(v({ type: 'short_answer', accepted: ['a'], mistakes: [] }, [], { ...ctx, main: '', templateId: null })).toEqual([]);
    });
    it('AI types need a template when ai is given', () => {
      const none: AiContext = { main: 'ctx', requirements: {}, templateId: null, requirementTemplates: {} };
      expect(v({ type: 'argument' }, [], none)).toEqual(['Alege un șablon AI.']);
      expect(v({ type: 'argument' }, [], null)).toEqual([]);
    });
    it('essay needs a template for every requirement', () => {
      const reqs = ['a', 'b'].map((id) => ({ id, text: 'T', modelAnswer: null, templateId: null, argument: false }));
      const ai: AiContext = { main: '', requirements: { a: 'x', b: 'y' }, templateId: null, requirementTemplates: { a: 't' } };
      expect(v({ type: 'essay', requirements: reqs }, [], ai)).toEqual(['Alege un șablon AI pentru cerința 2.']);
      expect(v({ type: 'essay', requirements: reqs }, [], null)).toEqual([]);
    });
    it('aiTemplateTypeFor maps consolidation types', () => {
      expect(aiTemplateTypeFor('essay')).toBe('essay_requirement');
      expect(aiTemplateTypeFor('argument')).toBe('argument');
      expect(aiTemplateTypeFor('short_answer')).toBeNull();
    });
    it('aiTemplateFromRow maps snake case', () => {
      expect(aiTemplateFromRow({ id: 'i', title: 'T', type: 'facts', criteria: 'c', keywords: 'k', response_format: 'r' })).toEqual({
        id: 'i', title: 'T', type: 'facts', criteria: 'c', keywords: 'k', responseFormat: 'r',
      });
    });
  });
});

describe('validateExercise: degenerate spans and letter evidence', () => {
  const msg = (t: string) => `Răspunsul marcat „${t}” nu mai există în sursă.`;
  const run = (c: object, refs: SourceRef[]) => validateExercise(make(c, refs), [SRC_A, SRC_B], null);
  it('rejects empty, reversed and out-of-range spans', () => {
    const info = (s: object) => ({ type: 'source_info', count: 1, spans: [s] });
    expect(run(info({ ...S1, start: 0, end: 0, text: '' }), [REF_A])).toEqual([msg('')]);
    expect(run(info({ ...S1, start: 5, end: 2, text: '' }), [REF_A])).toEqual([msg('')]);
    expect(run(info({ ...S1, start: 3, end: 3, text: 'x' }), [REF_A])).toEqual([msg('x')]);
    expect(run(info({ ...S1, start: -1, end: 2, text: 'x' }), [REF_A])).toEqual([msg('x')]);
    expect(run(info({ ...S1, start: 0, end: 2, text: '  ' }), [REF_A])).toEqual([msg('  ')]);
    expect(run(info(S1), [REF_A])).toEqual([]);
  });
  it('source_letter evidence must be in the source labelled correct', () => {
    const evB = spanOf('eb', 'Altă sursă', 'sb', SRC_B.body);
    expect(run({ type: 'source_letter', correct: 'B', evidence: evB }, [REF_A, REF_B])).toEqual([]);
    expect(run({ type: 'source_letter', correct: 'A', evidence: evB }, [REF_A, REF_B])).toEqual([
      'Fragmentul-dovadă trebuie să fie din sursa corectă.',
    ]);
  });
});
