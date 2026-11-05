import 'server-only';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { aiOutputSchema } from '@/lib/consolidation/schema';

export type Evaluator = (a: { model: string; instructions: string; input: string }) => Promise<unknown>;

export const OPENAI_TIMEOUT_MS = 30_000;

export function createOpenAIEvaluator(apiKey: string): Evaluator {
  const client = new OpenAI({ apiKey, timeout: OPENAI_TIMEOUT_MS, maxRetries: 0 });
  return async ({ model, instructions, input }) => {
    const res = await client.responses.parse(
      {
        model,
        instructions,
        input,
        store: false,
        text: { format: zodTextFormat(aiOutputSchema, 'evaluation') },
      },
      { timeout: OPENAI_TIMEOUT_MS },
    );
    return res.output_parsed;
  };
}
