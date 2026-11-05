import { describe, expect, it } from 'vitest';
import type { AnswerSpan, Mark } from './types';
import { spanToWords, tokenizeSource } from './sourceText';
import { judgeMark, judgeMarks, judgePair } from './marks';

const SRC_B = `Începuturile domniei lui Al. I. Cuza au fost anevoioase fiindcă domnul era obligat să colaboreze cu două guverne, unul la Iaşi şi celălalt la Bucureşti. Abia la sfârșitul anului 1861, Imperiul Otoman a recunoscut unirea politico-administrativă a Moldovei cu Țara Românească pe timpul domniei lui Cuza. Unirea, odată realizată, neînțelegerile politice au reapărut cu puteri sporite de însemnătatea problemelor de rezolvat, între care cea mai dificilă era, desigur, elaborarea Legii rurale. O altă problemă a estompat temporar confruntarea în jurul Legii rurale: secularizarea averilor mănăstirești. Prin legea din 1863 au fost trecute în proprietatea statului „toate averile mănăstirești“. Ca urmare, aproximativ un sfert din teritoriul țării a devenit patrimoniu al statului, ceea ce a mărit suprafața de care dispuneau autoritățile pentru viitoarea împroprietărire. Cu scopul de a elimina obstacolele din calea împroprietăririi, ca şi a altor reforme, Cuza a promulgat o nouă constituție (Statutul Dezvoltător), care întărea puterea domnului în detrimentul legislativului.`;

const SRC = 'src';
const T = tokenizeSource(SRC_B);
const range = (text: string): [number, number] => {
  const at = SRC_B.indexOf(text);
  if (at < 0) throw new Error(`not in source: ${text}`);
  const r = spanToWords(T, { start: at, end: at + text.length });
  if (!r) throw new Error('no words');
  return r;
};
const mark = (text: string, sourceId = SRC): Mark => {
  const [from, to] = range(text);
  return { sourceId, from, to };
};
const span = (id: string, text: string, extra: Partial<AnswerSpan> = {}): AnswerSpan => {
  const start = SRC_B.indexOf(text);
  if (start < 0) throw new Error(`not in source: ${text}`);
  return { id, sourceId: SRC, start, end: start + text.length, text, limitStart: null, limitEnd: null, ...extra };
};

const CORE = 'aproximativ un sfert din teritoriul țării a devenit patrimoniu al statului';
const SENTENCE =
  'Ca urmare, aproximativ un sfert din teritoriul țării a devenit patrimoniu al statului, ceea ce a mărit suprafața de care dispuneau autoritățile pentru viitoarea împroprietărire.';
const PREV_SENTENCE = 'Prin legea din 1863 au fost trecute în proprietatea statului „toate averile mănăstirești“.';
const NEXT_START = 'Cu scopul de a elimina obstacolele din calea împroprietăririi,';

describe('judgeMark', () => {
  const s = span('a', CORE);
  it('ok: contains the core, within the sentence', () => {
    expect(judgeMark(T, mark(CORE), s)).toBe('ok');
    expect(judgeMark(T, mark('Ca urmare, ' + CORE), s)).toBe('ok');
    expect(judgeMark(T, mark(SENTENCE), s)).toBe('ok');
  });
  it('long: contains the core but goes past the sentence', () => {
    expect(judgeMark(T, mark(SENTENCE + ' ' + NEXT_START), s)).toBe('long');
    expect(judgeMark(T, mark(PREV_SENTENCE + ' Ca urmare, ' + CORE), s)).toBe('long');
  });
  it('short: overlaps the core but misses part of it', () => {
    expect(judgeMark(T, mark('aproximativ un sfert'), s)).toBe('short');
    expect(judgeMark(T, mark('statului, ceea ce a mărit'), s)).toBe('short');
  });
  it('none: no overlap, or a mark on another source', () => {
    expect(judgeMark(T, mark('Abia la sfârșitul anului 1861'), s)).toBe('none');
    expect(judgeMark(T, mark(CORE, 'other'), s)).toBe('none');
  });
  it('trims leading/trailing punctuation-only and omission words', () => {
    const T2 = tokenizeSource('alfa beta - gamma [...] delta');
    const m = (from: number, to: number): Mark => ({ sourceId: SRC, from, to });
    const at = (text: string): AnswerSpan => {
      const start = 'alfa beta - gamma [...] delta'.indexOf(text);
      return { id: text, sourceId: SRC, start, end: start + text.length, text, limitStart: 0, limitEnd: 29 };
    };
    expect(T2.words[4]!.omission).toBe(true);
    expect(judgeMark(T2, m(0, 1), at('alfa'))).toBe('ok');
    // "-" or "[...]" alone are nothing
    expect(judgeMark(T2, m(2, 2), at('gamma'))).toBe('none');
    expect(judgeMark(T2, m(4, 4), at('delta'))).toBe('none');
    // edges are trimmed: "- gamma [...]" is just "gamma"
    expect(judgeMark(T2, m(2, 4), at('gamma'))).toBe('ok');
    // so a trailing "-" does not reach into the next word's span
    expect(judgeMark(T2, m(1, 2), at('gamma'))).toBe('none');
    expect(judgeMark(T2, m(3, 4), at('delta'))).toBe('none');
  });
  it('an explicit limit is used as-is', () => {
    const lim = span('w', CORE, {
      limitStart: SRC_B.indexOf(PREV_SENTENCE),
      limitEnd: SRC_B.indexOf('patrimoniu al statului') + 'patrimoniu al statului'.length,
    });
    expect(judgeMark(T, mark(PREV_SENTENCE + ' Ca urmare, ' + CORE), lim)).toBe('ok');
    expect(judgeMark(T, mark(SENTENCE), lim)).toBe('long');
  });
});

describe('judgeMarks', () => {
  const a = span('a', 'domnul era obligat să colaboreze cu două guverne');
  const b = span('b', 'Imperiul Otoman a recunoscut unirea politico-administrativă');
  it('ok when N distinct spans are matched', () => {
    const r = judgeMarks(T, [mark(a.text), mark(b.text)], [a, b], 2);
    expect(r.verdict).toBe('ok');
    expect(r.perMark.map((m) => m.spanId)).toEqual(['a', 'b']);
    expect(r.perMark.every((m) => !m.duplicate)).toBe(true);
  });
  it('two marks on the same span count once and the second is a duplicate', () => {
    const r = judgeMarks(T, [mark(a.text), mark('fiindcă ' + a.text)], [a, b], 2);
    expect(r.verdict).toBe('almost');
    expect(r.perMark[0]).toMatchObject({ judgement: 'ok', spanId: 'a', duplicate: false });
    expect(r.perMark[1]).toMatchObject({ judgement: 'ok', spanId: 'a', duplicate: true });
  });
  it('count 1 with one ok mark is ok', () => {
    expect(judgeMarks(T, [mark(a.text)], [a, b], 1).verdict).toBe('ok');
  });
  it('a short mark makes it almost; nothing matching is no', () => {
    expect(judgeMarks(T, [mark('Imperiul Otoman')], [a, b], 1).verdict).toBe('almost');
    const r = judgeMarks(T, [mark('Cuza a promulgat')], [a, b], 1);
    expect(r.verdict).toBe('no');
    expect(r.perMark[0]).toMatchObject({ judgement: 'none', spanId: null, duplicate: false });
  });
  it('no marks is no', () => {
    expect(judgeMarks(T, [], [a, b], 1)).toEqual({ perMark: [], verdict: 'no' });
  });
  it('a mark on another source never matches', () => {
    expect(judgeMarks(T, [mark(a.text, 'other')], [a], 1).verdict).toBe('no');
  });
  it('an ok mark claims the span before an earlier short mark of the same span', () => {
    const r = judgeMarks(T, [mark('domnul era obligat'), mark(a.text)], [a], 1);
    expect(r.verdict).toBe('ok');
    expect(r.perMark[1]).toMatchObject({ judgement: 'ok', duplicate: false });
    expect(r.perMark[0]).toMatchObject({ judgement: 'short', duplicate: true });
  });
});

describe('judgePair', () => {
  const P1 = {
    id: 'p1',
    cause: span('p1c', 'domnul era obligat să colaboreze cu două guverne'),
    effect: span('p1e', 'Începuturile domniei lui Al. I. Cuza au fost anevoioase'),
  };
  const P2 = {
    id: 'p2',
    cause: span('p2c', 'au fost trecute în proprietatea statului „toate averile mănăstirești“'),
    effect: span('p2e', CORE),
  };
  const P3 = {
    id: 'p3',
    cause: span('p3c', CORE),
    effect: span('p3e', 'a mărit suprafața de care dispuneau autoritățile pentru viitoarea împroprietărire'),
  };
  const P4 = {
    id: 'p4',
    cause: span('p4c', 'Cu scopul de a elimina obstacolele din calea împroprietăririi'),
    effect: span('p4e', 'Cuza a promulgat o nouă constituție (Statutul Dezvoltător)'),
  };
  const pairs = [P1, P2, P3, P4];
  const cause2 = mark(P2.cause.text);
  const effect2 = mark(P2.effect.text);

  it('exact: both ok on the same pair', () => {
    expect(judgePair(T, cause2, effect2, pairs)).toEqual({ kind: 'exact', pairId: 'p2', cause: 'ok', effect: 'ok' });
  });
  it('exact for the same-sentence pair', () => {
    expect(judgePair(T, mark(CORE), mark(P3.effect.text), pairs)).toMatchObject({ kind: 'exact', pairId: 'p3' });
  });
  it('same-sentence pair: the whole sentence as the effect is long, not ok', () => {
    expect(judgePair(T, mark(CORE), mark(SENTENCE), [P3])).toEqual({
      kind: 'near',
      pairId: 'p3',
      cause: 'ok',
      effect: 'long',
    });
  });
  it('same-sentence pair: the whole sentence as the cause is long, not ok', () => {
    expect(judgePair(T, mark(SENTENCE), mark(P3.effect.text), [P3])).toMatchObject({
      kind: 'near',
      pairId: 'p3',
      cause: 'long',
      effect: 'ok',
    });
  });
  it('near: a cause that runs into the neighbouring sentence is long', () => {
    expect(judgePair(T, mark(PREV_SENTENCE + ' Ca urmare, ' + CORE), effect2, [P2])).toMatchObject({
      kind: 'near',
      pairId: 'p2',
      cause: 'long',
      effect: 'ok',
    });
  });
  it('swapped: roles inverted', () => {
    expect(judgePair(T, effect2, cause2, pairs)).toEqual({ kind: 'swapped', pairId: 'p2', cause: 'ok', effect: 'ok' });
  });
  it('partial: both overlap the same pair but one is incomplete', () => {
    expect(judgePair(T, cause2, mark('aproximativ un sfert'), [P2])).toEqual({
      kind: 'partial',
      pairId: 'p2',
      cause: 'ok',
      effect: 'short',
    });
  });
  it('unrelated: each fits some pair, but not the same one', () => {
    expect(judgePair(T, mark(P1.cause.text), mark(P4.effect.text), pairs)).toEqual({
      kind: 'unrelated',
      pairId: null,
      cause: 'ok',
      effect: 'ok',
    });
  });
  it('none: anything else', () => {
    const r = judgePair(T, mark('Abia la sfârșitul anului 1861'), mark(P4.effect.text), pairs);
    expect(r.kind).toBe('none');
    expect(r.pairId).toBeNull();
    expect(r.cause).toBe('none');
    expect(r.effect).toBe('ok');
  });
  it('none: a short mark elsewhere does not make a pair unrelated', () => {
    expect(judgePair(T, mark('domnul era'), mark(P4.effect.text), pairs).kind).toBe('none');
  });
  it('marks on another source judge none', () => {
    expect(judgePair(T, mark(P2.cause.text, 'other'), mark(P2.effect.text, 'other'), pairs).kind).toBe('none');
  });
});
