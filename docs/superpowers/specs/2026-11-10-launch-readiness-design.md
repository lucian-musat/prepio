# Launch readiness — design

Date: 2026-11-10. Source: the production readiness audit of 2026-11-10 (P0 items 1–13, P1 items 14–26, P2). Payments are out of scope.

## Intent

Prepio works and its code is solid, but it lacks the operational and legal layer needed before real students (12th graders, 16+) arrive. This project closes the audit's gaps in batches. **Batch 1** (this spec, in detail) covers items 1, 2, 3, 7, 8 and 11: the ones that need no paid plan, no legal sign-off to build, and little owner work. The other items are listed at the end as later batches. Each later batch gets its own short spec when it starts.

Success for batch 1:
- Every PR to `main` runs the full automated gate.
- Errors in admin, the API, the student web and the APK reach Sentry.
- No screen white-screens on a render error.
- Students confirm they are 16+ and accept the terms.
- Published content can't be deleted by accident.

## Standing workflow rule (owner decision; goes into CLAUDE.md)

- All implementation happens on a new branch, `feat/<topic>` or `fix/<topic>`, never directly on `main`. Use a worktree for feature work.
- At the end the agent pushes the branch, opens a PR to `main` (`gh pr create`) and watches its checks (`gh pr checks --watch`).
- If CI fails, the agent fixes the cause on the branch and repeats.
- When CI is green and the local verification (tests plus the browser walk from the testing rule) is done and reported, the agent merges the PR itself (`gh pr merge --squash --delete-branch`) and syncs local `main`.
- Merging to `main` deploys prepio-admin and prepio-web through Vercel. If a release needs an ordered rollout (a migration pushed before the deploy, see `docs/deploy.md`), the agent does those steps in the documented order. A migration that must land before the code is pushed with `pnpm db:cloud:push` before the merge.
- This replaces CLAUDE.md "Start of every session" step 3: the agent no longer asks whether to use a branch.

## Batch 1

### 1. CI (GitHub Actions)

- Add `.github/workflows/ci.yml`, triggered on `pull_request` to `main` and on `push` to `main`.
- Versions: Node 22 (matches `eas.json`), pnpm 9.15.4 from `packageManager`, `pnpm install --frozen-lockfile` with the pnpm store cached.
- Steps:
  1. `pnpm typecheck`
  2. `pnpm --filter @prepio/admin lint`
  3. `pnpm test`
  4. Start Supabase locally in the runner (`supabase start` from the root devDependency), then `pnpm db:reset && pnpm seed && pnpm db:test`
  5. Admin `test:int` and content `test:int` (they need the local stack)
- Playwright e2e stays out of CI for now (builder's call: slow and needs both dev servers). It can be added later as a separate job.
- Concurrency: cancel superseded runs on the same ref.
- No branch protection (owner decision, 2026-11-10). The repo is public, so protection would be free and can be added later. The rule "never merge with red or pending CI, never push to `main` directly" is enforced by the agent through CLAUDE.md.
- Vercel keeps deploying `main`. PR preview deployments already exist by default and point at production Supabase until staging exists (item 6).

### 2. Sentry

Provisioned by Claude on 2026-11-10 in org `sc-expertpower-webluc-srl`, EU region (`https://de.sentry.io`), team `sc-expertpower-webluc-srl`:

| Project | Platform | DSN (public, safe to commit) |
|---|---|---|
| `prepio-admin` | javascript-nextjs | `https://9f2375285d6ebd3837f81fecef72638c@o4512407669309440.ingest.de.sentry.io/4512407702536272` |
| `prepio-mobile` | react-native (APK + student web) | `https://0dbd509867052fd3377cdef695dd6342@o4512407669309440.ingest.de.sentry.io/4512407702601808` |

The owner set `SENTRY_AUTH_TOKEN` (org token, source-map upload) in Vercel `prepio-admin`, Vercel `prepio-web` and the EAS environment variables (production and preview). The token is never in the repo or in a command line.

Shared rules for both SDKs:
- **No PII.** `sendDefaultPii: false`. The user is identified by Supabase user id only: no email, no name. Scrub request bodies and the `Authorization` header. Students' answers must never be sent.
- No session replay.
- Tracing at a low sample rate (0.1 in production). Errors are always sent.
- `environment` = `production` / `preview` / `development`.
- `release` = the git SHA on Vercel. For the app, use the app version plus build.
- **Off without a DSN.** When the DSN env var is missing (local dev, tests, CI), the SDK isn't initialised and nothing is sent. Source-map upload is skipped when `SENTRY_AUTH_TOKEN` is missing, so local builds and CI don't fail.

Admin (`@sentry/nextjs`):
- `instrumentation.ts` with `register()` for the node and edge runtimes, and `onRequestError` exported so server-component and route-handler errors are captured.
- `instrumentation-client.ts` for the browser.
- `withSentryConfig` in `next.config.ts` (org/project, upload only with the token, hide source maps from the client).
- The `global-error.tsx` from item 3 calls `Sentry.captureException`.
- The API routes (`/api/consolidation/evaluate`, `/api/bac/submit`, purchases, account delete) catch errors and return generic errors today. Their catch blocks must also `captureException` (the error, never the request body).
- DSN from `NEXT_PUBLIC_SENTRY_DSN`, set by Claude on Vercel `prepio-admin` (Production and Preview) via the Vercel CLI, since it isn't secret.

Student app (`@sentry/react-native` with its Expo config plugin and `getSentryExpoConfig` in a new `metro.config.js`):
- `Sentry.init` in `app/_layout.tsx`, wrapping the root.
- DSN from `EXPO_PUBLIC_SENTRY_DSN`:
  - committed in both `eas.json` profiles
  - set on Vercel `prepio-web` via the CLI
- Web: after `expo export -p web`, upload the `dist` source maps with Sentry's Expo upload script in the `prepio-web` build command (only when the token is present).
- APK: the config plugin uploads during EAS builds.
- Local APK builds (`scripts/build-apk-local.sh`, used while the EAS quota is out) have no token, so upload is skipped and that build's stack traces stay minified. This is acceptable and documented.
- **This adds a native module, so a new APK is required.** The owner checks on the phone that a test crash reaches Sentry.

Verification:
- Verify in the browser that a deliberate test error from admin and from the student web reaches Sentry, read back with the Sentry MCP.
- Use local runs with the DSN set temporarily, tagged `environment=development`.
- The test errors are resolved in Sentry afterwards.

### 3. Error boundaries and error pages

All copy is in Romanian, uses the existing design system, and never shows a stack trace.

Student app:
- Export `ErrorBoundary` from `app/_layout.tsx` (Expo Router's per-route error boundary).
  - Screen: „Ceva n-a mers bine”, „A apărut o eroare neașteptată. Am fost anunțați.”, a primary button „Încearcă din nou” (calls `retry`) and a secondary „Mergi la început” (to `/`).
  - It reports to Sentry.
  - It must render even if fonts or providers failed, so it falls back to system fonts.
- `app/+not-found.tsx`: „Pagina nu există”, „Linkul pe care l-ai urmat nu mai e valabil.”, with a button „Mergi la început”. It replaces Expo's English „Unmatched route”.

Admin:
- `src/app/global-error.tsx`: own `<html>` and `<body>`, plain styles, reports to Sentry, button „Reîncarcă”.
- `src/app/(admin)/error.tsx`: inside the shell, „Ceva n-a mers bine pe această pagină.”, „Încearcă din nou” (`reset`) and the error digest in small text, for matching in Sentry.
- `src/app/not-found.tsx`: „Pagina nu există”, with a link to the dashboard.
- `src/app/(admin)/loading.tsx`: a centred spinner.

### 7. Age confirmation (16+) — owner decision

The app targets 12th graders only, so there is no birth date and no parental consent.

On the Welcome screen (`src/screens/auth/WelcomeScreen.tsx`):
- One required checkbox: „Am cel puțin 16 ani și accept [Termenii de utilizare] și [Politica de confidențialitate].” The two links open `/termeni` and `/confidentialitate`.
- The sign-in buttons (Google and email) are disabled until it is checked.
- The checked state is kept locally (AsyncStorage / localStorage) so it survives the OAuth redirect on web.

After sign-in:
- The app calls a new RPC, `accept_terms(p_version text)` (SECURITY DEFINER, `auth.uid()` only), which sets the new `profiles` columns `age_confirmed_at = now()` and `terms_version = p_version`.
- Students get no column grant on these columns, so the timestamp can't be forged or cleared.

Gate screen in the onboarding stack:
- Any signed-in student whose `terms_version` is null or older than the current `TERMS_VERSION` sees a gate screen first, with the same checkbox and „Continuă”.
- This covers existing accounts, a sign-in where the local flag was lost, and future terms changes. It is shown before the name/mode onboarding.
- „Ieși din cont” is available on the gate.
- Suspended students go to the suspended screen as today. The gate does not apply to them.

`TERMS_VERSION` and `TERMS_DATE` live in `apps/mobile/src/lib/legal.ts` next to `POLICY_DATE`. The first version is `2026-11-10`.

*(Claude's call)* The server knows the current version. A SQL function `current_terms_version()`, bumped by a migration whenever the terms change, holds it. `accept_terms` refuses any other value, so a client can't skip a future gate by sending a future version. The gate compares the profile against what the server returns.

Changes to the privacy policy (`PrivacyScreen.tsx`):
- A new section „Vârsta minimă”: the app is for 12th-grade students, at least 16; no data is knowingly collected from anyone under 16; an account found to belong to someone under 16 is deleted.
- In „De ce le folosim”: the legal basis. Contract (art. 6(1)(b) GDPR) for the account, progress and checks; legitimate interest (art. 6(1)(f)) for security and error monitoring.
- In „Cine prelucrează datele”: Sentry (error monitoring, EU region, no names or emails).
- A placeholder operator block (below).
- `POLICY_DATE` is updated.
- The wording is a reasonable draft; the owner's lawyer reviews it before launch (an owner action).

pgTAP for `accept_terms` and the column grants:
- a student can't update `age_confirmed_at` / `terms_version` directly
- the RPC sets its own row only
- anon can't call it

### 8. Terms of use

- New public route `app/termeni.tsx`, re-exporting `src/screens/TermsScreen.tsx`.
  - Same layout and helpers as `PrivacyScreen`.
  - Reachable without login, like `/confidentialitate` and `/sterge-cont`.
- Linked from:
  - the Welcome checkbox
  - the gate screen
  - Profile, as a new row „Termeni de utilizare” next to the privacy row
  - the privacy policy's „Contact” section
- Sections (Romanian draft, lawyer review pending):
  1. Cine suntem (operator placeholders)
  2. Ce este Prepio
  3. Cine poate folosi aplicația (16+, clasa a 12-a)
  4. Contul tău (one account per person; sign-in through Google/email)
  5. Credite și acces (what they are; no payments are taken today)
  6. Notele și verificările sunt orientative (the AI-graded results may differ from a teacher's)
  7. Folosire corectă (no abuse, no automated access, no sharing accounts)
  8. Conținutul (belongs to the operator; personal study use only)
  9. Suspendarea și ștergerea contului
  10. Răspundere
  11. Modificări (a new version is accepted on the gate screen)
  12. Legea aplicabilă (Romanian law)
  13. Contact
- Operator placeholders are defined once in `legal.ts` and used by both the terms and privacy screens, so the owner fills them in one place: `OPERATOR_NAME = '[DENUMIRE OPERATOR]'`, `OPERATOR_CUI = '[CUI]'`, `OPERATOR_ADDRESS = '[SEDIU]'`. `CONTACT_EMAIL` is unchanged.
- Adding the route must not break the `/preview` CSP or the SPA rewrite in `apps/mobile/vercel.json` (it doesn't need changes).

### 11. Content deletion protection — owner decision

Rule:
- A lesson with `status = 'published'` can't be deleted.
- A node can't be deleted while any lesson in its subtree is published.
- After unpublishing, deletion is allowed and student progress on it is lost (owner accepts this).

Enforcement in the DB (new migration):
- A `BEFORE DELETE` trigger on `lessons` raises when `old.status = 'published'`, with a clear SQLSTATE and message. *(Claude's call)* It applies to the `authenticated` role, which is what the admin's session uses; the `service_role` passes, so the maintenance scripts keep working: seed reset, `content:cloud:demo --remove`, `remove-test-lessons`, and the integration-test cleanups. The point is to protect against mistakes in the admin, not against the owner's own scripts.
- Because node deletes cascade to lessons, the same trigger aborts a node delete whose subtree contains a published lesson. Check that in pgTAP, with a nested node too.
- pgTAP cases:
  - published lesson delete fails
  - draft lesson delete works
  - node with a published lesson (direct and nested) fails
  - node with only drafts works

Admin (`TreeEditor.tsx`, `actions/tree.ts`):
- The delete control on a published lesson is disabled, with the hint „Depublică lecția întâi”.
- On a node with published lessons inside, the hint is „Conține lecții publicate (n). Depublică-le întâi”.
- The server actions map the trigger error to that Romanian message, so a stale UI gets the same answer.
- The existing delete confirmation modal stays. Its body says what is lost: „Se șterg și progresul, încercările și consolidarea elevilor pe această lecție.”

Confirmations on every destructive action:
- The inventory found two without one: unpublishing a lesson (`TreeEditor.tsx` and `LessonHeader.tsx`, `setLessonStatus`) and unpublishing a BAC subject (`BacDetailsForm.tsx`, `setBacPublished`).
- Both get a confirm modal: „Retragi lecția din publicare? Elevii nu o vor mai vedea.” / „Retragi subiectul din publicare?”. Publishing needs no confirm.
- All other destructive actions already confirm (modal or the inline two-step `ItemControls`); they stay as they are.
- Builder's call: whether to extract a small shared `ConfirmModal` from the TreeEditor modal for the two new ones, or reuse the existing component.

Out of scope (owner chose "just block published"): soft delete / archive; blocking deletes of cards, questions or exercises inside a published lesson (they already have the two-step confirm).

### Delivery order *(Claude's call)*

Batch 1 ships as five PRs, each on its own branch:

1. CI. It goes first, so the other PRs run through it.
2. Error pages.
3. Delete protection and confirms. It has a migration, pushed to prod before the merge.
4. Sentry. Native module, so a new APK and the owner's phone checks follow.
5. Terms + age confirmation. It has a migration, pushed before the merge.

The legal text ships as a draft, because there are no real students yet. The lawyer's review is a pre-launch owner action.

### Verification for batch 1

- The full local suite and `pnpm db:reset && pnpm seed && pnpm db:test`.
- The CI workflow green on the PR itself.
- A browser walk on the local stack, at 360 px and desktop, console checked:
  - welcome checkbox gating and links
  - the OAuth/email sign-in flows still work
  - the gate for an existing `[test]` student, and after accepting, onboarding continues
  - `/termeni` and the updated `/confidentialitate` without login
  - the Profile row
  - an unknown URL shows the Romanian 404
  - a forced render error shows the error screen and „Încearcă din nou” recovers
  - admin 404 / error pages
  - published lesson and node delete disabled, and refused by the server when forced
  - the unpublish confirms
  - Sentry test events received
- Phone checks for the owner (native, next APK):
  - Sentry crash capture
  - the welcome checkbox
  - the gate
  - the error screen

## Later batches (each gets its own short spec when started)

- **Batch 2: security and stability**
  - 4: admin MFA (TOTP `aal2` in `proxy.ts` and `is_admin`); session settings, which the owner sets in the dashboard
  - 10: per-user AI limit (`evaluate:user:<id>`, about 50/day)
  - 20: the server writes the consolidation verdict; the client grant is dropped
  - 21: JSON size limits
  - 23: anon / `ai_settings` grant revokes
  - 19: OpenAI `max_output_tokens`, no quota spend on failure, response shape check
- **Batch 3: release and environments**
  - 9: Play release (`appVersionSource: remote` + `autoIncrement`, Play SHA-1 OAuth client, `blockedPermissions`, target SDK)
  - 14: OTA updates (`expo-updates`, `runtimeVersion`)
  - 6: staging (needs an owner decision on a second Supabase project vs branching)
  - 5: PITR backups and a tested restore (needs Supabase Pro, an owner purchase)
- **Batch 4: email and launch**
  - 12: Resend SMTP, OTP template, DNS records, email fingerprint normalisation, CAPTCHA
  - 13: launch day — enable sign-ups, remove the Vercel IP rule, remove the demo lesson
- **Batch 5: P1 hardening**
  - 15: security headers, admin noindex / `robots.txt`
  - 16: admin audit log
  - 17: admin management page
  - 18: uptime, `/api/health`, pg_cron failure alerts (Sentry uptime monitors can cover part of it)
  - 22: storage scoping and orphan cleanup
  - 24: web `+html.tsx` with `lang="ro"`, meta / OG, favicon, manifest, self-hosted YouTube iframe
  - 25: incident runbook
  - 26: Renovate / Dependabot, `expo install --fix`, lint for mobile / shared / content
- **P2**: as in the audit, picked up after launch.

Owner-only actions (tracked in STATUS): Play Console company account, Supabase Pro, OpenAI hard limit, legal review of privacy and terms, company contact email, filling in the operator placeholders.
