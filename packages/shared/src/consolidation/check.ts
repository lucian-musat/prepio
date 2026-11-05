import { VERDICT_LABELS } from './exercises';
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

const plainTitle = (v: Verdict) => (v === 'ok' ? 'Corect!' : VERDICT_LABELS[v]);
const blank = (s: string | undefined) => !s || s.trim() === '';

const MSG = {
  infoOk: 'Ai găsit o informație completă.',
  infoLong:
    'Informația e acolo, dar ai selectat și text în plus. La BAC se cere o informație: oprește-te la capătul propoziției.',
  infoShort: 'Ai prins doar o parte. Ia informația până la capătul ideii.',
  infoNone: 'Fragmentul ales nu conține informația cerută.',
  infoDuplicate: 'Ai marcat de două ori aceeași informație. Mai caută una.',
};

const markVerdict = (j: MarkJudgement, duplicate: boolean): Verdict =>
  j === 'none' ? 'no' : j === 'ok' && !duplicate ? 'ok' : 'almost';

/** Per-mark feedback shared by `source_info` and `viewpoint`. */
function judgeMarkItems(
  ex: Extract<ConsolidationExercise, { type: 'source_info' | 'viewpoint' }>,
  t: TokenizedSource,
  marks: Mark[],
  keyOf: (i: number) => string,
): { items: FeedbackItem[]; marks: NonNullable<ExerciseFeedback['marks']>; verdict: Verdict; okCount: number } {
  const r = judgeMarks(t, marks, ex.spans, ex.count);
  const many = ex.count > 1;
  const phrase: Record<Verdict, string> = { ok: 'corectă', almost: 'incompletă sau cu text în plus', no: 'nu conține informația cerută' };
  const items = marks.map((_, i) => {
    const m = r.perMark[i]!;
    const v = markVerdict(m.judgement, m.duplicate);
    const title = many ? `Informația ${i + 1}: ${phrase[v]}` : plainTitle(v);
    if (v === 'ok') return item(keyOf(i), v, title, { good: [MSG.infoOk] });
    if (m.duplicate && m.judgement === 'ok') return item(keyOf(i), v, title, { improve: [MSG.infoDuplicate] });
    const improve = m.judgement === 'long' ? MSG.infoLong : m.judgement === 'short' ? MSG.infoShort : MSG.infoNone;
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

export function checkExercise(ex: ConsolidationExercise, sources: Source[], answer: ExerciseAnswer): ExerciseFeedback {
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
    return { verdict: 'no', items: [item('answer', 'no', 'Mai lucrează', { improve: ['Răspunsul nu se potrivește cu exercițiul.'] })] };
  }

  switch (ex.type) {
    case 'short_answer': {
      const a = answer as Extract<ExerciseAnswer, { type: 'short_answer' }>;
      const m = matchVariants(a.text, ex.accepted, ex.mistakes);
      const reveal = ex.accepted.slice(0, 1);
      if (m.kind === 'exact') {
        return { verdict: 'ok', items: [item('answer', 'ok', 'Corect!', { good: ex.explanation ? [ex.explanation] : [] })], reveal };
      }
      if (m.kind === 'typo') {
        return {
          verdict: 'ok',
          items: [item('answer', 'ok', 'Corect, atenție la scriere', { improve: [`Forma corectă: ${m.accepted}.`] })],
          reveal,
        };
      }
      const message = m.kind === 'mistake' ? m.message : ex.explanation ?? 'Nu am găsit răspunsul în sursă.';
      return { verdict: 'no', items: [item('answer', 'no', 'Mai lucrează', { improve: [message] })], reveal };
    }

    case 'multi_answer': {
      const a = answer as Extract<ExerciseAnswer, { type: 'multi_answer' }>;
      const matches = matchGroups(a.texts.slice(0, ex.count), ex.groups);
      const fields = matches.map((m): Verdict => (m.groupId === null ? 'no' : m.duplicate ? 'almost' : 'ok'));
      const hits = fields.filter((f) => f === 'ok').length;
      const hasDuplicate = matches.some((m) => m.duplicate);
      const verdict: Verdict = hits >= ex.count ? 'ok' : hits > 0 || hasDuplicate ? 'almost' : 'no';
      const improve: string[] = [];
      if (hasDuplicate) improve.push('Ai scris de două ori același răspuns. Mai caută unul.');
      else if (verdict === 'almost') improve.push(`${hits} din ${ex.count} corecte.`);
      else if (verdict === 'no') improve.push('Niciun răspuns corect încă. Caută în sursă.');
      const good = verdict === 'ok' ? ['Ai găsit toate răspunsurile.'] : [];
      return {
        verdict,
        items: [item('answer', verdict, plainTitle(verdict), { good, improve })],
        fields,
        reveal: ex.groups.flatMap((g) => g.variants.slice(0, 1)),
      };
    }

    case 'source_info': {
      const a = answer as Extract<ExerciseAnswer, { type: 'source_info' }>;
      const reveal = ex.spans.map(spanText);
      const marks = a.marks.slice(0, ex.count);
      if (marks.length === 0) {
        return { verdict: 'no', items: [item('mark-0', 'no', 'Mai lucrează', { improve: ['Marchează în text informația cerută.'] })], marks: [], reveal };
      }
      const t = tok(ex.sources[0]?.sourceId ?? '');
      const r = judgeMarkItems(ex, t, marks, (i) => `mark-${i}`);
      const items = r.items;
      if (ex.count > 1 && r.verdict !== 'ok') {
        items.push(item('answer', r.verdict, plainTitle(r.verdict), { improve: [`Ai găsit ${r.okCount} din ${ex.count} informații.`] }));
      }
      return { verdict: r.verdict, items, marks: r.marks, reveal };
    }

    case 'source_letter': {
      const a = answer as Extract<ExerciseAnswer, { type: 'source_letter' }>;
      const reveal = ex.evidence ? [ex.evidence.text] : undefined;
      const out = (f: ExerciseFeedback): ExerciseFeedback => (reveal ? { ...f, reveal } : f);
      if (a.letter === null) {
        return out({ verdict: 'no', items: [item('answer', 'no', 'Mai lucrează', { improve: ['Alege litera sursei.'] })] });
      }
      if (a.letter === ex.correct) {
        const good = ex.evidence ? `Sursa ${ex.correct}: „${ex.evidence.text}”.` : `Sursa ${ex.correct} este cea corectă.`;
        return out({ verdict: 'ok', items: [item('answer', 'ok', 'Corect!', { good: [good] })] });
      }
      const improve = ex.explanation ?? `Nu e sursa ${a.letter}. Caută afirmația în sursa ${ex.correct}.`;
      return out({ verdict: 'no', items: [item('answer', 'no', 'Mai lucrează', { improve: [improve] })] });
    }

    case 'cause_effect': {
      const a = answer as Extract<ExerciseAnswer, { type: 'cause_effect' }>;
      const reveal = ex.pairs.map((p) => `Cauză: ${p.cause.text} / Efect: ${p.effect.text}`);
      if (!a.cause || !a.effect) {
        return { verdict: 'no', items: [item('relation', 'no', 'Mai lucrează', { improve: ['Marchează și cauza, și efectul.'] })], reveal };
      }
      const pj = judgePair(tok(a.cause.sourceId), a.cause, a.effect, ex.pairs);
      const explanation = ex.pairs.find((p) => p.id === pj.pairId)?.explanation;
      const loose = (j: MarkJudgement) => j === 'ok' || j === 'long';
      let verdict: Verdict = 'almost';
      let title = 'Aproape';
      let good: string[] = [];
      let improve: string[] = [];
      let cause: Verdict = 'almost';
      let effect: Verdict = 'almost';
      switch (pj.kind) {
        case 'exact':
          verdict = cause = effect = 'ok';
          title = 'Corect!';
          good = ['Ai stabilit o relație cauză-efect validă și ai precizat corect rolurile.', ...(explanation ? [explanation] : [])];
          break;
        case 'near':
          good = explanation ? [explanation] : [];
          improve = ['Relația e corectă, dar ai selectat și text în plus. Păstrează doar cele două informații.'];
          break;
        case 'swapped':
          title = 'Aproape: ai inversat rolurile';
          improve = ['Informațiile sunt legate, dar cauza e cealaltă. Întreabă-te: care s-a întâmplat din cauza celeilalte?'];
          break;
        case 'partial':
          improve = ['Ai găsit relația, dar una dintre informații e incompletă. Ia fiecare informație până la capătul ideii.'];
          break;
        case 'unrelated':
          verdict = 'no';
          title = 'Mai lucrează';
          improve = ['Fiecare informație poate fi cauză, respectiv efect, dar nu sunt legate între ele.'];
          break;
        case 'none':
          verdict = 'no';
          title = 'Mai lucrează';
          improve = ['Caută conectorii din text: „fiindcă”, „ca urmare”, „cu scopul de a”. Ei arată unde e cauza și unde e efectul.'];
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
      const r = judgeMarkItems(ex, t, marks, (i) => `support-${i}`);
      const items = r.items;
      for (let i = marks.length; i < ex.count; i++) {
        items.push(item(`support-${i}`, 'no', `Informația ${i + 1}: lipsește`, { improve: ['Marchează încă o informație din sursă.'] }));
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
        const text = a.texts[i] ?? '';
        const norm = normalizeAnswer(text);
        const n = i + 1;
        if (blank(text)) {
          items.push(item(`fact-${i}`, 'no', `Faptul ${n}: câmp gol`, { improve: ['Scrie un fapt istoric: ce s-a întâmplat, când, cine.'] }));
        } else if (text.trim().length < MIN_FACT_CHARS) {
          items.push(item(`fact-${i}`, 'no', `Faptul ${n}: prea scurt`, { improve: ['Prezintă faptul: ce s-a întâmplat, când, cine.'] }));
        } else if (seen.has(norm)) {
          items.push(item(`fact-${i}`, 'no', `Faptul ${n}: repetat`, { improve: ['Ai scris același fapt de două ori. Alege un alt fapt.'] }));
        }
        if (norm) seen.add(norm);
      }
      return { verdict: items.length >= ex.count ? 'no' : null, items };
    }

    case 'comparison': {
      const a = answer as Extract<ExerciseAnswer, { type: 'comparison' }>;
      if (blank(a.text)) {
        return { verdict: 'no', items: [item('answer', 'no', 'Mai lucrează', { improve: ['Scrie un răspuns.'] })] };
      }
      return { verdict: null, items: [] };
    }

    case 'essay': {
      const a = answer as Extract<ExerciseAnswer, { type: 'essay' }>;
      const items = ex.requirements.flatMap((r, i) =>
        blank(a.parts[r.id])
          ? [item(r.id, 'no', `Cerința ${i + 1}: necompletată`, { improve: ['Scrie un răspuns pentru această cerință.'] })]
          : [],
      );
      return { verdict: items.length > 0 && items.length === ex.requirements.length ? 'no' : null, items };
    }
  }
}
