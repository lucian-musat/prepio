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

const AI_FAILED = 'Evaluarea nu a reușit. Încearcă din nou.';
const OFFLINE = 'Nu ne-am putut conecta. Verifică internetul și încearcă din nou.';

export async function evaluateEssay(req: EvaluateRequest): Promise<EvaluateResponse> {
  let res: Response;
  try {
    res = await fetch(`${apiUrl()}/api/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
  } catch {
    throw new EvaluateApiError('ai_failed', OFFLINE);
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new EvaluateApiError('ai_failed', AI_FAILED);
  }
  if (!res.ok) {
    const e = body as Partial<EvaluateError> | null;
    throw new EvaluateApiError(e?.error ?? 'ai_failed', e?.message || AI_FAILED);
  }
  return body as EvaluateResponse;
}
