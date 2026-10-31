# Prepio

Prepio is a multi-platform product made of three apps:

- **Mobile app** — end-user application
- **Web app** — end-user application in the browser
- **Admin** — back-office for managing content

Stack, layout and commands: see `README.md`. Design spec and plan: `docs/superpowers/`. Deploy: `docs/deploy.md`.

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

## Conventions

- Communication with the owner may be in Romanian; code, comments, commit messages, and docs are in English.
- Never commit secrets (`.env`, keys, credentials).
