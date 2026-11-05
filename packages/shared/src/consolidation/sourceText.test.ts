import { describe, expect, it } from 'vitest';
import type { AnswerSpan } from './types';
import {
  isShortSource,
  limitWords,
  readingMinutes,
  reanchorSpan,
  sentenceRange,
  spanToWords,
  tokenizeSource,
} from './sourceText';

const SRC_B = `Începuturile domniei lui Al. I. Cuza au fost anevoioase fiindcă domnul era obligat să colaboreze cu două guverne, unul la Iaşi şi celălalt la Bucureşti. Abia la sfârșitul anului 1861, Imperiul Otoman a recunoscut unirea politico-administrativă a Moldovei cu Țara Românească pe timpul domniei lui Cuza. Unirea, odată realizată, neînțelegerile politice au reapărut cu puteri sporite de însemnătatea problemelor de rezolvat, între care cea mai dificilă era, desigur, elaborarea Legii rurale. O altă problemă a estompat temporar confruntarea în jurul Legii rurale: secularizarea averilor mănăstirești. Prin legea din 1863 au fost trecute în proprietatea statului „toate averile mănăstirești“. Ca urmare, aproximativ un sfert din teritoriul țării a devenit patrimoniu al statului, ceea ce a mărit suprafața de care dispuneau autoritățile pentru viitoarea împroprietărire. Cu scopul de a elimina obstacolele din calea împroprietăririi, ca şi a altor reforme, Cuza a promulgat o nouă constituție (Statutul Dezvoltător), care întărea puterea domnului în detrimentul legislativului.`;

const span = (body: string, text: string, extra: Partial<AnswerSpan> = {}): AnswerSpan => {
  const start = body.indexOf(text);
  return { id: 's', sourceId: 'src', start, end: start + text.length, text, limitStart: null, limitEnd: null, ...extra };
};
const words = (n: number) => Array.from({ length: n }, () => 'cuvânt').join(' ');

describe('tokenizeSource', () => {
  const body = 'Ana are.\n\nMere multe [...] azi.';
  const t = tokenizeSource(body);
  it('splits words and paragraphs', () => {
    expect(t.words).toHaveLength(6);
    expect(t.words.map((w) => w.paragraph)).toEqual([0, 0, 1, 1, 1, 1]);
    expect(t.paragraphCount).toBe(2);
    expect(t.words.map((w) => w.omission)).toEqual([false, false, false, false, true, false]);
    for (const w of t.words) expect(body.slice(w.start, w.end)).toBe(w.text);
    expect(t.words.map((w) => w.i)).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it('treats whitespace-only lines as blank and single newlines as spaces', () => {
    const u = tokenizeSource('a\nb\n  \nc');
    expect(u.words.map((w) => w.paragraph)).toEqual([0, 0, 1]);
  });
  it('handles empty bodies', () => {
    expect(tokenizeSource('  ')).toEqual({ words: [], paragraphCount: 0 });
  });
});

describe('sentenceRange', () => {
  const t = tokenizeSource(SRC_B);
  const idx = (s: string) => t.words.findIndex((w) => w.text === s);
  it('does not stop at initials', () => {
    const i = idx('obligat');
    const [a, b] = sentenceRange(t, i, i + 1);
    expect(t.words[a]!.text).toBe('Începuturile');
    expect(t.words[b]!.text).toBe('Bucureşti.');
  });
  it('keeps a leading initial in its sentence', () => {
    const u = tokenizeSource('D. Berindei a scris. Apoi a plecat.');
    expect(sentenceRange(u, 2, 2)).toEqual([0, 3]);
    expect(sentenceRange(u, 4, 4)).toEqual([4, 6]);
  });
  it('covers all sentences when the range crosses them', () => {
    const u = tokenizeSource('Unu doi. Trei patru! Cinci?');
    expect(sentenceRange(u, 1, 2)).toEqual([0, 3]);
  });
  it('ends sentences at quotes and paragraph breaks', () => {
    const u = tokenizeSource('El a zis „da.” Apoi a plecat\n\nAltul vine');
    expect(sentenceRange(u, 0, 0)).toEqual([0, 3]);
    expect(sentenceRange(u, 4, 4)).toEqual([4, 6]);
    expect(sentenceRange(u, 7, 7)).toEqual([7, 8]);
  });
  it('does not split on abbreviations', () => {
    const u = tokenizeSource('În sec. XIV a fost cca. 5 ani. Apoi.');
    expect(sentenceRange(u, 0, 0)).toEqual([0, 7]);
  });
});

describe('spanToWords', () => {
  const t = tokenizeSource(SRC_B);
  it('maps a span inside one word to that word', () => {
    const at = SRC_B.indexOf('Bucureşti') + 2;
    const w = spanToWords(t, { start: at, end: at + 3 });
    expect(w).not.toBeNull();
    expect(t.words[w![0]!]!.text).toBe('Bucureşti.');
    expect(w![1]).toBe(w![0]);
  });
  it('maps a multi-word span', () => {
    const s = span(SRC_B, 'toate averile mănăstirești');
    const w = spanToWords(t, s)!;
    expect(t.words.slice(w[0], w[1] + 1).map((x) => x.text)).toEqual(['„toate', 'averile', 'mănăstirești“.']);
  });
  it('returns null when no word overlaps', () => {
    expect(spanToWords(tokenizeSource('a  b'), { start: 2, end: 2 })).toBeNull();
  });
});

describe('limitWords', () => {
  const t = tokenizeSource(SRC_B);
  it('defaults to the core sentence', () => {
    const [a, b] = limitWords(t, span(SRC_B, 'domnul era obligat'));
    expect(t.words[a]!.text).toBe('Începuturile');
    expect(t.words[b]!.text).toBe('Bucureşti.');
  });
  it('uses the explicit limit', () => {
    const lim = 'Abia la sfârșitul anului 1861';
    const l = SRC_B.indexOf(lim);
    const s = span(SRC_B, 'domnul era obligat', { limitStart: 0, limitEnd: l + lim.length });
    const [a, b] = limitWords(t, s);
    expect(a).toBe(0);
    expect(t.words[b]!.text).toBe('1861,');
  });
});

describe('reanchorSpan', () => {
  const body = 'Unu doi trei. Patru cinci șase. Patru cinci șapte.';
  it('keeps an unchanged span', () => {
    const s = span(body, 'doi trei');
    expect(reanchorSpan(body, s)).toEqual(s);
  });
  it('shifts after an insertion before the span', () => {
    const s = span(body, 'doi trei');
    const r = reanchorSpan('NOU ' + body, s)!;
    expect(r.start).toBe(s.start + 4);
    expect(r.end).toBe(s.end + 4);
    expect(('NOU ' + body).slice(r.start, r.end)).toBe('doi trei');
    expect(r).not.toBe(s);
  });
  it('picks the occurrence nearest the old start', () => {
    const s = span(body, 'Patru cinci', { start: 32, end: 43 });
    expect(reanchorSpan(body, s)!.start).toBe(32);
    const s2 = span(body, 'Patru cinci', { start: 14, end: 25 });
    expect(reanchorSpan(body, s2)!.start).toBe(14);
    expect(reanchorSpan('xx ' + body, { ...s2, start: 40, end: 51 })!.start).toBe(35);
  });
  it('returns null when the text is gone', () => {
    expect(reanchorSpan('Altceva complet.', span(body, 'doi trei'))).toBeNull();
  });
  it('shifts a still-valid limit with the core', () => {
    const s = span(body, 'doi trei', { limitStart: 0, limitEnd: 13 });
    const r = reanchorSpan('NOU ' + body, s)!;
    expect(r.limitStart).toBe(4);
    expect(r.limitEnd).toBe(17);
  });
  it('resets the limit when it cannot be re-anchored, keeping the core', () => {
    const s = span(body, 'doi trei', { limitStart: 0, limitEnd: 13 });
    const r = reanchorSpan('X Unu doi trei', s)!;
    expect(r.text).toBe('doi trei');
    expect(r.limitStart).toBeNull();
    expect(r.limitEnd).toBeNull();
  });
});

describe('isShortSource / readingMinutes', () => {
  it('uses a 70-word threshold', () => {
    expect(isShortSource(words(69))).toBe(true);
    expect(isShortSource(words(70))).toBe(false);
  });
  it('estimates reading minutes', () => {
    expect(readingMinutes(words(10))).toBe(1);
    expect(readingMinutes(words(500))).toBe(3);
    expect(readingMinutes(words(1000))).toBe(5);
  });
});
