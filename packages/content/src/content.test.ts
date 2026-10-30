import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateLesson, type Lesson, type Question } from '@prepio/shared';
import { aiDefaults, lessons, tree, welcomeMessage, type SeedLesson, type SeedNode } from './index';

const imagesDir = fileURLToPath(new URL('../images/', import.meta.url));

const EXPECTED_TREE: Array<[string, string[]]> = [
  ['A. Popoare și spații istorice', ['Romanitatea românilor în viziunea istoricilor']],
  [
    'B. Oamenii, societatea și lumea ideilor',
    [
      'Secolul XX: între democrație și totalitarism',
      'Ideologii și practici politice în România și Europa',
      'Constituțiile din România',
    ],
  ],
  [
    'C. Statul și politica',
    [
      'Autonomii locale și instituții centrale (secolele IX–XVIII)',
      'Formarea statului român modern și realizarea României Mari',
      'România postbelică: regimul comunist și tranziția democratică',
    ],
  ],
  [
    'D. Relațiile internaționale',
    [
      'Diplomație și conflict în Evul Mediu și modernitate timpurie',
      'România și marile alianțe europene',
      'România în contextul Războiului Rece',
    ],
  ],
];

const EXPECTED_LESSONS: Array<{ leaf: string; exercises: string[] }> = [
  {
    leaf: 'Formarea statului român modern și realizarea României Mari',
    exercises: [
      'Scrie introducerea unui eseu despre constituirea statului român modern în perioada 1857–1866.',
      'Prezintă o acțiune desfășurată de români în perioada 1857–1859, precizând două informații referitoare la aceasta și utilizând relația cauză-efect.',
    ],
  },
  {
    leaf: 'Constituțiile din România',
    exercises: [
      'Precizează o măsură adoptată în statul român în perioada 1861–1866 și menționează două aspecte cu privire la această măsură.',
      'Formulează un punct de vedere referitor la Constituția din 1866 și susține-l printr-un argument istoric.',
    ],
  },
  {
    leaf: 'România și marile alianțe europene',
    exercises: [
      'Menționează două fapte istorice la care participă România în cadrul relațiilor internaționale din perioada 1875–1885.',
      'Formulează un punct de vedere referitor la politica externă a României în perioada 1916–1918 și susține-l printr-un argument istoric.',
    ],
  },
];

function leaves(nodes: SeedNode[]): SeedNode[] {
  return nodes.flatMap((n) => (n.children?.length ? leaves(n.children) : [n]));
}

function allNodes(nodes: SeedNode[]): SeedNode[] {
  return nodes.flatMap((n) => [n, ...allNodes(n.children ?? [])]);
}

function toLesson(l: SeedLesson): Lesson {
  return {
    id: l.key,
    nodeId: l.nodeKey,
    title: l.title,
    position: 0,
    status: l.status,
    cards: l.cards.map(({ image, ...c }, i) => ({
      ...c,
      id: `c${i}`,
      position: i,
      imagePath: image ?? null,
    })),
    questions: l.questions.map((q, i) => ({ ...q, id: `q${i}`, position: i }) as Question),
    exercises: l.exercises.map((x, i) => ({ ...x, id: `x${i}`, position: i })),
  };
}

describe('tree', () => {
  it('has the 4 BAC domains with their 10 leaves, titles verbatim', () => {
    expect(tree.map((d) => d.title)).toEqual(EXPECTED_TREE.map(([d]) => d));
    tree.forEach((domain, i) => {
      expect(domain.children?.map((c) => c.title)).toEqual(EXPECTED_TREE[i]![1]);
    });
    expect(leaves(tree)).toHaveLength(10);
  });

  it('has unique node keys', () => {
    const keys = allNodes(tree).map((n) => n.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('lessons', () => {
  const leafByKey = new Map(leaves(tree).map((n) => [n.key, n]));

  it('has 3 published lessons attached to the expected leaves', () => {
    expect(lessons).toHaveLength(3);
    lessons.forEach((l, i) => {
      expect(l.status).toBe('published');
      expect(leafByKey.get(l.nodeKey)?.title).toBe(EXPECTED_LESSONS[i]!.leaf);
    });
    expect(new Set(lessons.map((l) => l.key)).size).toBe(3);
  });

  describe.each(lessons.map((l) => [l.key, l] as const))('%s', (_key, lesson) => {
    it('has 6–10 cards, at least 2 with an image', () => {
      expect(lesson.cards.length).toBeGreaterThanOrEqual(6);
      expect(lesson.cards.length).toBeLessThanOrEqual(10);
      expect(lesson.cards.filter((c) => c.image).length).toBeGreaterThanOrEqual(2);
    });

    it('has 8–10 questions covering all types and difficulties, each with an explanation', () => {
      expect(lesson.questions.length).toBeGreaterThanOrEqual(8);
      expect(lesson.questions.length).toBeLessThanOrEqual(10);
      expect(new Set(lesson.questions.map((q) => q.type))).toEqual(
        new Set(['single_choice', 'multiple_choice', 'chronological_order']),
      );
      expect(new Set(lesson.questions.map((q) => q.difficulty))).toEqual(
        new Set(['easy', 'medium', 'hard']),
      );
      for (const q of lesson.questions) expect(q.explanation?.trim()).toBeTruthy();
    });

    it('labels every chronological item with a year and uses 3–5 items', () => {
      for (const q of lesson.questions) {
        if (q.type !== 'chronological_order') continue;
        expect(q.options.length).toBeGreaterThanOrEqual(3);
        expect(q.options.length).toBeLessThanOrEqual(5);
        for (const o of q.options) expect(o.label).toMatch(/^\d{4}$/);
        const years = q.options.map((o) => Number(o.label));
        expect([...years].sort((a, b) => a - b)).toEqual(years);
      }
    });

    it('has exactly the 2 required writing exercises with criteria', () => {
      const idx = lessons.indexOf(lesson);
      expect(lesson.exercises.map((x) => x.prompt)).toEqual(EXPECTED_LESSONS[idx]!.exercises);
      for (const x of lesson.exercises) expect(x.criteria.trim().length).toBeGreaterThan(0);
    });

    it('passes validateLesson', () => {
      expect(validateLesson(toLesson(lesson))).toEqual([]);
    });

    it('references existing images (≤ 300 KB) with a credit', () => {
      for (const c of lesson.cards) {
        if (!c.image) continue;
        const file = imagesDir + c.image;
        expect(existsSync(file), c.image).toBe(true);
        expect(statSync(file).size, c.image).toBeLessThanOrEqual(300 * 1024);
        expect(c.imageCredit?.trim(), c.image).toBeTruthy();
      }
    });
  });
});

describe('defaults', () => {
  it('has a welcome message and AI defaults', () => {
    expect(welcomeMessage.trim().length).toBeGreaterThan(0);
    expect(aiDefaults.rules.trim().length).toBeGreaterThan(0);
    expect(aiDefaults).toMatchObject({ gradeMin: 1, gradeMax: 10, model: 'gpt-5-mini' });
  });
});

describe('diacritics', () => {
  it('uses comma-below ș/ț, never cedilla ş/ţ', () => {
    const all = JSON.stringify({ tree, lessons, welcomeMessage, aiDefaults });
    expect(all).not.toMatch(/[şţŞŢ]/);
  });
});
