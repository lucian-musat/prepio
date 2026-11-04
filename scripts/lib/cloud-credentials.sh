# Sourced by the production wrappers (supabase-cloud.sh, content-cloud.sh). Loads the credentials file
# (default ~/.config/prepio/supabase.env, must be chmod 600) into the environment. Never prints the values.

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
export SUPABASE_ACCESS_TOKEN
