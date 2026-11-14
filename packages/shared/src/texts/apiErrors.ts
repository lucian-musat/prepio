import type { AccessPurchaseErrorCode } from '../access';
import type { BacSubmitErrorCode } from '../bac/types';
import type { ConsolidationEvaluateErrorCode } from '../consolidation/types';
import type { CreditsPurchaseErrorCode } from '../credits';
import type { AccountDeleteErrorCode } from '../types';
import type { TextKey } from './catalog';

/**
 * The student-facing text for each error `code` of the admin API, per endpoint. The app shows these (an admin can
 * edit them), never the server's `message`; their defaults are the server's messages (an admin test keeps them equal).
 * `errors.api.tooLong` takes `{max}`; a consolidation `ai_failed` with refunded credits uses
 * `errors.api.evaluate.aiFailedRefunded` instead.
 */
export const API_ERROR_TEXTS = {
  evaluate: {
    empty: 'errors.api.evaluate.empty',
    too_long: 'errors.api.tooLong',
    not_found: 'errors.api.evaluate.notFound',
    rate_limited: 'errors.api.evaluate.rateLimited',
    insufficient_credits: 'errors.api.evaluate.insufficientCredits',
    ai_failed: 'errors.api.evaluate.aiFailed',
    bad_request: 'errors.api.badRequest',
    unauthorized: 'errors.api.unauthorized',
    suspended: 'errors.api.suspended',
    access_required: 'errors.api.evaluate.accessRequired',
  } satisfies Record<ConsolidationEvaluateErrorCode, TextKey>,
  bac: {
    bad_request: 'errors.api.badRequest',
    unauthorized: 'errors.api.unauthorized',
    suspended: 'errors.api.suspended',
    access_required: 'errors.api.bac.accessRequired',
    not_found: 'errors.api.bac.notFound',
    rate_limited: 'errors.api.bac.rateLimited',
    insufficient_credits: 'errors.api.bac.insufficientCredits',
    already_grading: 'errors.api.bac.alreadyGrading',
    grading_failed: 'errors.api.bac.gradingFailed',
    too_long: 'errors.api.tooLong',
  } satisfies Record<BacSubmitErrorCode, TextKey>,
  credits: {
    bad_request: 'errors.api.badRequest',
    unauthorized: 'errors.api.unauthorized',
    package_unavailable: 'errors.api.credits.packageUnavailable',
    suspended: 'errors.api.suspended',
    server_error: 'errors.api.credits.serverError',
  } satisfies Record<CreditsPurchaseErrorCode, TextKey>,
  access: {
    bad_request: 'errors.api.badRequest',
    unauthorized: 'errors.api.unauthorized',
    suspended: 'errors.api.suspended',
    offer_changed: 'errors.api.access.offerChanged',
    server_error: 'errors.api.access.serverError',
  } satisfies Record<AccessPurchaseErrorCode, TextKey>,
  accountDelete: {
    unauthorized: 'errors.api.unauthorized',
    forbidden: 'errors.api.accountDelete.forbidden',
    bad_request: 'errors.api.badRequest',
    server_error: 'errors.api.accountDelete.serverError',
  } satisfies Record<AccountDeleteErrorCode, TextKey>,
};

export type ApiEndpoint = keyof typeof API_ERROR_TEXTS;

/** The refunded variant of a consolidation `ai_failed`. */
export const API_ERROR_REFUNDED_TEXT: TextKey = 'errors.api.evaluate.aiFailedRefunded';
