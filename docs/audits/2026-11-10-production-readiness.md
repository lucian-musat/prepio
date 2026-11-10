# Production readiness audit: admin, web, mobile

Date: 2026-11-10 · Commit: `main` @ `4fd35ba` · Payments are out of scope.
Method: four read-only audits run in parallel (DB/API security, student app, admin, ops) plus local quality gates. Nothing was run against production. The headline findings were spot-checked by hand.

## Verdict

The **code** is in good shape. RLS, the SECURITY DEFINER functions and the API routes are tight, the tests are extensive and all green, and the migrations process is disciplined. What is missing is the **operational layer**: no CI, no error tracking, no staging, no PITR backups, no admin MFA, no error pages, and no OTA updates or Play versioning. Before real (often underage) students arrive, there are also legal gaps: minors' consent and terms of use. No Critical security issue was found.

## Quality gates (local)

| Gate | Result |
|---|---|
| typecheck (4 packages) | ✅ |
| lint (admin only, the only package with a lint script) | ✅ 0 errors, 20 warnings |
| unit tests: shared 362, content 86, admin 417, mobile 961 | ✅ all pass |
| pgTAP `db:test` (637) | ✅ |
| `pnpm audit --prod` | ⚠️ 1 high (zod, via `@expo/cli`, build-only), 4 moderate, 1 low, all transitive |
| `expo install --check` | ⚠️ 7 patch updates behind |
| Playwright e2e | not run |

## P0: launch blockers

| # | Task | Area | Effort |
|---|---|---|---|
| 1 | **CI**: a GitHub Action running typecheck, lint, test and db:test on PRs and `main`, plus branch protection. There is no `.github/` today and Vercel deploys every push without a gate. | ops | S |
| 2 | **Error tracking**: Sentry for Next (admin + API routes, `onRequestError`) and for Expo (source maps from EAS). Today errors only go to `console.*` and the Vercel logs. | all | M |
| 3 | **Error boundaries and error pages**: an `ErrorBoundary` in `apps/mobile/app/_layout.tsx` (any render error white-screens the app today); `error.tsx`, `global-error.tsx`, `not-found.tsx` and `loading.tsx` in admin; `+not-found.tsx` in the student app (unknown URLs show Expo's English "Unmatched route"). | all | S |
| 4 | **Admin MFA and sessions**: require TOTP (`aal2`) in `proxy.ts` and `is_admin`; set a 12+ character password minimum, an inactivity timeout and a session timebox in the cloud dashboard. One stolen password currently exposes every student's data. | admin/sec | M |
| 5 | **Backups**: Supabase Pro with PITR (free plan today: daily dumps only), plus a documented and tested restore. | ops | S + cost |
| 6 | **Staging**: a separate Supabase project (or branching) with Vercel preview deploys pointed at it. Today there is only local and prod. | ops | M |
| 7 | **Minors / GDPR**: an age statement or age gate, parental-consent wording (digital consent age in RO is 16) and the legal basis in the privacy policy; this is also needed for Play's target-audience form. | legal/web | M (+ legal review) |
| 8 | **Terms of use**: a public `/termeni` page, linked from the welcome screen and the profile. Only privacy and account deletion exist today. | web/mobile | S |
| 9 | **Play release**: switch to `appVersionSource: "remote"` with `autoIncrement` in the production profile (otherwise the second upload is rejected); add the Play app-signing SHA-1 as an OAuth client (otherwise Google login fails in the store build); declare `blockedPermissions` and check the target SDK. | mobile | S |
| 10 | **Per-user AI limit**: today only the global cap of 300/day applies, so one student with credits (or several accounts with welcome credits) can block AI grading for everyone. Add `evaluate:user:<id>` at about 50/day. BAC already has a per-user limit. | API | S |
| 11 | **Content deletion wipes progress**: deleting a published lesson or node cascades to all student progress and attempts. Block deleting published lessons (unpublish first) or soft-delete with `archived_at`. | admin/DB | M |
| 12 | **Email/SMTP**: Resend, an OTP template, SPF/DKIM/MX, `EXPO_PUBLIC_AUTH_EMAIL_ENABLED=true`. Today Google is the only login. Before opening email sign-up, also normalise `+tag`/dots in `email_fingerprint` (otherwise unlimited welcome credits) and add a CAPTCHA. | auth | M |
| 13 | **Open the gates**: re-enable sign-ups in Supabase, remove the Vercel IP rule on `prepio-web`, remove the demo lesson (`content:cloud:demo --remove --apply`). | owner | S |

## P1: in the first weeks after launch

| # | Task | Area |
|---|---|---|
| 14 | **OTA updates**: `expo-updates` with `runtimeVersion: appVersion` and EAS Update channels, so JS-only fixes don't need a store release. | mobile |
| 15 | **Security headers**: CSP, `frame-ancestors 'none'` (admin can be clickjacked today), HSTS, `Referrer-Policy`, `nosniff` for admin and student web. Add noindex and `robots.txt` on admin. | sec |
| 16 | **Admin audit log**: an `admin_audit_log` table filled by triggers on content, settings, prices and BAC (who changed what, old/new values). Today only actions on students are logged. Optional: versioning and undo from the same table. | admin/DB |
| 17 | **Admin management**: an owner-only page or script to add and revoke admins. Today admins are granted through migrations with personal emails. | admin |
| 18 | **Monitoring and alerts**: uptime on prepio.ro, admin.prepio.ro and a `/api/health` route; an alert on pg_cron failures (`cron.job_run_details`); a confirmed hard limit and usage alert in the OpenAI dashboard. | ops |
| 19 | **AI cost and hardening**: `max_output_tokens` (2–4k) on every OpenAI call; don't consume the global quota when the AI call fails; shape-check the response in the mobile client. | API |
| 20 | **Students write their own verdict**: the grant on `consolidation_attempts(verdict, feedback)` lets a student forge "correct" results. Have the evaluate route save the attempt with the service role and drop the columns from the client grant. | DB |
| 21 | **Size limits on student JSON**: `save_bac_draft`, `lesson_progress.position`, `consolidation_attempts.answer` (a `pg_column_size` check). | DB |
| 22 | **Storage**: scope the `images` bucket listing to authenticated users; clean up orphans when a lesson, node or card is deleted or an upload is abandoned. | DB/admin |
| 23 | **Defence in depth**: revoke anon default grants on content tables and all grants on `ai_settings`. | DB |
| 24 | **Web basics**: `app/+html.tsx` with `lang="ro"` (it is `en` today), meta/OG, theme-color, favicon and manifest; self-host the YouTube iframe HTML (today it comes from a third party's GitHub Pages). | web |
| 25 | **Incident runbook**: Vercel rollback, DB restore, key rotation, who to contact. | ops |
| 26 | **Dependencies**: Renovate/Dependabot; `npx expo install --fix`; lint for mobile, shared and content. | ops |

## P2: quality and scale (non-blocking)

- Analytics (with a consent banner on web if it sets cookies); offline detection (NetInfo); lazy-load the BAC and consolidation screens (web bundle 1.1 + 1.5 MB); `expo-image` caching; `FlatList` once lists grow.
- Admin: zod on every server action (e.g. bounds on `adjustCreditsAction` and `grantAccessAction`); an atomic `reorder` RPC instead of N updates; pagination for the ledger (capped at 100); more e2e tests (settings, AI templates, delete student); the known UX backlog (login, pending buttons, preview of drafts).
- Periodic cleanup of `rate_limits`; Android App Links for prepio.ro; iOS config and Sign in with Apple when iOS comes.
- Content: owner review of the lessons, templates and BAC barem for historical accuracy (all written by Claude).

## Owner-only actions (no code)

Company + organization Play Console account · Supabase Pro plan · OpenAI hard limit · legal review (privacy, terms, minors) · company contact email instead of the personal gmail · the open APK checks on the phone and the signed-in production checks from `docs/STATUS.md`.

## Already solid (no action needed)

RLS on every table with column-level grants (a student can't change role, credits, access or suspension) · SECURITY DEFINER functions with `search_path` set, revokes and `is_admin()` checks · answer keys hidden from students · API routes: Bearer check, Origin allowlist, generic errors, prompt-injection nonces · no secrets in git or its history · complete account deletion (FK cascades, only HMAC hashes kept), OpenAI `store:false` · PKCE auth, graceful offline · migrations process with pgTAP · student lists and timeline paginated.

**Suggested order:** 1 → 3 → 2 → 4 → 10 → 11 → 9 → 5/6 → 7/8/12 (in parallel with legal) → 13 on launch day. Then P1, starting with 14, 15 and 18.
