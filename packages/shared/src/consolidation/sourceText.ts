import type { AnswerSpan } from './types';

export type SourceWord = { i: number; text: string; start: number; end: number; paragraph: number; omission: boolean };
export type TokenizedSource = { words: SourceWord[]; paragraphCount: number };

const SHORT_SOURCE_WORDS = 70;
const WORDS_PER_MINUTE = 200;

/** Words = maximal non-whitespace runs; a blank line (whitespace-only counts) starts a new paragraph. */
export function tokenizeSource(body: string): TokenizedSource {
  const words: SourceWord[] = [];
  let paragraph = 0;
  let lastEnd = 0;
  for (const m of body.matchAll(/\S+/g)) {
    const start = m.index;
    if (words.length > 0 && /\r?\n[^\S\r\n]*\r?\n/.test(body.slice(lastEnd, start))) paragraph++;
    lastEnd = start + m[0].length;
    words.push({
      i: words.length,
      text: m[0],
      start,
      end: lastEnd,
      paragraph,
      omission: m[0].startsWith('[...]'),
    });
  }
  return { words, paragraphCount: words.length === 0 ? 0 : paragraph + 1 };
}

/** A single capital letter ("I.", "D.") is an initial; capitalised words ("Ion.") end sentences. */
const INITIAL = /^[A-ZĂÂÎȘȚŞŢ]\.$/;
/** Compared lower-case with diacritics stripped (so "ș.a." and "ş.a." both match "s.a."). */
const ABBREVIATIONS = new Set([
  'al.', 'gh.', 'th.', 'st.', 'em.', 'gr.', 'mih.',
  'i.hr.', 'd.hr.', 'etc.', 's.a.', 'str.', 'p.', 'pp.', 'vol.', 'cf.', 'nr.', 'cca.', 'sec.',
]);

function foldCase(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Abbreviations that often close a sentence: they end one when the next word starts upper-case. */
const SENTENCE_FINAL_ABBREVIATIONS = new Set(['etc.', 'i.hr.', 'd.hr.']);
const OPENING_PUNCTUATION = /^[(„"«“‘'[]+/;

function endsSentence(text: string, next: string | undefined): boolean {
  const core = text.replace(/["”“»’)\]]+$/, '').replace(OPENING_PUNCTUATION, '');
  if (!/[.!?]$/.test(core)) return false;
  if (INITIAL.test(core)) return false;
  const folded = foldCase(core);
  if (SENTENCE_FINAL_ABBREVIATIONS.has(folded)) {
    const head = (next ?? '').replace(OPENING_PUNCTUATION, '').charAt(0);
    return head !== '' && head !== head.toLowerCase() && head === head.toUpperCase();
  }
  return !ABBREVIATIONS.has(folded);
}

/** Smallest word range covering whole sentences that contain words from..to. */
export function sentenceRange(t: TokenizedSource, from: number, to: number): [number, number] {
  const w = t.words;
  const isEnd = (i: number) => i >= w.length - 1 || w[i + 1]!.paragraph !== w[i]!.paragraph || endsSentence(w[i]!.text, w[i + 1]?.text);
  let a = from;
  while (a > 0 && !isEnd(a - 1)) a--;
  let b = to;
  while (b < w.length - 1 && !isEnd(b)) b++;
  return [a, b];
}

/** Words overlapping the char range [start, end); null when none do. */
export function spanToWords(t: TokenizedSource, span: Pick<AnswerSpan, 'start' | 'end'>): [number, number] | null {
  const first = t.words.findIndex((x) => x.end > span.start && x.start < span.end);
  if (first < 0) return null;
  let last = first;
  while (last + 1 < t.words.length && t.words[last + 1]!.start < span.end) last++;
  return [first, last];
}

/** The explicit limit when set, otherwise the sentence(s) of the core. */
export function limitWords(t: TokenizedSource, span: AnswerSpan): [number, number] {
  if (span.limitStart !== null && span.limitEnd !== null) {
    const l = spanToWords(t, { start: span.limitStart, end: span.limitEnd });
    if (l) return l;
  }
  const core = spanToWords(t, span);
  if (!core) return [0, Math.max(0, t.words.length - 1)];
  return sentenceRange(t, core[0], core[1]);
}

/** Re-find a span by its quoted text after the body changed; null = detached. */
export function reanchorSpan(body: string, span: AnswerSpan): AnswerSpan | null {
  if (body.slice(span.start, span.end) === span.text) return { ...span };
  if (span.text === '') return null;
  let best = -1;
  for (let at = body.indexOf(span.text); at >= 0; at = body.indexOf(span.text, at + 1)) {
    if (best < 0 || Math.abs(at - span.start) < Math.abs(best - span.start)) best = at;
  }
  if (best < 0) return null;
  const delta = best - span.start;
  const start = best;
  const end = best + span.text.length;
  let limitStart: number | null = null;
  let limitEnd: number | null = null;
  if (span.limitStart !== null && span.limitEnd !== null) {
    const ls = span.limitStart + delta;
    const le = span.limitEnd + delta;
    if (ls >= 0 && le <= body.length && ls <= start && le >= end) {
      limitStart = ls;
      limitEnd = le;
    }
  }
  return { ...span, start, end, limitStart, limitEnd };
}

function wordCount(body: string): number {
  return tokenizeSource(body).words.length;
}

export function isShortSource(body: string): boolean {
  return wordCount(body) < SHORT_SOURCE_WORDS;
}

export function readingMinutes(body: string): number {
  return Math.max(1, Math.round(wordCount(body) / WORDS_PER_MINUTE));
}
