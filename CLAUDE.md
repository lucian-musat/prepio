# Prepio

Prepio is a multi-platform product made of three apps:

- **Mobile app** — end-user application
- **Web app** — end-user application in the browser
- **Admin** — back-office for managing content

The project is in its initial phase: no stack, architecture, or code structure has been decided yet. Update this file as those decisions are made (stack, repo layout, build/test/lint commands, conventions).

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
