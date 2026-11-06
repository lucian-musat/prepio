import 'server-only';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { aiOutputSchema } from '@/lib/consolidation/schema';
import { reasoningFor } from './reasoning';

export type Evaluator = (a: { model: string; instructions: string; input: string }) => Promise<unknown>;

/** Leaves room for the auth, DB reads and rate limits within the route's 60 s `maxDuration`. */
export const OPENAI_TIMEOUT_MS = 50_000;

export function createOpenAIEvaluator(apiKey: string): Evaluator {
  const client = new OpenAI({ apiKey, timeout: OPENAI_TIMEOUT_MS, maxRetries: 0 });
  return async ({ model, instructions, input }) => {
    const reasoning = reasoningFor(model);
    const started = Date.now();
    try {
      const res = await client.responses.parse(
        {
          model,
          instructions,
          input,
          store: false,
          ...(reasoning ? { reasoning } : {}),
          text: { format: zodTextFormat(aiOutputSchema, 'evaluation') },
        },
        { timeout: OPENAI_TIMEOUT_MS },
      );
      // Timing and token counts only (no student text), to watch latency in the Vercel logs.
      console.info(
        '[consolidation/evaluate] openai',
        JSON.stringify({
          model,
          effort: reasoning?.effort ?? null,
          ms: Date.now() - started,
          inputTokens: res.usage?.input_tokens,
          outputTokens: res.usage?.output_tokens,
          reasoningTokens: res.usage?.output_tokens_details?.reasoning_tokens,
        }),
      );
      return res.output_parsed;
    } catch (e) {
      console.error('[consolidation/evaluate] openai failed', JSON.stringify({ model, ms: Date.now() - started }));
      throw e;
    }
  };
}
