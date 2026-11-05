import { describe, expect, it } from 'vitest';
import { emptyExerciseContent, type ConsolidationType } from '@prepio/shared';
import { changeType, cleanDraft, draftFor, hasTypeContent, toDraft, type DraftOf } from './exerciseModel';

const ids = () => {
  let n = 0;
  return () => `id-${n++}`;
};

const DETERMINISTIC: ConsolidationType[] = ['short_answer', 'multi_answer', 'source_info', 'source_letter', 'cause_effect'];

describe('draftFor', () => {
  it.each(DETERMINISTIC)('%s = empty content plus the common defaults', (type) => {
    expect(draftFor(type, ids())).toEqual({
      prompt: '',
      templateId: null,
      sources: [],
      modelAnswer: null,
      explanation: null,
      ai: { main: '', requirements: {} },
      ...emptyExerciseContent(type, ids()),
    });
  });
});

describe('changeType', () => {
  it('keeps the id, prompt, sources, template and model answer; resets the type fields', () => {
    const d = {
      ...draftFor('short_answer', ids()),
      id: 'ex1',
      prompt: 'Numiți domnul.',
      sources: [{ sourceId: 's1', label: 'A' as const }],
      templateId: 't1',
      modelAnswer: 'Cuza',
      explanation: 'Vezi sursa A.',
      accepted: ['Cuza'],
    };
    const next = changeType(d, 'source_info', ids());
    expect(next).toEqual({
      id: 'ex1',
      prompt: 'Numiți domnul.',
      sources: [{ sourceId: 's1', label: 'A' }],
      templateId: 't1',
      modelAnswer: 'Cuza',
      explanation: 'Vezi sursa A.',
      ai: { main: '', requirements: {} },
      type: 'source_info',
      count: 1,
      spans: [],
    });
  });
});

describe('hasTypeContent', () => {
  it('is false for fresh content (ids ignored) and true once the type fields change', () => {
    const d = draftFor('multi_answer', ids()) as DraftOf<'multi_answer'>;
    expect(hasTypeContent({ ...d, prompt: 'x' })).toBe(false);
    expect(hasTypeContent({ ...d, count: 3 })).toBe(true);
  });
});

describe('cleanDraft', () => {
  it('trims and drops empty list lines, empty optional texts become null', () => {
    const d = { ...draftFor('short_answer', ids()), accepted: [' Cuza ', '', '  ', 'Al. I. Cuza'], modelAnswer: '  ', explanation: ' e ' };
    expect(cleanDraft(d)).toMatchObject({ accepted: ['Cuza', 'Al. I. Cuza'], modelAnswer: null, explanation: 'e' });
    const m = { ...draftFor('multi_answer', ids()), groups: [{ id: 'g', variants: [' Muntenia', '', 'Valahia '] }] };
    expect(cleanDraft(m)).toMatchObject({ groups: [{ id: 'g', variants: ['Muntenia', 'Valahia'] }] });
  });
});

describe('toDraft', () => {
  it('drops the position and attaches the AI context', () => {
    const ex = { id: 'e', position: 3, ...draftFor('short_answer', ids()) };
    delete (ex as { ai?: unknown }).ai;
    const ai = { main: 'ctx', requirements: {} };
    const d = toDraft(ex as never, ai);
    expect(d).not.toHaveProperty('position');
    expect(d).toMatchObject({ id: 'e', type: 'short_answer', ai });
  });
});
