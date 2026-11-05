import { z } from 'zod';

/** What the model returns: one entry per expected item key. */
export const aiOutputSchema = z.object({
  items: z
    .array(
      z.object({
        key: z.string(),
        verdict: z.enum(['ok', 'almost', 'no']),
        title: z.string().max(120),
        good: z.array(z.string().max(400)).max(5),
        improve: z.array(z.string().max(400)).max(5),
      }),
    )
    .max(8),
});
export type AiOutput = z.infer<typeof aiOutputSchema>;
