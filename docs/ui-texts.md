# Editable UI texts

All student-facing copy (web and APK) lives in a code catalog and can be overridden by an admin in **Texte** (admin sidebar). The only exceptions are listed under „What the catalog does not cover” below. Spec: `docs/superpowers/specs/2026-11-13-editable-ui-texts-design.md`.

## How it works

- **Catalog** (`packages/shared/src/texts/groups/*.ts`): one entry per text, `key -> { group, default, description?, vars?, optional? }`. The `default` is the exact text the app shows with no override.
- **Overrides** (`public.ui_texts`, key + value): written by admins only, readable by everyone. A row replaces the default; deleting the row („Resetează") restores it.
- **Student app** (`apps/mobile/src/texts`): `t(key, vars?)` returns the override or the default. Overrides are fetched at start-up and cached on the device.
- **Guard** (`apps/mobile/src/texts/noLiterals.test.ts`): fails on a literal user-facing string in any file under `app/` and `src/`, with `file:line`. Only the legal pages in `EXCLUDED_FILES` are skipped; there is no list of files waiting to be migrated any more, so a new screen must use `t()` from the start.

## Adding a text

1. Add an entry to the right group file in `packages/shared/src/texts/groups/` (create the group file and register it in `catalog.ts` for a new group). Use the exact Romanian copy as `default`; add a `description` when the place is not obvious from the key.
2. Use it with `t('group.area.name')` **at use time** (inside the component or function that renders it), never at module load: module-level constants are evaluated before the overrides are loaded and would never change. Turn module-level text constants into functions.
3. If the guard flags a copy prop it does not know yet (e.g. `hint`, `caption`), add the prop to `COPY_PROPS`.
4. Add a wiring test: `applyOverrides({ 'the.key': '[override]' })`, render, expect `[override]`; call `resetTexts()` in `afterEach`.

A deliberate literal (a developer error message, a technical value) is allowed with `// texts-ignore` on the same line or the line above. `console.*` arguments, `testID`, imports, route paths (`/…`, `(…)`) and property keys are never flagged.

## Variables and plurals

- A variable is written `{nume}` in the text and listed in `vars`. Every listed variable must appear in the default, and an override may only use listed variables (the admin form checks this). Call `t('key', { nume })`.
- Plurals use two keys: `tPlural(n, 'streak.day.one', 'streak.day.many')` (`1 zi` / `n zile`).
- Text with a bold part or a link inside a sentence is split into keys around the formatted part (`…prefix`, `…bold`, `…suffix`).

## Server error messages

The admin API routes (`/api/consolidation/evaluate`, `/api/bac/submit`, `/api/credits/purchase`, `/api/access/purchase`, `/api/account/delete`) still send a Romanian `message`, but the app never shows it: `apiErrorText(endpoint, code)` in `apps/mobile/src/lib/api.ts` maps the response's `code` to an `errors.api.*` text (defaults = the server's messages) through `API_ERROR_TEXTS` in `packages/shared/src/texts/apiErrors.ts`, and an unknown code shows `errors.api.generic`. A new error code on the server needs its `errors.api.*` entry and a line in that map (the map is typed against the shared error-code types, so a missing one fails the typecheck). `apps/admin/src/lib/errorTexts.test.ts` checks that every server message equals the default of the text the app shows for its code; the routes' Origin / Content-Type guards („Cerere nepermisă.”, „Cerere invalidă.”) are the deliberate exceptions.

## Optional texts

`optional: true` lets an admin save an empty override, which hides the text (the welcome paragraph on Home). The component must render nothing for an empty string.

## Never rename a key

A key is the identity of the override row. Renaming or removing a key in the catalog orphans the saved override: it silently stops applying (unknown keys are ignored by the app). To change a key, add the new one and migrate the rows with a migration; do not change what an existing key means.

## One-opening lag

Overrides are cached on the device. The app shows the cached values at once and refreshes them in the background, so an admin edit appears on the **second** opening after saving, not the first. A fresh install (no cache) waits up to ~1.5 s for the texts, then falls back to the defaults.

## What the catalog does not cover

Everything else the student app shows is in the catalog. These stay non-editable on purpose:

- **Terms and Privacy bodies**: `app/termeni.tsx`, `app/confidentialitate.tsx`, `TermsScreen`, `PrivacyScreen` and `legal/LegalSection.tsx` (its `OperatorDetails` and `LegalLink` serve only those two pages; `Section` / `Item` hold no copy) are excluded from the guard. Their text is versioned (`TERMS_VERSION`, see `docs/deploy.md` „Terms version bump”) and must not change from a text editor. Only their navigation titles (`meta.route.*`) are editable. The public pages `/recomandari` and `/sterge-cont` are not legal text and are in the `pages` group.
- **Open Graph / meta tags** (`apps/mobile/public/index.html`) are static: link previews are built by crawlers that do not run the app, so they cannot read overrides. Edit the file and redeploy.
- **BAC texts stored by the server**: „Necompletat.” and the per-requirement feedback are written when a paper is graded and saved with the attempt, so they stay code constants (an edit could not change papers already graded).
- **Instant check vs grading**: the `consolidation.check.*` texts change only the app's instant check. The server calls the same check code with the catalog defaults, so BAC grading and feedback already saved keep the default wording.
- **AI output**: the AI's feedback and grades are shown as returned; their wording is steered by the AI rules (admin → AI templates), not by texts.
- **Matched constants**: strings that code compares against (connector lists, the verdict tokens the AI returns, the type and difficulty labels the admin editors use: `CARD_TYPE_LABELS`, `CONSOLIDATION_TYPE_LABELS`, `DIFFICULTY_LABELS`) stay constants. The app shows separate display keys; `packages/shared/src/texts/drift.test.ts` keeps their defaults equal to the constants.
- **Server error messages** (see above): the app shows the `errors.api.*` texts, not the server's `message`.
- Lesson, card and exercise content, the AI rules and the credit/access settings keep their own admin sections.
