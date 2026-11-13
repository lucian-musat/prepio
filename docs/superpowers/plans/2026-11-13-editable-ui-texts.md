# Editable UI texts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every UI text in the student app (web + mobile) comes from a code catalog of keys with defaults, and admins can override any key from a new „Texte” section; overrides are cached on the device and ready at start-up.

**Architecture:** The catalog (key → default, group, description, vars, optional) lives in `packages/shared/src/texts/`. A table `ui_texts` stores only overrides. The student app has a module-level store with `t(key, vars)`. It is filled once before the first screen renders: from the device cache instantly, or on a first opening from the network with a 1.5 s cap behind the native splash or a web boot loader. The fetch always refreshes the cache for the next opening. Admin builds its table from the catalog joined with the rows.

**Tech Stack:** TypeScript, Expo / React Native + react-native-web (jest-expo), Next.js admin (vitest, react-bootstrap), Supabase Postgres + pgTAP, `@react-native-async-storage/async-storage` (already a dependency; uses localStorage on web).

**Spec:** `docs/superpowers/specs/2026-11-13-editable-ui-texts-design.md`

## Global Constraints

- **Defaults are byte-identical to today's texts.** Moving a string must not change what a student sees. Existing tests that assert Romanian text must pass unchanged. A test may change only where a text was split around formatting.
- Out of scope: `app/termeni.tsx`, `app/confidentialitate.tsx`, `src/screens/TermsScreen.tsx`, `src/screens/PrivacyScreen.tsx` (and the legal section bodies they render), DB content (lessons, cards, consolidation, BAC), admin's own UI texts, Supabase auth emails, AI output, `ai_settings`. `/recomandari` and `/sterge-cont` are in scope.
- The static OG / description / `<noscript>` tags in `apps/mobile/public/index.html` stay static (crawlers run no JS). Docs say so; they are not in the catalog.
- No i18n dependency. Variables are `{name}`; plurals use the existing `plural(n, one, many)` with the noun forms as two keys.
- The start-up wait is capped at **1500 ms** and happens only when there is no cache. A cached opening never waits for the network, and the running app never switches texts mid-session.
- Never call `t()` at module load (top-level constants). The store is filled after imports run, so convert such constants to functions or call `t()` at use time.
- Keys are dotted `group.element[.part]`, lower camelCase segments. Keys are never renamed once shipped.
- DB per `docs/database-migrations.md`: migration, RLS, pgTAP, `pnpm db:reset && pnpm seed && pnpm db:test`, cloud push **before** the merge that needs it. Keep `settings.welcome_message` (the current APK still reads it).
- Every PR: branch `feat/ui-texts-<part>` off `main` in a worktree, CI green, browser walk (Claude in Chrome, 360 px + desktop, console clean) reported, then `gh pr merge --squash --delete-branch`.
- Commands run in WSL with nvm: `wsl -d Ubuntu-22.04 -- bash -ic "cd ~/projects/prepio_new && <cmd>"`.

## Review Focus

1. **Corrupt or foreign cache** (invalid JSON, an old cache holding keys no longer in the catalog, an override that dropped a `{var}`): the app starts with defaults for the bad entries and never shows a raw key or `{nume}`. Tests in Task 3.
2. **Storage throws** (private window, blocked site data, AsyncStorage failure): the start-up still completes within the cap, with defaults. Test in Task 3.
3. **Network hangs on a first opening:** ready after ~1500 ms with defaults, and the late response still writes the cache. Test in Task 3.
4. **Admin saves text with stray braces or a renamed variable** (`{Nume}`, `{n` unbalanced, an extra `{x}`): refused with a message naming the variable. Optional key saved empty → stored as `''` and the element hides. Tests in Tasks 1 and 5.
5. **A string left behind** in a migrated file, or a new literal added later: the literal guard test fails. Task 6, tightened by each batch.

---

## Part 1 — foundation (PR `feat/ui-texts-foundation`)

### Task 1: Catalog types, formatting and validation in shared

**Files:**
- Create: `packages/shared/src/texts/types.ts`, `packages/shared/src/texts/format.ts`, `packages/shared/src/texts/catalog.ts`, `packages/shared/src/texts/groups/common.ts`, `packages/shared/src/texts/groups/home.ts`, `packages/shared/src/texts/index.ts`
- Modify: `packages/shared/src/index.ts` (add `export * from './texts';`)
- Test: `packages/shared/src/texts/format.test.ts`, `packages/shared/src/texts/catalog.test.ts`

**Interfaces:**
- Produces:
  - `type TextEntry = { group: TextGroup; default: string; description?: string; vars?: readonly string[]; optional?: boolean }`
  - `type TextGroup = 'common' | 'errors' | 'auth' | 'onboarding' | 'home' | 'lesson' | 'cards' | 'consolidation' | 'bac' | 'access' | 'credits' | 'invite' | 'profile' | 'streak' | 'notifications' | 'pages' | 'meta' | 'suspended'`
  - `const TEXT_GROUP_LABELS: Record<TextGroup, string>` (Romanian admin labels, e.g. `home: 'Acasă'`)
  - `const TEXTS` (all groups merged, `satisfies Record<string, TextEntry>`) and `type TextKey = keyof typeof TEXTS`
  - `function textVars(s: string): string[]`: the `{name}` tokens in order, unique, where name matches `[A-Za-z][A-Za-z0-9]*`
  - `function formatText(s: string, vars?: Record<string, string | number>): string`: replaces each declared `{name}`; an unknown token is left as is
  - `function validateTextValue(entry: Pick<TextEntry, 'vars' | 'optional'>, value: string): string | null`: `null` when acceptable, otherwise a Romanian admin message. Callers pass `TEXTS[key]`.
  - `function isTextKey(k: string): k is TextKey`
- Group files export a plain object, e.g. `export const homeTexts = { 'home.hero.welcome': { group: 'home', default: <welcomeMessage from packages/content/src/defaults.ts>, optional: true, description: 'Paragraful de bun venit de sub titlul de pe Acasă; gol = ascuns' } } as const satisfies Record<string, TextEntry>;`. This task seeds `home.hero.welcome` and the Hero's returning-student greeting (today's „Bine ai revenit, <nume>!” text from `src/ui/Hero.tsx`, as a key with `vars: ['nume']`). That gives the store tests a real key with a variable; Task 4 wires both into Hero. The batches fill the rest.

- [ ] **Step 1: Write failing tests**

`format.test.ts`:
```ts
expect(textVars('Bine ai revenit, {nume}! Ai {n} lecții, {nume}')).toEqual(['nume', 'n']);
expect(formatText('Bine ai revenit, {nume}!', { nume: 'Ana' })).toBe('Bine ai revenit, Ana!');
expect(formatText('{n} din {m}', { n: 3, m: 10 })).toBe('3 din 10');
expect(formatText('fără variabile')).toBe('fără variabile');
```
`validateTextValue` cases, with `g = { vars: ['nume'] }` and `o = { optional: true }`:
- `(g, 'Hei, {nume}')` → `null`
- `(g, 'Hei')` → contains `{nume}` (missing)
- `(g, 'Hei {nume} {x}')` → contains `{x}` (unknown)
- `(g, 'Hei {Nume}')` → message (missing `{nume}`, unknown `{Nume}`)
- `(g, 'Hei {nume')` → message about unbalanced braces
- `(g, '   ')` → „Textul nu poate fi gol.”
- `(o, '')` → `null`

`catalog.test.ts`, over every entry:
- the default is non-empty after trim
- `textVars(default)` equals the sorted `vars ?? []` as a set
- `TEXT_GROUP_LABELS` has every group used
- key segments match `/^[a-z][a-zA-Z0-9]*(\.[a-z0-9][a-zA-Z0-9]*)+$/`
- every key starts with its group (`entry.group === key.split('.')[0]`)

- [ ] **Step 2:** Run `pnpm --filter @prepio/shared test -- texts`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement the files above. `validateTextValue` checks, in this order:
  1. empty / whitespace on a non-optional key
  2. unbalanced `{` / `}`
  3. missing declared vars
  4. unknown vars

  `common` starts with real shared texts only (no test keys); it may start empty and get filled in Task 7.
- [ ] **Step 4:** Run `pnpm --filter @prepio/shared test && pnpm --filter @prepio/shared typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(shared): text catalog with formatting and validation`.

### Task 2: `ui_texts` table, RLS, welcome-message copy

**Files:**
- Create: `supabase/migrations/<ts>_ui_texts.sql` (via `pnpm db:new ui_texts`), `supabase/tests/ui_texts.test.sql`

**Interfaces:**
- Produces the table `public.ui_texts (key text primary key check (key ~ '^[a-z][a-zA-Z0-9]*(\.[a-z0-9][a-zA-Z0-9]*)+$'), value text not null, updated_at timestamptz not null default now(), updated_by uuid references auth.users(id) on delete set null)`

Migration content:
- `enable row level security`
- policies:
  - `ui_texts_public_select` for select to `anon, authenticated` using `(true)`
  - `ui_texts_admin_insert` / `_update` / `_delete` to `authenticated`, using / with check `public.is_admin()`
- grants: `grant select on public.ui_texts to anon, authenticated; grant insert, update, delete on public.ui_texts to authenticated;`
- a `before update` trigger setting `updated_at = now()`
- copy of the welcome message: `insert into public.ui_texts (key, value) select 'home.hero.welcome', welcome_message from public.settings where id = 1 and welcome_message is distinct from '<exact current default from packages/content/src/defaults.ts>';`. An empty welcome message is copied as `''`, so it stays hidden.

- [ ] **Step 1: Write the pgTAP test** (`plan(n)`). It asserts:
  - the table exists with RLS on
  - anon can select
  - a student (`set local role authenticated` + a non-admin sub, pattern of `supabase/tests/referral_reads.test.sql`) sees rows but its insert / update / delete affect 0 rows or throw `42501`
  - an admin (row in `public.admins`, as in `student_admin.test.sql`) can insert, update and delete
  - the key check rejects `'Home.x'` and `'home'`
  - `updated_at` moves on update
- [ ] **Step 2:** Run `pnpm db:reset && pnpm seed && pnpm db:test`. Expected: the new test FAILS (no table) and the others pass.
- [ ] **Step 3:** Write the migration.
- [ ] **Step 4:** Run `pnpm db:reset && pnpm seed && pnpm db:test`. Expected: all PASS. With the local seed (default welcome), `select count(*) from ui_texts` is 0.
- [ ] **Step 5:** Commit `feat(db): ui_texts overrides table`.

### Task 3: Student-app text store, cache and start-up loader

**Files:**
- Create: `apps/mobile/src/texts/store.ts`, `apps/mobile/src/texts/cache.ts`, `apps/mobile/src/texts/boot.ts`, `apps/mobile/src/texts/useTextsBoot.ts`, `apps/mobile/src/texts/bootLoader.ts`, `apps/mobile/src/texts/bootLoader.web.ts`
- Modify: `apps/mobile/app/_layout.tsx` (ready = fonts && auth && texts; hide the web boot loader when ready), `apps/mobile/public/index.html` (boot loader markup + CSS)
- Test: `apps/mobile/src/texts/store.test.ts`, `apps/mobile/src/texts/boot.test.ts`

**Interfaces:**
- Consumes: `TEXTS`, `TextKey`, `formatText`, `validateTextValue`, `isTextKey`, `plural` from `@prepio/shared`.
- Produces:
  - `t(key: TextKey, vars?: Record<string, string | number>): string`: the override if valid, else the default, then formatted. An optional key with `''` returns `''`.
  - `tPlural(n: number, oneKey: TextKey, manyKey: TextKey): string` = `plural(n, t(oneKey), t(manyKey))`
  - `applyOverrides(rows: Record<string, string>): void` keeps only `isTextKey` keys whose value passes `validateTextValue`. `resetTexts(): void` is for tests.
  - `readTextCache(): Promise<Record<string, string> | null>` and `writeTextCache(rows: Record<string, string>): Promise<void>`. The AsyncStorage key is `prepio.uiTexts.v1` and the value is JSON `{ rows, savedAt }`. Every call is in try/catch: a read failure or invalid JSON → `null`, a write failure is swallowed.
  - `fetchTextOverrides(client?: SupabaseClient): Promise<Record<string, string>>` does `from('ui_texts').select('key,value')`.
  - `bootTexts(opts?: { timeoutMs?: number; client?: SupabaseClient }): Promise<'cache' | 'network' | 'defaults'>` (default `timeoutMs` 1500):
    - cache present → `applyOverrides(cache)`, start the fetch in the background (its result only goes to `writeTextCache`), return `'cache'`
    - no cache → race the fetch against the timeout. On fetch → apply + write, return `'network'`. On timeout or error → return `'defaults'`, and the pending fetch still writes the cache.
  - `useTextsBoot(): boolean` runs `bootTexts()` once and returns ready.
  - `hideBootLoader(): void`: a no-op on native. On web it fades out `#boot-loader` (CSS class `boot-loader--done`) and removes it after the transition.

- [ ] **Step 1: Write failing tests.** Mock AsyncStorage with `@react-native-async-storage/async-storage/jest/async-storage-mock`, and the supabase client with a stub `from().select()`. Use fake timers for the cap.
  - `store.test.ts`:
    - `t('home.hero.welcome')` equals the catalog default
    - after `applyOverrides({ 'home.hero.welcome': 'Salut' })` it returns `'Salut'`
    - an override missing a declared var falls back to the default (use a catalog key with vars)
    - an unknown key in the rows is ignored and doesn't throw
    - optional `''` → `''`
    - non-optional `''` → the default
  - `boot.test.ts`:
    - (a) a cache → resolves `'cache'` without waiting for a never-resolving fetch, and `t` shows the cached value
    - (b) a cache + a fetch with a new value → the running `t` still shows the cached value, and the cache now holds the new value
    - (c) no cache, the fetch resolves in 200 ms → `'network'`, the value applied and cached
    - (d) no cache, the fetch never resolves → `'defaults'` at 1500 ms
    - (e) no cache, the fetch resolves at 3000 ms → `'defaults'` at 1500, and the cache is written after 3000
    - (f) `getItem` throws → `'network'` or `'defaults'`, never a rejection
    - (g) the cached JSON is `'{oops'` → treated as no cache
    - (h) the fetch errors → `'defaults'`, the cache is untouched
- [ ] **Step 2:** Run `pnpm --filter @prepio/mobile test -- src/texts`. Expected: FAIL.
- [ ] **Step 3:** Implement. In `_layout.tsx`, `ready = (fontsLoaded || !!fontError) && status !== 'loading' && textsReady`, and call `hideBootLoader()` in the same effect as `SplashScreen.hideAsync()`.

  The web loader in `index.html` is a sibling of `#root`, not a child: React clears `#root` as soon as it commits, even a `null`. It is a `#boot-loader` fixed full-screen overlay on the theme background (`color.bg` from `packages/shared/src/theme.ts`, copied as a literal hex). It shows the Prepio „P” mark inline (the same mark as `assets`/`public/icon-192.png`, as an `<img src="/icon-192.png">` or inline SVG) with a gentle pulse/scale animation (`prefers-reduced-motion` → no animation) and has no text. It is centred and looks right at 360 px and desktop. It fades out in 200 ms.
- [ ] **Step 4:** Run `pnpm --filter @prepio/mobile test && pnpm --filter @prepio/mobile typecheck`. Expected: PASS. The existing suites are unaffected, because the store starts with defaults.
- [ ] **Step 5:** Commit `feat(mobile): text store with cached start-up and web boot loader`.

### Task 4: Welcome message moves to the catalog

**Files:**
- Modify: `apps/mobile/src/lib/content.ts` (drop the `settings` query and `welcomeMessage` from `HomeData`), `apps/mobile/src/ui/Hero.tsx` (read `t('home.hero.welcome')` and hide on `''`), `apps/mobile/src/screens/HomeScreen.tsx`, `apps/admin/src/lib/data/settings.ts` + `SettingsForm.tsx` (remove the welcome field and its validation), `packages/content/src/defaults.ts` (`welcomeMessage = TEXTS['home.hero.welcome'].default`, so seed still fills the not-null column), `packages/content/src/updateAiSettings.ts` (stop reading/writing `welcome_message`; AI rules only) and `scripts/content-cloud.sh` comment
- Test: the existing `Hero`, `HomeScreen`, `content`, admin `SettingsForm` / `settings.int`, and content `seed.int` / `updateAiSettings` tests, updated

- [ ] **Step 1:** Update the tests first:
  - Hero renders the catalog default with no prop
  - after `applyOverrides({'home.hero.welcome': ''})` the paragraph is absent
  - `fetchHome` no longer queries `settings`
  - SettingsForm has no „Mesaj de bun venit”
  - updateAiSettings changes report only `ai_rules`
- [ ] **Step 2:** Run the affected suites (mobile jest, `pnpm --filter @prepio/admin test`, content tests). Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `pnpm test && pnpm typecheck`, plus `pnpm --filter @prepio/admin test:int` and the content int tests against the local DB. Expected: PASS.
- [ ] **Step 5:** Commit `feat: welcome message is a catalog text`.

### Task 5: Admin „Texte” section

**Files:**
- Create: `apps/admin/src/lib/data/uiTexts.ts`, `apps/admin/src/app/(admin)/texts/page.tsx`, `apps/admin/src/app/(admin)/texts/actions.ts`, `apps/admin/src/app/(admin)/texts/TextsTable.tsx`, `apps/admin/src/app/(admin)/texts/TextEditModal.tsx`
- Modify: `apps/admin/src/app/(admin)/AdminShell.tsx` (nav `{ href: '/texts', label: 'Texte' }` after „Setări”), `apps/admin/src/app/(admin)/settings/SettingsForm.tsx` (a one-line link „Textele aplicației se editează în Texte”)
- Test: `apps/admin/src/lib/data/uiTexts.int.test.ts`, `apps/admin/src/app/(admin)/texts/TextsTable.test.tsx`, `apps/admin/src/app/(admin)/texts/TextEditModal.test.tsx`, `apps/admin/e2e/texts.spec.ts`

**Interfaces:**
- Consumes: `TEXTS`, `TEXT_GROUP_LABELS`, `validateTextValue`, `isTextKey` from `@prepio/shared`.
- Produces:
  - `type UiTextRow = { key: string; group: TextGroup | null; description?: string; vars: string[]; optional: boolean; defaultText: string | null; value: string | null; updatedAt: string | null; updatedBy: string | null /* email */; orphan: boolean }`
  - `listUiTexts(db): Promise<UiTextRow[]>`: every catalog key (sorted by group, then key) plus orphan rows. It reads `ui_texts`, and the editor emails through the existing admin email lookup pattern (see `lib/data/students.ts`). If none exists, show the uuid's first 8 characters. *Builder's call.*
  - `saveUiText(db, key, value): Promise<void>` throws `UserError` on an unknown key or a `validateTextValue` message. It upserts `{ key, value, updated_by: auth.uid() }`. A value equal to the default deletes the override instead.
  - `resetUiText(db, key): Promise<void>` deletes the row and also works for an orphan.
  - The actions `saveUiTextAction(key, value)` and `resetUiTextAction(key)` return `ActionResult<UiTextRow[]>` (the same pattern as `settings/actions.ts`) and `revalidatePath('/texts')`.
- UI (react-bootstrap, like the other admin pages):
  - heading „Texte”
  - a search input (case- and diacritic-insensitive over the key, default and current text)
  - a group `Form.Select` („Toate grupurile” + labels)
  - a „Doar modificate” switch
  - a table with columns: Grup · Cheie (monospace, small) · Text implicit · Text actual (badge „modificat” when overridden; „(gol — ascuns)” for an optional `''`) · Modificat (email, date) · actions „Editează” / „Revino la implicit” (the latter only when overridden)
  - orphans in a separate „Texte care nu mai există în aplicație” table with „Șterge”
  - the modal shows the key, description, default, required variables as chips, a textarea and the inline validation message (the same `validateTextValue`, also enforced server side). For optional keys it notes „Lasă gol ca să ascunzi textul”. „Salvează” is disabled while the value is unchanged or invalid.
  - a note under the heading: „Modificările apar la elevi de la următoarele deschideri ale aplicației.”

- [ ] **Step 1: Write failing tests.**
  - `uiTexts.int.test.ts`, against the local DB as the test admin, like the other `*.int.test.ts`:
    - save → listed as overridden with `updatedBy`
    - save a value equal to the default → no row
    - save missing a var → `UserError`
    - unknown key → `UserError`
    - reset → back to default
    - an orphan row inserted directly → listed with `orphan: true`, and reset deletes it
    - optional `''` → saved
  - `TextsTable.test.tsx`:
    - the search „accesul meu” (no diacritics, any case) finds the access row once it exists. Use `home.hero.welcome` and search for a word from it.
    - the group filter
    - „Doar modificate”
  - `TextEditModal.test.tsx`:
    - removing `{nume}` shows the message and disables save
    - an optional key accepts empty
  - `e2e/texts.spec.ts`: edit the welcome text to `[test] salut`, see the „modificat” badge, reset, and the badge is gone.
- [ ] **Step 2:** Run `pnpm --filter @prepio/admin test` and `test:int`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `pnpm --filter @prepio/admin test && pnpm --filter @prepio/admin test:int && pnpm --filter @prepio/admin typecheck`, and the e2e per the README. Expected: PASS.
- [ ] **Step 5:** Commit `feat(admin): Texte section for UI text overrides`.

### Task 6: Literal guard, docs, foundation rollout

**Files:**
- Create: `apps/mobile/src/texts/noLiterals.test.ts`, `docs/ui-texts.md`
- Modify: `README.md` (one link to `docs/ui-texts.md`), `docs/STATUS.md`, `docs/deploy.md` (the ui-texts rollout: migration push before the merge)

**Interfaces:**
- Produces the constant `PENDING_FILES: string[]` in `noLiterals.test.ts`. It lists the not-yet-migrated files (relative to `apps/mobile`). Each batch removes its files, and Task 13 leaves it empty.

The guard scans every non-test `.ts`/`.tsx` under `apps/mobile/app` and `apps/mobile/src`, minus the excluded legal files and `PENDING_FILES`. It fails with `file:line` for:
- JSX text children containing a letter
- string literals in the props `title|label|placeholder|accessibilityLabel|accessibilityHint|message|description|subtitle|cta|confirmLabel|cancelLabel`
- any string or template literal containing a Romanian diacritic (`[ăâîșțĂÂÎȘȚ]`) or matching `/\b(și|sau|nu|la|din|cu|pentru|ai|să)\b/`

Allowed: strings inside `console.*`, `throw new Error` used only for developer errors (whitelist by comment `// texts-ignore`), `testID`, route paths, style values. Use a TS-AST scan (`typescript` is already a dev dependency) rather than regex, so comments don't trip it. Also assert that `PENDING_FILES` entries exist, so stale entries fail.

`docs/ui-texts.md` covers:
- how to add a text (catalog entry in the right group file, `t()` at use time, never at module load)
- variables and plurals
- optional keys
- the no-rename rule
- the one-opening lag
- OG tags are static in `public/index.html`
- the excluded pages

- [ ] **Step 1:** Write the guard with `PENDING_FILES` = every current file that has literals (generate the list by running the guard once with an empty list, then paste it in). Expected: PASS with the full list. Removing any one entry fails it.
- [ ] **Step 2:** Write the docs. Update STATUS (where we are: foundation; backlog: batches 2–8).
- [ ] **Step 3:** Verify:
  - `pnpm test && pnpm typecheck`
  - `pnpm db:reset && pnpm seed && pnpm db:test`
  - browser walk per CLAUDE.md:
    - first web opening with storage cleared shows the boot loader then Home, with no blank flash
    - reload with the cache → instant
    - admin „Texte”: edit the welcome text to `[test] …` → student reload 1 still shows the old text, reload 2 shows the new one; reset; empty → the paragraph hidden; reset
    - DevTools offline + cleared storage → loader ≤ ~1.5 s, then defaults
    - 360 px + desktop, console clean on both apps
  - Remove every `[test]` override afterwards.
- [ ] **Step 4:** Commit, push and open the PR. **Before merging:** `pnpm db:cloud:push:dry` → `pnpm db:cloud:push`. Then watch `gh pr checks --watch`, merge, and sync `main`.
  - Phone checklist for the next APK: splash stays until the texts are ready on a fresh install (airplane mode → ≤ 1.5 s, then defaults); the cache survives an app restart; the welcome text edit shows on the second opening.

---

## Part 2 — moving the strings (one PR per batch, `feat/ui-texts-<batch>`)

Every batch task has the same shape. Each one owns the listed files and the catalog group files it fills.

**Batch rules (apply to Tasks 7–13):**
- For every UI string in the batch's files:
  1. add an entry to the right group file, with the **exact current text** as `default`, a `description` when the place isn't obvious from the key, and `vars` for interpolated values
  2. replace the literal with `t('…')` or `t('…', { … })`, and replace `plural(n, 'zi', 'zile')` with `tPlural(n, 'streak.day.one', 'streak.day.many')`
  3. turn module-level text constants into functions, or call `t()` inline
- Text with inline formatting (a bold part, a link inside a sentence): split it into keys around the formatted part (`…prefix`, `…bold`, `…suffix`), unless `richText` already renders it.
- Remove the batch's files from `PENDING_FILES`.
- Add one wiring test per screen or component touched: `applyOverrides({ '<one key from it>': '[override]' })` → the render shows `[override]`. Then `resetTexts()` in `afterEach`.
- Existing tests stay green unchanged. If one needs a change, the default was altered: fix the default, not the test.
- Verify:
  - `pnpm --filter @prepio/mobile test && pnpm --filter @prepio/mobile typecheck && pnpm --filter @prepio/shared test`
  - browser walk of the batch's screens at 360 px and desktop: texts unchanged, console clean, plus one `[test]` override shown on the second reload, then removed
- Commit `feat(mobile): editable texts — <batch>`, then PR → green → merge.

### Task 7: Batch „shell” — common UI, errors, navigation titles

Files:
- `app/_layout.tsx`, `app/(app)/_layout.tsx`, `app/(auth)/_layout.tsx`, `app/(suspended)/_layout.tsx`, `app/+not-found.tsx`, `app/preview.tsx`
- `src/ui/*` (TopBar, ConfirmDialog, ActionBar, Hero (rest), ScreenLayout, TextField, SettingsRow, LessonListItem, Spinner, etc.)
- `src/lib/pageTitle.tsx`, `src/lib/errorMessage.ts`, `src/lib/api.ts`, `src/lib/supabase.ts`, `src/lib/share.ts`
- `src/screens/ErrorScreen.tsx`, `NotFoundScreen.tsx`, `PreviewScreen.tsx`, `SuspendedScreen.tsx`, `app/(suspended)/index.tsx`

Groups: `common`, `errors`, `meta`, `suspended`.

**Server messages:**
- In `api.ts` (and the BAC, credits and access callers in `src/lib/bac.ts`, `credits.ts`, `access.ts`), stop showing the server's `message`. Map each error `code` from the shared error-code types (`ConsolidationEvaluateErrorCode`, `AccountDeleteErrorCode`, and the BAC, credit purchase and access purchase codes; inventory them from `packages/shared/src` and `apps/admin/src/app/api/*/route.ts`) to an `errors.api.<code>` key. Use the server's current Romanian text as the default.
- An unknown code → `errors.api.generic`.
- Test: for each code, the thrown error's message equals `t('errors.api.<code>')`, and an override shows instead of the server text.

**`ownMessage`:** app-produced `new Error('…')` messages in `src/lib/*` become `new Error(t('…'))` at throw time.

### Task 8: Batch „auth and onboarding”

Files:
- `app/(auth)/*`, `app/(onboarding)/*`
- `src/screens/auth/*`, `src/screens/TermsGateScreen.tsx`
- `src/auth/*`
- `src/components/AgeTermsCheckbox.tsx`, `LearningModePicker.tsx`, `ReferralCodeField.tsx`, `EmailLink.tsx`
- `src/lib/emailAuth.ts`, `learningMode.ts`, `termsConsent.ts`, `pendingEmail.ts`

Groups: `auth`, `onboarding`.

Supabase auth error codes shown to the student are mapped to `errors.auth.<code>` in the same way as Task 7, keeping today's texts. The `Stack.Screen` titles in `app/_layout.tsx` (Task 7) for onboarding use `meta.*` keys.

### Task 9: Batch „home and lesson”

Files:
- `app/(app)/index.tsx`, `app/(app)/lesson/[id]/index.tsx`
- `src/screens/HomeScreen.tsx`, `src/screens/home/*`, `src/screens/LessonScreen.tsx`, `src/screens/lesson/*`
- `src/components/CardStepper.tsx`, `QuestionView.tsx`, `ChoiceQuestion.tsx`, `OrderQuestion.tsx`, `DifficultyBadge.tsx`, `InviteNote.tsx`, `src/components/cards/*`
- `src/lib/homeContinue.ts`, `lessonCount.ts`, `lessonFlow.ts`, `lessonProgressLabel.ts`, `lastTest.ts`, `progress.ts`

Groups: `home`, `lesson`, `cards`.

### Task 10: Batch „consolidation”

Files:
- `app/(app)/lesson/[id]/consolidare.tsx`
- `src/screens/ConsolidationScreen.tsx`, `src/screens/consolidation/*`
- `src/components/consolidation/*`, `src/components/marker/*`
- `src/lib/consolidation.ts`, `sourcesNamed.ts`
- student-visible strings produced in `packages/shared/src/consolidation/*` (e.g. check messages): move them to shared catalog keys and call a shared `formatText(TEXTS[k].default)`. Shared has no store, so these functions take a `text: (key: TextKey, vars?) => string` parameter defaulting to the catalog default, and the app passes `t`. *This is the only shared-side change.*

Group: `consolidation`.

### Task 11: Batch „BAC”

Files:
- `app/(app)/bac/**`
- `src/screens/bac/*`
- `src/lib/bac.ts`
- student-visible strings from `packages/shared/src/bac/*`, the same pattern as Task 10

Group: `bac`.

### Task 12: Batch „account” — access, credits, invite, profile, streak

Files:
- `app/(app)/abonament.tsx`, `credits.tsx`, `invita.tsx`, `profile.tsx`, `app/invita/[code].tsx`
- `src/screens/AccessScreen.tsx`, `CreditsScreen.tsx`, `InviteScreen.tsx`, `InviteLinkScreen.tsx`, `ProfileScreen.tsx`
- `src/access/*`, `src/credits/*`, `src/referrals/*`, `src/streak/*` (including the reminder notification title/body in `reminders.native.ts`, group `notifications`)
- `src/components/AccountDeletion.tsx`
- `src/lib/access.ts`, `credits.ts`, `referrals.ts`, `streak.ts`, `profile.ts`

Groups: `access`, `credits`, `invite`, `profile`, `streak`, `notifications`. The reminder text is read when the reminder is scheduled; that's acceptable (spec).

### Task 13: Batch „pages” and closing

Files:
- `app/recomandari.tsx`, `app/sterge-cont.tsx`
- `src/screens/ReferralsInfoScreen.tsx`, `DeleteAccountInfoScreen.tsx`
- `src/screens/legal/LegalSection.tsx`, only its own chrome, not the Terms/Privacy bodies
- `src/lib/legal.ts`, only what the in-scope pages use

Group: `pages`. Then:
- `PENDING_FILES` must be empty (assert `expect(PENDING_FILES).toEqual([])`)
- full suite: `pnpm test && pnpm typecheck`
- a full browser walk of every student screen at 360 px and desktop against the local stack, console clean
- in admin, spot-check that every group appears and that searching for „Accesul meu” / „Acces la lecții” finds its row
- STATUS: feature done; backlog item „drop `settings.welcome_message` after the next APK is everywhere”
- phone checklist: notification text, splash wait, a few screens on the device
