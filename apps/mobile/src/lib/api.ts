import type {
  AccountDeleteError,
  AccountDeleteErrorCode,
  EvaluateError,
  EvaluateErrorCode,
  EvaluateRequest,
  EvaluateResponse,
} from '@prepio/shared';
import { apiUrl, getAccessToken, signOut } from './supabase';

export class EvaluateApiError extends Error {
  code: EvaluateErrorCode;
  constructor(code: EvaluateErrorCode, message: string) {
    super(message);
    this.name = 'EvaluateApiError';
    this.code = code;
  }
}

export class AccountDeleteApiError extends Error {
  code: AccountDeleteErrorCode;
  constructor(code: AccountDeleteErrorCode, message: string) {
    super(message);
    this.name = 'AccountDeleteApiError';
    this.code = code;
  }
}

/** Slightly above the server's own limits (60 s function, 30 s OpenAI timeout). */
export const EVALUATE_TIMEOUT_MS = 65_000;

const AI_FAILED = 'Evaluarea nu a reușit. Încearcă din nou.';
const OFFLINE = 'Nu ne-am putut conecta. Verifică internetul și încearcă din nou.';
const TIMEOUT = 'Evaluarea durează prea mult. Încearcă din nou.';
const NOT_CONFIGURED = 'Evaluarea nu este disponibilă momentan. Încearcă din nou mai târziu.';
const SESSION_EXPIRED = 'Sesiunea a expirat. Intră din nou în cont.';
const DELETE_FAILED = 'Contul nu a putut fi șters. Încearcă din nou.';
const DELETE_NOT_CONFIGURED = 'Ștergerea contului nu este disponibilă momentan. Încearcă din nou mai târziu.';

function missingApiUrl(caller: string) {
  console.error(
    `[${caller}] EXPO_PUBLIC_API_URL is not set; the admin API is unreachable. ` +
      'Set it in apps/mobile/.env for local dev, or in the EAS/Vercel build environment.',
  );
}

/**
 * The session is really gone (no token, or the API said 401): sign out so the route guard shows the welcome
 * screen. A 5xx is an outage, not a logout — callers keep the session and show the error.
 */
async function sessionExpired<E extends Error>(error: E): Promise<never> {
  await signOut();
  throw error;
}

export async function evaluateEssay(req: EvaluateRequest): Promise<EvaluateResponse> {
  const base = apiUrl();
  if (!base) {
    missingApiUrl('evaluateEssay');
    throw new EvaluateApiError('ai_failed', NOT_CONFIGURED);
  }
  const token = await getAccessToken();
  if (!token) return sessionExpired(new EvaluateApiError('unauthorized', SESSION_EXPIRED));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EVALUATE_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(`${base}/api/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(req),
        signal: controller.signal,
      });
    } catch {
      throw new EvaluateApiError('ai_failed', controller.signal.aborted ? TIMEOUT : OFFLINE);
    }
    if (res.status === 401) return sessionExpired(new EvaluateApiError('unauthorized', SESSION_EXPIRED));
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

/**
 * Permanently deletes the signed-in student's account. Resolves on 204; the caller then signs out.
 * Throws AccountDeleteApiError with a Romanian message otherwise (401 also signs out).
 */
export async function deleteAccount(): Promise<void> {
  const base = apiUrl();
  if (!base) {
    missingApiUrl('deleteAccount');
    throw new AccountDeleteApiError('server_error', DELETE_NOT_CONFIGURED);
  }
  const token = await getAccessToken();
  if (!token) return sessionExpired(new AccountDeleteApiError('unauthorized', SESSION_EXPIRED));

  let res: Response;
  try {
    res = await fetch(`${base}/api/account/delete`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new AccountDeleteApiError('server_error', OFFLINE);
  }
  if (res.status === 204) return;
  if (res.status === 401) return sessionExpired(new AccountDeleteApiError('unauthorized', SESSION_EXPIRED));
  let body: Partial<AccountDeleteError> | null = null;
  try {
    body = (await res.json()) as Partial<AccountDeleteError> | null;
  } catch {
    // Non-JSON error page (proxy/gateway): fall through to the generic message.
  }
  throw new AccountDeleteApiError(body?.error ?? 'server_error', body?.message || DELETE_FAILED);
}
