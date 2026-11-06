import { describe, expect, it } from 'vitest';
import { reasoningFor } from './reasoning';

describe('reasoningFor', () => {
  it.each(['gpt-5-mini', 'gpt-5', 'gpt-5-nano', 'GPT-5.1-mini', 'o4-mini', 'o3'])('asks %s for low effort', (model) => {
    expect(reasoningFor(model)).toEqual({ effort: 'low' });
  });

  it.each(['gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini', ''])('sends no reasoning option to %s (it would be rejected)', (model) => {
    expect(reasoningFor(model)).toBeUndefined();
  });
});
