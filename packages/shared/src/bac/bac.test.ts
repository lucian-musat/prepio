import { describe, expect, it } from 'vitest';
import { spanToWords, tokenizeSource } from '../consolidation/sourceText';
import type { AnswerSpan, ExerciseAnswer, Mark, Source } from '../consolidation/types';
import {
  allowedSteps,
  bacGrade,
  clampToStep,
  essayLengthPoints,
  formatGrade,
  sanitizeAnswers,
  scoreDeterministic,
  validateBacItem,
  validateBacSubject,
  bacItemFromRow,
  DEFAULT_ESSAY_STYLE,
  BAC_GRADE_NOTE,
} from './bac';
import type { BacBarem, BacItem } from './types';
import { TEXTS } from '../texts/catalog';

const S1 = 'Domnul urma să fie ales pe viață de către Adunarea electivă.';
const S2 = 'Puterea legislativă era exercitată colectiv de domn.';
const S3 = 'Prin legea din 1863 averile mănăstirești au trecut în proprietatea statului, ca urmare un sfert din teritoriu a devenit patrimoniu al statului.';
const BODY = `${S1} ${S2} ${S3}`;
const SRC: Source = { id: 'sa', position: 0, title: null, author: 'a', work: 'w', body: BODY };
const T = tokenizeSource(BODY);

const spanOf = (id: string, text: string): AnswerSpan => {
  const start = BODY.indexOf(text);
  return { id, sourceId: 'sa', start, end: start + text.length, text, limitStart: null, limitEnd: null };
};
const markOf = (text: string): Mark => {
  const at = BODY.indexOf(text);
  const r = spanToWords(T, { start: at, end: at + text.length })!;
  return { sourceId: 'sa', from: r[0], to: r[1] };
};

const base = { id: 'i', position: 0, prompt: 'P', templateId: 't', modelAnswer: null, explanation: null, creditCost: 1, section: 1, number: 1 };
const item = (c: object, points: number, sources: BacItem['sources'] = []) =>
  ({ ...base, sources, points, ...c }) as unknown as BacItem;
const score = (it: BacItem, answer?: ExerciseAnswer) => scoreDeterministic(it, [SRC], answer)!;

describe('grade', () => {
  it('computes and formats', () => {
    expect(bacGrade(74)).toBe(8.4);
    expect(bacGrade(0)).toBe(1);
    expect(bacGrade(90)).toBe(10);
    expect(formatGrade(8.4)).toBe('8,40');
  });
});

describe('steps', () => {
  it('clampToStep', () => {
    expect(clampToStep(8, [0, 7, 10])).toBe(7);
    expect(clampToStep(11, [0, 7, 10])).toBe(10);
    expect(clampToStep(-1, [0, 2])).toBe(0);
  });
  it('allowedSteps', () => {
    expect(allowedSteps({ text: 'x', points: 4, steps: null })).toEqual([0, 1, 2, 3, 4]);
    expect(allowedSteps({ text: 'x', points: 6, steps: [4, 2, 2] })).toEqual([0, 2, 4, 6]);
  });
});

describe('short_answer', () => {
  const it0 = item({ type: 'short_answer', accepted: ['Carol I'], mistakes: [] }, 2);
  const a = (text: string): ExerciseAnswer => ({ type: 'short_answer', text });
  it('exact', () => expect(score(it0, a('Carol I'))).toMatchObject({ points: 2, max: 2, feedback: '' }));
  it('typo', () => {
    const long = item({ type: 'short_answer', accepted: ['Statutul Dezvoltător'], mistakes: [] }, 2);
    expect(score(long, a('Statutul Dezvoltatr')).points).toBe(2);
  });
  it('wrong', () => {
    const r = score(it0, a('Carol II'));
    expect(r.points).toBe(0);
    expect(r.feedback).not.toBe('');
  });
  it('missing', () => expect(score(it0, undefined)).toMatchObject({ points: 0, feedback: 'Necompletat.' }));
  it('mismatched type', () => expect(score(it0, { type: 'comparison', text: 'x' })).toMatchObject({ points: 0, feedback: 'Necompletat.' }));
});

describe('multi_answer', () => {
  const it0 = item({ type: 'multi_answer', count: 2, groups: [{ id: 'm', variants: ['Moldova'] }, { id: 't', variants: ['Muntenia'] }] }, 6);
  const a = (...texts: string[]): ExerciseAnswer => ({ type: 'multi_answer', texts });
  it('partial credit', () => {
    expect(score(it0, a('Moldova', 'x')).points).toBe(3);
    expect(score(it0, a('Moldova', 'Muntenia')).points).toBe(6);
    expect(score(it0, a('Moldova', 'Moldova')).points).toBe(3);
  });
});

describe('source_info', () => {
  const it0 = item(
    { type: 'source_info', count: 2, spans: [spanOf('a', S1), spanOf('b', S2)] },
    6,
    [{ sourceId: 'sa', label: 'A' }],
  );
  const a = (...marks: Mark[]): ExerciseAnswer => ({ type: 'source_info', marks });
  it('exact span', () => expect(score(it0, a(markOf(S1))).points).toBe(3));
  it('extra words inside the same sentence still count', () => {
    const inner = item({ type: 'source_info', count: 1, spans: [spanOf('v', 'ales pe viață')] }, 3, [{ sourceId: 'sa', label: 'A' }]);
    expect(score(inner, a(markOf(S1))).points).toBe(3);
  });
  it('a mark running past the sentence does not count', () => {
    expect(score(it0, a({ ...markOf(S1), to: markOf(S2).to })).points).toBe(0);
  });
  it('a whole-source mark scores 0', () => {
    expect(score(it0, a({ sourceId: 'sa', from: 0, to: T.words.length - 1 })).points).toBe(0);
  });
  it('two whole-source marks on count 2 score 0', () => {
    const whole: Mark = { sourceId: 'sa', from: 0, to: T.words.length - 1 };
    expect(score(it0, a(whole, { ...whole })).points).toBe(0);
  });
  it('too-short mark does not count', () => expect(score(it0, a(markOf('Domnul urma'))).points).toBe(0));
  it('two exact', () => expect(score(it0, a(markOf(S1), markOf(S2))).points).toBe(6));
  it('same span twice counts once', () => expect(score(it0, a(markOf(S1), markOf(S1))).points).toBe(3));
});

describe('cause_effect', () => {
  const cause = spanOf('c', 'averile mănăstirești au trecut în proprietatea statului');
  const effect = spanOf('e', 'un sfert din teritoriu a devenit patrimoniu al statului');
  const it0 = item({ type: 'cause_effect', pairs: [{ id: 'p', cause, effect, explanation: null }] }, 7, [{ sourceId: 'sa', label: 'A' }]);
  const a = (c: string, e: string): ExerciseAnswer => ({ type: 'cause_effect', cause: markOf(c), effect: markOf(e) });
  it('exact pair', () => expect(score(it0, a(cause.text, effect.text)).points).toBe(7));
  it('swapped', () => expect(score(it0, a(effect.text, cause.text)).points).toBe(0));
  it('partial', () => expect(score(it0, a('averile mănăstirești', effect.text)).points).toBe(0));
});

describe('source_letter', () => {
  const it0 = item(
    { type: 'source_letter', correct: 'B', evidence: null },
    3,
    [{ sourceId: 'sa', label: 'A' }, { sourceId: 'sb', label: 'B' }],
  );
  it('correct and wrong', () => {
    expect(score(it0, { type: 'source_letter', letter: 'B' }).points).toBe(3);
    expect(score(it0, { type: 'source_letter', letter: 'A' }).points).toBe(0);
  });
});

describe('AI types', () => {
  it('return null', () => {
    expect(scoreDeterministic(item({ type: 'comparison', variant: 'similarity' }, 6), [], { type: 'comparison', text: 'x' })).toBeNull();
  });
});

describe('sanitizeAnswers', () => {
  it('ignores answers for unknown or mismatched items', () => {
    const items = [item({ type: 'short_answer', accepted: ['x'], mistakes: [] }, 2)];
    const out = sanitizeAnswers(items, {
      unknownId: { type: 'short_answer', text: 'x' },
      i: { type: 'comparison', text: 'x' },
    });
    expect(out).toEqual({});
    expect(sanitizeAnswers(items, { i: { type: 'short_answer', text: 'x' } })).toEqual({ i: { type: 'short_answer', text: 'x' } });
  });
});

describe('essayLengthPoints', () => {
  const words = (n: number) => Array.from({ length: n }, () => 'w').join(' ');
  it('awards the length point between 300 and 900 words', () => {
    const p = (n: number) => essayLengthPoints({ a: words(n) }, DEFAULT_ESSAY_STYLE);
    expect([p(299), p(300), p(900), p(901)]).toEqual([0, 1, 1, 0]);
    expect(essayLengthPoints({ a: words(150), b: words(150) }, DEFAULT_ESSAY_STYLE)).toBe(1);
  });
});

describe('validateBacSubject', () => {
  const mk = (id: string, points: number, number = 1) => item({ id, type: 'argument', number }, points);
  it('requires a total of 90', () => {
    const items = [mk('a', 54), mk('b', 30, 2)];
    expect(validateBacSubject(items, new Map())).toEqual(['Subiectul nu poate fi publicat: totalul este 84 din 90.']);
    expect(validateBacSubject([mk('a', 60), mk('b', 30, 2)], new Map())).toEqual([]);
  });
  it('reports invalid items and empty subjects', () => {
    const errs = validateBacSubject([mk('a', 90)], new Map([['a', ['x']]]));
    expect(errs).toEqual(['Subiectul nu poate fi publicat: cerința 1.1 are erori.']);
    expect(validateBacSubject([], new Map())).toEqual(['Subiectul nu are nicio cerință.']);
  });
});

describe('validateBacItem', () => {
  const reqs = ['r1', 'r2', 'r3', 'r4', 'r5'];
  const rule = (points: number) => ({ text: 'x', points, steps: null });
  const barem = (): BacBarem => ({
    text: 'Barem',
    points: 30,
    steps: null,
    essay: {
      requirements: { r1: rule(2), r2: rule(3), r3: rule(6), r4: rule(6), r5: rule(7) },
      style: DEFAULT_ESSAY_STYLE,
    },
  });
  const essay = (points: number) =>
    item({ type: 'essay', requirements: reqs.map((id) => ({ id, text: id, modelAnswer: null, templateId: null, argument: false })) }, points);
  it('checks the essay point sum', () => {
    expect(validateBacItem(essay(30), [], barem())).toEqual([]);
    expect(validateBacItem(essay(29), [], barem()).some((e) => e.startsWith('Cerințele eseului (24 p) și ordonarea ideilor (6 p)'))).toBe(true);
  });
  it('requires at least 1 point per essay requirement', () => {
    const b = barem();
    b.essay!.requirements.r1 = rule(0);
    b.essay!.requirements.r5 = rule(9);
    expect(validateBacItem(essay(30), [], b)).toContain('Cerința 1 trebuie să aibă cel puțin 1 punct.');
  });
  it('requires template, barem text and in-range steps', () => {
    const it0 = item({ type: 'argument', templateId: null }, 6);
    const errs = validateBacItem(it0, [], { text: ' ', points: 6, steps: [0, 7], essay: null });
    expect(errs).toContain('Alege un „Cum rezolv”.');
    expect(errs).toContain('Baremul este obligatoriu.');
    expect(errs).toContain('Treptele de punctaj trebuie să fie între 0 și 6.');
    expect(validateBacItem(item({ type: 'argument' }, 31), [], { text: 'b', points: 31, steps: null, essay: null })).toContain(
      'Punctajul trebuie să fie între 1 și 30.',
    );
  });
});

describe('bacItemFromRow', () => {
  it('wraps exerciseFromRow with number, section and credit cost', () => {
    const it0 = bacItemFromRow(
      { id: 'x', section: 2, position: 3, type: 'argument', prompt: 'P', content: {}, template_id: null, points: 6 },
      4,
      [],
    );
    expect(it0).toMatchObject({ id: 'x', section: 2, number: 4, points: 6, creditCost: 2, type: 'argument' });
  });
});

describe('BAC_GRADE_NOTE', () => {
  it('matches the default of the result screen text (the Terms keep the constant)', () => {
    expect(TEXTS['bac.result.gradeNote'].default).toBe(BAC_GRADE_NOTE);
  });
});
