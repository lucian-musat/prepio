import * as Sentry from '@sentry/nextjs';
import { scrubBreadcrumb, scrubEvent, scrubSpan } from '@prepio/shared';

// Shared by the browser (`instrumentation-client.ts`), the Node and the Edge runtimes (`sentry.*.config.ts`) and the
// error boundaries. Next inlines `process.env.NEXT_PUBLIC_*` literals at build time, so these stay plain property reads.
// No DSN (local dev, tests, CI) means Sentry is never initialised and every helper here is a no-op.
const dsn = (): string => process.env.NEXT_PUBLIC_SENTRY_DSN || '';

/** Vercel sets VERCEL_ENV on the server and exposes it to the browser as NEXT_PUBLIC_VERCEL_ENV. */
const environment = (): string => process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV || 'development';

/**
 * The init options for every runtime. The release is injected by `withSentryConfig` (the git SHA on Vercel).
 *
 * Pinned to SDK v10, like the student app. v11 drops `sendDefaultPii` for `dataCollection` (whose defaults collect
 * gen-AI inputs, i.e. student answers sent to OpenAI, and HTTP bodies) and streams spans, which skips
 * `beforeSendTransaction` and changes the `beforeSendSpan` shape: an upgrade must revisit all of this.
 */
export function sentryOptions() {
  return {
    dsn: dsn(),
    environment: environment(),
    // No IP, cookies or request bodies; the scrubber also drops request data and the Authorization/Cookie headers.
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    // No `sentry-trace` / `baggage` headers on outgoing requests (Supabase and OpenAI are third parties).
    tracePropagationTargets: [],
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubEvent,
    beforeSendSpan: scrubSpan,
    beforeBreadcrumb: scrubBreadcrumb,
  } satisfies Parameters<typeof Sentry.init>[0];
}

/** Initialises Sentry when the build has a DSN. Returns whether it is on. */
export function initSentry(): boolean {
  if (!dsn()) return false;
  Sentry.init(sentryOptions());
  return true;
}

/** Reports a caught error: pass the error only, never the request, its body, a student's answer or an email. */
export function captureError(e: unknown, tags?: Record<string, string>): void {
  if (!dsn()) return;
  Sentry.captureException(e, tags ? { tags } : undefined);
}

/** Reports an error that reached an error boundary (it crashed the page): `mechanism.handled = false`. */
export function captureBoundaryError(e: unknown): void {
  if (!dsn()) return;
  Sentry.captureException(e, { mechanism: { handled: false } });
}
