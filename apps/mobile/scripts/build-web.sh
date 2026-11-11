#!/usr/bin/env bash
# Vercel build for the student web (prepio-web, buildCommand in vercel.json): exports the web bundle to dist/ and,
# only when SENTRY_AUTH_TOKEN is set, uploads its source maps to Sentry and removes them from dist/ so they are
# not served publicly. Without the token (local, CI, previews without the secret) it is a plain export.
# Org, project and region are not secret, so they are set here; only the token comes from the environment.
set -euo pipefail
cd "$(dirname "$0")/.."

# Inlined into the bundle (src/lib/sentry.ts). Source maps are matched by Debug ID, not by release, so the upload
# below needs no release name.
export EXPO_PUBLIC_SENTRY_RELEASE="prepio-web@${VERCEL_GIT_COMMIT_SHA:-local}"

if [ -z "${SENTRY_AUTH_TOKEN:-}" ]; then
  echo "SENTRY_AUTH_TOKEN is not set: exporting without source maps, nothing is uploaded to Sentry."
  pnpm exec expo export -p web
  exit 0
fi

pnpm exec expo export -p web --source-maps
# A failed upload only costs readable stack traces for this deploy: warn, don't block the release.
if SENTRY_ORG=sc-expertpower-webluc-srl SENTRY_PROJECT=prepio-mobile SENTRY_URL=https://de.sentry.io/ \
  pnpm exec sentry-expo-upload-sourcemaps dist; then
  echo "Sentry source maps uploaded."
else
  echo "WARNING: Sentry source map upload failed; stack traces for this deploy stay minified." >&2
fi
find dist -name '*.map' -delete
