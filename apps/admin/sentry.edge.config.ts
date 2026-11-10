// Sentry for the Edge runtime. Nothing runs there today (Next 16's `proxy.ts` is Node.js); kept so a route that opts
// into `runtime = 'edge'` is covered. Loaded by `src/instrumentation.ts`.
import { initSentry } from './src/lib/sentry';

initSentry();
