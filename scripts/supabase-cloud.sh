#!/usr/bin/env bash
# Runs the Supabase CLI against the production project, reading credentials from a
# local file outside the repo (default ~/.config/prepio/supabase.env, chmod 600).
# The credentials are passed through the environment only; this script never prints them.
# Usage: bash scripts/supabase-cloud.sh <supabase args...>   e.g. migration list | db push --dry-run
set -euo pipefail

PROJECT_REF="pienbjvwjgnzmnjzmrbh"
CRED_FILE="${PREPIO_SUPABASE_ENV:-$HOME/.config/prepio/supabase.env}"

if [ ! -f "$CRED_FILE" ]; then
  echo "Missing $CRED_FILE — see docs/database-migrations.md (one-time setup)." >&2
  exit 1
fi
perms="$(stat -c '%a' "$CRED_FILE")"
if [ "$perms" != "600" ]; then
  echo "$CRED_FILE must be readable only by you: chmod 600 \"$CRED_FILE\" (currently $perms)." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$CRED_FILE"
set +a
: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN is not set in $CRED_FILE}"
: "${SUPABASE_DB_PASSWORD:?SUPABASE_DB_PASSWORD is not set in $CRED_FILE}"
export SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD

cd "$(dirname "$0")/.."

# Link once (the CLI reads SUPABASE_DB_PASSWORD from the environment; never pass it as an argument).
if [ "$(cat supabase/.temp/project-ref 2>/dev/null || true)" != "$PROJECT_REF" ]; then
  pnpm exec supabase link --project-ref "$PROJECT_REF" >/dev/null
fi

exec pnpm exec supabase "$@"
