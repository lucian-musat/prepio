#!/usr/bin/env bash
# Runs a content script of packages/content against production: `add-cards` (default) adds the extra seed
# cards (src/extraCards.ts), `add-consolidation` adds the seed solution templates, sources and consolidation
# exercises to the seed lessons that have none yet (src/addConsolidation.ts), `sync-consolidation` replaces the
# consolidation set (sources, exercises, their attempts and runs) of each seed lesson that differs from the seed
# (src/syncConsolidation.ts), `remove-test-lessons` deletes the leftover „test” / „test 2” lessons,
# `remove-test-cards` deletes the leftover „card test” card (src/removeTestCards.ts), `demo` creates or refreshes the demo lesson (src/demoLesson.ts; add --remove to delete it), `update-ai-settings` replaces the welcome message and the AI rules with the grade-free defaults
# (src/updateAiSettings.ts), `ai-templates` adds the seed AI templates, replaces the AI contexts of the seed exercises
# with the fact-only seed ones and links every AI exercise without a template link to the seed template of its type
# (src/syncAiTemplates.ts), `bac-subjects` adds the seed BAC subjects missing by title and fills an empty
# „Reguli de notare BAC” with the default (src/syncBacSubjects.ts).
# Dry run by default; pass --apply to write. Reads SUPABASE_ACCESS_TOKEN from the credentials file
# (see scripts/lib/cloud-credentials.sh), fetches the project's service key with the Supabase CLI and hands
# it to the content script through the environment only. Never prints a secret; never passes one as an argument.
# Usage: bash scripts/content-cloud.sh [add-cards|add-consolidation|sync-consolidation|remove-test-lessons|remove-test-cards|demo|update-ai-settings|ai-templates|bac-subjects]
#        [--apply] [--remove]
set -euo pipefail

command="add-cards"
case "${1:-}" in
  add-cards | add-consolidation | sync-consolidation | remove-test-lessons | remove-test-cards | demo | update-ai-settings | ai-templates | bac-subjects) command="$1"; shift ;;
  "" | --*) ;;
  *) echo "Unknown content command: $1" >&2; exit 1 ;;
esac

# shellcheck source=lib/cloud-credentials.sh
. "$(dirname "$0")/lib/cloud-credentials.sh"

cd "$(dirname "$0")/.."

if ! keys_json="$(pnpm exec supabase projects api-keys --project-ref "$PROJECT_REF" --reveal -o json)"; then
  echo "Could not list the API keys of $PROJECT_REF (check SUPABASE_ACCESS_TOKEN)." >&2
  exit 1
fi

# Prefer a new-style secret key (sb_secret_…), fall back to the legacy service_role JWT.
# The JSON goes through stdin (printf is a shell builtin), so the keys never appear in a process list.
service_key="$(printf '%s' "$keys_json" | node -e '
  let s = "";
  process.stdin.on("data", (d) => (s += d)).on("end", () => {
    let keys;
    try { keys = JSON.parse(s); } catch { process.exit(2); }
    if (!Array.isArray(keys)) process.exit(2);
    const usable = (k) => k && typeof k.api_key === "string" && k.api_key && !k.api_key.includes("·");
    const key = keys.find((k) => k.type === "secret" && usable(k)) ?? keys.find((k) => k.name === "service_role" && usable(k));
    if (!key) process.exit(3);
    process.stdout.write(key.api_key);
  });
')" || {
  echo "No service key found in the API keys of $PROJECT_REF (needs a secret or service_role key)." >&2
  exit 1
}
unset keys_json

# Only the child process gets the project URL and the key; the management token and DB password are dropped.
unset SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD
export SUPABASE_URL="https://$PROJECT_REF.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="$service_key"
unset service_key

exec pnpm --filter @prepio/content "$command" "$@"
