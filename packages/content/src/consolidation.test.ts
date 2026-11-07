import { describe, expect, it } from 'vitest';
import {
  AI_TYPES,
  CONSOLIDATION_TYPES,
  checkExercise,
  parseRichText,
  spanToWords,
  tokenizeSource,
  validateExercise,
  validateTemplate,
  type AnswerSpan,
  type ExerciseAnswer,
  type Mark,
  type Source,
} from '@prepio/shared';
import { essayFromWriting, essayTitle, seedSpans, toExercise, withPendingTemplates } from './consolidation';
import { DEMO_CONSOLIDATION, DEMO_SOURCES } from './demoLesson';
import { lessons } from './index';
import { TEMPLATES } from './templates';
import type { SeedConsolidation, SeedSource } from './types';

const identity = (keys: string[]) => new Map(keys.map((k) => [k, k]));
const templateIds = identity(TEMPLATES.map((t) => t.key));
let n = 0;
const newId = () => `id-${++n}`;

const SOURCES: SeedSource[] = [
  { key: 'a', title: null, author: 'Autor', work: 'Lucrare', body: 'Primul text. Domnul era ales pe viață.' },
  { key: 'b', title: 'B', author: 'Autor B', work: '', body: 'Al doilea text, deoarece așa trebuie.' },
];
const bodies = new Map(SOURCES.map((s) => [s.key, s.body]));
const sourceIds = new Map([
  ['a', 'uuid-a'],
  ['b', 'uuid-b'],
]);

/** The seed set as the student/admin model sees it: source ids are the keys. */
function checkSet(sources: SeedSource[], items: SeedConsolidation[]): string[][] {
  const asSources: Source[] = sources.map((s, position) => ({ id: s.key, position, ...s }));
  const ids = identity(sources.map((s) => s.key));
  const b = new Map(sources.map((s) => [s.key, s.body]));
  return items.map((c) => {
    const { exercise, ai } = toExercise(c, ids, b, templateIds, newId);
    return validateExercise(exercise, asSources, withPendingTemplates(exercise, ai));
  });
}

describe('toExercise', () => {
  it('turns quotes into offsets equal to body.indexOf(quote), labels the sources A/B and resolves templates', () => {
    const { exercise, ai } = toExercise(
      {
        prompt: 'Precizați o informație.',
        template: 'source_info',
        sources: ['a'],
        type: 'source_info',
        count: 1,
        spans: [{ source: 'a', quote: 'Domnul era ales pe viață' }],
        explanation: 'Explicație.',
      },
      sourceIds,
      bodies,
      templateIds,
      newId,
    );
    expect(exercise.type).toBe('source_info');
    if (exercise.type !== 'source_info') return;
    const start = SOURCES[0]!.body.indexOf('Domnul era ales pe viață');
    expect(exercise.spans).toEqual([
      expect.objectContaining({ sourceId: 'uuid-a', start, end: start + 'Domnul era ales pe viață'.length, text: 'Domnul era ales pe viață', limitStart: null, limitEnd: null }),
    ]);
    expect(exercise.sources).toEqual([{ sourceId: 'uuid-a', label: 'A' }]);
    expect(exercise.templateId).toBe('source_info');
    expect(exercise.explanation).toBe('Explicație.');
    expect(exercise.modelAnswer).toBeNull();
    expect(ai).toEqual({ main: '', requirements: {} });
  });

  it('converts cause-effect pairs and the letter evidence, and keeps the AI context of AI types', () => {
    const pairs = toExercise(
      {
        prompt: 'Relație cauză-efect.',
        template: null,
        sources: ['b'],
        type: 'cause_effect',
        pairs: [{ cause: { source: 'b', quote: 'așa trebuie' }, effect: { source: 'b', quote: 'Al doilea text' }, explanation: null }],
      },
      sourceIds,
      bodies,
      templateIds,
      newId,
    ).exercise;
    if (pairs.type !== 'cause_effect') throw new Error(pairs.type);
    expect(pairs.pairs[0]!.cause).toMatchObject({ sourceId: 'uuid-b', start: SOURCES[1]!.body.indexOf('așa trebuie') });
    expect(pairs.pairs[0]!.effect).toMatchObject({ start: 0, text: 'Al doilea text' });

    const letter = toExercise(
      { prompt: 'Litera.', template: null, sources: ['a', 'b'], type: 'source_letter', correct: 'B', evidence: { source: 'b', quote: 'deoarece' } },
      sourceIds,
      bodies,
      templateIds,
      newId,
    ).exercise;
    expect(letter.sources).toEqual([
      { sourceId: 'uuid-a', label: 'A' },
      { sourceId: 'uuid-b', label: 'B' },
    ]);
    if (letter.type !== 'source_letter') throw new Error(letter.type);
    expect(letter.evidence).toMatchObject({ sourceId: 'uuid-b', text: 'deoarece' });

    const ai = { main: 'Perioada 1859–1866.', requirements: {} };
    expect(toExercise({ prompt: 'Argumentați.', template: 'argument', sources: [], type: 'argument', ai }, sourceIds, bodies, templateIds, newId).ai).toEqual(ai);
  });

  it('throws with the exercise prompt when a quote is not in the source', () => {
    expect(() =>
      toExercise(
        { prompt: 'Enunț cu citat greșit', template: null, sources: ['a'], type: 'source_info', count: 1, spans: [{ source: 'a', quote: 'nu există' }] },
        sourceIds,
        bodies,
        templateIds,
        newId,
      ),
    ).toThrow(/Enunț cu citat greșit/);
  });

  it('throws on an unknown template or source key', () => {
    expect(() =>
      toExercise({ prompt: 'X', template: 'nope', sources: [], type: 'argument', ai: { main: 'c', requirements: {} } }, sourceIds, bodies, templateIds, newId),
    ).toThrow(/nope/);
    expect(() => toExercise({ prompt: 'Y', template: null, sources: ['zz'], type: 'facts', count: 2 }, sourceIds, bodies, templateIds, newId)).toThrow(/zz/);
  });
});

describe('essayFromWriting', () => {
  it('is a one-requirement essay with the criteria as its context, like the SQL migration', () => {
    const long = 'Prezintă o acțiune desfășurată de români în perioada 1857–1859, precizând două informații referitoare la aceasta.';
    const e = essayFromWriting(long, 'Criteriul 1\nCriteriul 2');
    expect(e).toMatchObject({
      type: 'essay',
      prompt: essayTitle(long),
      template: null,
      sources: [],
      requirements: [{ id: 'r1', text: long, modelAnswer: null, template: null, argument: false }],
      ai: { main: '', requirements: { r1: 'Criteriul 1\nCriteriul 2' } },
    });
    expect(essayTitle('Scurt.')).toBe('Scurt.');
    expect(essayTitle(long)).toBe('Prezintă o acțiune desfășurată de români în perioada 1857–1859, precizând două…');
  });
});

describe('templates', () => {
  it('has one valid template per type, with unique keys and titles', () => {
    expect(TEMPLATES.map((t) => t.exerciseType).sort()).toEqual([...CONSOLIDATION_TYPES].sort());
    expect(new Set(TEMPLATES.map((t) => t.key)).size).toBe(TEMPLATES.length);
    expect(new Set(TEMPLATES.map((t) => t.title)).size).toBe(TEMPLATES.length);
    for (const t of TEMPLATES) {
      expect(validateTemplate(t), t.key).toEqual([]);
      expect(t.points.trim(), t.key).not.toBe('');
    }
  });

  it('writes every body as „Pașii” (ordered list), an example callout and a warning callout', () => {
    for (const t of TEMPLATES) {
      const blocks = parseRichText(t.body);
      expect(blocks[0], t.key).toMatchObject({ kind: 'heading', spans: [{ text: 'Pașii' }] });
      expect(blocks.some((b) => b.kind === 'list' && b.ordered), t.key).toBe(true);
      expect(blocks.some((b) => b.kind === 'callout' && b.variant === 'exemplu'), t.key).toBe(true);
      expect(blocks.some((b) => b.kind === 'callout' && b.variant === 'atentie'), t.key).toBe(true);
    }
  });
});

/** Every intended answer of the deterministic exercises of a set, with the verdict `checkExercise` gives it. */
function intendedAnswers(sources: SeedSource[], items: SeedConsolidation[]): Array<{ what: string; verdict: string | null }> {
  const asSources: Source[] = sources.map((s, position) => ({ id: s.key, position, ...s }));
  const ids = identity(sources.map((s) => s.key));
  const b = new Map(sources.map((s) => [s.key, s.body]));
  const mark = (span: AnswerSpan): Mark => {
    const words = spanToWords(tokenizeSource(b.get(span.sourceId)!), span)!;
    return { sourceId: span.sourceId, from: words[0], to: words[1] };
  };
  const out: Array<{ what: string; verdict: string | null }> = [];
  for (const c of items) {
    const { exercise: ex } = toExercise(c, ids, b, templateIds, newId);
    const answers: ExerciseAnswer[] = [];
    if (ex.type === 'short_answer') answers.push(...ex.accepted.map((text) => ({ type: ex.type, text })));
    if (ex.type === 'multi_answer') answers.push({ type: ex.type, texts: ex.groups.slice(0, ex.count).map((g) => g.variants[0]!) });
    if (ex.type === 'source_info') {
      // Each span on its own is a full answer when one is asked for; with N > 1, any N spans together.
      if (ex.count === 1) for (const s of ex.spans) answers.push({ type: ex.type, marks: [mark(s)] });
      else {
        answers.push({ type: ex.type, marks: ex.spans.slice(0, ex.count).map(mark) });
        answers.push({ type: ex.type, marks: ex.spans.slice(-ex.count).map(mark) });
      }
    }
    if (ex.type === 'source_letter') answers.push({ type: ex.type, letter: ex.correct });
    if (ex.type === 'cause_effect') for (const p of ex.pairs) answers.push({ type: ex.type, cause: mark(p.cause), effect: mark(p.effect) });
    for (const a of answers) out.push({ what: `${c.prompt}: ${JSON.stringify(a)}`, verdict: checkExercise(ex, asSources, a).verdict });
  }
  return out;
}

/** Templates, AI contexts and model answers as the seed authors them (the demo is held to the same rules). */
function checkAuthoring(items: SeedConsolidation[]): void {
  for (const c of items) {
    expect(c.template, c.prompt).toBe(c.type);
    if (c.type === 'essay') {
      for (const r of c.requirements) expect(c.ai?.requirements[r.id]?.length ?? 0, r.text).toBeGreaterThan(100);
    } else if (AI_TYPES.has(c.type)) {
      expect(c.ai?.main.length ?? 0, c.prompt).toBeGreaterThan(200);
      expect(c.modelAnswer?.trim(), c.prompt).toBeTruthy();
    } else {
      expect(c.ai, c.prompt).toBeUndefined();
      expect(c.explanation?.trim() || c.type === 'cause_effect', c.prompt).toBeTruthy();
    }
  }
}

describe('seed lesson consolidation', () => {
  describe.each(lessons.map((l) => [l.key, l] as const))('%s', (_key, lesson) => {
    it('has 1–2 sources with a citation and unique keys', () => {
      expect(lesson.sources.length).toBeGreaterThanOrEqual(1);
      expect(lesson.sources.length).toBeLessThanOrEqual(2);
      expect(new Set(lesson.sources.map((s) => s.key)).size).toBe(lesson.sources.length);
      for (const s of lesson.sources) {
        expect(s.author.trim(), s.key).not.toBe('');
        expect(s.body.trim().length, s.key).toBeGreaterThan(100);
      }
    });

    it('has one exercise of every type, in the BAC order', () => {
      expect(lesson.consolidation.map((c) => c.type)).toEqual(CONSOLIDATION_TYPES);
    });

    it('has a BAC-style essay: four requirements, the last one a point of view with an argument', () => {
      const essay = lesson.consolidation.find((c) => c.type === 'essay');
      if (essay?.type !== 'essay') throw new Error('no essay');
      expect(essay.prompt).toMatch(/^Elaborați un eseu despre .+, respectând următoarele cerințe:$/);
      expect(essay.requirements.map((r) => r.id)).toEqual(['r1', 'r2', 'r3', 'r4']);
      expect(essay.requirements.map((r) => r.argument)).toEqual([false, false, false, true]);
      expect(essay.requirements[3]!.text).toMatch(/^Formulați un punct de vedere .+ și susțineți-l printr-un argument istoric\.$/);
      for (const r of essay.requirements) {
        expect(r.template, r.text).not.toBeNull();
        expect(r.modelAnswer?.trim(), r.text).toBeTruthy();
      }
    });

    it('has only exercises that pass validateExercise with their AI context', () => {
      const errors = checkSet(lesson.sources, lesson.consolidation);
      lesson.consolidation.forEach((c, i) => expect(errors[i], c.prompt).toEqual([]));
    });

    it('accepts the intended answers of every deterministic exercise as „Corect”', () => {
      for (const { what, verdict } of intendedAnswers(lesson.sources, lesson.consolidation)) expect(verdict, what).toBe('ok');
    });

    it('quotes every span exactly once in its source', () => {
      const bodiesByKey = new Map(lesson.sources.map((s) => [s.key, s.body]));
      for (const c of lesson.consolidation) {
        for (const s of seedSpans(c)) {
          const body = bodiesByKey.get(s.source) ?? '';
          const first = body.indexOf(s.quote);
          expect(first, `${c.prompt}: ${s.quote}`).toBeGreaterThanOrEqual(0);
          expect(body.indexOf(s.quote, first + 1), `${c.prompt}: ${s.quote} (ambiguous)`).toBe(-1);
        }
      }
    });

    it('uses every source, attaches its template to every exercise and gives AI types a real context', () => {
      const used = new Set(lesson.consolidation.flatMap((c) => c.sources));
      expect([...used].sort()).toEqual(lesson.sources.map((s) => s.key).sort());
      checkAuthoring(lesson.consolidation);
    });
  });
});

describe('demo lesson consolidation', () => {
  it('has one valid exercise of every type, in the BAC order', () => {
    expect(DEMO_CONSOLIDATION.map((c) => c.type)).toEqual(CONSOLIDATION_TYPES);
    const errors = checkSet(DEMO_SOURCES, DEMO_CONSOLIDATION);
    DEMO_CONSOLIDATION.forEach((c, i) => expect(errors[i], c.prompt).toEqual([]));
  });

  it('accepts the intended answers of every deterministic exercise as „Corect”', () => {
    const answers = intendedAnswers(DEMO_SOURCES, DEMO_CONSOLIDATION);
    expect(answers.length).toBeGreaterThanOrEqual(5);
    for (const { what, verdict } of answers) expect(verdict, what).toBe('ok');
  });

  it('uses every source, quotes spans exactly once and attaches templates', () => {
    const used = new Set(DEMO_CONSOLIDATION.flatMap((c) => c.sources));
    expect([...used].sort()).toEqual(DEMO_SOURCES.map((s) => s.key).sort());
    const bodies = new Map(DEMO_SOURCES.map((s) => [s.key, s.body]));
    for (const c of DEMO_CONSOLIDATION) {
      expect(c.template, c.prompt).toBe(c.type);
      for (const s of seedSpans(c)) {
        const body = bodies.get(s.source) ?? '';
        expect(body.indexOf(s.quote), s.quote).toBeGreaterThanOrEqual(0);
        expect(body.indexOf(s.quote, body.indexOf(s.quote) + 1), s.quote).toBe(-1);
      }
    }
  });
});

describe('diacritics', () => {
  it('uses comma-below ș/ț in sources, exercises and templates', () => {
    const all = JSON.stringify({ TEMPLATES, l: lessons.map((l) => [l.sources, l.consolidation]), DEMO_SOURCES, DEMO_CONSOLIDATION });
    expect(all).not.toMatch(/[şţŞŢ]/);
  });
});
