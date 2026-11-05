import { normalizeAnswer } from './normalize';
import { limitWords, sentenceRange, spanToWords, type TokenizedSource } from './sourceText';
import type { AnswerSpan, Mark, Verdict } from './types';

export type MarkJudgement = 'ok' | 'long' | 'short' | 'none';
type Range = [number, number];

const RANK: Record<MarkJudgement, number> = { ok: 3, long: 2, short: 1, none: 0 };
const best = (a: MarkJudgement, b: MarkJudgement): MarkJudgement => (RANK[b] > RANK[a] ? b : a);

/** Leading/trailing punctuation-only or omission words are not part of the student's mark. */
function trimMark(t: TokenizedSource, mark: Mark): Range | null {
  let from = Math.max(0, mark.from);
  let to = Math.min(t.words.length - 1, mark.to);
  const blank = (i: number) => t.words[i]!.omission || normalizeAnswer(t.words[i]!.text) === '';
  while (from <= to && blank(from)) from++;
  while (to >= from && blank(to)) to--;
  return from <= to ? [from, to] : null;
}

function judgeAgainst(t: TokenizedSource, mark: Mark, span: AnswerSpan, limit: Range | null): MarkJudgement {
  if (mark.sourceId !== span.sourceId) return 'none';
  const core = spanToWords(t, span);
  const m = trimMark(t, mark);
  if (!core || !m) return 'none';
  if (m[1] < core[0] || m[0] > core[1]) return 'none';
  if (m[0] > core[0] || m[1] < core[1]) return 'short';
  const [lo, hi] = limit ?? limitWords(t, span);
  return m[0] >= lo && m[1] <= hi ? 'ok' : 'long';
}

export function judgeMark(t: TokenizedSource, mark: Mark, span: AnswerSpan): MarkJudgement {
  return judgeAgainst(t, mark, span, null);
}

export function judgeMarks(
  t: TokenizedSource,
  marks: Mark[],
  spans: AnswerSpan[],
  count: number,
): { perMark: Array<{ judgement: MarkJudgement; spanId: string | null; duplicate: boolean }>; verdict: Verdict } {
  const perMark = marks.map(() => ({ judgement: 'none' as MarkJudgement, spanId: null as string | null, duplicate: false }));
  const candidates = marks.map((mark) => {
    const judged = spans.map((s) => ({ id: s.id, j: judgeMark(t, mark, s) }));
    const top = judged.reduce<MarkJudgement>((acc, x) => best(acc, x.j), 'none');
    return { top, ids: judged.filter((x) => x.j === top && top !== 'none').map((x) => x.id) };
  });
  // Better marks claim spans first, so a weak mark never makes a good one a duplicate.
  const order = marks.map((_, i) => i).sort((a, b) => RANK[candidates[b]!.top] - RANK[candidates[a]!.top] || a - b);
  const claimed = new Set<string>();
  const okSpans = new Set<string>();
  for (const i of order) {
    const { top, ids } = candidates[i]!;
    if (top === 'none') continue;
    const free = ids.find((id) => !claimed.has(id));
    const spanId = free ?? ids[0]!;
    perMark[i] = { judgement: top, spanId, duplicate: free === undefined };
    claimed.add(spanId);
    if (top === 'ok') okSpans.add(spanId);
  }
  const verdict: Verdict = okSpans.size >= count ? 'ok' : perMark.some((m) => m.judgement !== 'none') ? 'almost' : 'no';
  return { perMark, verdict };
}

export type PairJudgement = {
  kind: 'exact' | 'near' | 'swapped' | 'partial' | 'unrelated' | 'none';
  pairId: string | null;
  cause: MarkJudgement;
  effect: MarkJudgement;
};

/** Limit of `span` for pairs: a default (sentence) limit stops short of the other side's core when both sit in one sentence. */
function pairLimit(t: TokenizedSource, span: AnswerSpan, other: AnswerSpan): Range {
  if (span.limitStart !== null && span.limitEnd !== null) return limitWords(t, span);
  const core = spanToWords(t, span);
  const otherCore = spanToWords(t, other);
  if (!core || !otherCore || other.sourceId !== span.sourceId) return limitWords(t, span);
  const [lo, hi] = sentenceRange(t, core[0], core[1]);
  if (otherCore[1] < lo || otherCore[0] > hi) return [lo, hi];
  if (otherCore[0] > core[1]) return [lo, otherCore[0] - 1];
  if (otherCore[1] < core[0]) return [otherCore[1] + 1, hi];
  return [lo, hi];
}

const loose = (j: MarkJudgement) => j === 'ok' || j === 'long';

export function judgePair(
  t: TokenizedSource,
  cause: Mark,
  effect: Mark,
  pairs: { id: string; cause: AnswerSpan; effect: AnswerSpan }[],
): PairJudgement {
  const rows = pairs.map((p) => {
    const cl = pairLimit(t, p.cause, p.effect);
    const el = pairLimit(t, p.effect, p.cause);
    return {
      id: p.id,
      cc: judgeAgainst(t, cause, p.cause, cl), // cause mark on the pair's cause
      ee: judgeAgainst(t, effect, p.effect, el),
      ce: judgeAgainst(t, cause, p.effect, el), // cause mark on the pair's effect (roles inverted)
      ec: judgeAgainst(t, effect, p.cause, cl),
    };
  });
  const found = (kind: PairJudgement['kind'], id: string, c: MarkJudgement, e: MarkJudgement): PairJudgement => ({
    kind,
    pairId: id,
    cause: c,
    effect: e,
  });
  const exact = rows.find((r) => r.cc === 'ok' && r.ee === 'ok');
  if (exact) return found('exact', exact.id, 'ok', 'ok');
  const near = rows.find((r) => loose(r.cc) && loose(r.ee));
  if (near) return found('near', near.id, near.cc, near.ee);
  const swapped = rows.find((r) => loose(r.ce) && loose(r.ec));
  if (swapped) return found('swapped', swapped.id, swapped.ce, swapped.ec);
  const partial = rows.find((r) => r.cc !== 'none' && r.ee !== 'none');
  if (partial) return found('partial', partial.id, partial.cc, partial.ee);
  const bestCause = rows.reduce<MarkJudgement>((a, r) => best(a, r.cc), 'none');
  const bestEffect = rows.reduce<MarkJudgement>((a, r) => best(a, r.ee), 'none');
  const kind = loose(bestCause) && loose(bestEffect) ? 'unrelated' : 'none';
  return { kind, pairId: null, cause: bestCause, effect: bestEffect };
}
