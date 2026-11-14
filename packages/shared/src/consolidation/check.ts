import { defaultText, type TextFn } from '../texts/catalog';
import { judgeMarks, judgePair, type MarkJudgement } from './marks';
import { matchGroups, matchVariants, normalizeAnswer } from './normalize';
import { tokenizeSource, type TokenizedSource } from './sourceText';
import type {
  AnswerSpan,
  ConsolidationExercise,
  ExerciseAnswer,
  ExerciseFeedback,
  FeedbackItem,
  Mark,
  Source,
  Verdict,
} from './types';

const MIN_FACT_CHARS = 15;

const item = (
  key: string,
  verdict: Verdict,
  title: string,
  { good = [], improve = [] }: { good?: string[]; improve?: string[] } = {},
): FeedbackItem => ({ key, verdict, title, good, improve, ai: false });

const VERDICT_KEY = { ok: 'consolidation.verdict.ok', almost: 'consolidation.verdict.almost', no: 'consolidation.verdict.no' } as const;
const plainTitle = (text: TextFn, v: Verdict) => (v === 'ok' ? text('consolidation.check.correct') : text(VERDICT_KEY[v]));
const blank = (s: string | undefined) => !s || s.trim() === '';

const markVerdict = (j: MarkJudgement, duplicate: boolean): Verdict =>
  j === 'none' ? 'no' : j === 'ok' && !duplicate ? 'ok' : 'almost';

/** Per-mark feedback shared by `source_info` and `viewpoint`. */
function judgeMarkItems(
  ex: Extract<ConsolidationExercise, { type: 'source_info' | 'viewpoint' }>,
  t: TokenizedSource,
  marks: Mark[],
  keyOf: (i: number) => string,
  text: TextFn,
): { items: FeedbackItem[]; marks: NonNullable<ExerciseFeedback['marks']>; verdict: Verdict; okCount: number } {
  const r = judgeMarks(t, marks, ex.spans, ex.count);
  const many = ex.count > 1;
  const phrase = (v: Verdict) => text(`consolidation.check.info.phrase.${v}`);
  const items = marks.map((_, i) => {
    const m = r.perMark[i]!;
    const v = markVerdict(m.judgement, m.duplicate);
    const title = many ? text('consolidation.check.info.numberedTitle', { n: i + 1, stare: phrase(v) }) : plainTitle(text, v);
    if (v === 'ok') return item(keyOf(i), v, title, { good: [text('consolidation.check.info.ok')] });
    if (m.duplicate && m.judgement === 'ok') return item(keyOf(i), v, title, { improve: [text('consolidation.check.info.duplicate')] });
    const improve = text(
      m.judgement === 'long' ? 'consolidation.check.info.long' : m.judgement === 'short' ? 'consolidation.check.info.short' : 'consolidation.check.info.none',
    );
    return item(keyOf(i), v, title, { improve: [improve] });
  });
  return {
    items,
    marks: marks.map((m, i) => ({ sourceId: m.sourceId, from: m.from, to: m.to, verdict: markVerdict(r.perMark[i]!.judgement, r.perMark[i]!.duplicate) })),
    verdict: r.verdict,
    okCount: r.perMark.filter((m) => m.judgement === 'ok' && !m.duplicate).length,
  };
}

const spanText = (s: AnswerSpan) => s.text;

/**
 * The instant (deterministic) check. Its titles and lines are student-facing catalog texts: the app passes its `t`
 * (admin overrides applied); the server and the BAC grading keep the catalog defaults.
 */
export function checkExercise(
  ex: ConsolidationExercise,
  sources: Source[],
  answer: ExerciseAnswer,
  text: TextFn = defaultText,
): ExerciseFeedback {
  const no = text('consolidation.verdict.no');
  const correct = text('consolidation.check.correct');
  const tokenCache = new Map<string, TokenizedSource>();
  const tok = (sourceId: string): TokenizedSource => {
    let t = tokenCache.get(sourceId);
    if (!t) {
      t = tokenizeSource(sources.find((s) => s.id === sourceId)?.body ?? '');
      tokenCache.set(sourceId, t);
    }
    return t;
  };

  if (answer.type !== ex.type) {
    return { verdict: 'no', items: [item('answer', 'no', no, { improve: [text('consolidation.check.mismatch')] })] };
  }

  switch (ex.type) {
    case 'short_answer': {
      const a = answer as Extract<ExerciseAnswer, { type: 'short_answer' }>;
      const m = matchVariants(a.text, ex.accepted, ex.mistakes);
      const reveal = ex.accepted.slice(0, 1);
      if (m.kind === 'exact') {
        return { verdict: 'ok', items: [item('answer', 'ok', correct, { good: ex.explanation ? [ex.explanation] : [] })], reveal };
      }
      if (m.kind === 'typo') {
        return {
          verdict: 'ok',
          items: [item('answer', 'ok', text('consolidation.check.short.typoTitle'), {
              improve: [text('consolidation.check.short.typo', { raspuns: m.accepted })],
            })],
          reveal,
        };
      }
      const message = m.kind === 'mistake' ? m.message : ex.explanation ?? text('consolidation.check.short.notFound');
      return { verdict: 'no', items: [item('answer', 'no', no, { improve: [message] })], reveal };
    }

    case 'multi_answer': {
      const a = answer as Extract<ExerciseAnswer, { type: 'multi_answer' }>;
      const matches = matchGroups(a.texts.slice(0, ex.count), ex.groups);
      const fields = matches.map((m): Verdict => (m.groupId === null ? 'no' : m.duplicate ? 'almost' : 'ok'));
      const hits = fields.filter((f) => f === 'ok').length;
      const hasDuplicate = matches.some((m) => m.duplicate);
      const verdict: Verdict = hits >= ex.count ? 'ok' : hits > 0 || hasDuplicate ? 'almost' : 'no';
      const improve: string[] = [];
      if (hasDuplicate) improve.push(text('consolidation.check.multi.duplicate'));
      else if (verdict === 'almost') improve.push(text('consolidation.check.multi.partial', { corecte: hits, total: ex.count }));
      else if (verdict === 'no') improve.push(text('consolidation.check.multi.none'));
      const good = verdict === 'ok' ? [text('consolidation.check.multi.all')] : [];
      return {
        verdict,
        items: [item('answer', verdict, plainTitle(text, verdict), { good, improve })],
        fields,
        reveal: ex.groups.flatMap((g) => g.variants.slice(0, 1)),
      };
    }

    case 'source_info': {
      const a = answer as Extract<ExerciseAnswer, { type: 'source_info' }>;
      const reveal = ex.spans.map(spanText);
      const marks = a.marks.slice(0, ex.count);
      if (marks.length === 0) {
        return { verdict: 'no', items: [item('mark-0', 'no', no, { improve: [text('consolidation.check.sourceInfo.noMarks')] })], marks: [], reveal };
      }
      const t = tok(ex.sources[0]?.sourceId ?? '');
      const r = judgeMarkItems(ex, t, marks, (i) => `mark-${i}`, text);
      const items = r.items;
      if (ex.count > 1 && r.verdict !== 'ok') {
        items.push(item('answer', r.verdict, plainTitle(text, r.verdict), {
            improve: [text('consolidation.check.sourceInfo.partial', { corecte: r.okCount, total: ex.count })],
          }));
      }
      return { verdict: r.verdict, items, marks: r.marks, reveal };
    }

    case 'source_letter': {
      const a = answer as Extract<ExerciseAnswer, { type: 'source_letter' }>;
      const reveal = ex.evidence ? [ex.evidence.text] : undefined;
      const out = (f: ExerciseFeedback): ExerciseFeedback => (reveal ? { ...f, reveal } : f);
      if (a.letter === null) {
        return out({ verdict: 'no', items: [item('answer', 'no', no, { improve: [text('consolidation.check.letter.pick')] })] });
      }
      if (a.letter === ex.correct) {
        const good = ex.evidence
          ? text('consolidation.check.letter.evidence', { litera: ex.correct, fragment: ex.evidence.text })
          : text('consolidation.check.letter.correct', { litera: ex.correct });
        return out({ verdict: 'ok', items: [item('answer', 'ok', correct, { good: [good] })] });
      }
      const improve = ex.explanation ?? text('consolidation.check.letter.wrong', { aleasa: a.letter, corecta: ex.correct });
      return out({ verdict: 'no', items: [item('answer', 'no', no, { improve: [improve] })] });
    }

    case 'cause_effect': {
      const a = answer as Extract<ExerciseAnswer, { type: 'cause_effect' }>;
      const reveal = ex.pairs.map((p) => text('consolidation.check.causeEffect.reveal', { cauza: p.cause.text, efectul: p.effect.text }));
      if (!a.cause || !a.effect) {
        return { verdict: 'no', items: [item('relation', 'no', no, { improve: [text('consolidation.check.causeEffect.missing')] })], reveal };
      }
      const pj = judgePair(tok(a.cause.sourceId), a.cause, a.effect, ex.pairs);
      const explanation = ex.pairs.find((p) => p.id === pj.pairId)?.explanation;
      const loose = (j: MarkJudgement) => j === 'ok' || j === 'long';
      let verdict: Verdict = 'almost';
      let title = text('consolidation.verdict.almost');
      let good: string[] = [];
      let improve: string[] = [];
      let cause: Verdict = 'almost';
      let effect: Verdict = 'almost';
      switch (pj.kind) {
        case 'exact':
          verdict = cause = effect = 'ok';
          title = correct;
          good = [text('consolidation.check.causeEffect.exact'), ...(explanation ? [explanation] : [])];
          break;
        case 'near':
          good = explanation ? [explanation] : [];
          improve = [text('consolidation.check.causeEffect.near')];
          break;
        case 'swapped':
          title = text('consolidation.check.causeEffect.swappedTitle');
          improve = [text('consolidation.check.causeEffect.swapped')];
          break;
        case 'partial':
          improve = [text('consolidation.check.causeEffect.partial')];
          break;
        case 'unrelated':
          verdict = 'no';
          title = no;
          improve = [text('consolidation.check.causeEffect.unrelated')];
          break;
        case 'none':
          verdict = 'no';
          title = no;
          improve = [text('consolidation.check.causeEffect.none')];
          break;
      }
      if (verdict === 'no') {
        cause = loose(pj.cause) ? 'almost' : 'no';
        effect = loose(pj.effect) ? 'almost' : 'no';
      }
      const out: ExerciseFeedback = {
        verdict,
        items: [item('relation', verdict, title, { good, improve })],
        marks: [
          { sourceId: a.cause.sourceId, from: a.cause.from, to: a.cause.to, verdict: cause },
          { sourceId: a.effect.sourceId, from: a.effect.from, to: a.effect.to, verdict: effect },
        ],
        reveal,
      };
      if (pj.kind === 'swapped') out.swapped = true;
      return out;
    }

    case 'viewpoint': {
      const a = answer as Extract<ExerciseAnswer, { type: 'viewpoint' }>;
      const t = tok(ex.sources[0]?.sourceId ?? '');
      const marks = a.marks.slice(0, ex.count);
      const r = judgeMarkItems(ex, t, marks, (i) => `support-${i}`, text);
      const items = r.items;
      for (let i = marks.length; i < ex.count; i++) {
        items.push(item(`support-${i}`, 'no', text('consolidation.check.viewpoint.missingTitle', { n: i + 1 }), {
            improve: [text('consolidation.check.viewpoint.missing')],
          }));
      }
      return { verdict: null, items, marks: r.marks };
    }

    case 'argument':
      return { verdict: null, items: [] };

    case 'facts': {
      const a = answer as Extract<ExerciseAnswer, { type: 'facts' }>;
      const items: FeedbackItem[] = [];
      const seen = new Set<string>();
      for (let i = 0; i < ex.count; i++) {
        const field = a.texts[i] ?? '';
        const norm = normalizeAnswer(field);
        const n = i + 1;
        if (blank(field)) {
          items.push(item(`fact-${i}`, 'no', text('consolidation.check.facts.emptyTitle', { n }), { improve: [text('consolidation.check.facts.empty')] }));
        } else if (field.trim().length < MIN_FACT_CHARS) {
          items.push(item(`fact-${i}`, 'no', text('consolidation.check.facts.shortTitle', { n }), { improve: [text('consolidation.check.facts.short')] }));
        } else if (seen.has(norm)) {
          items.push(item(`fact-${i}`, 'no', text('consolidation.check.facts.repeatedTitle', { n }), { improve: [text('consolidation.check.facts.repeated')] }));
        }
        if (norm) seen.add(norm);
      }
      return { verdict: items.length >= ex.count ? 'no' : null, items };
    }

    case 'comparison': {
      const a = answer as Extract<ExerciseAnswer, { type: 'comparison' }>;
      if (blank(a.text)) {
        return { verdict: 'no', items: [item('answer', 'no', no, { improve: [text('consolidation.check.comparison.empty')] })] };
      }
      return { verdict: null, items: [] };
    }

    case 'essay': {
      const a = answer as Extract<ExerciseAnswer, { type: 'essay' }>;
      const items = ex.requirements.flatMap((r, i) =>
        blank(a.parts[r.id])
          ? [item(r.id, 'no', text('consolidation.check.essay.emptyTitle', { n: i + 1 }), { improve: [text('consolidation.check.essay.empty')] })]
          : [],
      );
      return { verdict: items.length > 0 && items.length === ex.requirements.length ? 'no' : null, items };
    }
  }
}
