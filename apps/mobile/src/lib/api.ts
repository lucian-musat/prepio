import {
  API_ERROR_REFUNDED_TEXT,
  API_ERROR_TEXTS,
  MAX_ANSWER_CHARS,
  type AccountDeleteError,
  type AccountDeleteErrorCode,
  type ApiEndpoint,
  type ConsolidationEvaluateError,
  type ConsolidationEvaluateErrorCode,
  type ConsolidationEvaluateRequest,
  type ConsolidationEvaluateResponse,
  type TextKey,
} from '@prepio/shared';
import { apiUrl, AuthOutageError, getAccessToken, signOut } from './supabase';
import { refreshRegisteredAccess, refreshRegisteredProfile } from './profileRefresh';
import { t } from '../texts/store';

// The code -> text map lives in @prepio/shared (API_ERROR_TEXTS), so the admin can test it against the server.
export type { ApiEndpoint };

/**
 * The student-facing text for an error `code` returned by `endpoint`. `refunded`: a consolidation `ai_failed` whose
 * credits were given back (the reply carries `credits`).
 */
export function apiErrorText(endpoint: ApiEndpoint, code: string, opts: { refunded?: boolean } = {}): string {
  if (endpoint === 'evaluate' && code === 'ai_failed' && opts.refunded) return t(API_ERROR_REFUNDED_TEXT);
  const texts: Record<string, TextKey> = API_ERROR_TEXTS[endpoint];
  const key = Object.prototype.hasOwnProperty.call(texts, code) ? texts[code]! : 'errors.api.generic';
  return t(key, { max: MAX_ANSWER_CHARS });
}

export class EvaluateApiError extends Error {
  code: ConsolidationEvaluateErrorCode;
  /** Only on `insufficient_credits`: what the check costs and what the student has. */
  required?: number;
  balance?: number;
  constructor(code: ConsolidationEvaluateErrorCode, message: string, extra?: { required?: number; balance?: number }) {
    super(message);
    this.name = 'EvaluateApiError';
    this.code = code;
    this.required = extra?.required;
    this.balance = extra?.balance;
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

/** Slightly above the server's own limits (60 s function, 50 s OpenAI timeout). */
export const EVALUATE_TIMEOUT_MS = 65_000;

// The app's own messages, read at throw time (never at module load: the overrides arrive later).
export const offlineText = () => t('errors.offline');
export const sessionExpiredText = () => t('errors.sessionExpired');

export function missingApiUrl(caller: string) {
  console.error(
    `[${caller}] EXPO_PUBLIC_API_URL is not set; the admin API is unreachable. ` +
      'Set it in apps/mobile/.env for local dev, or in the EAS/Vercel build environment.',
  );
}

/**
 * The session is really gone (no token, or the API said 401): sign out so the route guard shows the welcome
 * screen. A 5xx is an outage, not a logout — callers keep the session and show the error.
 */
export async function sessionExpired<E extends Error>(error: E): Promise<never> {
  await signOut();
  throw error;
}

/**
 * The server refused the call because an admin suspended the account (403 `suspended`): re-read the profile so
 * the root guard moves to the suspended screen, then throw the error (its text is `errors.api.suspended`).
 */
export async function accountSuspended<E extends Error>(error: E): Promise<never> {
  await refreshRegisteredProfile();
  throw error;
}

/**
 * The bearer token, or null when there is no session. An auth outage (expired token that cannot be refreshed
 * offline, stalled Supabase) becomes `outage()` — a connection error that keeps the stored session.
 */
export async function bearerToken(outage: () => Error): Promise<string | null> {
  try {
    return await getAccessToken();
  } catch (e) {
    if (e instanceof AuthOutageError) throw outage();
    throw e;
  }
}

export async function evaluateConsolidation(req: ConsolidationEvaluateRequest): Promise<ConsolidationEvaluateResponse> {
  const base = apiUrl();
  if (!base) {
    missingApiUrl('evaluateConsolidation');
    throw new EvaluateApiError('ai_failed', t('errors.evaluate.notConfigured'));
  }
  const token = await bearerToken(() => new EvaluateApiError('ai_failed', offlineText()));
  if (!token) return sessionExpired(new EvaluateApiError('unauthorized', sessionExpiredText()));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EVALUATE_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(`${base}/api/consolidation/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(req),
        signal: controller.signal,
      });
    } catch {
      throw new EvaluateApiError('ai_failed', controller.signal.aborted ? t('errors.evaluate.timeout') : offlineText());
    }
    if (res.status === 401) return sessionExpired(new EvaluateApiError('unauthorized', sessionExpiredText()));
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new EvaluateApiError('ai_failed', controller.signal.aborted ? t('errors.evaluate.timeout') : t('errors.api.evaluate.aiFailed'));
    }
    if (!res.ok) {
      const e = body as Partial<ConsolidationEvaluateError> | null;
      const code = e?.error ?? 'ai_failed';
      const error = new EvaluateApiError(code, apiErrorText('evaluate', code, { refunded: !!e?.credits }), {
        required: e?.required,
        balance: e?.balance ?? e?.credits?.balance,
      });
      if (res.status === 403 && error.code === 'suspended') return accountSuspended(error);
      // Access ended mid-session: re-read it so the lesson list and the paywall catch up; the caller shows the sheet.
      if (res.status === 403 && error.code === 'access_required') await refreshRegisteredAccess();
      throw error;
    }
    return body as ConsolidationEvaluateResponse;
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
    throw new AccountDeleteApiError('server_error', t('errors.accountDelete.notConfigured'));
  }
  const token = await bearerToken(() => new AccountDeleteApiError('server_error', offlineText()));
  if (!token) return sessionExpired(new AccountDeleteApiError('unauthorized', sessionExpiredText()));

  let res: Response;
  try {
    res = await fetch(`${base}/api/account/delete`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new AccountDeleteApiError('server_error', offlineText());
  }
  if (res.status === 204) return;
  if (res.status === 401) return sessionExpired(new AccountDeleteApiError('unauthorized', sessionExpiredText()));
  let body: Partial<AccountDeleteError> | null = null;
  try {
    body = (await res.json()) as Partial<AccountDeleteError> | null;
  } catch {
    // Non-JSON error page (proxy/gateway): fall through to the generic message.
  }
  const code = body?.error ?? 'server_error';
  throw new AccountDeleteApiError(code, apiErrorText('accountDelete', code));
}
