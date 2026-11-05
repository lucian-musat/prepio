import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CARD_TYPES, cardImagePaths, parseRichText, validateCard, validateQuestion, type Question } from '@prepio/shared';
import { DEMO_CARDS, DEMO_QUESTIONS } from './demoLesson';

const imagesDir = fileURLToPath(new URL('../images/', import.meta.url));

describe('demo lesson content', () => {
  it('has a card of every type, valid, with existing images', () => {
    expect(new Set(DEMO_CARDS.map((c) => c.type))).toEqual(new Set(CARD_TYPES));
    // The text card uses every rich-text block kind.
    const text = DEMO_CARDS.find((c) => c.type === 'text');
    const kinds = new Set(parseRichText(text?.type === 'text' ? text.text : '').map((b) => b.kind));
    expect(kinds).toEqual(new Set(['heading', 'paragraph', 'list', 'callout']));
    for (const card of DEMO_CARDS) {
      expect(validateCard(card), card.title ?? card.type).toEqual([]);
      for (const file of cardImagePaths(card)) expect(existsSync(imagesDir + file), file).toBe(true);
    }
  });

  it('shows both image layouts', () => {
    const displays = DEMO_CARDS.flatMap((c) => (c.type === 'images' ? [c.display] : []));
    expect(new Set(displays)).toEqual(new Set(['single', 'gallery']));
  });

  it('has 2-3 valid single-choice questions whose only correct option is the first', () => {
    expect(DEMO_QUESTIONS.length).toBeGreaterThanOrEqual(2);
    expect(DEMO_QUESTIONS.length).toBeLessThanOrEqual(3);
    DEMO_QUESTIONS.forEach((q, position) => {
      expect(validateQuestion({ ...q, id: `q${position}`, position } as Question)).toEqual([]);
      if (q.type !== 'single_choice') throw new Error(`question ${position} is ${q.type}`);
      expect(q.options.map((o) => o.correct)).toEqual([true, ...q.options.slice(1).map(() => false)]);
    });
  });
});
