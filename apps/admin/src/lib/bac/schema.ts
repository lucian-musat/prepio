import { z } from 'zod';

/** One barem item (or essay requirement): whole points; the server clamps them to the barem's steps. */
export const bacGradeSchema = z.object({ points: z.number().int().min(0), feedback: z.string().max(300) });
export type BacGradeOutput = z.infer<typeof bacGradeSchema>;

/** The essay's ordering and expression call; each sub-criterion is clamped to its maximum by the server. */
export const bacStyleSchema = z.object({
  language: z.number().int().min(0),
  structure: z.number().int().min(0),
  order: z.number().int().min(0),
  feedback: z.string().max(300),
});
export type BacStyleOutput = z.infer<typeof bacStyleSchema>;
