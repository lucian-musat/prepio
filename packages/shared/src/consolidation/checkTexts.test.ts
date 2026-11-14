import { describe, expect, it } from 'vitest';
import { defaultText, type TextFn } from '../texts/catalog';
import { checkExercise } from './check';
import type { ConsolidationExercise } from './types';

const base = { id: 'e', position: 0, prompt: 'P', templateId: null, modelAnswer: null, explanation: null, sources: [] };
const short = { ...base, type: 'short_answer', accepted: ['Cuza'], mistakes: [] } as unknown as ConsolidationExercise;
const facts = { ...base, type: 'facts', count: 1 } as unknown as ConsolidationExercise;

describe('checkExercise texts', () => {
  it('uses the catalog defaults without a text function', () => {
    const fb = checkExercise(short, [], { type: 'short_answer', text: 'Cuza' });
    expect(fb.items[0]!.title).toBe(defaultText('consolidation.check.correct'));
  });

  it('takes its titles and lines from the given text function, with variables', () => {
    const text: TextFn = (key, vars) => `[${key}${vars ? ` ${JSON.stringify(vars)}` : ''}]`;
    const ok = checkExercise(short, [], { type: 'short_answer', text: 'Cuza' }, text);
    expect(ok.items[0]!.title).toBe('[consolidation.check.correct]');
    const empty = checkExercise(facts, [], { type: 'facts', texts: [''] }, text);
    expect(empty.items[0]).toMatchObject({
      title: '[consolidation.check.facts.emptyTitle {"n":1}]',
      improve: ['[consolidation.check.facts.empty]'],
    });
  });
});
