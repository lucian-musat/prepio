import * as Sentry from '@sentry/react-native';
import { scrubEvent, scrubUrl } from '@prepio/shared';

// Expo inlines `process.env.EXPO_PUBLIC_*` literals at bundle time, so these must stay plain property reads.
// No DSN (local dev, tests, CI) means Sentry is never initialised and every helper here is a no-op.
const dsn = (): string => process.env.EXPO_PUBLIC_SENTRY_DSN || '';

type Breadcrumb = Parameters<NonNullable<Sentry.ReactNativeOptions['beforeBreadcrumb']>>[0];
type SpanJSON = Parameters<NonNullable<Sentry.ReactNativeOptions['beforeSendSpan']>>[0];

const SPAN_URL_KEYS = ['url', 'http.url'];

/** Breadcrumbs are synced to the native layer too (native crash reports skip `beforeSend`): scrub on record. */
function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  const out = scrubEvent({ breadcrumbs: [breadcrumb] }).breadcrumbs?.[0] ?? breadcrumb;
  // Logged objects (profiles, API errors) can carry emails anywhere inside: keep the message, drop the arguments.
  if (out.category === 'console' && out.data && 'arguments' in out.data) {
    const { arguments: _dropped, ...data } = out.data;
    return { ...out, data };
  }
  return out;
}

/** Page-load / navigation / fetch spans carry URLs, e.g. the OAuth return with `?code=` or `#access_token=`. */
function scrubSpan(span: SpanJSON): SpanJSON {
  const out = { ...span };
  if (typeof out.description === 'string') out.description = scrubUrl(out.description);
  if (out.data) {
    const data = { ...out.data };
    for (const k of SPAN_URL_KEYS) {
      const v = data[k];
      if (typeof v === 'string') data[k] = scrubUrl(v);
    }
    out.data = data;
  }
  return out;
}

/** Initialises Sentry when the build has a DSN. Returns whether it is on. */
export function initSentry(): boolean {
  const value = dsn();
  if (!value) return false;
  // Web (Vercel) sets `prepio-web@<git sha>`; native keeps the SDK default `<package>@<version>+<build>`.
  const release = process.env.EXPO_PUBLIC_SENTRY_RELEASE || undefined;
  Sentry.init({
    dsn: value,
    environment: process.env.EXPO_PUBLIC_SENTRY_ENV || 'development',
    ...(release ? { release } : {}),
    // No IP, cookies or request bodies; the user is identified by Supabase id only (setSentryUser).
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    // No `sentry-trace` / `baggage` headers on any request: the admin API's CORS allows only Content-Type and
    // Authorization (a preflight with them would fail), and Supabase is a third party.
    tracePropagationTargets: [],
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubEvent,
    beforeSendSpan: scrubSpan,
    beforeBreadcrumb: scrubBreadcrumb,
  });
  return true;
}

/** Tags events with the signed-in user's id (never email or name); `null` on sign-out. */
export function setSentryUser(id: string | null): void {
  if (!dsn()) return;
  Sentry.setUser(id ? { id } : null);
}

/** Reports an error. `{ handled: false }` marks one that reached an error boundary (it crashed the screen). */
export function captureError(e: unknown, mechanism?: { handled: boolean }): void {
  if (!dsn()) return;
  Sentry.captureException(e, mechanism ? { mechanism } : undefined);
}
