import { describe, expect, it } from 'vitest';

describe('openai evaluator module', () => {
  it('is server-only (refuses to load outside the React server environment)', async () => {
    await expect(import('./openai')).rejects.toThrow(/Client Component/);
  });
});
