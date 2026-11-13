# Deploy runbook

## Services

| Service | Where | URL / id |
| --- | --- | --- |
| Database + Auth + Storage | Supabase (eu-west-2, London) | `https://pienbjvwjgnzmnjzmrbh.supabase.co` |
| Admin + `/api/consolidation/evaluate` | Vercel project `prepio-admin`, root `apps/admin` | `https://admin.prepio.ro` |
| Student web | Vercel project `prepio-web`, root `apps/mobile` | `https://prepio.ro` |
| Android APK | Expo EAS, owner `lucianm91s-team`, slug `prepio` | projectId `706d0198-4bc6-4079-90f5-6a1ffbde3ef3`, package `dev.musat.prepio` |

Both Vercel projects deploy from `main` of the GitHub repo. Config lives in `apps/admin/vercel.json` (region `lhr1`, next to Supabase) and `apps/mobile/vercel.json` (pnpm install from the repo root, `expo export -p web`, SPA rewrite).

## Domain

`prepio.ro` (bought 2026-11-07, third-party registrar) uses the Vercel nameservers `ns1.vercel-dns.com` / `ns2.vercel-dns.com`; the DNS zone lives in Vercel (team `prepio1` → Domains → `prepio.ro`). No email records yet (MX / SPF / DKIM go there when email is set up).

| Host | Vercel project | Behaviour |
| --- | --- | --- |
| `prepio.ro` | `prepio-web` | Production |
| `www.prepio.ro` | `prepio-web` | 308 → `https://prepio.ro` |
| `prepio-web.vercel.app` | `prepio-web` | 308 → `https://prepio.ro` |
| `admin.prepio.ro` | `prepio-admin` | Production |
| `prepio-admin.vercel.app` | `prepio-admin` | 308 → `https://admin.prepio.ro` |

The `*.vercel.app` redirects break APKs built before the domain change: their API calls go to `prepio-admin.vercel.app`, and Android's HTTP client drops the `Authorization` header when following a redirect to another host, so authenticated calls (AI checks, purchases, account deletion) fail with 401. Install an APK built with the current `eas.json`.

Changing the domain again means updating: the Vercel env vars below (then redeploy), the `/preview` CSP in `apps/mobile/vercel.json`, `EXPO_PUBLIC_API_URL` in `apps/mobile/eas.json` (new APK), Supabase Authentication → URL Configuration (Site URL and Redirect URLs), and the Google OAuth web client's JavaScript origins plus the consent screen Branding (homepage, privacy policy, authorised domains), see [auth-setup.md](auth-setup.md).

## Environment variables

Admin (Vercel project `prepio-admin`):

- `NEXT_PUBLIC_SUPABASE_URL` = Supabase URL above
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = publishable key (`sb_publishable_...`, public)
- `SUPABASE_SERVICE_ROLE_KEY` - secret, server only
- `OPENAI_API_KEY` - secret, server only (set a monthly spend limit in the OpenAI dashboard)
- `STUDENT_WEB_ORIGINS` = `https://prepio.ro` (comma-separated CORS allow-list for the student APIs: `/api/consolidation/evaluate`, `/api/account/delete`)
- `NEXT_PUBLIC_STUDENT_WEB_URL` = `https://prepio.ro` (the student web that the card editor embeds as its live preview, `/preview`). Inlined at build time.

Student web (Vercel project `prepio-web`) and the APK (`apps/mobile/eas.json`, profiles `preview` and `production`):

- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL` = `https://admin.prepio.ro`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` = Google OAuth web client id (public). Used by native Google sign-in as `webClientId`; the web flow doesn't need it but it is harmless. Set on Vercel and in `eas.json`.
- `EXPO_PUBLIC_AUTH_EMAIL_ENABLED` = `false` in production (hides the email-code sign-in button until the domain + SMTP exist); `true` locally. Set on Vercel and in `eas.json`.
- `EXPO_PUBLIC_ADMIN_ORIGIN` = `https://admin.prepio.ro` (Vercel `prepio-web` only; the APK has no `/preview`). The only origin whose `postMessage` the `/preview` route accepts. Exact origin: no trailing slash and no path, otherwise the preview silently waits forever.

Provider setup (Google Cloud, Supabase dashboard, rollout checklist): [auth-setup.md](auth-setup.md).

`EXPO_PUBLIC_*` values are inlined at build time, so changing them needs a rebuild/redeploy. For the APK they are committed in `eas.json` (all public values).

## Accounts rollout

Do these in this exact order:

1. List production `auth.users` and get the owner's confirmation: the migration backfill makes every existing user an admin.
2. `pnpm db:cloud:push:dry` → review → `pnpm db:cloud:push` (the `student_accounts` migration).
3. Deploy admin (CORS allowing `Authorization`, admin guard, bearer APIs).
4. Deploy student web. Admin must go first: the old admin's CORS doesn't allow the `Authorization` header, so the new web's authenticated calls (`/api/evaluate`, account deletion) would fail against it.
5. Immediately apply the Supabase dashboard settings from [auth-setup.md](auth-setup.md): **Confirm email ON first**, then sign-ups ON, then the Google provider; run its production checks (admin password login still works, an OTP to an outside address is not delivered).
6. Google consent screen: Branding + Publish to production.
7. Production walk in Chrome (see the verification checklist below).
8. New APK build. After the migration, content is readable only by signed-in users, so the old APK (and the old web build) can no longer read content.

## Typed cards rollout

The card-types change (spec `docs/superpowers/specs/2026-11-03-card-types-design.md`) drops the old `cards.body` / `image_path` / `image_credit` columns. Old builds of the admin, the student web and the APK read those columns, so do these in this exact order, without a pause between steps 3 and 4:

1. Set the two env vars on Vercel **before** pushing: `prepio-admin` → `NEXT_PUBLIC_STUDENT_WEB_URL=https://prepio.ro`; `prepio-web` → `EXPO_PUBLIC_ADMIN_ORIGIN=https://admin.prepio.ro` (no trailing slash). Both are inlined at build time; if they are set after the push, both projects need a redeploy.
2. Optional insurance: export the `cards` table from the Supabase dashboard.
3. `pnpm db:cloud:push:dry` (must list only `20261103122901_card_types`) → `pnpm db:cloud:push`.
4. `git push` immediately: both Vercel projects deploy from `main`. Between steps 3 and 4 the live admin errors (it selects dropped columns) and the live student web shows empty cards.
5. Check the `/preview` CSP header (both forms of the path must carry it):
   `curl -sI https://prepio.ro/preview | grep -i content-security-policy` and the same for `/preview/` → `frame-ancestors 'self' https://admin.prepio.ro http://localhost:3000`.
6. Production walk in Chrome: existing lessons render (converted text and image cards); in the admin, create a `[test]` draft lesson with one card of each type, check the live preview (Telefon / Desktop) against production web, then delete it; console clean.
7. New EAS `preview` APK, **mandatory**: after the migration the installed APK shows empty or placeholder cards. New native modules: `react-native-webview`, `react-native-youtube-iframe`, `expo-web-browser` (config plugin in `app.json`). Run `npx expo install --check` before the build. Then the owner's phone-test list in `docs/STATUS.md`.

## Learning modes rollout

The learning-modes change (spec `docs/superpowers/specs/2026-11-04-learning-modes-design.md`) is additive: migration `20261104131121_learning_modes` adds the nullable `profiles.learning_mode` column and the `lesson_progress` table. Old builds of the student web and the APK don't read them and keep working, just without modes or saved progress. The new student web does read them, so the migration goes first. The admin code is unchanged.

1. **Prerequisite (owner):** delete the production lessons „test” and „test 2” (section A) through the production admin, never by hand in the database. Otherwise guided mode puts them first and locks the real lessons behind them. Check that the student Home then lists only the real lessons.
2. `pnpm db:cloud:push:dry` (must list only `20261104131121_learning_modes`) → `pnpm db:cloud:push`.
3. `git push`: Vercel deploys `prepio-web` (and `prepio-admin`, no code change there) from `main`. Don't push before step 2: the new web selects `profiles.learning_mode` and would fail to load the profile.
4. Production walk in Chrome: an existing account sees „Cum vrei să înveți?” once, then Home with the mode chip; guided Home locks all but the first lesson; open a lesson (start screen), go a few cards in, reload, „Continuă de unde ai rămas” resumes; switch the mode in the profile; console clean. Progress rows created during the walk are the walking account's own progress; never edit `lesson_progress` by hand.
5. New EAS `preview` APK (no new native modules). Old APKs keep working without progress. Then the owner's phone-test list in `docs/STATUS.md`.

## Consolidation rollout

The consolidation change (spec `docs/superpowers/specs/2026-11-05-consolidation-exercises-design.md`) is **not** additive: migration `20261105133808_consolidation` converts the writing exercises into consolidation essays and drops `writing_exercises`, and the new admin no longer has `/api/evaluate`. The live student web and every installed APK embed `writing_exercises` in their lesson query, so **from step 1 on they can no longer open lessons** until the new web is deployed (step 2) and a new APK is installed (step 6). Do the steps in this exact order, with no pause between steps 1 and 2:

1. `pnpm db:cloud:push:dry` (must list only `20261105133808_consolidation`) → `pnpm db:cloud:push`.
2. Immediately `git push` `main`: Vercel deploys `prepio-web` and `prepio-admin`. Wait until both deployments are **Ready**: until then the live web can't load lessons, and the live admin's lesson editor still reads `writing_exercises`. (The `ai_settings.grade_*` columns stay, so the old Settings page keeps working.)
3. Content: `pnpm content:cloud:add-consolidation` (dry run: 10 templates, and for each seed lesson its sources and non-essay exercises; no problems listed), then `pnpm content:cloud:add-consolidation --apply`, then the dry run again: it must plan 0. See "Consolidation content" below.
4. AI settings: `pnpm content:cloud:update-ai-settings` (dry run: shows the current and the new welcome message and AI rules), then `--apply`: replaces both with the grade-free defaults of `packages/content/src/defaults.ts` (model untouched); a re-run plans 0. The migration doesn't touch `settings` / `ai_settings`, so production keeps the old wording until this step. (Done 2026-11-06.)
5. Production checks:
   - anon REST on every new table returns `[]` or 401/42501, never rows: `sources`, `solution_templates`, `consolidation_exercises`, `consolidation_exercise_sources`, `consolidation_ai_context`, `consolidation_attempts`, `consolidation_runs` (e.g. `curl -s "$SUPABASE_URL/rest/v1/consolidation_exercises?select=id" -H "apikey: $ANON"`);
   - a signed-in student can read the published exercises but **not** `consolidation_ai_context` (`[]`);
   - `POST /api/consolidation/evaluate` returns 401 without a token and 403 with a foreign `Origin`:
     `curl -si -X POST https://admin.prepio.ro/api/consolidation/evaluate -H "Content-Type: application/json" -H "Origin: https://prepio.ro" -d '{}'` → 401;
     the same with `-H "Origin: https://evil.example"` → 403;
   - `https://admin.prepio.ro/api/evaluate` returns 404;
   - **one real AI evaluation** from the student web (e.g. an essay requirement or the argument exercise of a seed lesson): 200 with Romanian feedback and no grade (it was never run against OpenAI before the release: no local key);
   - student web `/`, a lesson's start screen with the three zones and `/lesson/<id>/consolidare`, admin `/login` and `/templates` (logged out → redirect to `/login`) load with a clean console.
6. New EAS `preview` APK, **mandatory**: the installed APK can't open lessons after step 1. New font asset (Literata), no new native module. Then the owner's phone-test list in `docs/STATUS.md`.

## AI templates rollout

The AI templates change (spec `docs/superpowers/specs/2026-11-07-ai-templates-design.md`) adds the `ai_templates` and `consolidation_ai_template_links` tables (migration `20261107075311_ai_templates`), new general rules in the AI settings, fact-only contexts on the seed exercises and a template link on every AI exercise. The new admin evaluation reads the template of each exercise, so the content steps go before the push. Do the steps in this exact order:

1. `pnpm db:cloud:push:dry` (must list only `20261107075311_ai_templates`) → `pnpm db:cloud:push`.
2. `pnpm content:cloud:update-ai-settings` (dry run, then `--apply`): replaces the AI rules with the new general-rules defaults; a re-run plans 0.
3. `pnpm content:cloud:ai-templates` (dry run, then `--apply`): inserts the seed AI templates (by title), replaces the AI contexts of the seed exercises with the fact-only ones and links every AI exercise without a template link to the seed template of its type (an existing link is never changed). The dry run lists the templates, contexts and links to write and no problems; a re-run plans 0.
4. `pnpm content:cloud:demo` (dry run, then `--apply`): refreshes the demo lesson, which the previous script doesn't cover.
5. `git push` `main`: Vercel deploys `prepio-web` and `prepio-admin`. Wait until both are **Ready**.
6. New EAS `preview` APK, **needed**: the student UI changes (the „Verifică eseul întreg” button is gone; the essay is checked per requirement with a combined verdict). Until the new APK is installed, an old APK's whole-essay button answers „Cererea nu este validă.” and no credits are charged.
7. AI exercises created or edited in the old admin between the migration push (step 1) and the admin deploy (step 5) have no template link and show „Invalid” in the admin: re-run `pnpm content:cloud:ai-templates` (dry run, then `--apply`) after the deploy.
8. Post-release checks:
   - anon REST on `ai_templates` and `consolidation_ai_template_links` is refused or returns `[]`;
   - admin `/ai-templates` loads with the 5 seed templates and no exercise is marked „Invalid”;
   - one real AI evaluation (an essay requirement and an argument) returns feedback;
   - phone check with the next APK: the essay screen shows per-requirement checks and the combined verdict, and no „Verifică eseul întreg”.

## Credits rollout

The credits change (spec `docs/superpowers/specs/2026-11-06-credits-design.md`) adds migrations `20261106132444_credits` and `20261106133031_welcome_credits` (the welcome-grant pepper is generated inside the migration; no env var or secret to set). The new admin charges credits on `/api/consolidation/evaluate` and adds `POST /api/credits/purchase`; the new student web and APK show the balance and can buy. Purchases are approved instantly with no payment (owner decision, test environment only; gate or pay before a public launch). Order:

1. `pnpm db:cloud:push:dry` (must list only the two credits migrations) → `pnpm db:cloud:push`. Every existing account, admins too, gets the welcome credits (12) once.
2. Push `main` and wait for **prepio-admin** Ready (the charging evaluate route and the purchase route need the new tables from step 1).
3. **prepio-web** Ready (same push): the web shows the chip, the costs and the purchase sheet.
4. New EAS `preview` APK (no new native module). Until it is installed, an old APK gets a 402 on every AI check and has no way to buy credits.
5. Production checks:
   - `select count(*) from auth.users u where (select count(*) from credit_ledger l where l.user_id = u.id and kind = 'welcome') <> 1` returns 0 (Supabase SQL editor, read-only);
   - anon REST on `credit_packages`, `credit_orders`, `credit_ledger`, `credit_settings`, `welcome_grants` returns `[]` or 401/42501;
   - `POST /api/credits/purchase` returns 401 without a token and 403 with a foreign `Origin`;
   - signed in on the student web: the chip shows the balance, a purchase works (balance and „Creditele mele” history), and one real AI check takes the exercise's cost; admin Elevi lists the student with the same balance.
6. After any later `pnpm content:cloud:sync-consolidation`, re-set admin-made `credit_cost` changes: the sync replaces the exercises with the seed defaults.

## Paid access rollout

The paid access change (spec `docs/superpowers/specs/2026-11-08-paid-access-design.md`) adds migration `20261108091845_paid_access` (access offer, orders, ledger, restrictive RLS on the content tables, and the pg_cron job `log-access-expiries`). Order:

1. Check that `pg_cron` is available on the cloud project: `select * from pg_available_extensions where name = 'pg_cron'`, or enable it in the Supabase dashboard (Database → Extensions). The dry run does NOT execute SQL, so it can't prove this.
2. `pnpm db:cloud:push:dry` (must list only `20261108091845_paid_access`) → `pnpm db:cloud:push`.
3. Verify: `select jobname, schedule from cron.job` shows `log-access-expiries`; some minutes later `select status from cron.job_run_details order by start_time desc limit 5` shows a succeeded run.
4. Only then deploy admin and student web (push `main`, wait for Ready). The web client selects `profiles.access_until` and evaluate calls `can_open_lesson_for`: deploying before the push breaks sign-in and checks.
5. New EAS `preview` APK. Old APKs show locked lessons as empty screens (they can't read the content) and have no way to buy.
6. Every existing account starts in trial (production is test-only). Checks: anon REST on `access_ledger` / `access_orders` returns `[]` or 401/42501; `POST /api/access/purchase` returns 401 without a token; a trial student sees one open lesson and the sheet on the others; after one purchase the pill shows the plan and the credits grew by the bonus.

## BAC subjects rollout

The BAC subjects change (spec `docs/superpowers/specs/2026-11-09-bac-subjects-design.md`) adds migration `20261109102217_bac_subjects`: the tables `bac_subjects`, `bac_sources`, `bac_items`, `bac_item_sources`, `bac_item_barem` (admin-only) and `bac_attempts` with their RLS (sources / items / links need full access), the `save_bac_draft` RPC, the grading helpers, the new `student_events` kinds, `ai_settings.bac_rules` (default `''`) and the pg_cron job `fail-stale-bac-grading` (every 5 min: an attempt in `grading` for more than 5 minutes is refunded and set to `failed`), plus migration `20261109130548_bac_charge_attempt`: the service-role RPC `bac_charge_attempt` that charges a paper and stores the ledger entry on its `grading` attempt in one transaction (the submit route calls it, so the admin must not deploy before it exists). The admin gets „Subiecte BAC” (`/bac`), the student page tab, „Reguli de notare BAC” in Setări and `POST /api/bac/submit` (OpenAI, same `OPENAI_API_KEY`; no new env var). The student web and APK get the Home card, `/bac`, the paper and the result. No new native module. Order:

1. `pnpm db:cloud:push:dry` (must list only `20261109102217_bac_subjects` and `20261109130548_bac_charge_attempt`) → `pnpm db:cloud:push`. **Before any deploy:** the new admin and web read the new tables.
2. Verify the cron job: `select jobname, schedule, active from cron.job where jobname = 'fail-stale-bac-grading'` shows `*/5 * * * *` and `active = true`; some minutes later `select status from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'fail-stale-bac-grading') order by start_time desc limit 3` shows succeeded runs.
3. Push `main` and wait for **prepio-admin** and **prepio-web** Ready.
4. „Reguli de notare BAC” and the demo subject: `pnpm content:cloud:bac-subjects` (dry run: lists the seed BAC subjects missing by title and whether the rules are empty), then `--apply`: inserts the missing ones (the demo „Istorie 2026 · Varianta 3”, published; an existing subject is never changed) and writes `DEFAULT_BAC_RULES` only while the rules are empty; a re-run plans 0. After the migration the rules are **empty** in production: grade no real paper before this step (or before setting them in admin → Setări). Delete the demo subject in admin if it isn't wanted.
5. Further subjects: enter them in admin → „Subiecte BAC” (publishing needs exactly 90 points and every item valid). `pnpm seed` (see "Schema and content") also adds missing seed BAC subjects and fills empty rules, but prefer the script above for production.
6. New EAS `preview` APK (JS-only change). An old APK has no „Subiecte BAC” entry and otherwise works.
7. Checks:
   - anon REST on `bac_subjects`, `bac_sources`, `bac_items`, `bac_item_barem`, `bac_attempts` returns `[]` or 401/42501, never rows; `POST /api/bac/submit` returns 401 without a token;
   - a trial student sees the list with 🔒 and the paywall sheet, and reads no items / sources through REST;
   - **one real graded paper by the owner** (full access, enough credits): fill a few items and the essay, submit; expect „Corectăm lucrarea…”, then the grade with „Notă orientativă — poate diferi de corectarea unui profesor.” and short feedback lines; the credits drop by the subject's cost once; admin → Elevi → the student → „Subiecte BAC” lists the attempt and „Credite” shows „Corectare subiect · <titlu>”. If grading fails, the student sees the refund message and the prepio-admin Vercel logs show why (a paper is about 10 parallel OpenAI calls of up to 40 s each, inside the 60 s route budget).

## Student administration rollout

The student administration change (spec `docs/superpowers/specs/2026-11-06-student-administration-design.md`) adds four migrations:

- `20261106193652_student_events`: the timeline table and triggers, `log_app_open`, `log_test_failed`, and the backfill from the existing data;
- `20261106194440_student_suspension`: suspension on `profiles`, `is_suspended()` in the student RLS, `blocked_emails`, and `handle_new_user()` creating blocked emails suspended;
- `20261106195014_student_admin`: the admin progress / reset / list / timeline functions, and the suspended-edit guard;
- `20261106200001_student_event_service`: `check_blocked` from the evaluate route, and „Activi azi” counting only the student's own events.

The block fingerprint reuses the welcome-grant pepper, so there is no env var or secret to set. The new admin reads `profiles.suspended_at` and calls the new functions, and the evaluate, purchase and account-delete routes check the suspension. The new student web and APK show the suspended screen and send the app-opened and test-failed events. Order:

1. `pnpm db:cloud:push:dry` (must list only the four migrations above) → `pnpm db:cloud:push`. **Before any admin deploy:** an admin built from this `main` against the old schema breaks Elevi and the student API routes. The backfill gives every existing account one `registered` event and replays the finished lessons, the finished consolidations and the credit ledger. It runs once inside the migration; never re-run it by hand (it is not idempotent against events logged by the triggers).
2. Push `main` and wait for **prepio-admin** Ready.
3. **prepio-web** Ready (same push). Note the Vercel Firewall rule on `prepio-web` (owner IP only, see `docs/STATUS.md`): the web checks only work from that IP. The rule was removed on 2026-11-10.
4. New EAS `preview` APK (no new native module). An old APK has no suspended screen: for a suspended student it shows empty lessons and refused checks. It still works normally for everyone else. Old APKs are ignored (owner).
5. Production checks (read-only):
   - anon REST on `student_events` and `blocked_emails` returns 401/42501 (or `[]`), never rows:
     `curl -s "$SUPABASE_URL/rest/v1/student_events?select=id" -H "apikey: $ANON"` and the same for `blocked_emails`;
   - `select count(*) from auth.users u where (select count(*) from public.student_events e where e.user_id = u.id and e.kind = 'registered') <> 1` returns 0 (Supabase SQL editor, read-only);
   - `select kind, count(*) from public.student_events group by kind` shows the backfilled kinds (`registered`, `welcome_credits`, `lesson_finished`, `consolidation_finished`, `check`, `purchase`, …) and nothing unexpected;
   - `select count(*) from public.profiles where suspended_at is not null` returns 0 and `select count(*) from public.blocked_emails` returns 0 right after the push;
   - `POST /api/credits/purchase` and `/api/consolidation/evaluate` still return 401 without a token; admin `/students` logged out → `/login`;
   - signed in as admin: Elevi shows the „Stare” / „Ultima activitate” columns and the filter chips; a student page shows Parcurs and the backfilled Cronologie;
   - the owner's phone checks (STATUS "Test student administration on the phone").

## Referrals rollout

Spec `docs/superpowers/specs/2026-11-12-referrals-design.md`. Everything ships dark: `referrals_enabled` defaults to off, so pushing the migrations changes nothing for students.

1. `pnpm db:cloud:push:dry`, then `pnpm db:cloud:push` (the referral migrations up to `20261112121359_referral_bonus_and_followups`; the flag stays off). Safe before the code: the old admin and web simply don't call the new functions. The last one changes the return shape of `my_referral_summary`, `referral_public_settings` and `admin_credit_ledger` by adding columns only (clients read by name), and `purchase_access` keeps its signature.
2. Merge the PR, which deploys admin and web through Vercel (the settings card and the student page tab appear; the student screens stay hidden while the flag is off).
3. Build and ship an APK from this branch. Old APKs render new referral rows wrongly: `AccessScreen.historyLabel` labels unknown access kinds „Acces retras”, and the old `credits.ts` has no label for the `referral` ledger kind.
4. Only then switch `referrals_enabled` on in admin Settings → Recomandări.

Keep it off until:
- real payments exist (purchases are simulated, `provider='none'`, so a „paying” invitee costs nothing);
- the explainer copy and the Terms/Privacy sentences have the owner's (and the lawyer's) review.

The free access earned through referrals includes the access bonus credits (`access_settings.bonus_credits` at grant time, owner decision 2026-11-12). After switching the flag on, check once: an inviter who reaches the threshold gets the access and a „Credite incluse în accesul gratuit din recomandări” row of that size in the credit history. A referral-step error never rolls back a purchase; it shows as a `purchase_access: referral step skipped` warning in the database logs (STATUS backlog has what to do then).

## Daily streak rollout

Spec `docs/superpowers/specs/2026-11-13-daily-streak-design.md`.

1. `pnpm db:cloud:push:dry` must list only the `*_daily_streak` migration, then `pnpm db:cloud:push`. Safe before the code: it only adds a table and two RPCs.
2. Merge the PR, which deploys admin and web through Vercel. Web shows the „🔥 n” pill right away; the old APK keeps working without it.
3. Build and ship a new APK. It is mandatory for the reminders: `expo-notifications` is a new native module. A JS update on an old APK would hide the „Memento zilnic” settings (the module is missing), not crash.

## Editable UI texts rollout

Spec `docs/superpowers/specs/2026-11-13-editable-ui-texts-design.md`, how-to `docs/ui-texts.md`.

1. Foundation PR: push the `*_ui_texts` migration **before** merging: `pnpm db:cloud:push:dry` (must list only it) → `pnpm db:cloud:push`. The new web reads `ui_texts` at start-up, so the table must exist first. Safe before the code: it only adds a table and carries the old welcome message over.
2. Merge the PR (Vercel deploys admin and web). A new APK is needed for the texts to apply on the phone; an old APK keeps its built-in texts.
3. Later batch PRs (moving more screens into the catalog) need no migration: just merge.
4. After the next APK is in use, drop `settings.welcome_message` (see the STATUS backlog).

## Local APK builds

EAS cloud builds are limited on the Free plan (the Android quota ran out on 2026-11-10, resets on the 1st). `eas build --local` builds on this machine with no quota and the same signing keystore (downloaded from the EAS credentials; the CLI must be logged in as `lucian.m91`).

- One-time setup in WSL, no sudo (done 2026-11-10): Temurin JDK 17 in `~/.local/jdk-17` (`https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse`), Android command-line tools in `~/Android/Sdk/cmdline-tools/latest` (`commandlinetools-linux-11076708_latest.zip` from `dl.google.com/android/repository`), then `sdkmanager --sdk_root=$HOME/Android/Sdk --licenses` and `--install platform-tools`. Gradle downloads the platform, build-tools and NDK it needs on the first build.
- Build: `bash scripts/build-apk-local.sh` (profile `preview` → APK; `production` → AAB). The artifact lands in `~/prepio-builds/prepio-<profile>-<date>-<sha>.<ext>`; copy it to Windows (e.g. `cp ~/prepio-builds/<file> /mnt/c/Users/lucia/Downloads/`) to install or share it. A local build has no expo.dev install page.
- Machine resources (2026-11-12): WSL gets 20 GB RAM, 16 processors and 8 GB swap via `C:\Users\lucia\.wslconfig` (`[wsl2]` `memory=20GB`, `processors=16`, `swap=8GB`; `[experimental]` `autoMemoryReclaim=gradual`; apply with `wsl --shutdown`). Gradle settings live in `~/.gradle/gradle.properties` in WSL, outside the repo, and the script does not override them:

  ```properties
  org.gradle.jvmargs=-Xmx6g -XX:MaxMetaspaceSize=1g
  org.gradle.parallel=true
  org.gradle.caching=true
  org.gradle.workers.max=12
  ```

  On a smaller machine lower the heap and workers there (e.g. `-Xmx3g`, `workers.max=2`). The first build takes long (downloads); later ones reuse the Gradle cache.

## Schema and content

- Schema: migrations in `supabase/migrations/`, applied with `pnpm db:cloud:push` — full workflow, credentials setup and the one-time history repair in [database-migrations.md](database-migrations.md).
  The initial deploy (2026-10-31) applied migrations `20261030000001`–`20261030000004` and the seed content through the SQL editor.
- Content: `pnpm seed` against the cloud project. Pass credentials inline, never through a `.env` file:

  ```bash
  SUPABASE_URL=https://pienbjvwjgnzmnjzmrbh.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=<secret> \
  ADMIN_EMAIL=<admin email> ADMIN_PASSWORD=<admin password> \
  pnpm seed
  ```

  `SEED_RESET` semantics: by default the seed only inserts lessons when none exist; otherwise it leaves content untouched (images, settings and the admin user are still ensured). `SEED_RESET=1` (or `--reset`) replaces ALL content, including lessons written in the admin. Do not use it on production after real editing has started.

## Adding content to production

Seed cards written after the first production seed live in `packages/content/src/extraCards.ts` (the seed lessons append them, so a fresh local seed has them too). To add them to the existing production lessons without touching anything else (prerequisite: the migrations the cards need are pushed and admin/web are deployed; always run the dry run first and check that only the expected lessons and cards are listed):

```bash
pnpm content:cloud:add-cards           # dry run: prints, per lesson, the cards to add / already present and images to upload
pnpm content:cloud:add-cards --apply   # inserts the missing cards at the end of each lesson
```

`scripts/content-cloud.sh` uses the same credentials file as `db:cloud` (only `SUPABASE_ACCESS_TOKEN` is needed), fetches the project's service key with `supabase projects api-keys --reveal` (a new `secret` key, or the legacy `service_role` one) and passes it to `packages/content/src/addCards.ts` through the environment only; nothing secret is printed or passed as an argument. The script finds each lesson by its exact seed title (renamed or duplicated lessons are reported and skipped, exit code 1), skips a card when the lesson already has one with the same type and title (re-running is safe), uploads missing images under `images/seed/` without overwriting, and never edits or deletes existing cards. Locally the same script runs with `pnpm --filter @prepio/content add-cards [--apply]` against the `.env` Supabase.

### Consolidation content

The consolidation migration only converts the old writing exercises into essays. The seed solution templates (`packages/content/src/templates.ts`) and each seed lesson's sources and other consolidation exercises are added with (prerequisite: the consolidation migration is pushed and admin/web are deployed; dry run first):

```bash
pnpm content:cloud:add-consolidation           # dry run: lists the templates, sources and exercises to add, and the lessons skipped
pnpm content:cloud:add-consolidation --apply   # inserts them
```

It uses the same credentials path as `add-cards` (`packages/content/src/addConsolidation.ts`). Templates are matched by title and only the missing ones are inserted. A seed lesson is matched by its exact title among the published lessons (not found or duplicated: reported, exit code 1). It gets its sources and its non-essay seed exercises (with source links, templates and AI contexts), after the existing essays, only while it has no consolidation exercise other than an essay; so re-running plans nothing, and a lesson the owner has already started in the admin is left alone. Nothing existing is edited or deleted. Locally: `pnpm --filter @prepio/content add-consolidation [--apply]`.

Because `add-consolidation` never touches a lesson that already has exercises, later changes to the seed consolidation sets (for example every lesson getting all ten types and a four-requirement essay instead of the two converted one-requirement essays, 2026-11-06) are brought to production with (prerequisite: admin/web deployed with any code the new content needs; dry run first):

```bash
pnpm content:cloud:sync-consolidation           # dry run: per lesson, the current and the new sources / exercises by type, and the student attempts and runs it would remove
pnpm content:cloud:sync-consolidation --apply   # replaces them
```

`packages/content/src/syncConsolidation.ts` matches each seed lesson to exactly one published lesson by title (otherwise: reported, skipped, exit code 1). A lesson whose exercises (type and prompt, in order) and sources (title and body) already equal the seed's is reported as in sync; every other one gets its whole consolidation set **replaced** by the seed's: the seed set is inserted first (a failed insert is rolled back, leaving the old set as it was), then the lesson's consolidation runs, the old exercises (with every student's attempts on them, their AI contexts and source links) and the old sources are deleted, and the new rows are renumbered. So anything edited in the admin's Consolidare tab of a seed lesson is overwritten: check the dry run. Every seed exercise is validated before anything is written. Missing seed templates are inserted; existing templates are never changed (those that differ from the seed are listed, to edit in the admin if wanted). The demo lesson is not included: refresh it with `pnpm content:cloud:demo --apply`. A re-run after `--apply` plans 0. Locally: `pnpm --filter @prepio/content sync-consolidation [--apply]`.

## Demo lesson (testing, pre-launch only)

`packages/content/src/demoLesson.ts` defines „[demo] Toate funcționalitățile” in its own root node „Demo”: one card of every type (both image layouts, every rich-text block), three single-choice questions whose first option is always correct, and two short sources with one consolidation exercise of every type, in the BAC order (the essay has two requirements; the seed templates they use are added if missing). The node is placed before every other root node, so the demo is the first lesson (open in guided mode). When a new lesson feature is added, add it to the demo lesson and re-run the script.

```bash
pnpm content:cloud:demo                    # dry run: create or refresh?
pnpm content:cloud:demo --apply            # creates it, or replaces its cards/questions/consolidation in place (same lesson id) and resets everyone's progress in it
pnpm content:cloud:demo --remove --apply   # deletes the demo node and lesson (do this before real students use the app)
pnpm content:demo --apply                  # the same against the local .env Supabase
```

## Auth settings (Supabase dashboard)

- Anonymous sign-ins: OFF. Sign-up and provider settings for student accounts: see [auth-setup.md](auth-setup.md). The Email provider stays ON (admin password login) with Confirm email ON; there is no email-only sign-up switch.
- The admin user is created manually in Authentication > Users with "Auto Confirm User" checked.

## Android APK

Config: `apps/mobile/eas.json` (`preview`: internal distribution, APK; `production`: app bundle). `appVersionSource` is `local` so no EAS login is needed to read the config; bump `version` in `app.json` when needed.

- From the expo.dev dashboard: project `prepio` > Builds > connect GitHub, build Android with profile `preview`.
- Or from the CLI: `cd apps/mobile && eas login && pnpm dlx eas-cli build -p android --profile preview`.

Share the internal-distribution install link from the build page; the phone must allow installing from unknown sources. Unauthenticated access to internal builds is enabled in the Expo project settings, so testers don't need an Expo account. Builds expire after 14 days on the free plan; run a new `preview` build to refresh. The Android upload keystore was generated by EAS on the first CLI build and is stored in EAS credentials (`dev.musat.prepio`).

## CI

`.github/workflows/ci.yml` runs on every pull request to `main` and on every push to `main` (superseded runs on the same ref are cancelled). One job, `ci`: install (`pnpm install --frozen-lockfile`), `pnpm typecheck`, admin lint, `pnpm test`, then a local Supabase stack in the runner (`supabase start`, without studio / imgproxy / vector / logflare / edge-runtime), `pnpm db:reset`, `pnpm seed`, `pnpm db:test`, and the admin and content `test:int` suites. Playwright e2e is not part of CI.

- There is no branch protection, by owner decision: the rule "never merge on red or pending CI" is followed by the agent (CLAUDE.md "Branches and PRs"), not enforced by GitHub.
- The repository is public, so Actions minutes are free. The workflow holds no secrets: the local stack's keys are derived at runtime from `supabase status`.

## Error tracking (Sentry)

Sentry org `sc-expertpower-webluc-srl`, EU region (`https://de.sentry.io`). There are two projects:

- `prepio-admin` covers the admin pages, server actions and the student API routes.
- `prepio-mobile` covers the APK and the student web.

The SDK only starts when its DSN env var is set, so local dev, tests and CI send nothing. Source maps upload only when `SENTRY_AUTH_TOKEN` is present. A failed upload only warns; it never fails the build.

| Where | Variables |
|---|---|
| Vercel `prepio-admin` (Production, Preview) | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` (secret, set by the owner) |
| Vercel `prepio-web` | `EXPO_PUBLIC_SENTRY_DSN` (Production, Preview), `EXPO_PUBLIC_SENTRY_ENV` (`production` / `preview`), `SENTRY_AUTH_TOKEN` (secret, set by the owner) |
| EAS (`apps/mobile/eas.json` + EAS env) | `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_SENTRY_ENV`, `SENTRY_ALLOW_FAILURE` in `eas.json`; `SENTRY_AUTH_TOKEN` as an EAS secret |
| Local APK builds | no token: `scripts/build-apk-local.sh` sets `SENTRY_DISABLE_AUTO_UPLOAD`, so those builds keep minified stack traces |

The student web build is `apps/mobile/scripts/build-web.sh`. It runs `expo export` with source maps, uploads them, then deletes the `.map` files from `dist`, so the site never serves them. The release is `prepio-web@<git sha>`.

**Privacy.** `packages/shared/src/sentryScrub.ts` runs as `beforeSend`, `beforeSendTransaction`, `beforeSendSpan` and `beforeBreadcrumb` in both SDKs. It removes:

- the user, except the Supabase id
- request bodies and cookies
- the `Authorization`, cookie and IP headers
- emails
- auth tokens and search terms in URLs
- console breadcrumb text after the first `:`

The handled failure paths in the API (OpenAI, refunds, ledger, purchases) report a synthetic `route:stage` error, never the original message. Trace headers are never sent (`tracePropagationTargets: []`). No replay.

## Terms version bump

Whenever the terms of use change:

1. Bump both together, in one PR:
   - `TERMS_VERSION` (and `TERMS_DATE`) in `apps/mobile/src/lib/legal.ts`
   - `current_terms_version()` in a new migration (`pnpm db:new`, `create or replace function`; never edit an applied one)
2. Ship a new APK first, before pushing the migration and deploying the web.
3. Then, right after, run `pnpm db:cloud:push` and merge, which deploys the web. Keep the gap short.

`accept_terms` refuses any version other than the database's (`terms_version_mismatch`). In that case the gate asks the student to update the app or reload the page:
- a client still on the old version after the push
- the new APK before the push

Every existing student sees the terms gate once (their `terms_version` no longer matches) and accepts the new terms there.

## Redeploy

- Admin / student web: push to `main` (Vercel auto-deploys), or "Redeploy" in the Vercel dashboard after changing env vars.
- APK: run a new `preview` build as above.
- Schema change: see [database-migrations.md](database-migrations.md) (`pnpm db:new`, test locally, `pnpm db:cloud:push`).

## Verification checklist

1. A raw-API password sign-up for an outside address issues no session (Confirm email ON; with the default SMTP the confirmation mail can't be sent, expect an error such as `email_address_not_authorized`, never an `access_token`):
   `curl -s -X POST "$SUPABASE_URL/auth/v1/signup" -H "apikey: $ANON" -H "Content-Type: application/json" -d '{"email":"x@example.com","password":"password123"}'`
2. Anonymous cannot read `ai_settings` (empty array or 401/403, never rows):
   `curl -s "$SUPABASE_URL/rest/v1/ai_settings?select=*" -H "apikey: $ANON"`
3. Anonymous sees no lessons since the `student_accounts` migration (expect `[]`): `curl -s "$SUPABASE_URL/rest/v1/lessons?select=id" -H "apikey: $ANON"`.
4. Evaluate CORS preflight from the student origin returns `Access-Control-Allow-Origin` and allows `Authorization`:
   `curl -si -X OPTIONS https://admin.prepio.ro/api/consolidation/evaluate -H "Origin: https://prepio.ro" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: authorization,content-type"`
5. Admin login works on `https://admin.prepio.ro`; student web loads lessons and an AI consolidation exercise (an essay requirement, a viewpoint, an argument…) returns an evaluation.
6. The card preview may only be framed by the admin: `curl -sI https://prepio.ro/preview` and `curl -sI https://prepio.ro/preview/` both return `Content-Security-Policy: frame-ancestors 'self' https://admin.prepio.ro http://localhost:3000`; the admin card editor shows the live preview (not "previzualizarea nu este disponibilă").
