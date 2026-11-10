import * as Sentry from '@sentry/react-native';
import { scrubEvent } from '@prepio/shared';

// Expo inlines `process.env.EXPO_PUBLIC_*` literals at bundle time, so these must stay plain property reads.
// No DSN (local dev, tests, CI) means Sentry is never initialised and every helper here is a no-op.
const dsn = (): string => process.env.EXPO_PUBLIC_SENTRY_DSN || '';

/** Initialises Sentry when the build has a DSN. Returns whether it is on. */
export function initSentry(): boolean {
  const value = dsn();
  if (!value) return false;
  Sentry.init({
    dsn: value,
    environment: process.env.EXPO_PUBLIC_SENTRY_ENV || 'development',
    // No IP, cookies or request bodies; the user is identified by Supabase id only (setSentryUser).
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    beforeSend: scrubEvent,
    // Breadcrumbs are also synced to the native layer (native crash reports skip `beforeSend`), so scrub each one
    // as it is recorded too.
    beforeBreadcrumb: (breadcrumb) => scrubEvent({ breadcrumbs: [breadcrumb] }).breadcrumbs?.[0] ?? breadcrumb,
  });
  return true;
}

/** Tags events with the signed-in user's id (never email or name); `null` on sign-out. */
export function setSentryUser(id: string | null): void {
  if (!dsn()) return;
  Sentry.setUser(id ? { id } : null);
}

export function captureError(e: unknown): void {
  if (!dsn()) return;
  Sentry.captureException(e);
}
