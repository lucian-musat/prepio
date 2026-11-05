import { describe, expect, it } from 'vitest';
import { checkExercise } from './check';
import { spanToWords, tokenizeSource } from './sourceText';
import type { AnswerSpan, ConsolidationExercise, ExerciseAnswer, Mark, Source } from './types';

const S1 = 'Domnul urma să fie ales pe viață de către Adunarea electivă.';
const S2 = 'Puterea legislativă era exercitată colectiv de domn.';
const S3 = 'Prin legea din 1863 averile mănăstirești au trecut în proprietatea statului, ca urmare un sfert din teritoriu a devenit patrimoniu al statului.';
const BODY = `${S1} ${S2} ${S3}`;
const SRC: Source = { id: 'sa', position: 0, title: null, author: 'a', work: 'w', body: BODY };
const T = tokenizeSource(BODY);

const spanOf = (id: string, text: string): AnswerSpan => {
  const start = BODY.indexOf(text);
  if (start < 0) throw new Error(`not in body: ${text}`);
  return { id, sourceId: 'sa', start, end: start + text.length, text, limitStart: null, limitEnd: null };
};
const markOf = (text: string): Mark => {
  const at = BODY.indexOf(text);
  const r = spanToWords(T, { start: at, end: at + text.length })!;
  return { sourceId: 'sa', from: r[0], to: r[1] };
};

const base = { id: 'e', position: 0, prompt: 'P', templateId: null, modelAnswer: null, explanation: null };
const ex = (c: object, sources: ConsolidationExercise['sources'] = [{ sourceId: 'sa', label: 'A' }]) =>
  ({ ...base, sources, ...c }) as unknown as ConsolidationExercise;
const check = (e: ConsolidationExercise, a: ExerciseAnswer) => checkExercise(e, [SRC], a);

describe('short_answer', () => {
  const e = ex(
    {
      type: 'short_answer',
      accepted: ['Statutul Dezvoltător', 'Statutul dezvoltator al Convenției'],
      mistakes: [{ answer: 'Constituția din 1866', message: 'Asta e altă constituție.' }],
      explanation: 'Promulgat de Cuza în 1864.',
    },
    [],
  );
  const a = (text: string): ExerciseAnswer => ({ type: 'short_answer', text });
  it('exact', () => {
    const f = check(e, a('statutul dezvoltator'));
    expect(f.verdict).toBe('ok');
    expect(f.items[0]).toMatchObject({ key: 'answer', verdict: 'ok', title: 'Corect!', good: ['Promulgat de Cuza în 1864.'] });
    expect(f.reveal).toEqual(['Statutul Dezvoltător']);
  });
  it('typo', () => {
    const f = check(e, a('Statutul Dezvoltatr'));
    expect(f.verdict).toBe('ok');
    expect(f.items[0]).toMatchObject({
      title: 'Corect, atenție la scriere',
      improve: ['Forma corectă: Statutul Dezvoltător.'],
    });
  });
  it('mistake', () => {
    const f = check(e, a('Constituția din 1866'));
    expect(f.verdict).toBe('no');
    expect(f.items[0]).toMatchObject({ title: 'Mai lucrează', improve: ['Asta e altă constituție.'] });
  });
  it('none uses the explanation, or a default', () => {
    expect(check(e, a('altceva')).items[0]!.improve).toEqual(['Promulgat de Cuza în 1864.']);
    const f = check({ ...e, explanation: null } as ConsolidationExercise, a(''));
    expect(f.verdict).toBe('no');
    expect(f.items[0]!.improve).toEqual(['Nu am găsit răspunsul în sursă.']);
    expect(f.reveal).toEqual(['Statutul Dezvoltător']);
  });
});

describe('multi_answer', () => {
  const e = ex(
    {
      type: 'multi_answer',
      count: 2,
      groups: [
        { id: 'm', variants: ['Moldova'] },
        { id: 't', variants: ['Țara Românească', 'Muntenia', 'Valahia'] },
        { id: 'd', variants: ['Dobrogea'] },
      ],
    },
    [],
  );
  const a = (...texts: string[]): ExerciseAnswer => ({ type: 'multi_answer', texts });
  it('ok when N distinct groups hit', () => {
    const f = check(e, a('Moldova', 'Tara Romaneasca'));
    expect(f.verdict).toBe('ok');
    expect(f.fields).toEqual(['ok', 'ok']);
    expect(f.reveal).toEqual(['Moldova', 'Țara Românească', 'Dobrogea']);
  });
  it('a duplicate is almost with its message', () => {
    const f = check(e, a('Muntenia', 'Valahia'));
    expect(f.verdict).toBe('almost');
    expect(f.fields).toEqual(['ok', 'almost']);
    expect(f.items[0]!.improve).toEqual(['Ai scris de două ori același răspuns. Mai caută unul.']);
  });
  it('some hit is almost, none is no', () => {
    const f = check(e, a('Moldova', 'Roma'));
    expect(f.verdict).toBe('almost');
    expect(f.fields).toEqual(['ok', 'no']);
    expect(f.items[0]!.improve).toEqual(['1 din 2 corecte.']);
    const g = check(e, a('x', ''));
    expect(g.verdict).toBe('no');
    expect(g.fields).toEqual(['no', 'no']);
  });
});

describe('source_info', () => {
  const e = ex({ type: 'source_info', count: 1, spans: [spanOf('a', S1.replace(/\.$/, ''))], explanation: null });
  const a = (...marks: Mark[]): ExerciseAnswer => ({ type: 'source_info', marks });
  it('ok', () => {
    const f = check(e, a(markOf(S1)));
    expect(f.verdict).toBe('ok');
    expect(f.items[0]).toMatchObject({ key: 'mark-0', title: 'Corect!', good: ['Ai găsit o informație completă.'] });
    expect(f.marks).toEqual([{ ...markOf(S1), verdict: 'ok' }]);
    expect(f.reveal).toEqual([S1.replace(/\.$/, '')]);
  });
  it('long', () => {
    const f = check(e, a(markOf(`${S1} ${S2}`)));
    expect(f.verdict).toBe('almost');
    expect(f.items[0]!.title).toBe('Aproape');
    expect(f.items[0]!.improve[0]).toMatch(/^Informația e acolo, dar ai selectat și text în plus/);
    expect(f.marks![0]!.verdict).toBe('almost');
  });
  it('short', () => {
    const f = check(e, a(markOf('Domnul urma să fie ales')));
    expect(f.verdict).toBe('almost');
    expect(f.items[0]!.improve[0]).toMatch(/^Ai prins doar o parte/);
  });
  it('none, and no marks', () => {
    const f = check(e, a(markOf(S2)));
    expect(f.verdict).toBe('no');
    expect(f.items[0]).toMatchObject({ title: 'Mai lucrează', improve: ['Fragmentul ales nu conține informația cerută.'] });
    expect(f.marks![0]!.verdict).toBe('no');
    const g = check(e, a());
    expect(g.verdict).toBe('no');
    expect(g.items).toHaveLength(1);
    expect(g.reveal).toEqual([S1.replace(/\.$/, '')]);
  });
  it('two infos: second a duplicate stays almost and reports the shortfall', () => {
    const e2 = ex({ type: 'source_info', count: 2, spans: [spanOf('a', S1.replace(/\.$/, '')), spanOf('b', S2.replace(/\.$/, ''))] });
    const dup = check(e2, a(markOf(S1), markOf(S1)));
    expect(dup.verdict).toBe('almost');
    expect(dup.marks!.map((m) => m.verdict)).toEqual(['ok', 'almost']);
    expect(dup.items.map((i) => i.key)).toEqual(['mark-0', 'mark-1', 'answer']);
    expect(dup.items[2]!.improve).toEqual(['Ai găsit 1 din 2 informații.']);
    const full = check(e2, a(markOf(S1), markOf(S2)));
    expect(full.verdict).toBe('ok');
    expect(full.items.map((i) => i.key)).toEqual(['mark-0', 'mark-1']);
  });
});

describe('source_letter', () => {
  const two = [
    { sourceId: 'sa', label: 'A' as const },
    { sourceId: 'sb', label: 'B' as const },
  ];
  const e = ex({ type: 'source_letter', correct: 'A', evidence: spanOf('ev', 'Puterea legislativă era exercitată colectiv') }, two);
  const a = (letter: 'A' | 'B' | null): ExerciseAnswer => ({ type: 'source_letter', letter });
  it('ok shows the evidence', () => {
    const f = check(e, a('A'));
    expect(f.verdict).toBe('ok');
    expect(f.items[0]).toMatchObject({ title: 'Corect!', good: ['Sursa A: „Puterea legislativă era exercitată colectiv”.'] });
    expect(f.reveal).toEqual(['Puterea legislativă era exercitată colectiv']);
  });
  it('wrong or empty', () => {
    const f = check(e, a('B'));
    expect(f.verdict).toBe('no');
    expect(f.items[0]).toMatchObject({ title: 'Mai lucrează' });
    expect(f.items[0]!.improve[0]).toMatch(/sursa A/);
    expect(check(e, a(null)).verdict).toBe('no');
  });
  it('no evidence means no reveal', () => {
    const f = check({ ...e, evidence: null } as ConsolidationExercise, a('A'));
    expect(f.verdict).toBe('ok');
    expect(f.reveal).toBeUndefined();
  });
});

describe('cause_effect', () => {
  const CAUSE = 'Prin legea din 1863 averile mănăstirești au trecut în proprietatea statului';
  const EFFECT = 'un sfert din teritoriu a devenit patrimoniu al statului';
  const e = ex({
    type: 'cause_effect',
    pairs: [{ id: 'p', cause: spanOf('c', CAUSE), effect: spanOf('f', EFFECT), explanation: 'Legea a secularizat averile.' }],
  });
  const a = (cause: Mark | null, effect: Mark | null): ExerciseAnswer => ({ type: 'cause_effect', cause, effect });
  it('exact', () => {
    const f = check(e, a(markOf(CAUSE), markOf(EFFECT)));
    expect(f.verdict).toBe('ok');
    expect(f.items[0]).toMatchObject({
      key: 'relation',
      title: 'Corect!',
      good: ['Ai stabilit o relație cauză-efect validă și ai precizat corect rolurile.', 'Legea a secularizat averile.'],
    });
    expect(f.marks!.map((m) => m.verdict)).toEqual(['ok', 'ok']);
    expect(f.swapped).toBeUndefined();
    expect(f.reveal).toEqual([`Cauză: ${CAUSE} / Efect: ${EFFECT}`]);
  });
  it('near: extra text', () => {
    const f = check(e, a(markOf(`${S2} ${CAUSE}`), markOf(EFFECT)));
    expect(f.verdict).toBe('almost');
    expect(f.items[0]).toMatchObject({ title: 'Aproape' });
    expect(f.items[0]!.improve).toEqual(['Relația e corectă, dar ai selectat și text în plus. Păstrează doar cele două informații.']);
    expect(f.marks!.map((m) => m.verdict)).toEqual(['almost', 'almost']);
  });
  it('swapped', () => {
    const f = check(e, a(markOf(EFFECT), markOf(CAUSE)));
    expect(f.verdict).toBe('almost');
    expect(f.swapped).toBe(true);
    expect(f.items[0]!.title).toBe('Aproape: ai inversat rolurile');
    expect(f.items[0]!.improve[0]).toMatch(/^Informațiile sunt legate, dar cauza e cealaltă/);
  });
  it('partial: one side incomplete', () => {
    const f = check(e, a(markOf('Prin legea din 1863'), markOf(EFFECT)));
    expect(f.verdict).toBe('almost');
    expect(f.items[0]!.improve[0]).toMatch(/^Ai găsit relația, dar una dintre informații e incompletă/);
    expect(f.swapped).toBeUndefined();
  });
  it('unrelated: each valid, from different pairs', () => {
    const two = ex({
      type: 'cause_effect',
      pairs: [
        { id: 'p', cause: spanOf('c', CAUSE), effect: spanOf('f', EFFECT), explanation: null },
        { id: 'q', cause: spanOf('c2', 'Domnul urma să fie ales pe viață'), effect: spanOf('f2', 'Adunarea electivă'), explanation: null },
      ],
    });
    const f = check(two, a(markOf(CAUSE), markOf('Adunarea electivă')));
    expect(f.verdict).toBe('no');
    expect(f.items[0]!.improve).toEqual(['Fiecare informație poate fi cauză, respectiv efect, dar nu sunt legate între ele.']);
    expect(f.marks!.map((m) => m.verdict)).toEqual(['almost', 'almost']);
  });
  it('none: connector hint, and missing marks', () => {
    const f = check(e, a(markOf(S2), markOf(EFFECT)));
    expect(f.verdict).toBe('no');
    expect(f.items[0]!.improve[0]).toMatch(/^Caută conectorii din text: „fiindcă”, „ca urmare”, „cu scopul de a”/);
    expect(f.marks!.map((m) => m.verdict)).toEqual(['no', 'almost']); // the effect alone is a valid effect
    const g = check(e, a(markOf(CAUSE), null));
    expect(g.verdict).toBe('no');
    expect(g.items[0]!.improve).toEqual(['Marchează și cauza, și efectul.']);
  });
});

describe('viewpoint', () => {
  const e = ex({ type: 'viewpoint', count: 2, spans: [spanOf('a', S1.replace(/\.$/, '')), spanOf('b', S2.replace(/\.$/, ''))] });
  const a = (...marks: Mark[]): ExerciseAnswer => ({ type: 'viewpoint', text: 'Cred că…', marks });
  it('only support items, verdict stays null', () => {
    const f = check(e, a(markOf(S1), markOf(S3)));
    expect(f.verdict).toBeNull();
    expect(f.items.map((i) => [i.key, i.verdict])).toEqual([
      ['support-0', 'ok'],
      ['support-1', 'no'],
    ]);
    expect(f.items[1]!.improve).toEqual(['Fragmentul ales nu conține informația cerută.']);
    expect(f.marks!.map((m) => m.verdict)).toEqual(['ok', 'no']);
  });
  it('a missing mark is a no item; a long one is almost', () => {
    const f = check(e, a(markOf(`${S1} ${S2}`)));
    expect(f.items.map((i) => [i.key, i.verdict])).toEqual([
      ['support-0', 'almost'],
      ['support-1', 'no'],
    ]);
    expect(f.items[1]!.improve).toEqual(['Marchează încă o informație din sursă.']);
  });
});

describe('argument', () => {
  it('has no items and a null verdict', () => {
    expect(check(ex({ type: 'argument' }, []), { type: 'argument', text: 'Deoarece…' })).toEqual({ verdict: null, items: [] });
  });
});

describe('facts', () => {
  const e = ex({ type: 'facts', count: 2 }, []);
  const a = (...texts: string[]): ExerciseAnswer => ({ type: 'facts', texts });
  const GOOD1 = 'În 1866 s-a adoptat prima Constituție a României moderne.';
  const GOOD2 = 'În 1877 România și-a proclamat independența de stat.';
  it('passes the instant checks with a null verdict', () => {
    expect(check(e, a(GOOD1, GOOD2))).toEqual({ verdict: null, items: [] });
  });
  it('empty or short fields are no items', () => {
    const f = check(e, a(GOOD1, 'În 1866.'));
    expect(f.verdict).toBeNull();
    expect(f.items.map((i) => [i.key, i.verdict])).toEqual([['fact-1', 'no']]);
    const g = check(e, a('', ''));
    expect(g.verdict).toBe('no');
    expect(g.items.map((i) => i.key)).toEqual(['fact-0', 'fact-1']);
    expect(g.items[0]!.title).toBe('Faptul 1: câmp gol');
    expect(check(e, a(GOOD1)).items.map((i) => i.key)).toEqual(['fact-1']);
  });
  it('the same normalised fact twice', () => {
    const f = check(e, a(GOOD1, GOOD1.toUpperCase().replace('Ă', 'A')));
    expect(f.items).toHaveLength(1);
    expect(f.items[0]).toMatchObject({ key: 'fact-1', verdict: 'no', title: 'Faptul 2: repetat' });
  });
});

describe('comparison', () => {
  const e = ex({ type: 'comparison', variant: 'similarity' }, []);
  it('an empty answer is a no item, otherwise null', () => {
    const f = check(e, { type: 'comparison', text: '  ' });
    expect(f.verdict).toBe('no');
    expect(f.items).toHaveLength(1);
    expect(f.items[0]).toMatchObject({ key: 'answer', verdict: 'no' });
    expect(check(e, { type: 'comparison', text: 'Ceva' })).toEqual({ verdict: null, items: [] });
  });
});

describe('essay', () => {
  const r = (id: string) => ({ id, text: 'T', modelAnswer: null, templateId: null, argument: false });
  const e = ex({ type: 'essay', requirements: [r('r1'), r('r2')] }, []);
  it('empty parts are no items keyed by requirement id', () => {
    const f = check(e, { type: 'essay', parts: { r1: 'Text', r2: ' ' } });
    expect(f.verdict).toBeNull();
    expect(f.items.map((i) => [i.key, i.verdict])).toEqual([['r2', 'no']]);
    const g = check(e, { type: 'essay', parts: {} });
    expect(g.verdict).toBe('no');
    expect(g.items.map((i) => i.key)).toEqual(['r1', 'r2']);
    expect(check(e, { type: 'essay', parts: { r1: 'a', r2: 'b' } })).toEqual({ verdict: null, items: [] });
  });
});

it('an answer of another type is a no', () => {
  const f = check(ex({ type: 'argument' }, []), { type: 'comparison', text: 'x' });
  expect(f.verdict).toBe('no');
});

describe('extra answers are ignored', () => {
  it('source_info judges only the first `count` marks', () => {
    const e = ex({ type: 'source_info', count: 1, spans: [spanOf('a', S1.replace(/\.$/, ''))] });
    const f = check(e, { type: 'source_info', marks: [markOf(S2), markOf(S1), markOf(S3)] });
    expect(f.verdict).toBe('no');
    expect(f.marks).toHaveLength(1);
    expect(f.items).toHaveLength(1);
  });
  it('viewpoint judges only the first `count` marks', () => {
    const e = ex({ type: 'viewpoint', count: 1, spans: [spanOf('a', S1.replace(/\.$/, ''))] });
    const f = check(e, { type: 'viewpoint', text: 'x', marks: [markOf(S1), markOf(S2)] });
    expect(f.items.map((i) => i.key)).toEqual(['support-0']);
  });
  it('multi_answer judges only the first `count` texts', () => {
    const e = ex({ type: 'multi_answer', count: 1, groups: [{ id: 'm', variants: ['Moldova'] }, { id: 't', variants: ['Muntenia'] }] }, []);
    const f = check(e, { type: 'multi_answer', texts: ['x', 'Moldova', 'Muntenia'] });
    expect(f.verdict).toBe('no');
    expect(f.fields).toEqual(['no']);
  });
});

describe('cause_effect colours in none/unrelated', () => {
  it('cause colour is the best cause-role judgement over all pairs', () => {
    const CAUSE = 'Prin legea din 1863 averile mănăstirești au trecut în proprietatea statului';
    const e = ex({
      type: 'cause_effect',
      pairs: [
        { id: 'p', cause: spanOf('c', 'Domnul urma să fie ales pe viață'), effect: spanOf('f', 'Adunarea electivă'), explanation: null },
        { id: 'q', cause: spanOf('c2', CAUSE), effect: spanOf('f2', 'un sfert din teritoriu a devenit patrimoniu al statului'), explanation: null },
      ],
    });
    const f = check(e, { type: 'cause_effect', cause: markOf(CAUSE), effect: markOf(S2) });
    expect(f.verdict).toBe('no');
    expect(f.marks!.map((m) => m.verdict)).toEqual(['almost', 'no']);
  });
});
