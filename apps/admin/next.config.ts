import type { NextConfig } from 'next';
// v11 moved the build-time wrapper out of the runtime entry point.
import { withSentryConfig } from '@sentry/nextjs/config';

const nextConfig: NextConfig = {
  transpilePackages: ['@prepio/shared'],
  // Card images go through a server action; allow the 5 MB image limit plus form overhead.
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
};

// Source maps are uploaded (and then deleted from the output, so the browser never gets them) only when
// SENTRY_AUTH_TOKEN is set: on Vercel. Local builds and CI skip the upload.
export default withSentryConfig(nextConfig, {
  org: 'sc-expertpower-webluc-srl',
  project: 'prepio-admin',
  sentryUrl: 'https://de.sentry.io/',
  silent: true,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  widenClientFileUpload: true,
});
