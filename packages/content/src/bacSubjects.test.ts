import { describe, expect, it } from 'vitest';
import {
  BAC_TOTAL_POINTS,
  DEFAULT_ESSAY_STYLE,
  scoreDeterministic,
  tokenizeSource,
  validateBacItem,
  validateBacSubject,
  type BacItem,
  type ExerciseAnswer,
  type Mark,
} from '@prepio/shared';
import { BAC_SUBJECTS, ISTORIE_2026_V3, toBacSubject } from './bacSubjects';
import { DEFAULT_BAC_RULES } from './defaults';
import { TEMPLATES } from './templates';

/** Template ids are their keys here, so a test can see which template an item got. */
const templateIds = new Map(TEMPLATES.map((t) => [t.key, t.key]));
let n = 0;
const newId = () => `id-${++n}`;

describe('BAC seed subjects', () => {
  it('has exactly the Istorie 2026 Varianta 3 subject, published, cost 10', () => {
    expect(BAC_SUBJECTS).toEqual([ISTORIE_2026_V3]);
    expect(ISTORIE_2026_V3).toMatchObject({ title: 'Istorie 2026 · Varianta 3', year: 2026, variant: 'Varianta 3', creditCost: 10, published: true });
  });

  for (const subject of BAC_SUBJECTS) {
    const { sources, items } = toBacSubject(subject, templateIds, newId);
    const sectionSources = (section: number) => sources.filter((s) => s.section === section);
    const bySection = (section: number) => items.filter((i) => i.item.section === section);

    it(`${subject.title}: 3 sources (A and B in Subiectul I, one in Subiectul II), 7 + 6 + 1 items`, () => {
      expect(sources.map((s) => [s.section, s.author])).toEqual([
        [1, 'D. Berindei'],
        [1, 'F. Constantiniu'],
        [2, 'I. Țurcanu'],
      ]);
      expect([1, 2, 3].map((s) => bySection(s).length)).toEqual([7, 6, 1]);
      for (const s of [1, 2, 3]) expect(bySection(s).map((i) => i.item.number)).toEqual(bySection(s).map((_, k) => k + 1));
    });

    it(`${subject.title}: types and points as in the paper`, () => {
      expect(items.map(({ item }) => `${item.section}.${item.number} ${item.type} ${item.points}`)).toEqual([
        '1.1 short_answer 2',
        '1.2 source_info 2',
        '1.3 multi_answer 6',
        '1.4 source_letter 3',
        '1.5 cause_effect 7',
        '1.6 facts 6',
        '1.7 comparison 4',
        '2.1 short_answer 2',
        '2.2 short_answer 2',
        '2.3 multi_answer 6',
        '2.4 source_info 6',
        '2.5 viewpoint 10',
        '2.6 argument 4',
        '3.1 essay 30',
      ]);
    });

    it(`${subject.title}: every item is valid against its section's sources and barem, and the subject totals 90`, () => {
      const errors = new Map<string, string[]>();
      for (const { item, barem } of items) {
        const e = validateBacItem(item, sectionSources(item.section), barem);
        expect(e, `${item.section}.${item.number}`).toEqual([]);
        errors.set(item.id, e);
      }
      expect(items.reduce((t, i) => t + i.item.points, 0)).toBe(BAC_TOTAL_POINTS);
      expect(validateBacSubject(items.map((i) => i.item), errors)).toEqual([]);
    });

    it(`${subject.title}: every item uses the solution template of its type and links sources by their section letter`, () => {
      for (const { item } of items) {
        expect(item.templateId, `${item.section}.${item.number}`).toBe(item.type);
        const letters = sectionSources(item.section).map((s) => s.id);
        for (const ref of item.sources) expect(ref.label).toBe(['A', 'B'][letters.indexOf(ref.sourceId)]);
      }
      const item = (section: number, number: number) => items.find((i) => i.item.section === section && i.item.number === number)!.item;
      const [a, b] = sectionSources(1).map((s) => s.id);
      expect(item(1, 2).sources).toEqual([{ sourceId: a, label: 'A' }]);
      expect(item(1, 3).sources).toEqual([{ sourceId: a, label: 'A' }, { sourceId: b, label: 'B' }]);
      expect(item(1, 5).sources).toEqual([{ sourceId: b, label: 'B' }]);
      const letter = item(1, 4);
      if (letter.type !== 'source_letter') throw new Error('1.4 is not source_letter');
      expect(letter.correct).toBe('A');
    });

    it(`${subject.title}: barem steps as the official barem allows`, () => {
      const barem = (section: number, number: number) => items.find((i) => i.item.section === section && i.item.number === number)!.barem;
      expect(barem(1, 6).steps).toBeNull();
      expect(barem(1, 6).text).toContain('câte 1 punct pentru menționarea');
      expect(barem(1, 6).text).toContain('câte 2 puncte pentru prezentarea');
      expect(barem(1, 7).steps).toEqual([0, 4]);
      expect(barem(2, 5).steps).toEqual([0, 7, 10]);
      expect(barem(2, 6).steps).toEqual([0, 4]);
      for (const { barem: b, item } of items) {
        expect(b.points, `${item.section}.${item.number}`).toBe(item.points);
        expect(b.text.trim().length).toBeGreaterThan(20);
      }
    });

    it(`${subject.title}: the essay has the four requirements worth 5/6/7/6 and the default style 2/1/2/1`, () => {
      const { item, barem } = bySection(3)[0]!;
      if (item.type !== 'essay') throw new Error('III is not an essay');
      expect(item.requirements).toHaveLength(4);
      expect(item.requirements[3]!.argument).toBe(true);
      expect(item.requirements.map((r) => barem.essay!.requirements[r.id]!.points)).toEqual([5, 6, 7, 6]);
      expect(barem.essay!.style).toEqual(DEFAULT_ESSAY_STYLE);
    });

    it(`${subject.title}: the expected answers of the deterministic items score full points`, () => {
      const item = (section: number, number: number) => items.find((i) => i.item.section === section && i.item.number === number)!.item;
      const score = (it: BacItem, answer: ExerciseAnswer) => scoreDeterministic(it, sectionSources(it.section), answer)!.points;
      expect(score(item(1, 1), { type: 'short_answer', text: 'Statutul Dezvoltător' })).toBe(2);
      expect(score(item(1, 3), { type: 'multi_answer', texts: ['Moldova', 'Țara Românească'] })).toBe(6);
      expect(score(item(1, 3), { type: 'multi_answer', texts: ['Moldova', 'Moldova'] })).toBe(3);
      expect(score(item(1, 4), { type: 'source_letter', letter: 'A' })).toBe(3);
      expect(score(item(1, 4), { type: 'source_letter', letter: 'B' })).toBe(0);
      expect(score(item(2, 1), { type: 'short_answer', text: 'Siret' })).toBe(2);
      for (const text of ['al XIV-lea', 'secolul al XIV-lea', 'XIV', 'sec. 14']) {
        expect(score(item(2, 2), { type: 'short_answer', text }), text).toBe(2);
      }
      expect(score(item(2, 2), { type: 'short_answer', text: 'al XV-lea' })).toBe(0);
      expect(score(item(2, 3), { type: 'multi_answer', texts: ['Bogdan', 'l-a îndepărtat pe Balc de la putere'] })).toBe(6);
      // A student who marks whole sentences of the source still earns the points.
      const mark = (section: number, letter: number, quote: string): Mark => {
        const src = sectionSources(section)[letter]!;
        const start = src.body.indexOf(quote);
        expect(start, quote).toBeGreaterThanOrEqual(0);
        const words = tokenizeSource(src.body).words.filter((w) => w.end > start && w.start < start + quote.length);
        return { sourceId: src.id, from: words[0]!.i, to: words[words.length - 1]!.i };
      };
      expect(
        score(item(1, 2), { type: 'source_info', marks: [mark(1, 0, 'Domnul urma să fie ales în fiecare țară pe viață de către Adunarea electivă.')] }),
      ).toBe(2);
      expect(
        score(item(1, 5), {
          type: 'cause_effect',
          cause: mark(1, 1, 'Prin legea din [...] 1863 au fost trecute în proprietatea statului „toate averile mănăstirești”.'),
          effect: mark(1, 1, 'Ca urmare, aproximativ un sfert din teritoriul țării a devenit patrimoniu al statului, ceea ce a mărit suprafața de care dispuneau autoritățile pentru viitoarea împroprietărire.'),
        }),
      ).toBe(7);
      expect(
        score(item(1, 5), {
          type: 'cause_effect',
          cause: mark(1, 1, 'Începuturile domniei lui Al. I. Cuza au fost anevoioase'),
          effect: mark(1, 1, 'domnul era obligat să colaboreze cu două guverne, unul la Iași și celălalt la București'),
        }),
      ).toBe(0);
      expect(
        score(item(2, 4), {
          type: 'source_info',
          marks: [
            mark(2, 0, 'Pentru a nu permite pătrunderea tătarilor în Transilvania'),
            mark(2, 0, 'În fruntea acestei formațiuni l-a numit pe Dragoș.'),
          ],
        }),
      ).toBe(6);
      // „Muntenia” is not the polity named in the sources.
      expect(score(item(1, 3), { type: 'multi_answer', texts: ['Moldova', 'Muntenia'] })).toBe(3);
      for (const action of [
        'a scos Moldova de sub dominația ungară',
        'a scos Moldova de sub dominația maghiară',
        'a întemeiat statul independent Moldova',
        'a fondat statul Moldova',
        'a respins oastea lui Ludovic',
        'a înfrânt oastea Ungariei',
        'a înfrânt oastea regelui Ungariei',
        'a respins oastea trimisă de Ludovic I',
      ]) {
        expect(score(item(2, 3), { type: 'multi_answer', texts: ['Bogdan', action] }), action).toBe(6);
      }
      // Two actions are one answer group: only the leader + an action earns both units.
      expect(score(item(2, 3), { type: 'multi_answer', texts: ['l-a îndepărtat pe Balc de la putere', 'a înfrânt oastea trimisă de Ludovic I'] })).toBe(3);
    });
  }
});

describe('DEFAULT_BAC_RULES', () => {
  it('states the strict-examiner rules of the barem, in Romanian, addressed with „tu”', () => {
    for (const phrase of [
      'examinator strict',
      'Se punctează orice modalitate de rezolvare corectă',
      'Nu se acordă punctaje intermediare',
      'fracțiuni de punct',
      'Când ai dubii, nu acorzi punctul',
      '„tu”',
    ]) {
      expect(DEFAULT_BAC_RULES, phrase).toContain(phrase);
    }
    expect(DEFAULT_BAC_RULES).not.toMatch(/\bAI\b/);
  });
});
