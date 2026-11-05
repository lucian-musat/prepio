import { z } from 'zod';

/**
 * What the model returns: one entry per expected item key. No length constraints on purpose:
 * this schema is sent to OpenAI as a strict structured-output schema, which may reject or ignore
 * `maxLength`/`maxItems`. Limits are enforced by `normalizeAiOutput` after parsing, so a long
 * answer never fails the evaluation.
 */
export const aiOutputSchema = z.object({
  items: z.array(
    z.object({
      key: z.string(),
      verdict: z.enum(['ok', 'almost', 'no']),
      title: z.string(),
      good: z.array(z.string()),
      improve: z.array(z.string()),
    }),
  ),
});
export type AiOutput = z.infer<typeof aiOutputSchema>;

export const MAX_ITEMS = 8;
export const MAX_TITLE_CHARS = 120;
export const MAX_ENTRY_CHARS = 400;
export const MAX_ENTRIES = 5;

const truncate = (s: string, max: number) => {
  const chars = [...s];
  return chars.length <= max ? s : chars.slice(0, max).join('');
};

/** Truncates over-long strings and lists instead of rejecting them. */
export function normalizeAiOutput(out: AiOutput): AiOutput {
  return {
    items: out.items.slice(0, MAX_ITEMS).map((i) => ({
      key: i.key,
      verdict: i.verdict,
      title: truncate(i.title, MAX_TITLE_CHARS),
      good: i.good.slice(0, MAX_ENTRIES).map((s) => truncate(s, MAX_ENTRY_CHARS)),
      improve: i.improve.slice(0, MAX_ENTRIES).map((s) => truncate(s, MAX_ENTRY_CHARS)),
    })),
  };
}
