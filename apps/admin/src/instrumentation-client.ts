import * as Sentry from '@sentry/nextjs';
import { initSentry } from './lib/sentry';

// Browser Sentry: errors and a 10% trace sample, no session replay. Off without NEXT_PUBLIC_SENTRY_DSN.
initSentry();

// Navigation spans for the App Router.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
