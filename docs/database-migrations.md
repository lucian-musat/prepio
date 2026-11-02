# Database migrations

The schema lives in `supabase/migrations/*.sql` (applied in filename order) and is tested with pgTAP in `supabase/tests/*.sql`. Every schema change — table, column, index, RLS policy, function, storage bucket setting — is a new migration file. The production database (Supabase project `pienbjvwjgnzmnjzmrbh`) only ever receives changes through these files.

## One-time setup (per machine)

1. **Credentials file**, outside the repo, readable only by you:

   ```bash
   mkdir -p ~/.config/prepio
   touch ~/.config/prepio/supabase.env && chmod 600 ~/.config/prepio/supabase.env
   ```

   Edit it with your editor (don't `echo` secrets into the shell history):

   ```bash
   SUPABASE_ACCESS_TOKEN=<personal access token: supabase.com/dashboard/account/tokens>
   SUPABASE_DB_PASSWORD=<database password: Project Settings → Database>
   ```

   `scripts/supabase-cloud.sh` refuses to run if the file is missing or not `chmod 600`. It passes the values to the Supabase CLI through the environment and never prints them. Another location can be used with `PREPIO_SUPABASE_ENV=/path/to/file`.

2. **Check the connection**: `pnpm db:cloud:status` lists local vs remote migrations. The first run links the repo to the project (stored in `supabase/.temp/`, gitignored).

3. **Initial history repair — done on 2026-10-31.** The first deploy applied migrations `20261030000001`–`20261030000004` through the SQL editor; they were then marked as applied in the remote history, so local and remote are in sync. For reference, the command was:

   ```bash
   pnpm db:cloud migration repair --linked --status applied 20261030000001 20261030000002 20261030000003 20261030000004
   ```

## Making a change

1. **Create the migration**

   ```bash
   pnpm db:new add_lesson_summary   # → supabase/migrations/<timestamp>_add_lesson_summary.sql
   ```

2. **Write the SQL.** Rules:
   - Never edit a migration that has been applied to production; fix forward with a new one.
   - Prefer additive, backwards-compatible changes (add nullable columns / defaults first; drop or rename only after the apps no longer use the old shape). Vercel and the APK may run the previous code version for a while.
   - Every new table: `enable row level security` + explicit policies, following `20261102094219_student_accounts.sql` — `anon` gets nothing; admins (`authenticated` + `public.is_admin()`) get `<table>_admin_all`; students (any other `authenticated` user) may only `select` published content or their own rows; secrets/config tables are admin-only.
   - Functions that bypass RLS: `security definer`, `set search_path = ''` (empty; reference everything fully qualified, e.g. `public.admins`), and `revoke execute … from public, anon, authenticated` unless they must be callable by clients.
   - Data fixes go in migrations too (idempotent `update … where …`), never by hand in production.

3. **Test locally**

   ```bash
   pnpm db:reset      # recreates the local DB from all migrations
   pnpm seed          # reloads the content
   # add/adjust a pgTAP test in supabase/tests/ for the new behaviour (especially RLS)
   pnpm db:test
   pnpm test && pnpm typecheck
   ```

   If columns or shapes changed, update `packages/shared/src/types.ts`, the admin data functions (`apps/admin/src/lib/data/`), the student data layer (`apps/mobile/src/lib/content.ts`) and, if needed, `packages/content` + the seed.

4. **Commit** the migration together with the code that uses it.

5. **Apply to production**

   ```bash
   pnpm db:cloud:push:dry   # shows exactly which migrations will run
   pnpm db:cloud:push       # applies them
   pnpm db:cloud:status     # local and remote must now match
   ```

   Deploy order for changes the apps depend on: push the migration first, then the code (Vercel deploys on push to `main`; the APK needs a new EAS build). For removals, the reverse: ship code that no longer uses the column, then the migration that drops it.

6. **Verify** the relevant items of the checklist in [deploy.md](deploy.md) (sign-up 422, anon can't read `ai_settings`, student app loads lessons).

## Rolling back

There is no automatic down-migration. Write a new migration that reverts the change and push it the same way. Before risky changes (drops, type changes, large data updates), take a backup: Supabase dashboard → Database → Backups (daily backups on the free plan), or `pnpm db:cloud db dump -f /tmp/prepio-backup.sql` (never commit dumps).

## Commands

| Command | What it does |
|---|---|
| `pnpm db:start` / `db:stop` | local Supabase (Docker) |
| `pnpm db:new <name>` | new empty migration file |
| `pnpm db:reset` | rebuild the local DB from migrations |
| `pnpm db:test` | pgTAP tests (local) |
| `pnpm db:cloud:status` | local vs production migration list |
| `pnpm db:cloud:push:dry` | preview what would be applied to production |
| `pnpm db:cloud:push` | apply pending migrations to production |
| `pnpm db:cloud <args>` | any Supabase CLI command against production, e.g. `migration repair --linked …` (add `--linked` to commands that would otherwise default to the local DB) |
