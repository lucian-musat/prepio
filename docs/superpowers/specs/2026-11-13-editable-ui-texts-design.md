# Editable UI texts — design

Date: 2026-11-13. Status: draft for owner review.

## Intent

The owner wants to change any text the student sees (the Home hero, the „Accesul meu” label, buttons, errors, empty states…) from the admin, without a code change or a release. Today every string is hard-coded in `apps/mobile` (shared by student web and the phone app), except `settings.welcome_message`, which has its own field in admin Settings.

Translations are explicitly **not** a goal. The goal is that every piece of UI text is easy to find and edit.

## Owner decisions

- Every static text in the student app (web and mobile) becomes a placeholder (key) in code, editable from a table in a new admin section.
- **There is always a default text, including in the app's code.** The app must work with no network and with nothing in the database.
- Scope: **absolutely all** text, including buttons and the texts now in Settings — **except the very long pages**: Terms (`termeni`) and Privacy (`confidentialitate`).
- The admin table lists every placeholder in use, with its default text and the possibility to change it.
- A change made in admin needs to appear only **at the next app opening**; no live update of an open app. With the cache-first start-up an edit actually shows one opening later (the opening right after the edit still uses the old cache and refreshes it in the background; on web an opening is a page load). The owner confirmed this lag is fine: „nu este nevoie să apară neapărat imediat”. No version check before rendering.
- Texts must be ready when the app opens, with a cache. On the first opening (no cache) the owner prefers **waiting** for the texts over showing defaults that then change — behind **a nice loader until everything is ready**.

## Goals

1. A single text catalog in code: key → default text, with metadata (group/screen, description, variables).
2. Every student-app UI string reads from that catalog through one helper; no Romanian UI literal is left in screens/components (outside the excluded pages).
3. The database stores **only overrides**. Removing an override returns the code default.
4. Admin section „Texte”: a searchable, filterable table of every key with its default, its current value and edit / reset.
5. Start-up: cached overrides apply instantly; fresh ones are fetched in the background and cached for the next opening; a first opening without cache waits for them (bounded) behind a branded loader.
6. `settings.welcome_message` moves into the catalog as an ordinary key.

## Non-goals

- Translations / multiple languages.
- Live update of an open app.
- Editing lesson, consolidation or BAC content (already edited in admin), the admin app's own texts, Supabase auth emails, AI-generated text, AI prompts/rules (`ai_settings`, BAC rules stay in Settings).
- Terms and Privacy pages (owner decision).
- Adding brand-new texts or screens from admin: a new key needs a code change (its default lives in code).

## Anti-goals (a failure even if it works)

- A student ever sees a raw key (`home.hero.title`), an empty string or an unfilled `{variable}`.
- The app blocks at start-up when the network is slow or down for longer than the bounded wait.
- A visible flash from default text to the edited text on a normal (cached) opening.
- An admin edit that breaks a screen (missing a variable, empty text).
- A default that exists only in the database.

## Design

### 1. Catalog (code, source of truth for keys and defaults)

- Lives in `packages/shared` (e.g. `src/texts/`), so both `apps/mobile` and `apps/admin` import it. Split by group/screen files (home, lesson, consolidation, bac, profile, credits, access, invite, auth, onboarding, streak, errors, common, notifications, meta/share…), merged into one exported catalog.
- Entry shape (builder may refine): `{ key, group, description?, default, vars?: string[], optional?: boolean }`.
  - `optional`: the text may be set to empty, and an empty value hides the element. This keeps today's behaviour, where an empty welcome message hides that line on Home (`Hero.tsx`). *My call:* only keys whose element already disappears when the text is empty get the flag (at least the welcome message). For every other key empty is refused.
  - `key`: stable dotted id, e.g. `home.hero.welcomeBack`, `profile.row.access`. Keys never get renamed casually: a rename orphans the override.
  - `group`: the screen/area shown in admin as a filter.
  - `description`: where it appears, when it isn't obvious (e.g. „Toast after the first exercise of the day”).
  - `vars`: the variables the text must contain, e.g. `['nume']` for `Bine ai revenit, {nume}!`.
- Variables are written `{name}` in the text. Interpolation is a tiny function in shared (no i18n library — no translations are needed). *Builder's call:* variable names may be Romanian words (`{nume}`, `{n}`) since the owner edits them.
- Plurals: Romanian forms (`1 zi` / `2 zile` / `20 de zile`). The existing `plural()` helper in shared takes the forms as arguments; each form becomes its own key (e.g. `streak.days.one`, `streak.days.many`). *My call:* separate keys rather than an ICU-style syntax, so the admin edits plain text.
- Texts mixed with formatting (bold part, a link inside a sentence): *my call:* split into separate keys around the formatted part rather than introduce markup, unless the existing `richText` helper in shared already fits a case.
- A unit test enforces the catalog: unique keys, non-empty defaults, every `{var}` in a default declared in `vars` and vice versa.

### 2. Storage (database)

- New table (e.g. `ui_texts`): `key text primary key`, `value text not null`, `updated_at timestamptz`, `updated_by uuid` (admin). The database can't tell which keys are optional, so the non-empty rule is enforced in the admin save (server side) and by `t`. There is no DB check on it.
- Only overrides are stored. No row = the code default.
- RLS: select for `anon` and `authenticated` (the signed-out auth screens need the texts too); insert/update/delete for admins only (same admin check as the other admin tables).
- The database does not know the catalog. A row whose key is no longer in the catalog is ignored by the app and shown in admin as „orphan” with a delete action. *My call.*
- Migration moves the current `settings.welcome_message` into a `ui_texts` row **only if it differs from the new code default**; the column stops being read (dropping it is a later cleanup, after the app version that no longer reads it is everywhere — the phone APK may lag). The `content:cloud:update-ai-settings` script stops touching `welcome_message`.
- pgTAP tests for the RLS (anon reads, student can't write, admin writes) per `docs/database-migrations.md`.

### 3. Student app (`apps/mobile`, web + native)

- A `TextsProvider` near the root, plus a `t(key, vars?)` helper / `useT()` hook. `t` returns override ?? default, interpolated.
  - If an override is missing a declared variable, or is empty for a non-optional key, `t` falls back to the default. Admin should make this impossible, so this is a defensive check. For an optional key an empty override returns `''`, and the caller hides the element.
  - A key not in the catalog is a TypeScript error (keys typed from the catalog), so a raw key can't ship.
- Code outside React (navigation titles in `_layout`, notification scheduling, share messages, `document.title`) reads the same store through a non-hook accessor.
- **Start-up sequence:**
  1. Read the cached overrides from device storage (AsyncStorage on native, localStorage on web), wrapped in try/catch. If present → apply and render immediately; the screen is never held for the network.
  2. In every case, fetch all `ui_texts` rows (one request, anon key) in the background and write them to the cache for the next opening. The running app does **not** switch texts mid-session (owner: next opening is enough; avoids flashes).
  3. No cache (first opening on this device, cleared storage, private window): hold the loader until the fetch returns or **~1.5 s** pass, whichever is first. On timeout or error → defaults; the background fetch still fills the cache when it completes.
  4. The cache may store a version stamp (e.g. the max `updated_at`) so that unchanged downloads can be skipped later. *Builder's call* whether to use it now. It is never used to hold a cached opening (owner accepted the one-opening lag).
- The wait runs in parallel with the existing fonts + session wait in `app/_layout.tsx` (ready = fonts && auth && texts).
- **Loader (owner: „un loader frumos”):**
  - Native: the existing native splash (Prepio „P” mark) stays up until ready, as today — no change needed beyond adding texts to the ready condition.
  - Web: today the page is blank until JS runs and the app renders. Add a branded loading screen in the web shell (`apps/mobile/public/index.html`): the Prepio mark on the brand background with a subtle animation, visible from the first paint, removed when the app is ready. It must look right at 360 px and desktop, in the theme colours from `@prepio/shared` theme. The texts on it, if any, are not editable (they appear before the catalog loads) — *my call:* the loader has no text.
- **Native notification (daily reminder):** scheduled with the text current at scheduling time; an edit reaches already-scheduled reminders when they are rescheduled (next opening / exercise). Acceptable under „next opening”.
- **Tab titles, Open Graph / share meta:** in-app `document.title` and share messages use the catalog. The static OG tags in `public/index.html` are read by crawlers without JS, so they **cannot** come from the database at runtime; *my call:* they stay static in the HTML and are listed in admin as not editable — or left out of the catalog with a note in the docs. Builder picks one and states it.

### 4. Migration of the strings

- Every Romanian UI literal in `apps/mobile/app` and `apps/mobile/src` (screens, components, ui, alerts, toasts, accessibility labels, navigation titles, validation/error messages produced in the app, notification texts) moves into the catalog with its current text as default. Defaults equal today's texts exactly — the move must not change what students see.
- Strings produced in `packages/shared` and shown to students (e.g. validation messages, labels built there) move too.
- **Server messages shown to students** are in scope too (owner: „absolut tot”). Examples are the Romanian `message` fields from the admin API routes (`apps/admin/src/app/api/*`, such as „Trebuie să fii autentificat.” or the suspended 403), which `apps/mobile/src/lib/api.ts` shows today (`e?.message || …`). *My call:* the app maps each error `code` to a catalog key and stops showing the server's `message`. An unknown code falls back to a generic catalog error. The server keeps sending `message` for logs and other callers. Errors from Supabase auth (sign-in codes, etc.) are mapped the same way where the app shows them. The plan inventories the codes.
- Excluded: `termeni.tsx`, `confidentialitate.tsx`, and anything that's content from the DB.
- `/recomandari` and `/sterge-cont` are in scope (short-section screens, not legal documents). *My call; the owner may move them out.*
- Done screen by screen / area by area (the plan splits it into batches), each batch with its tests updated. Existing tests that assert Romanian text keep passing because defaults are unchanged.
- A guard against regressions: a lint rule or test that flags Romanian string literals in JSX text / common text props in `apps/mobile` outside the excluded files. *Builder's call* how strict (e.g. a scan for literals with Romanian diacritics or letters in `.tsx` JSX children, `title=`, `label=`, `accessibilityLabel=`, `placeholder=`).

### 5. Admin („Texte” section, `apps/admin`)

- New nav entry „Texte”. The admin `settings` field „Mesaj de bun venit” is removed and points to the new section (or becomes a link to that key).
- Table, built from the catalog (imported from shared) joined with the `ui_texts` rows:
  - columns: group, key, default text, current text (marked „modificat” when overridden), last changed (who, when);
  - search across key, default and current text (the owner looks for „Accesul meu”, not for the key);
  - filter by group; filter „doar modificate”;
  - edit inline or in a modal: a textarea; the description and the required variables are shown; save is refused when the text is empty on a non-optional key, or when it misses a declared `{variable}` or adds an unknown one. Optional keys say that an empty text hides the element;
  - „Revino la default” deletes the override;
  - orphan rows (key no longer in the catalog) shown separately with delete.
- Any admin can edit (same rights as the rest of the admin).
- The size is a few hundred rows: client-side search/filter over the full list is fine; *builder's call.*

### 6. Docs

- `docs/STATUS.md` updated; a short note in the README or a doc on how to add a new text (add a catalog entry, use `t()`), and the rule that keys aren't renamed.

## Constraints

- Monorepo per `README.md`; DB changes per `docs/database-migrations.md` (migration, RLS, pgTAP, cloud push before merge).
- Order of rollout: the migration (table + welcome_message copy) is pushed before the code merge. The phone app reads the old `settings.welcome_message` until the next APK — keep the column until then.
- Frontend changes need the browser walk (Claude in Chrome): 360 px and desktop, console clean; native-only parts (splash wait, AsyncStorage cache, notification text) go on the phone checklist for the next APK.
- No new i18n dependency is required; keep it a small in-house helper.

## Left to the builder

- Exact file split of the catalog, key naming within the dotted scheme, the hook/accessor API shape.
- Whether to use the version stamp to skip downloads now.
- The strictness of the regression guard.
- How the OG/meta tags are handled (static and listed as not editable, or out of the catalog), stated in the docs.
- Batching of the migration across PRs.
