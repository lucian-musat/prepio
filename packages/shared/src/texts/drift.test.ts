import { describe, expect, it } from 'vitest';
import { CARD_TYPE_LABELS } from '../cards';
import { CONSOLIDATION_TYPE_LABELS } from '../consolidation/exercises';
import { DIFFICULTY_LABELS } from '../types';
import { isTextKey, TEXTS } from './catalog';

/**
 * Some labels exist twice: as a code constant (used by the admin editors and shared messages) and as a catalog
 * text (what the student app shows). The catalog default must stay equal to the constant.
 */
const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

function defaultOf(key: string): string {
  if (!isTextKey(key)) throw new Error(`missing catalog key ${key}`);
  return TEXTS[key].default;
}

describe('catalog defaults match the shared label constants', () => {
  it.each(Object.entries(CARD_TYPE_LABELS))('cards.type.%s', (type, label) => {
    expect(defaultOf(`cards.type.${type}`)).toBe(label);
  });

  it.each(Object.entries(DIFFICULTY_LABELS))('lesson.test.difficulty.%s', (difficulty, label) => {
    expect(defaultOf(`lesson.test.difficulty.${difficulty}`)).toBe(label);
  });

  it.each(Object.entries(CONSOLIDATION_TYPE_LABELS))('consolidation.type for %s', (type, label) => {
    expect(defaultOf(`consolidation.type.${camel(type)}`)).toBe(label);
  });
});
