import type { EvaluateError, EvaluateErrorCode, EvaluateRequest, EvaluateResponse } from '@prepio/shared';
import { apiUrl } from './supabase';

export class EvaluateApiError extends Error {
  code: EvaluateErrorCode;
  constructor(code: EvaluateErrorCode, message: string) {
    super(message);
    this.name = 'EvaluateApiError';
    this.code = code;
  }
}

/** Slightly above the server's own limits (60 s function, 30 s OpenAI timeout). */
export const EVALUATE_TIMEOUT_MS = 65_000;

const AI_FAILED = 'Evaluarea nu a reușit. Încearcă din nou.';
const OFFLINE = 'Nu ne-am putut conecta. Verifică internetul și încearcă din nou.';
const TIMEOUT = 'Evaluarea durează prea mult. Încearcă din nou.';
const NOT_CONFIGURED = 'Evaluarea nu este disponibilă momentan. Încearcă din nou mai târziu.';

export async function evaluateEssay(req: EvaluateRequest): Promise<EvaluateResponse> {
  const base = apiUrl();
  if (!base) {
    console.error(
      '[evaluateEssay] EXPO_PUBLIC_API_URL is not set; essay evaluation is disabled. ' +
        'Set it in apps/mobile/.env for local dev, or in the EAS/Vercel build environment.',
    );
    throw new EvaluateApiError('ai_failed', NOT_CONFIGURED);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EVALUATE_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(`${base}/api/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
        signal: controller.signal,
      });
    } catch {
      throw new EvaluateApiError('ai_failed', controller.signal.aborted ? TIMEOUT : OFFLINE);
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new EvaluateApiError('ai_failed', controller.signal.aborted ? TIMEOUT : AI_FAILED);
    }
    if (!res.ok) {
      const e = body as Partial<EvaluateError> | null;
      throw new EvaluateApiError(e?.error ?? 'ai_failed', e?.message || AI_FAILED);
    }
    return body as EvaluateResponse;
  } finally {
    clearTimeout(timer);
  }
}
