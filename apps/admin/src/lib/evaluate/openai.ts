import 'server-only';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { aiOutputSchemaFor } from '@/lib/consolidation/schema';
import { bacGradeSchema, bacStyleSchema } from '@/lib/bac/schema';
import { reasoningFor } from './reasoning';

/** `keys`: the item keys the model must return; the structured-output schema allows only these. */
export type Evaluator = (a: { model: string; instructions: string; input: string; keys: string[] }) => Promise<unknown>;

/** Leaves room for the auth, DB reads and rate limits within the route's 60 s `maxDuration`. */
export const OPENAI_TIMEOUT_MS = 50_000;

export function createOpenAIEvaluator(apiKey: string): Evaluator {
  const client = new OpenAI({ apiKey, timeout: OPENAI_TIMEOUT_MS, maxRetries: 0 });
  return async ({ model, instructions, input, keys }) => {
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
          text: { format: zodTextFormat(aiOutputSchemaFor(keys), 'evaluation') },
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

/** One BAC grading call: `item` = a barem item or essay requirement (`bacGradeSchema`), `style` = the essay's style call. */
export type Grader = (a: { model: string; instructions: string; input: string; kind: 'item' | 'style' }) => Promise<unknown>;

/** All of a paper's calls run in parallel, with no retry, within the route's 60 s `maxDuration`. */
export const BAC_OPENAI_TIMEOUT_MS = 40_000;

export function createOpenAIGrader(apiKey: string): Grader {
  const client = new OpenAI({ apiKey, timeout: BAC_OPENAI_TIMEOUT_MS, maxRetries: 0 });
  return async ({ model, instructions, input, kind }) => {
    const reasoning = reasoningFor(model);
    const started = Date.now();
    const format = kind === 'style' ? zodTextFormat(bacStyleSchema, 'style') : zodTextFormat(bacGradeSchema, 'grade');
    try {
      const res = await client.responses.parse(
        { model, instructions, input, store: false, ...(reasoning ? { reasoning } : {}), text: { format } },
        { timeout: BAC_OPENAI_TIMEOUT_MS },
      );
      // Timing and token counts only (no student text), to watch latency in the Vercel logs.
      console.info(
        '[bac/submit] openai',
        JSON.stringify({
          model,
          kind,
          effort: reasoning?.effort ?? null,
          ms: Date.now() - started,
          inputTokens: res.usage?.input_tokens,
          outputTokens: res.usage?.output_tokens,
          reasoningTokens: res.usage?.output_tokens_details?.reasoning_tokens,
        }),
      );
      return res.output_parsed;
    } catch (e) {
      console.error('[bac/submit] openai failed', JSON.stringify({ model, kind, ms: Date.now() - started }));
      throw e;
    }
  };
}
