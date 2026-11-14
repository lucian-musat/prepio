import { describe, expect, it, vi } from 'vitest';
import { API_ERROR_REFUNDED_TEXT, API_ERROR_TEXTS, MAX_ANSWER_CHARS, TEXTS, formatText, type ApiEndpoint, type TextKey } from '@prepio/shared';
import { accountDeleteError } from './account/errors';
import { purchaseError as accessError } from './access/purchase';
import { bacError } from './bac/handler';
import { REFUNDED_MESSAGE, errorResult } from './consolidation/handler';
import { purchaseError as creditsError } from './credits/purchase';

vi.mock('@/lib/sentry', () => ({ captureFailure: vi.fn(), captureError: vi.fn() }));

/**
 * Drift guard: the app never shows the server's `message`, it maps the `code` to a catalog text (API_ERROR_TEXTS, the
 * same map the student app uses). The catalog default must stay the server's message, so the two never tell the
 * student different things.
 */
const messageOf = (r: { json: unknown }) => (r.json as { message: string }).message;
const serverMessage: Record<ApiEndpoint, (code: string) => string> = {
  evaluate: (code) => messageOf(errorResult(code as never)),
  bac: (code) => messageOf(bacError(code as never)),
  credits: (code) => messageOf(creditsError(code as never)),
  access: (code) => messageOf(accessError(code as never)),
  accountDelete: (code) => messageOf(accountDeleteError(code as never)),
};

/**
 * Codes whose server message differs from the app's text on purpose. The routes' Origin / Content-Type guards answer
 * `bad_request` with „Cerere nepermisă.” / „Cerere invalidă.” (the account deletion has only the Origin guard), while
 * the app shows „Cererea nu este validă.” for every `bad_request`.
 */
const EXCEPTIONS: Partial<Record<ApiEndpoint, string[]>> = { accountDelete: ['bad_request'] };

const catalogDefault = (key: TextKey) => formatText(TEXTS[key].default, { max: MAX_ANSWER_CHARS });

describe('server error messages match the app texts', () => {
  for (const [endpoint, map] of Object.entries(API_ERROR_TEXTS) as Array<[ApiEndpoint, Record<string, TextKey>]>) {
    for (const [code, key] of Object.entries(map)) {
      if (EXCEPTIONS[endpoint]?.includes(code)) continue;
      it(`${endpoint} ${code} → ${key}`, () => {
        expect(serverMessage[endpoint](code)).toBe(catalogDefault(key));
      });
    }
  }

  it('the refunded ai_failed message matches its text', () => {
    expect(REFUNDED_MESSAGE).toBe(catalogDefault(API_ERROR_REFUNDED_TEXT));
  });

  it('the exceptions are the guard messages', () => {
    expect(accountDeleteError('bad_request').json.message).toBe('Cerere nepermisă.');
  });
});
