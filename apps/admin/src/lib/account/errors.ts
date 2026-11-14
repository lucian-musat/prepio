import type { AccountDeleteError, AccountDeleteErrorCode } from '@prepio/shared';

/**
 * Error replies of `POST /api/account/delete`. The app shows its own text for each code (`API_ERROR_TEXTS` in
 * @prepio/shared); errorTexts.test.ts keeps these messages equal to those texts' defaults. `bad_request` is only the
 * Origin guard, whose message differs on purpose.
 */
const ERRORS: Record<AccountDeleteErrorCode, { status: number; message: string }> = {
  bad_request: { status: 403, message: 'Cerere nepermisă.' },
  unauthorized: { status: 401, message: 'Trebuie să fii autentificat.' },
  forbidden: { status: 403, message: 'Contul de administrator nu poate fi șters de aici.' },
  server_error: { status: 500, message: 'Contul nu a putut fi șters. Încearcă din nou.' },
};

export function accountDeleteError(code: AccountDeleteErrorCode): { status: number; json: AccountDeleteError } {
  const { status, message } = ERRORS[code];
  return { status, json: { error: code, message } };
}
