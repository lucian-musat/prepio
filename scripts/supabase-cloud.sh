#!/usr/bin/env bash
# Runs the Supabase CLI against the production project, reading credentials from a
# local file outside the repo (default ~/.config/prepio/supabase.env, chmod 600).
# The credentials are passed through the environment only; this script never prints them.
# Usage: bash scripts/supabase-cloud.sh <supabase args...>   e.g. migration list | db push --dry-run
set -euo pipefail

# shellcheck source=lib/cloud-credentials.sh
. "$(dirname "$0")/lib/cloud-credentials.sh"
: "${SUPABASE_DB_PASSWORD:?SUPABASE_DB_PASSWORD is not set in $CRED_FILE}"
export SUPABASE_DB_PASSWORD

cd "$(dirname "$0")/.."

# Link once (the CLI reads SUPABASE_DB_PASSWORD from the environment; never pass it as an argument).
if [ "$(cat supabase/.temp/project-ref 2>/dev/null || true)" != "$PROJECT_REF" ]; then
  pnpm exec supabase link --project-ref "$PROJECT_REF" >/dev/null
fi

exec pnpm exec supabase "$@"
