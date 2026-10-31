# Prepio

Prepio is a multi-platform product made of three apps:

- **Mobile app** — end-user application
- **Web app** — end-user application in the browser
- **Admin** — back-office for managing content

## Start of every session

1. Read `docs/STATUS.md` — where the project is, decisions taken, and the prioritised backlog. Update it whenever work changes the status or completes/adds backlog items.
2. The POC spec and plan in `docs/superpowers/` are **done** — don't re-execute that plan. New work gets its own spec and plan (see "Workflow — Superpowers" below), saved as `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` and `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`.
3. Before implementing, ask the owner whether to work on a branch or directly on `main` (the POC was built on `main` by the owner's choice; that was a one-off answer).

Stack, layout and commands: see `README.md`. Deploy: `docs/deploy.md`. Database changes: `docs/database-migrations.md`.

- The repo lives in WSL (`~/projects/prepio_new`); run commands with nvm loaded: `wsl -d Ubuntu-22.04 -- bash -ic "cd ~/projects/prepio_new && <cmd>"`.
- Production: student web https://prepio-web.vercel.app, admin https://prepio-admin.vercel.app, Supabase project `pienbjvwjgnzmnjzmrbh`, Expo `lucianm91s-team/prepio`.

## Database changes

Follow `docs/database-migrations.md`: new migration (`pnpm db:new`), RLS policies for every new table, pgTAP test, `pnpm db:reset && pnpm seed && pnpm db:test`, then `pnpm db:cloud:push:dry` → `pnpm db:cloud:push`. Never edit an applied migration; never change production by hand.

Production DB credentials live in `~/.config/prepio/supabase.env` (chmod 600, outside the repo). Use them only through `scripts/supabase-cloud.sh` / the `pnpm db:cloud*` scripts — never read, print, copy or pass the values as command-line arguments. Never run `pnpm seed` with `SEED_RESET=1` against production.

## Repository

- Remote: `git@github.com:lucian-musat/prepio.git`
- Default branch: `main`

## Workflow — Superpowers

This project uses the [superpowers](https://github.com/obra/superpowers) plugin (enabled in `.claude/settings.json`). Follow its workflow for all development work:

1. **New features / any creative work** → `superpowers:brainstorming` first, to clarify requirements and produce a spec.
2. **Before touching code on multi-step work** → `superpowers:writing-plans` to turn the spec into an implementation plan.
3. **Isolation** → `superpowers:using-git-worktrees` for feature work.
4. **Execution** → `superpowers:subagent-driven-development` or `superpowers:executing-plans`.
5. **Implementation** → `superpowers:test-driven-development` (tests first).
6. **Bugs / unexpected behavior** → `superpowers:systematic-debugging` before proposing fixes.
7. **Before claiming done** → `superpowers:verification-before-completion`, then `superpowers:requesting-code-review`.
8. **Wrapping up a branch** → `superpowers:finishing-a-development-branch`.

## Testing and validation (owner's rule)

Any change that touches the frontend — admin (`apps/admin`), student web or mobile app (`apps/mobile`) — is not done until it has been tested and validated in the browser (Claude in Chrome), in addition to the automated tests:

- Run the local stack: Supabase (`pnpm db:start`), admin `pnpm --filter @prepio/admin dev` (:3000), student web `pnpm --filter @prepio/mobile web` (:8081). Start dev servers detached so they survive the session.
- Walk the changed flows end to end (happy path and the relevant error/empty states), check the browser console for errors, and check the student app at phone width (360px) and desktop width.
- Admin flows use the local test admin from `apps/admin/.env.example`; test data is created with a `[test]` prefix and removed afterwards; seeded content must stay intact.
- Report what was checked in the browser (screens, flows, console) when declaring the work done; if something could not be verified in the browser, say so explicitly.
- Native-only behaviour (keyboard, Android back button, safe areas, native modules, fonts/images on device) can't be fully validated on web. Before a new APK build or when a change adds native dependencies, also validate on an Android emulator (adb + Maestro) — setup pending; until it exists, flag these changes so the owner tests them on the phone.

## Conventions

- Communication with the owner may be in Romanian; code, comments, commit messages, and docs are in English.
- Never commit secrets (`.env`, keys, credentials).
