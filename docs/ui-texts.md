# Editable UI texts

Student-facing copy (web and APK) lives in a code catalog and can be overridden by an admin in **Texte** (admin sidebar). Spec: `docs/superpowers/specs/2026-11-13-editable-ui-texts-design.md`.

## How it works

- **Catalog** (`packages/shared/src/texts/groups/*.ts`): one entry per text, `key -> { group, default, description?, vars?, optional? }`. The `default` is the exact text the app shows with no override.
- **Overrides** (`public.ui_texts`, key + value): written by admins only, readable by everyone. A row replaces the default; deleting the row („Resetează") restores it.
- **Student app** (`apps/mobile/src/texts`): `t(key, vars?)` returns the override or the default. Overrides are fetched at start-up and cached on the device.
- **Guard** (`apps/mobile/src/texts/noLiterals.test.ts`): fails on a literal user-facing string in `app/` and `src/`, with `file:line`.

## Adding a text

1. Add an entry to the right group file in `packages/shared/src/texts/groups/` (create the group file and register it in `catalog.ts` for a new group). Use the exact Romanian copy as `default`; add a `description` when the place is not obvious from the key.
2. Use it with `t('group.area.name')` **at use time** (inside the component or function that renders it), never at module load: module-level constants are evaluated before the overrides are loaded and would never change. Turn module-level text constants into functions.
3. Remove the file from `PENDING_FILES` in `noLiterals.test.ts` once it has no literals left (the test fails if a pending file is already clean).
4. Add a wiring test: `applyOverrides({ 'the.key': '[override]' })`, render, expect `[override]`; call `resetTexts()` in `afterEach`.

A deliberate literal (a developer error message, a technical value) is allowed with `// texts-ignore` on the same line or the line above. `console.*` arguments, `testID`, imports, route paths (`/…`, `(…)`) and property keys are never flagged.

## Variables and plurals

- A variable is written `{nume}` in the text and listed in `vars`. Every listed variable must appear in the default, and an override may only use listed variables (the admin form checks this). Call `t('key', { nume })`.
- Plurals use two keys: `tPlural(n, 'streak.day.one', 'streak.day.many')` (`1 zi` / `n zile`).
- Text with a bold part or a link inside a sentence is split into keys around the formatted part (`…prefix`, `…bold`, `…suffix`).

## Optional texts

`optional: true` lets an admin save an empty override, which hides the text (the welcome paragraph on Home). The component must render nothing for an empty string.

## Never rename a key

A key is the identity of the override row. Renaming or removing a key in the catalog orphans the saved override: it silently stops applying (unknown keys are ignored by the app). To change a key, add the new one and migrate the rows with a migration; do not change what an existing key means.

## One-opening lag

Overrides are cached on the device. The app shows the cached values at once and refreshes them in the background, so an admin edit appears on the **second** opening after saving, not the first. A fresh install (no cache) waits up to ~1.5 s for the texts, then falls back to the defaults.

## What the catalog does not cover

- **Open Graph / meta tags** (`apps/mobile/public/index.html`) are static: link previews are built by crawlers that do not run the app, so they cannot read overrides. Edit the file and redeploy.
- **Legal pages**: the Terms and the Privacy policy (`app/termeni.tsx`, `app/confidentialitate.tsx`, `TermsScreen`, `PrivacyScreen` and `legal/LegalSection.tsx`) are excluded from the guard. Their text is versioned (`TERMS_VERSION`, see `docs/deploy.md` „Terms version bump") and must not change from a text editor.
- Lesson, card and exercise content, the AI rules and the credit/access settings keep their own admin sections.
