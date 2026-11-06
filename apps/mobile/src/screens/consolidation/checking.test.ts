import type { ConsolidationExercise, ExerciseFeedback, FeedbackItem } from '@prepio/shared';
import {
  aiBlocked,
  combineVerdict,
  emptyAnswer,
  essayProgress,
  isComplete,
  markerMarks,
  markerConfig,
  mergeAiFeedback,
  mergeItems,
  restorable,
} from './checking';

const base = { id: 'e1', position: 1, prompt: 'P', templateId: null, sources: [], modelAnswer: null, explanation: null };
const ex = <T extends ConsolidationExercise['type']>(c: { type: T } & Record<string, unknown>) =>
  ({ ...base, ...c }) as unknown as Extract<ConsolidationExercise, { type: T }>;
const item = (key: string, verdict: FeedbackItem['verdict'], ai = true): FeedbackItem => ({ key, verdict, title: key, good: [], improve: [], ai });

const short = ex<'short_answer'>({ type: 'short_answer', accepted: ['X'], mistakes: [] });
const multi = ex<'multi_answer'>({ type: 'multi_answer', count: 2, groups: [] });
const info = ex<'source_info'>({ type: 'source_info', count: 2, spans: [] });
const letter = ex<'source_letter'>({ type: 'source_letter', correct: 'A', evidence: null });
const ce = ex<'cause_effect'>({ type: 'cause_effect', pairs: [] });
const facts = ex<'facts'>({ type: 'facts', count: 2 });
const comparison = ex<'comparison'>({ type: 'comparison', variant: 'similarity' });
const viewpoint = ex<'viewpoint'>({ type: 'viewpoint', count: 2, spans: [] });
const argument = ex<'argument'>({ type: 'argument' });
const essay = ex<'essay'>({
  type: 'essay',
  requirements: [
    { id: 'r1', text: 'Cerința 1', modelAnswer: null, templateId: null, argument: false },
    { id: 'r2', text: 'Cerința 2', modelAnswer: null, templateId: null, argument: true },
  ],
});
const m = (from: number) => ({ sourceId: 's', from, to: from + 2 });

describe('emptyAnswer / isComplete', () => {
  it('starts every type empty and incomplete', () => {
    for (const e of [short, multi, info, letter, ce, facts, comparison, viewpoint, argument, essay]) {
      const a = emptyAnswer(e);
      expect(a.type).toBe(e.type);
      expect(isComplete(e, a)).toBe(false);
    }
    expect(emptyAnswer(multi)).toEqual({ type: 'multi_answer', texts: ['', ''] });
    expect(emptyAnswer(essay)).toEqual({ type: 'essay', parts: { r1: '', r2: '' } });
  });

  it('needs every field filled and the required marks set', () => {
    expect(isComplete(short, { type: 'short_answer', text: '  ' })).toBe(false);
    expect(isComplete(short, { type: 'short_answer', text: 'x' })).toBe(true);
    expect(isComplete(multi, { type: 'multi_answer', texts: ['a', ''] })).toBe(false);
    expect(isComplete(multi, { type: 'multi_answer', texts: ['a', 'b'] })).toBe(true);
    expect(isComplete(info, { type: 'source_info', marks: [m(0)] })).toBe(false);
    expect(isComplete(info, { type: 'source_info', marks: [m(0), m(5)] })).toBe(true);
    expect(isComplete(letter, { type: 'source_letter', letter: 'B' })).toBe(true);
    expect(isComplete(ce, { type: 'cause_effect', cause: m(0), effect: null })).toBe(false);
    expect(isComplete(ce, { type: 'cause_effect', cause: m(0), effect: m(5) })).toBe(true);
    expect(isComplete(viewpoint, { type: 'viewpoint', text: 'Consider', marks: [m(0)] })).toBe(false);
    expect(isComplete(viewpoint, { type: 'viewpoint', text: 'Consider', marks: [m(0), m(5)] })).toBe(true);
    expect(isComplete(viewpoint, { type: 'viewpoint', text: '', marks: [m(0), m(5)] })).toBe(false);
    expect(isComplete(essay, { type: 'essay', parts: { r1: 'a', r2: '' } })).toBe(false);
    expect(isComplete(essay, { type: 'essay', parts: { r1: 'a', r2: 'b' } })).toBe(true);
  });
});

describe('markerConfig', () => {
  it('limits each pen to what the exercise asks for', () => {
    expect(markerConfig(info)).toEqual({ pens: ['info'], limits: { info: 2 } });
    expect(markerConfig(viewpoint)).toEqual({ pens: ['support'], limits: { support: 2 } });
    expect(markerConfig(ce)).toEqual({ pens: ['cause', 'effect'], limits: { cause: 1, effect: 1 }, autoNext: { cause: 'effect' } });
    expect(markerConfig(short)).toBeNull();
  });
});

describe('aiBlocked', () => {
  it('blocks the AI on instant input problems (empty, too short, repeated facts)', () => {
    const det: ExerciseFeedback = { verdict: null, items: [{ ...item('fact-0', 'no', false), title: 'Faptul 1: prea scurt' }] };
    expect(aiBlocked(facts, det, { type: 'facts', texts: ['scurt', 'un fapt istoric suficient de lung'] })).toBe(true);
    expect(aiBlocked(facts, { verdict: null, items: [] }, { type: 'facts', texts: ['a'.repeat(20), 'b'.repeat(20)] })).toBe(false);
  });

  it('a viewpoint mark the check rejected does not block the AI (it judges the point of view)', () => {
    const det: ExerciseFeedback = { verdict: null, items: [item('support-0', 'no', false), item('support-1', 'ok', false)] };
    expect(aiBlocked(viewpoint, det, { type: 'viewpoint', text: 'Consider că…', marks: [m(0), m(5)] })).toBe(false);
    expect(aiBlocked(viewpoint, det, { type: 'viewpoint', text: ' ', marks: [m(0), m(5)] })).toBe(true);
  });
});

describe('combineVerdict', () => {
  it('one item: its verdict; several: ok / no when unanimous, otherwise almost', () => {
    expect(combineVerdict([item('a', 'almost')])).toBe('almost');
    expect(combineVerdict([item('a', 'ok'), item('b', 'ok')])).toBe('ok');
    expect(combineVerdict([item('a', 'no'), item('b', 'no')])).toBe('no');
    expect(combineVerdict([item('a', 'ok'), item('b', 'no')])).toBe('almost');
    expect(combineVerdict([])).toBeNull();
  });
});

describe('mergeAiFeedback', () => {
  it('viewpoint: the AI viewpoint first, then the support items (AI over deterministic), mark colours follow', () => {
    const det: ExerciseFeedback = {
      verdict: null,
      items: [item('support-0', 'ok', false), item('support-1', 'no', false)],
      marks: [
        { sourceId: 's', from: 0, to: 2, verdict: 'ok' },
        { sourceId: 's', from: 5, to: 7, verdict: 'no' },
      ],
    };
    const out = mergeAiFeedback(viewpoint, det, [item('support-0', 'almost'), item('viewpoint', 'ok')]);
    expect(out.items.map((i) => [i.key, i.verdict, i.ai])).toEqual([
      ['viewpoint', 'ok', true],
      ['support-0', 'almost', true],
      ['support-1', 'no', false],
    ]);
    expect(out.marks!.map((x) => x.verdict)).toEqual(['almost', 'no']);
    expect(out.verdict).toBe('almost');
  });

  it('facts: the AI items in order, the verdict from all of them', () => {
    const out = mergeAiFeedback(facts, { verdict: null, items: [] }, [item('fact-1', 'ok'), item('fact-0', 'ok')]);
    expect(out.items.map((i) => i.key)).toEqual(['fact-0', 'fact-1']);
    expect(out.verdict).toBe('ok');
  });
});

describe('essay helpers', () => {
  it('mergeItems replaces an item with the same key and keeps the rest', () => {
    const fb: ExerciseFeedback = { verdict: null, items: [item('r1', 'almost')] };
    expect(mergeItems(fb, [item('r1', 'ok'), item('r2', 'no')]).items.map((i) => [i.key, i.verdict])).toEqual([
      ['r1', 'ok'],
      ['r2', 'no'],
    ]);
  });

  it('essayProgress counts the requirements judged ok', () => {
    expect(essayProgress(essay, { verdict: null, items: [item('r1', 'ok'), item('r2', 'almost')] })).toEqual({ ok: 1, total: 2 });
    expect(essayProgress(essay, null)).toEqual({ ok: 0, total: 2 });
  });
});

describe('restorable / markerMarks', () => {
  it('a stored answer of the same shape can be restored', () => {
    expect(restorable(short, { type: 'short_answer', text: 'X' })).toBe(true);
    expect(restorable(multi, { type: 'multi_answer', texts: ['a', 'b'] })).toBe(true);
    expect(restorable(info, { type: 'source_info', marks: [m(0)] })).toBe(true);
    expect(restorable(essay, { type: 'essay', parts: { r1: 'a', r2: '' } })).toBe(true);
  });

  it('an answer that no longer fits the exercise (edited in the admin) is not restored', () => {
    expect(restorable(short, { type: 'comparison', text: 'X' })).toBe(false);
    expect(restorable(multi, { type: 'multi_answer', texts: ['a', 'b', 'c'] })).toBe(false);
    expect(restorable(facts, { type: 'facts', texts: ['a'] })).toBe(false);
    expect(restorable(info, { type: 'source_info', marks: [m(0), m(4), m(8)] })).toBe(false);
    expect(restorable(essay, { type: 'essay', parts: { r1: 'a' } })).toBe(false);
  });

  it('markerMarks gives the marks back to the marker with their pens', () => {
    expect(markerMarks({ type: 'source_info', marks: [m(0)] })).toEqual([{ ...m(0), pen: 'info' }]);
    expect(markerMarks({ type: 'viewpoint', text: 't', marks: [m(0), m(4)] })).toEqual([
      { ...m(0), pen: 'support' },
      { ...m(4), pen: 'support' },
    ]);
    expect(markerMarks({ type: 'cause_effect', cause: m(4), effect: m(0) })).toEqual([
      { ...m(4), pen: 'cause' },
      { ...m(0), pen: 'effect' },
    ]);
    expect(markerMarks({ type: 'cause_effect', cause: null, effect: m(0) })).toEqual([{ ...m(0), pen: 'effect' }]);
    expect(markerMarks({ type: 'short_answer', text: 'x' })).toEqual([]);
  });
});
