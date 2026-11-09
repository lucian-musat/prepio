import { zodTextFormat } from 'openai/helpers/zod';
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

/**
 * What is sent to OpenAI: the same shapes without the feedback length limit. `zodTextFormat` also parses the reply
 * client-side with its schema, so a limit there would turn a long feedback into a failed (refunded) paper, and strict
 * mode may reject `maxLength`. The handler cuts the feedback and then validates with the schemas above.
 */
const bacGradeWireSchema = bacGradeSchema.extend({ feedback: z.string() });
const bacStyleWireSchema = bacStyleSchema.extend({ feedback: z.string() });

export function bacTextFormat(kind: 'item' | 'style') {
  return kind === 'style' ? zodTextFormat(bacStyleWireSchema, 'style') : zodTextFormat(bacGradeWireSchema, 'grade');
}
