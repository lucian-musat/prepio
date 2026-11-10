# Launch readiness, batch 1: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship audit items 1 (CI), 3 (error pages), 11 (delete protection), 2 (Sentry), 8 (terms) and 7 (16+ confirmation) as five PRs.

**Architecture:**
- A GitHub Actions workflow gates every PR.
- Expo Router and Next.js error boundaries provide the error screens.
- A Postgres trigger and the admin UI protect published content.
- `@sentry/nextjs` and `@sentry/react-native` report errors, initialised only when a DSN is set.
- A new public terms screen, plus a server-checked terms/age acceptance stored on `profiles` and enforced by a new `needsTerms` auth status.

**Tech Stack:** pnpm 9.15.4 monorepo, Node 22, Next 16 (admin), Expo Router (mobile and student web), Supabase Postgres 17 with pgTAP, vitest, jest, GitHub Actions, Sentry.

**Spec:** `docs/superpowers/specs/2026-11-10-launch-readiness-design.md`

**Progress tracking:**
- Tick the checkboxes here as steps finish.
- The "Launch readiness" block in `docs/STATUS.md` says which PR is current, which are merged, and what's pending for the owner.

## Global Constraints

- Every PR uses its own branch off up-to-date `main` (worktree under `.worktrees/` or a plain branch).
- Merge only when CI is green and the local verification and browser walk are reported. Merge with `gh pr merge --squash --delete-branch`.
- Commands run in WSL with nvm: `wsl -d Ubuntu-22.04 -- bash -ic "cd ~/projects/prepio_new && <cmd>"`. `gh` is installed there.
- User-facing copy is Romanian with diacritics, exactly as written in the spec. Code, comments and commits are in English.
- Sentry:
  - `sendDefaultPii: false`; the user is the Supabase id only; never send request bodies, answers or the `Authorization` header.
  - No replay.
  - `tracesSampleRate` 0.1 in production.
  - No init without a DSN; no source-map upload without `SENTRY_AUTH_TOKEN`.
- Sentry org `sc-expertpower-webluc-srl`, projects `prepio-admin` and `prepio-mobile`, DSNs as listed in the spec.
- Every DB change follows `docs/database-migrations.md`: `pnpm db:new`, pgTAP, `pnpm db:reset && pnpm seed && pnpm db:test`, then `pnpm db:cloud:push:dry` → `pnpm db:cloud:push` **before** merging the PR that needs it.
- The FE testing rule in CLAUDE.md applies to PRs 2–5: a browser walk at 360 px and desktop, with the console checked.

## Review Focus

1. **A node delete that cascades into a nested published lesson** must be refused. The trigger fires on the cascaded lesson rows, so a pgTAP case uses a 2-level node.
2. **A service-role delete of a published lesson** (seed reset, demo removal, the int-test cleanups) must still succeed. Cover it with a pgTAP case running as `service_role`. The existing content and admin `test:int` suites must stay green.
3. **Web OAuth redirect:** the 16+ checkbox ticked before „Continuă cu Google” must survive the full-page redirect. On return the terms are accepted automatically and there is no gate flash. Unit-test the AuthProvider path with a stored consent.
4. **An offline or failed profile load** must not trap a student on the terms gate. `statusFor` returns `ready` when `loadFailed` and the profile is null, as today. Add a unit case.
5. **A Sentry `beforeSend` must not leak PII:** emails in messages, `Authorization` headers, request bodies. Unit-test the shared scrubber with an event that contains each.

---

## PR 1: CI and the workflow rule (branch `ci/github-actions`)

### Task 1: CI workflow, workflow rule, docs

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `CLAUDE.md` ("Start of every session" step 3; a new "Branches and PRs" section)
- Modify: `docs/STATUS.md` (a "Launch readiness" block at the top, plus the two pending owner edits already in the working tree)
- Modify: `docs/deploy.md` (a "CI" subsection)
- Add: this plan and the spec

- [ ] **Step 1:** Write `ci.yml`:
  - Triggers: `pull_request` (branches `main`) and `push` (branches `main`); `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`.
  - One job, `ci`, on `ubuntu-latest` with `timeout-minutes: 30`. Steps:
    1. checkout
    2. `pnpm/action-setup@v4` (version taken from `packageManager`)
    3. `actions/setup-node@v4` with node 22 and `cache: pnpm`
    4. `pnpm install --frozen-lockfile`
    5. `pnpm typecheck`
    6. `pnpm --filter @prepio/admin lint`
    7. `pnpm test`
    8. `pnpm exec supabase start -x studio,imgproxy,vector,logflare,edge-runtime`
    9. Write `.env` (root) and `apps/admin/.env.local` from `pnpm exec supabase status -o env`. Map `API_URL`→`SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_URL`, `ANON_KEY`→`SUPABASE_ANON_KEY`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SERVICE_ROLE_KEY`→`SUPABASE_SERVICE_ROLE_KEY`, plus `ADMIN_EMAIL`/`ADMIN_PASSWORD` from `apps/admin/.env.example`, `STUDENT_WEB_ORIGINS=http://localhost:8081` and `NEXT_PUBLIC_STUDENT_WEB_URL=http://localhost:8081`.
    10. `pnpm db:reset`
    11. `pnpm seed`
    12. `pnpm db:test`
    13. `pnpm --filter @prepio/admin test:int`
    14. `pnpm --filter @prepio/content test:int`
- [ ] **Step 2:** `CLAUDE.md`:
  - Replace step 3 with: "Implementation always happens on a new branch (see 'Branches and PRs'); don't ask."
  - Add the "Branches and PRs" section with the spec's standing workflow rule, verbatim in meaning: branch naming; PR via `gh pr create`; `gh pr checks --watch`; fix on the branch until green; merge with `gh pr merge --squash --delete-branch` after the verification is reported; sync `main`; migrations pushed before the merge when the code needs them; never push to `main` directly; never merge on red or pending CI.
- [ ] **Step 3:** `docs/STATUS.md`: add a "Launch readiness (2026-11-10 →)" block that links the spec and plan, lists the five PRs with their state, and the owner actions (lawyer review, operator placeholders in `apps/mobile/src/lib/legal.ts`, the phone checks after the Sentry APK). `docs/deploy.md`: add a "CI" note (what runs, that there is no branch protection by owner decision, and that the repo is public).
- [ ] **Step 4:** Commit. Push the branch, `gh pr create`, `gh pr checks --watch`.
  - Expected: the `ci` check passes. If a suite fails only in CI (env, ports, timing), fix it on this branch.
- [ ] **Step 5:** Merge and sync `main`. STATUS gets "PR 1 merged".

## PR 2: Error pages (branch `feat/error-pages`)

### Task 2: Student app error boundary and 404

**Files:**
- Create: `apps/mobile/src/screens/ErrorScreen.tsx`
- Create: `apps/mobile/src/screens/NotFoundScreen.tsx`
- Create: `apps/mobile/app/+not-found.tsx`
- Modify: `apps/mobile/app/_layout.tsx` (add `export function ErrorBoundary`)
- Test: `apps/mobile/src/screens/__tests__/ErrorScreen.test.tsx`
- Test: `apps/mobile/src/screens/__tests__/NotFoundScreen.test.tsx` (follow the existing screen-test location and pattern)

**Interfaces:**
- Produces: `ErrorScreen({ error, retry }: { error: Error; retry: () => Promise<void> })` and `NotFoundScreen()`. Task 7 later adds `Sentry.captureException(error)` inside `ErrorScreen`'s mount effect.

- [ ] **Step 1:** Write the failing tests.
  - `ErrorScreen` renders „Ceva n-a mers bine” and „A apărut o eroare neașteptată. Am fost anunțați.”. „Încearcă din nou” calls `retry`. „Mergi la început” calls `router.replace('/')`. The error message text is **not** rendered.
  - `NotFoundScreen` renders „Pagina nu există” and „Linkul pe care l-ai urmat nu mai e valabil.”. „Mergi la început” calls `router.replace('/')`.
- [ ] **Step 2:** Run `pnpm --filter @prepio/mobile test -- ErrorScreen NotFoundScreen`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement both screens with `ScreenLayout`, `AppText` and `Button` from `src/ui`.
  - `ErrorScreen` must not depend on `AuthProvider` or the loaded fonts: it renders above the providers, so it uses plain `AppText` roles and the system font fallback is acceptable.
  - `_layout.tsx`: `export function ErrorBoundary(props: ErrorBoundaryProps) { return <ErrorScreen {...props} />; }`
  - `app/+not-found.tsx` re-exports `NotFoundScreen` like the other route files.
- [ ] **Step 4:** Run the tests and `pnpm --filter @prepio/mobile typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit.

### Task 3: Admin error, not-found and loading pages

**Files:**
- Create: `apps/admin/src/app/global-error.tsx`
- Create: `apps/admin/src/app/not-found.tsx`
- Create: `apps/admin/src/app/(admin)/error.tsx`
- Create: `apps/admin/src/app/(admin)/loading.tsx`
- Test: `apps/admin/src/app/__tests__/errorPages.test.tsx` (follow the existing admin component-test pattern)

- [ ] **Step 1:** Write the failing tests.
  - `(admin)/error.tsx` renders „Ceva n-a mers bine pe această pagină.”, a button „Încearcă din nou” that calls `reset`, and `error.digest` when present. It never renders `error.message`.
  - `not-found.tsx` renders „Pagina nu există” and a link to `/`.
  - `global-error.tsx` renders its own `<html lang="ro">`, plain inline styles and „Reîncarcă”.
- [ ] **Step 2:** Run `pnpm --filter @prepio/admin test -- errorPages`. Expected: FAIL.
- [ ] **Step 3:** Implement. The error files are `'use client'`. `loading.tsx` is a centred react-bootstrap `Spinner` with `aria-label="Se încarcă"`.
- [ ] **Step 4:** Run the tests, admin `typecheck` and `lint`. Expected: PASS.
- [ ] **Step 5:** Commit. Then do the browser walk:
  - an unknown URL in the student web at 360 and 1280, and in the admin
  - a temporary throw in a student screen and in an admin page (not committed), to see both error screens and that „Încearcă din nou” recovers once the throw is removed
  - the console
- [ ] **Step 6:** Open the PR, CI green, merge, update STATUS.

## PR 3: Delete protection and confirms (branch `feat/delete-protection`)

### Task 4: Migration — published lessons can't be deleted from an admin session

**Files:**
- Create: `supabase/migrations/<ts>_protect_published_lessons.sql` (via `pnpm db:new protect_published_lessons`)
- Test: `supabase/tests/delete_protection.test.sql`

**Interfaces:**
- Produces: the trigger `lessons_block_published_delete` raises SQLSTATE `P0001` with the message `published_lesson_delete`. The admin maps exactly this message.

- [ ] **Step 1:** Write the pgTAP tests, following the auth helpers in `rls.test.sql`. As an admin (`authenticated` with an admins row):
  - deleting a published lesson → `throws_ok(..., 'P0001', 'published_lesson_delete')`
  - deleting a draft lesson → `lives_ok`
  - deleting a node whose child node holds a published lesson → throws, and the lesson still exists
  - deleting a node with only drafts → `lives_ok`

  As `service_role`, deleting a published lesson → `lives_ok`.
- [ ] **Step 2:** Run `pnpm db:test`. Expected: the new file fails.
- [ ] **Step 3:** Write the migration:
  - a `plpgsql` trigger function with `set search_path = ''`
  - the check: `old.status = 'published' and coalesce(auth.role(), current_user) <> 'service_role'` → `raise exception 'published_lesson_delete'`
  - `before delete on public.lessons for each row`
- [ ] **Step 4:** Run `pnpm db:reset && pnpm seed && pnpm db:test`, then admin and content `test:int`. Expected: all PASS.
- [ ] **Step 5:** Commit.

### Task 5: Admin — disabled deletes, server message, unpublish confirms

**Files:**
- Modify: `apps/admin/src/lib/data/tree.ts` (`deleteLesson` and `deleteNode` map the error)
- Modify: `apps/admin/src/components/TreeEditor.tsx` (disabled delete with hint; unpublish confirm; delete-modal body)
- Modify: `apps/admin/src/components/editor/LessonHeader.tsx` (unpublish confirm)
- Modify: `apps/admin/src/components/bac/BacDetailsForm.tsx` (confirm before turning `published` off)
- Test: `apps/admin/src/lib/data/tree.int.test.ts`
- Test: the component tests next to `TreeEditor` and `LessonHeader`, if they exist; otherwise add `TreeEditor.test.tsx`

**Interfaces:**
- Consumes: the `published_lesson_delete` message from Task 4.
- Produces: `publishedLessonCount(node): number`, a helper in `TreeEditor.tsx` that counts published lessons in a node's subtree from the tree data already loaded.

- [ ] **Step 1:** Write the failing tests.
  - int: `deleteLesson` on a published lesson rejects with `UserError('Depublică lecția întâi.')`.
  - int: `deleteNode` on a node with a published lesson rejects with `UserError('Nodul conține lecții publicate. Depublică-le întâi.')`.
  - component: a published lesson's delete button is disabled with the title „Depublică lecția întâi”.
  - component: a node with 2 published lessons has its delete disabled with „Conține lecții publicate (2). Depublică-le întâi”.
  - component: „Retrage” opens a modal „Retragi lecția din publicare? Elevii nu o vor mai vedea.” and calls `setLessonStatus` only after confirming.
  - component: turning the BAC switch off asks „Retragi subiectul din publicare?”.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
  - `tree.ts`: catch the PostgREST error whose `message === 'published_lesson_delete'` in `deleteLesson` and `deleteNode`, and throw the `UserError`s above.
  - The lesson delete modal body: „Se șterg și progresul, încercările și consolidarea elevilor pe această lecție.”
  - The unpublish confirms reuse TreeEditor's existing confirm modal state. For `LessonHeader` and `BacDetailsForm`, extract it as `components/ConfirmModal.tsx` (`{ show, heading, body, confirmLabel, onConfirm, onCancel }`) if that's less code than duplicating.
- [ ] **Step 4:** Run admin `test`, `test:int`, `typecheck` and `lint`. Expected: PASS.
- [ ] **Step 5:** Commit. Then do the browser walk with a `[test]` lesson and node:
  - disabled delete with the hints
  - a forced delete through a stale UI (publish in a second tab) shows the Romanian error
  - the unpublish confirm: cancel keeps the lesson published, confirm unpublishes
  - a draft delete works
  - the BAC switch confirm
  - console clean; seed intact; `[test]` rows removed
- [ ] **Step 6:** `pnpm db:cloud:push:dry` (only this migration) → `pnpm db:cloud:push`. Then the PR, CI, merge, STATUS.

## PR 4: Sentry (branch `feat/sentry`)

### Task 6: Shared PII scrubber

**Files:**
- Create: `packages/shared/src/sentryScrub.ts`, exported from the package index
- Test: `packages/shared/src/sentryScrub.test.ts`

**Interfaces:**
- Produces: `scrubEvent<E extends { request?: …; user?: …; message?: string; exception?: … }>(event: E): E`. Use a structural type, so `shared` has no Sentry dependency.

- [ ] **Step 1:** Failing tests. Given an event with:
  - `request.headers.Authorization` and `request.headers.cookie`
  - `request.data`
  - `user: { id, email, username, ip_address }`
  - an email in `message` and in an exception value

  the result has no `Authorization`, no cookie and no `data`, the user is `{ id }` only, and every email is replaced by `[email]`.
- [ ] **Step 2:** `pnpm --filter @prepio/shared test -- sentryScrub`. Expected: FAIL.
- [ ] **Step 3:** Implement. The email regex is `/[^\s@]+@[^\s@]+\.[^\s@]+/g`.
- [ ] **Step 4:** Tests PASS. Commit.

### Task 7: Sentry in the student app (native and web)

**Files:**
- Create: `apps/mobile/src/lib/sentry.ts`
- Create: `apps/mobile/metro.config.js` (`getSentryExpoConfig(__dirname)`)
- Modify: `apps/mobile/app/_layout.tsx` (`initSentry()` at module load; `export default Sentry.wrap(RootLayout)` when enabled)
- Modify: `apps/mobile/src/screens/ErrorScreen.tsx` (capture on mount)
- Modify: `apps/mobile/src/auth/AuthProvider.tsx` (`setSentryUser(session?.user.id ?? null)`)
- Modify: `apps/mobile/app.json` (plugin `["@sentry/react-native/expo", { "organization": "sc-expertpower-webluc-srl", "project": "prepio-mobile", "url": "https://de.sentry.io/" }]`)
- Modify: `apps/mobile/eas.json` (`EXPO_PUBLIC_SENTRY_DSN` in both profiles)
- Modify: `apps/mobile/vercel.json` (`buildCommand`: export, then `if [ -n "$SENTRY_AUTH_TOKEN" ]; then npx sentry-expo-upload-sourcemaps dist; fi`)
- Modify: `apps/mobile/package.json` (via `npx expo install @sentry/react-native`)
- Test: `apps/mobile/src/lib/__tests__/sentry.test.ts`

**Interfaces:**
- Produces: `initSentry(): boolean`, `setSentryUser(id: string | null): void` and `captureError(e: unknown): void`. All are no-ops when `EXPO_PUBLIC_SENTRY_DSN` is empty.

- [ ] **Step 1:** Failing tests, with `@sentry/react-native` mocked.
  - With no DSN, `initSentry()` returns false and `init` is not called.
  - With a DSN, `init` is called with `sendDefaultPii: false`, `tracesSampleRate: 0.1` and `beforeSend` = `scrubEvent`.
  - The environment is `EXPO_PUBLIC_SENTRY_ENV ?? 'development'`.
  - `setSentryUser('u1')` → `setUser({ id: 'u1' })`; `null` → `setUser(null)`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement and wire.
  - `EXPO_PUBLIC_SENTRY_ENV` is `production` in the eas `production` profile and on Vercel `prepio-web`, and `preview` in the eas `preview` profile.
  - Set `EXPO_PUBLIC_SENTRY_DSN` and `EXPO_PUBLIC_SENTRY_ENV=production` on Vercel `prepio-web` (Production) with `npx vercel env add` from WSL (memory: Vercel via npx, team `prepio1`).
  - In `scripts/build-apk-local.sh`, export `SENTRY_DISABLE_AUTO_UPLOAD=true` when `SENTRY_AUTH_TOKEN` is unset.
- [ ] **Step 4:** Run mobile `test` and `typecheck`, and `expo export -p web` (it must succeed with no token). Expected: PASS.
- [ ] **Step 5:** Commit.

### Task 8: Sentry in admin and the API routes

**Files:**
- Create: `apps/admin/src/instrumentation.ts`
- Create: `apps/admin/src/instrumentation-client.ts`
- Create: `apps/admin/sentry.server.config.ts`
- Create: `apps/admin/sentry.edge.config.ts`, or inline both in `instrumentation.ts`, whichever the installed `@sentry/nextjs` version documents
- Create: `apps/admin/src/lib/sentry.ts`
- Modify: `apps/admin/next.config.ts` (`withSentryConfig(config, { org, project: 'prepio-admin', sentryUrl: 'https://de.sentry.io/', silent: true, sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN }, widenClientFileUpload: true })`)
- Modify: `apps/admin/src/app/global-error.tsx` and `(admin)/error.tsx` (capture)
- Modify: the catch blocks of the API route handlers under `apps/admin/src/app/api/**/route.ts` and the `[tree action] unexpected error` style `console.error`s in the server actions (call `captureError(e)`, never the request)
- Test: `apps/admin/src/lib/sentry.test.ts`

**Interfaces:**
- Produces: `captureError(e: unknown, tags?: Record<string, string>): void`, a no-op when `NEXT_PUBLIC_SENTRY_DSN` is empty.

- [ ] **Step 1:** Failing tests (`@sentry/nextjs` mocked).
  - `captureError` without a DSN doesn't call `captureException`.
  - With a DSN, it calls it once with the error and the tags.
  - The shared init options are `sendDefaultPii: false`, `tracesSampleRate: 0.1` and `beforeSend: scrubEvent`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
  - `instrumentation.ts` exports `register()`, which imports the node or edge config by `NEXT_RUNTIME`, and `export const onRequestError = Sentry.captureRequestError`.
  - The environment is `VERCEL_ENV ?? 'development'`.
  - Set `NEXT_PUBLIC_SENTRY_DSN` on Vercel `prepio-admin` for Production and Preview.
- [ ] **Step 4:** Run admin `test`, `test:int`, `typecheck` and `lint`, and `next build` with no token. Expected: PASS.
- [ ] **Step 5:** Commit. Then verify end to end:
  - Locally, set the DSN temporarily (env `development`).
  - Trigger a throw in an admin page and in the student web.
  - Read both events back with the Sentry MCP (`search_issues`) and confirm they carry no email or body.
  - Resolve them.
- [ ] **Step 6:** Open the PR, CI, merge. After the deploys are Ready, confirm the production builds uploaded source maps (`find_releases`). STATUS: native → the owner tests a crash on the next APK.

## PR 5: Terms and the 16+ confirmation (branch `feat/terms-age`)

### Task 9: Migration — `accept_terms` and the profile columns

**Files:**
- Create: `supabase/migrations/<ts>_terms_acceptance.sql`
- Test: `supabase/tests/terms_acceptance.test.sql`

**Interfaces:**
- Produces:
  - `profiles.age_confirmed_at timestamptz null` and `profiles.terms_version text null`
  - `public.current_terms_version() returns text`, immutable, returning `'2026-11-10'`
  - `public.accept_terms(p_version text) returns void`, SECURITY DEFINER, `set search_path = ''`, granted to `authenticated` only
  - On a mismatch it raises `terms_version_mismatch`.

- [ ] **Step 1:** pgTAP tests.
  - As a student:
    - `update profiles set terms_version = ...` on the own row → 42501 (no column grant)
    - `accept_terms('2026-11-10')` sets both columns on the own row only (another student's row is unchanged)
    - `accept_terms('2099-01-01')` → throws `terms_version_mismatch`
  - anon: `accept_terms` → 42501.
  - Students can still select the new columns on their own row.
- [ ] **Step 2:** Run `pnpm db:test`. Expected: FAIL.
- [ ] **Step 3:** Write the migration.
- [ ] **Step 4:** Run `pnpm db:reset && pnpm seed && pnpm db:test`. Expected: PASS. Commit.

### Task 10: Legal constants, the terms screen, privacy update

**Files:**
- Modify: `apps/mobile/src/lib/legal.ts` (add `TERMS_VERSION = '2026-11-10'`, `TERMS_DATE = '10 noiembrie 2026'`, `OPERATOR_NAME = '[DENUMIRE OPERATOR]'`, `OPERATOR_CUI = '[CUI]'`, `OPERATOR_ADDRESS = '[SEDIU]'`; set `POLICY_DATE = '10 noiembrie 2026'`)
- Create: `apps/mobile/src/screens/TermsScreen.tsx`
- Create: `apps/mobile/app/termeni.tsx`
- Modify: `apps/mobile/app/_layout.tsx` (public `Stack.Screen name="termeni"` with the title „Termeni de utilizare”)
- Modify: `apps/mobile/src/screens/PrivacyScreen.tsx` (a „Vârsta minimă” section; the legal basis in „De ce le folosim”; Sentry in „Cine prelucrează datele”; an operator block; a link to the terms in „Contact”)
- Modify: `apps/mobile/src/screens/ProfileScreen.tsx` (a „Termeni de utilizare” row next to the privacy row)
- Test: `apps/mobile/src/screens/__tests__/TermsScreen.test.tsx`
- Test: the existing Privacy and Profile tests

- [ ] **Step 1:** Failing tests.
  - `TermsScreen` renders the 13 section titles from the spec in order. It shows `OPERATOR_NAME`, `OPERATOR_CUI`, `OPERATOR_ADDRESS`, `CONTACT_EMAIL` and `TERMS_DATE`, and „cel puțin 16 ani”.
  - Privacy renders „Vârsta minimă”, „art. 6 alin. (1) lit. b”, „Sentry” and `OPERATOR_NAME`.
  - Profile has a „Termeni de utilizare” row that pushes `/termeni`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Write the screens with the `PrivacyScreen` `Section`/`Item` pattern (move them to a shared `src/screens/legal/LegalSection.tsx` if reused). The Romanian text follows the spec's section list; plain, short sentences.
- [ ] **Step 4:** Run mobile `test` and `typecheck`. Expected: PASS. Commit.

### Task 11: Consent on Welcome, the `needsTerms` gate, auto-accept after sign-in

**Files:**
- Create: `apps/mobile/src/lib/termsConsent.ts`
- Create: `apps/mobile/src/components/AgeTermsCheckbox.tsx`
- Create: `apps/mobile/src/screens/TermsGateScreen.tsx`
- Create: `apps/mobile/app/(onboarding)/terms.tsx`
- Modify: `apps/mobile/src/auth/AuthProvider.tsx` (`statusFor`, the profile mapping, the auto-accept)
- Modify: the profile type/mapping (`Profile` gets `termsVersion: string | null`; select `terms_version`)
- Modify: `apps/mobile/app/_layout.tsx` (`Stack.Protected guard={status === 'needsTerms'}` with `(onboarding)/terms`)
- Modify: `apps/mobile/src/screens/auth/WelcomeScreen.tsx` (the checkbox; the buttons disabled until it's ticked; the footer sentence replaced by the checkbox)
- Test: `apps/mobile/src/auth/__tests__/statusFor.test.ts` (extend the existing test file if there is one)
- Test: `apps/mobile/src/lib/__tests__/termsConsent.test.ts`
- Test: `WelcomeScreen.test.tsx`
- Test: `TermsGateScreen.test.tsx`

**Interfaces:**
- Consumes: `TERMS_VERSION` (Task 10); the `accept_terms` RPC (Task 9).
- Produces:
  - `AuthStatus` gains `'needsTerms'`.
  - `statusFor(profile, loadFailed)`: suspended first, then `profile && profile.termsVersion !== TERMS_VERSION` → `'needsTerms'`, then name, then mode.
  - `termsConsent`:
    - `getStoredConsent(): Promise<string | null>`
    - `storeConsent(version: string): Promise<void>`
    - `clearConsent(): Promise<void>`
    - `acceptTerms(): Promise<void>`, which calls `rpc('accept_terms', { p_version: TERMS_VERSION })` and throws on an error.

- [ ] **Step 1:** Failing tests.
  - `statusFor`:
    - termsVersion null → `needsTerms`
    - suspended with null terms → `suspended`
    - `loadFailed` with a null profile → `ready`
    - accepted, no name → `needsName`
  - Welcome:
    - „Continuă cu Google” is disabled until „Am cel puțin 16 ani și accept Termenii de utilizare și Politica de confidențialitate.” is checked
    - checking it calls `storeConsent(TERMS_VERSION)`
    - the two links push `/termeni` and `/confidentialitate`
  - Gate:
    - „Continuă” is disabled until it is checked, then calls `acceptTerms` and `refreshProfile`
    - an RPC error shows „Nu am putut salva. Încearcă din nou.”
    - „Ieși din cont” signs out
  - AuthProvider: with a stored consent equal to `TERMS_VERSION` and a profile with null terms, it calls `acceptTerms` once, clears the consent and settles past `needsTerms`. If `acceptTerms` fails, the status is `needsTerms`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
  - `termsConsent` uses the same storage wrapper the Supabase client uses (AsyncStorage on native, localStorage on web).
  - The checkbox is a pressable row with `accessibilityRole="checkbox"` and `accessibilityState={{ checked }}`, styled with the design tokens.
  - Auto-accept runs in the profile load path before the status settles, so there is no gate flash.
- [ ] **Step 4:** Run mobile `test`, `typecheck` and `expo export -p web`. Expected: PASS. Commit.
- [ ] **Step 5:** Browser walk (local stack, 360 touch and 1280):
  - Welcome:
    - the checkbox gates both buttons
    - the links open `/termeni` and `/confidentialitate` signed out, and back returns
  - a new `[test]` student via email code (local flag on): ticks, signs in, goes straight to name/mode with no gate; the DB row has both columns
  - an existing `[test]` student with null terms: sees the gate, with „Ieși din cont” and „Continuă”, then onboarding or Home
  - a suspended `[test]` student: still the suspended screen
  - Profile: the „Termeni de utilizare” row
  - an RPC refused (a temporarily wrong version in devtools) shows the error
  - no horizontal scroll; console clean; `[test]` rows removed
- [ ] **Step 6:** `pnpm db:cloud:push:dry` → `pnpm db:cloud:push` (before the merge: the web reads `terms_version`). Then the PR, CI, merge, Ready.
  - STATUS: owner actions are a new APK (Sentry and terms), the phone checks (crash to Sentry, Welcome checkbox, gate, error screen), filling the placeholders in `legal.ts`, and the lawyer review.

## After batch 1

Write the batch 2 spec (MFA, the per-user AI limit, server-side verdicts, JSON limits, grant revokes, OpenAI hardening) per the spec's "Later batches". Update STATUS.
