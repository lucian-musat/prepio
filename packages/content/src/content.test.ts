import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  AI_TEMPLATE_TYPES,
  CARD_TYPES,
  cardImagePaths,
  parseRichText,
  validateCard,
  validateLesson,
  type Card,
  type Lesson,
  type Question,
} from '@prepio/shared';
import { DEMO_CONSOLIDATION } from './demoLesson';
import { EXTRA_CARDS } from './extraCards';
import { AI_TEMPLATES, aiDefaults, lessons, tree, welcomeMessage, type SeedLesson, type SeedNode } from './index';

const imagesDir = fileURLToPath(new URL('../images/', import.meta.url));
const credits = readFileSync(imagesDir + 'CREDITS.md', 'utf8');

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

const EXPECTED_LESSONS: Array<{ leaf: string }> = [
  { leaf: 'Formarea statului român modern și realizarea României Mari' },
  { leaf: 'Constituțiile din România' },
  { leaf: 'România și marile alianțe europene' },
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
    cards: l.cards.map((c, i) => ({ ...c, id: `c${i}`, position: i }) as Card),
    questions: l.questions.map((q, i) => ({ ...q, id: `q${i}`, position: i }) as Question),
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

  it('uses every card type at least once', () => {
    const types = new Set(lessons.flatMap((l) => l.cards.map((c) => c.type)));
    expect([...types].sort()).toEqual([...CARD_TYPES].sort());
  });

  it('has a gallery images card with at least 3 images', () => {
    const galleries = lessons.flatMap((l) => l.cards).filter((c) => c.type === 'images' && c.display === 'gallery');
    expect(galleries.some((c) => c.type === 'images' && c.images.length >= 3)).toBe(true);
  });

  it('uses every callout variant, a list and a heading in one text card', () => {
    const texts = lessons.flatMap((l) => l.cards).flatMap((c) => (c.type === 'text' ? [parseRichText(c.text)] : []));
    const full = texts.find((blocks) => {
      const variants = new Set(blocks.flatMap((b) => (b.kind === 'callout' ? [b.variant] : [])));
      return (
        variants.size === 3 && blocks.some((b) => b.kind === 'list') && blocks.some((b) => b.kind === 'heading')
      );
    });
    expect(full).toBeDefined();
  });

  it('appends the extra cards of every lesson key, which all exist', () => {
    const keys = new Set(lessons.map((l) => l.key));
    for (const [key, extras] of Object.entries(EXTRA_CARDS)) {
      expect(keys.has(key), key).toBe(true);
      const lesson = lessons.find((l) => l.key === key)!;
      expect(lesson.cards.slice(-extras.length)).toEqual(extras);
    }
  });

  describe.each(lessons.map((l) => [l.key, l] as const))('%s', (_key, lesson) => {
    it('has 6–16 cards, at least 2 with an image', () => {
      expect(lesson.cards.length).toBeGreaterThanOrEqual(6);
      expect(lesson.cards.length).toBeLessThanOrEqual(16);
      expect(lesson.cards.filter((c) => cardImagePaths(c).length > 0).length).toBeGreaterThanOrEqual(2);
    });

    it('has a card of every type', () => {
      expect(new Set(lesson.cards.map((c) => c.type))).toEqual(new Set(CARD_TYPES));
    });

    it('has unique card titles (the add-cards script matches on type + title)', () => {
      const titles = lesson.cards.map((c) => c.title);
      expect(titles.every((t) => t?.trim())).toBe(true);
      expect(new Set(titles).size).toBe(titles.length);
    });

    it('has only valid cards', () => {
      for (const c of lesson.cards) expect(validateCard(c), c.title ?? c.type).toEqual([]);
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

    it('passes validateLesson', () => {
      expect(validateLesson(toLesson(lesson))).toEqual([]);
    });

    it('references existing images (≤ 300 KB) listed in CREDITS.md', () => {
      for (const image of lesson.cards.flatMap((c) => cardImagePaths(c))) {
        const file = imagesDir + image;
        expect(existsSync(file), image).toBe(true);
        expect(statSync(file).size, image).toBeLessThanOrEqual(300 * 1024);
        expect(credits, image).toContain(`| \`${image}\` |`);
      }
    });

    it('credits every image shown on an images card', () => {
      for (const c of lesson.cards) {
        if (c.type !== 'images') continue;
        for (const img of c.images) expect(img.credit?.trim(), img.path).toBeTruthy();
      }
    });
  });
});

describe('defaults', () => {
  it('has a welcome message and AI defaults', () => {
    expect(welcomeMessage.trim().length).toBeGreaterThan(0);
    expect(aiDefaults.rules.trim().length).toBeGreaterThan(0);
    expect(aiDefaults).toEqual({ rules: aiDefaults.rules, model: 'gpt-5-mini' });
    // Consolidation feedback has no grades (spec): the default rules must not ask for one.
    expect(aiDefaults.rules).not.toMatch(/\bnot[ăa]|\bscala\b/i);
  });

  it('keeps only type-independent rules: the type instructions live in the AI templates', () => {
    expect(aiDefaults.rules).not.toMatch(/simplă menționare|punct de vedere este o apreciere|deoarece/);
    // The role, the language and the tone moved from the code into the rules.
    expect(aiDefaults.rules).toMatch(/profesor de istorie/);
    expect(aiDefaults.rules).toMatch(/diacritice/);
    expect(aiDefaults.rules).toMatch(/încurajator/);
  });
});

describe('AI templates', () => {
  it('has exactly one template per type, keyed by its type, with criteria and unique titles', () => {
    expect(AI_TEMPLATES.map((t) => t.key).sort()).toEqual([...AI_TEMPLATE_TYPES].sort());
    expect(new Set(AI_TEMPLATES.map((t) => t.title)).size).toBe(AI_TEMPLATES.length);
    for (const t of AI_TEMPLATES) {
      expect(t.title.trim(), t.key).not.toBe('');
      expect(t.criteria.trim().length, t.key).toBeGreaterThan(100);
    }
  });

  it('gives the connector-based types the causal and conclusion connectors, and comparison its markers', () => {
    const keywords = (k: string) => AI_TEMPLATES.find((t) => t.key === k)!.keywords;
    for (const k of ['argument', 'essay_requirement']) expect(keywords(k), k).toMatch(/deoarece.*așadar|așadar.*deoarece/);
    for (const w of ['spre deosebire de', 'în timp ce', 'la fel ca', 'ambele']) expect(keywords('comparison')).toContain(w);
  });
});

describe('seed AI contexts', () => {
  const contexts = [...lessons.flatMap((l) => l.consolidation), ...DEMO_CONSOLIDATION].flatMap((c) =>
    c.ai ? [{ prompt: c.prompt, text: c.ai.main }, ...Object.entries(c.ai.requirements).map(([id, text]) => ({ prompt: `${c.prompt} ${id}`, text }))] : [],
  );

  it('hold facts only: no type instruction', () => {
    expect(contexts.length).toBeGreaterThan(20);
    for (const { prompt, text } of contexts) expect(text, prompt).not.toMatch(/trebuie (să fie )?prezentat|nu doar numit|Nu este punct de vedere|Nu se acceptă/i);
  });
});

describe('diacritics', () => {
  it('uses comma-below ș/ț, never cedilla ş/ţ', () => {
    const all = JSON.stringify({ tree, lessons, welcomeMessage, aiDefaults, AI_TEMPLATES });
    expect(all).not.toMatch(/[şţŞŢ]/);
  });
});
