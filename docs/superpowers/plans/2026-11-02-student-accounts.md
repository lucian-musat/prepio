# Student Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Students must sign in (Google now; email code built but hidden in prod) before using the web/Android app; admins are explicitly separated from students; AI evaluation and account deletion are tied to the signed-in user.

**Architecture:** Supabase Auth for students and admins; an `admins` table + `is_admin()` drives every write policy, students read published content only, anon reads nothing. The Expo app gets a persisted session, an `AuthProvider` and `Stack.Protected` route groups; Google uses OAuth redirect on web and native Google Sign-In + `signInWithIdToken` on Android. The admin app hosts the bearer-token APIs (`/api/evaluate`, `/api/account/delete`).

**Tech Stack:** Supabase (Postgres, RLS, pgTAP, Auth), Next.js 16 admin (`proxy.ts`), Expo SDK 58 / expo-router / react-native-web, Jest + RTL, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-02-student-accounts-design.md` (read it with this plan).

## Global Constraints

- All UI copy in Romanian with correct ș/ț (comma-below); code, comments, docs in English.
- Student UI uses the own UI kit `apps/mobile/src/ui/` and tokens from `@prepio/shared` (design system "Mentă Prietenoasă", `docs/design-system.md`); no browser `alert/confirm`.
- DB changes only via a new migration (`pnpm db:new student_accounts`), pgTAP for every policy, `pnpm db:reset && pnpm seed && pnpm db:test`; never edit applied migrations; production only via `pnpm db:cloud:push:dry` → `pnpm db:cloud:push`.
- Never commit/print secrets. Google client secret only in Supabase dashboard and local `.env` (gitignored).
- Contact email: `lucian.m91@gmail.com` in one constant.
- Env vars (new): mobile `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_AUTH_EMAIL_ENABLED` (`"true"` to show email; anything else hides it); Supabase local `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`.
- Run commands through WSL with nvm: `wsl -d Ubuntu-22.04 -- bash -ic "cd ~/projects/prepio_new && <cmd>"`.
- **Model tier per task** (owner's token-economy request) is given in each task title: **[Opus]** = run on the strong model, **[Sonnet]** / **[Haiku]** = dispatch the implementer subagent with that model. Reviews of Opus tasks use Opus; reviews of Sonnet/Haiku tasks use Sonnet.

## Review Focus

1. A student session (valid JWT, not in `admins`) calling admin server actions / PostgREST writes directly → must be denied by RLS, not only by the proxy. Test in Task 1 (pgTAP as a non-admin `authenticated` user) and Task 3 (admin login with a student account refused).
2. Expired/refreshed access token on a long-open app (web tab or Android app resumed after an hour) → requests still succeed (auto-refresh; evaluate uses the *current* session token). Test in Task 5 (`getAccessToken` reads `supabase.auth.getSession()` at call time) and Task 6 (AppState start/stop refresh).
3. A deleted account still holding a session on another device → next request fails cleanly and the app returns to the welcome screen instead of an endless spinner. Test in Task 5 (auth listener `SIGNED_OUT` / `getUser` error → signed-out state).
4. Google sign-in cancelled by the user (closes picker / back on OAuth page) → back on the welcome screen with no error banner. Test in Task 7.
5. Name input of only spaces or > 60 chars → rejected client-side with a Romanian message and by the DB check. Test in Task 1 (pgTAP) and Task 8.

---

### Task 1 [Opus]: Admins, profiles and the policy rewrite

**Files:**
- Create: `supabase/migrations/<timestamp>_student_accounts.sql` (via `pnpm db:new student_accounts`)
- Create: `supabase/tests/accounts.test.sql`
- Modify: `supabase/tests/rls.test.sql`, `supabase/tests/storage.test.sql` (anon now sees nothing; authenticated non-admin = student)
- Modify: `packages/content/src/seed.ts` (`ensureAdmin` also upserts into `admins`), `packages/content/src/seed.int.test.ts`
- Modify: admin int-test fixtures that create/sign in users (`apps/admin/src/lib/data/{tree,settings,lesson}.int.test.ts`, `apps/admin/e2e/lesson-editor.spec.ts`) so their users are inserted into `admins`

**Interfaces:**
- Produces: table `public.admins(user_id uuid pk → auth.users on delete cascade)`; `public.is_admin() returns boolean` (security definer, stable, `set search_path = ''`, execute granted to `authenticated` only); table `public.profiles(id uuid pk → auth.users on delete cascade, display_name text null check (display_name is null or char_length(btrim(display_name)) between 1 and 60), created_at timestamptz default now(), updated_at timestamptz default now())`; trigger `on_auth_user_created` on `auth.users` after insert → `public.handle_new_user()` inserting a profile with `display_name = nullif(btrim(coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name')), '')` (truncate to 60).

- [ ] **Step 1: Write `supabase/tests/accounts.test.sql`** (fixtures as postgres; create one student and one admin in `auth.users`, admin also in `admins`; use `set local role authenticated` + `set local request.jwt.claims` to impersonate). Assertions:
  - anon: `count(*)` = 0 on `nodes`, `lessons`, `cards`, `questions`, `writing_exercises`, `settings` (fixture ids).
  - student: sees only the published fixture lesson and its card/question/exercise; sees fixture nodes and `settings` row 1; `ai_settings` returns 0 rows; `admins` returns 0 rows; insert into `lessons` throws `42501`; update of `settings` affects 0 rows; `is_admin()` = false.
  - admin: `is_admin()` = true; can insert/update/delete a lesson; reads `ai_settings`.
  - profiles: inserting into `auth.users` with `raw_user_meta_data = '{"full_name":"Ana Pop"}'` creates profile with `display_name = 'Ana Pop'`; without metadata → `display_name is null`; student reads/updates own row, cannot see the admin's row; update to `'   '` and to a 61-char string throws `23514`; student cannot insert or delete profiles.
  - deleting the student from `auth.users` removes the profile (cascade).
  - storage: student insert into `storage.objects` bucket `images` throws `42501`; admin insert succeeds.
- [ ] **Step 2: Update `rls.test.sql` / `storage.test.sql`** — replace the "anon sees …" expectations with the new anon = nothing rule and turn the old "authenticated can write" cases into admin cases (admin fixture in `admins`). Keep the `plan(n)` counts right.
- [ ] **Step 3: Run** `pnpm db:reset && pnpm db:test` → Expected: new/changed tests FAIL.
- [ ] **Step 4: Write the migration**: create `admins` (RLS on, no policies, revoke all from anon/authenticated), `is_admin()`, `profiles` (+ RLS: `profiles_own_select` / `profiles_own_update` for `authenticated` with `id = auth.uid()`; `updated_at` maintained by a before-update trigger), `handle_new_user` (security definer, `set search_path = ''`) + trigger; backfill `insert into public.admins select id from auth.users on conflict do nothing`; drop `*_anon_select` and `*_auth_all` policies; for each content table create `<table>_admin_all` (`for all to authenticated using (public.is_admin()) with check (public.is_admin())`) and `<table>_student_select` (`for select to authenticated` with the same visibility rules the dropped anon policies used — copy them from `20261030000002_rls.sql`); `settings` student select `using (true)`; `ai_settings` admin only; storage `images_auth_insert/update/delete` recreated with `public.is_admin()` added; `images_public_select` unchanged.
- [ ] **Step 5: Seed** — `ensureAdmin` inserts the user id into `public.admins` (upsert). Add an int-test assertion that the seeded admin is in `admins`; fix the admin int/e2e fixtures to add their users to `admins`.
- [ ] **Step 6: Run** `pnpm db:reset && pnpm seed && pnpm db:test` and `pnpm --filter @prepio/content test` and the admin int tests → Expected: all PASS.
- [ ] **Step 7: Commit** `feat(db): admins, profiles and student/admin RLS split`

### Task 2 [Sonnet]: Local Supabase auth config

**Files:**
- Modify: `supabase/config.toml` (`[auth]`, `[auth.email]`, `[auth.external.google]`)
- Create: `supabase/templates/otp.html` (Romanian email with `{{ .Token }}`, no link)
- Modify: `supabase/.env.example` (create if missing) / root `README.md` env section

**Interfaces:** Produces local auth that Tasks 5–9 use: OTP code emails in the local mail inbox; Google provider reading `env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)` / `env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)`; `skip_nonce_check = true` (native Google Sign-In free tier sends no nonce).

- [ ] **Step 1:** Set `enable_signup = true`; `site_url = "http://localhost:8081"`; `additional_redirect_urls` add `http://localhost:8081/**`; `[auth.email] enable_signup = true`, `enable_confirmations = true`, `otp_length = 6`, `otp_expiry = 600`; `[auth.email.template.magic_link]` and `[auth.email.template.confirmation]` → `content_path = "./supabase/templates/otp.html"`, subject `"Codul tău Prepio"`; `[auth.external.google] enabled = true`, `client_id`/`secret` from env, `skip_nonce_check = true`, `redirect_uri = ""`.
- [ ] **Step 2:** Document the two env vars in `.env.example` + README (values never committed).
- [ ] **Step 3: Verify** `pnpm db:stop && pnpm db:start` succeeds with the env vars set to dummy values, and a `curl -X POST http://127.0.0.1:54321/auth/v1/otp -d '{"email":"[test]a@prepio.local"}'` (anon key header) delivers a mail with a 6-digit code in the local inbox (Mailpit, `http://127.0.0.1:54324`).
- [ ] **Step 4: Commit** `chore(supabase): local auth config for students (OTP, Google)`

### Task 3 [Opus]: Admin panel refuses non-admins

**Files:**
- Modify: `apps/admin/src/proxy.ts`, `apps/admin/src/proxy.test.ts`
- Modify: `apps/admin/src/app/login/actions.ts`, `apps/admin/src/app/login/page.tsx` (show `?error=not_admin`)
- Modify: `apps/admin/e2e/auth.spec.ts`

**Interfaces:** Consumes `is_admin()` (Task 1). Produces the message `NOT_ADMIN_MESSAGE = 'Contul nu are acces de administrator.'`.

- [ ] **Step 1: Tests first:** `proxy.test.ts` — signed-in user with `rpc('is_admin')` → `false` on `/` is redirected to `/login?error=not_admin` and `signOut` is called; admin passes; `/api/*` stays public. `auth.spec.ts` — a `[test]` student created via service role (not in `admins`) logging in sees `Contul nu are acces de administrator.` and stays on `/login`; the test deletes the user afterwards.
- [ ] **Step 2: Run** `pnpm --filter @prepio/admin test` and `pnpm --filter @prepio/admin e2e -- auth` → FAIL.
- [ ] **Step 3: Implement:** in `login` after a successful `signInWithPassword`, `supabase.rpc('is_admin')`; on `false`/error → `signOut()` and return `{ error: NOT_ADMIN_MESSAGE }`. In `proxy` for non-public paths with a user, same RPC; non-admin → `signOut()` then redirect carrying the cleared cookies.
- [ ] **Step 4: Run** both again → PASS. **Step 5: Commit** `feat(admin): only admins can use the admin panel`

### Task 4 [Opus]: Bearer-token APIs — evaluate per user, account delete

**Files:**
- Create: `apps/admin/src/lib/auth/bearer.ts`, `apps/admin/src/lib/auth/bearer.test.ts`
- Create: `apps/admin/src/lib/account/deleteAccount.ts`, `deleteAccount.int.test.ts`
- Create: `apps/admin/src/app/api/account/delete/route.ts`, `route.test.ts`
- Modify: `apps/admin/src/lib/evaluate/cors.ts` (+ test), `handler.ts`, `rateLimit.ts`, `apps/admin/src/app/api/evaluate/route.ts`, existing evaluate tests
- Modify: `packages/shared/src/types.ts` (`EvaluateErrorCode` adds `'unauthorized'`)

**Interfaces:**
- Produces: `authenticateBearer(request: Request, db: SupabaseClient): Promise<{ userId: string } | null>` — reads `Authorization: Bearer <jwt>`, `db.auth.getUser(jwt)`, null on missing/invalid.
- Produces: `handleEvaluate(body: unknown, userId: string, deps: Deps)` — rate key `evaluate:user:<userId>` (10 / 3600 s, constants renamed `USER_RATE_LIMIT`, `USER_RATE_WINDOW_SECONDS`); global cap unchanged; IP key removed.
- Produces: `deleteAccount(userId: string, db: SupabaseClient): Promise<'deleted' | 'forbidden_admin'>` — refuses if the id is in `admins`, else `db.auth.admin.deleteUser(userId)` (throws on error).
- Produces: `POST /api/account/delete` → 204 deleted, 401 `{ error: 'unauthorized', message: 'Trebuie să fii autentificat.' }`, 403 for admins `{ error: 'forbidden', message: 'Contul de administrator nu poate fi șters de aici.' }`; same Origin 403 / JSON-not-required (no body) / CORS handling as evaluate.
- `corsHeaders` allows methods `POST, OPTIONS` and headers `Content-Type, Authorization`.

- [ ] **Step 1: Tests first:** `bearer.test.ts` (no header → null; `Bearer` with invalid token → null; valid → `{userId}` via a stubbed `db.auth.getUser`); `cors.test` expects `Authorization` in allow-headers; evaluate `route.test.ts` → 401 `unauthorized` without token, and the handler is called with the user id; `handler.test.ts` → rate key is `evaluate:user:<id>`; `deleteAccount.int.test.ts` (local DB) → creates a `[test]` student, deletes it, profile gone; admin → `'forbidden_admin'` and user still exists; account route test → 401/403/204 paths.
- [ ] **Step 2: Run** `pnpm --filter @prepio/admin test` → FAIL.
- [ ] **Step 3: Implement** the interfaces above; add `unauthorized` to `ERRORS` in `handler.ts` (status 401, `'Trebuie să fii autentificat.'`).
- [ ] **Step 4: Run** admin unit + int tests and `pnpm typecheck` → PASS. **Step 5: Commit** `feat(api): bearer auth for evaluate (per-user limit) and account deletion`

### Task 5 [Opus]: Mobile session, AuthProvider and route guard

**Files:**
- Modify: `apps/mobile/src/lib/supabase.ts` (persisted session), `apps/mobile/src/lib/api.ts` (bearer on evaluate, `deleteAccount()`)
- Create: `apps/mobile/src/auth/AuthProvider.tsx`, `AuthProvider.test.tsx`
- Create: `apps/mobile/src/lib/profile.ts`, `profile.test.ts`
- Move: `apps/mobile/app/index.tsx` → `apps/mobile/app/(app)/index.tsx`, `app/lesson/[id].tsx` → `app/(app)/lesson/[id].tsx`
- Create: `apps/mobile/app/(auth)/_layout.tsx` (placeholder `welcome` route until Task 8), `app/(app)/_layout.tsx`
- Modify: `apps/mobile/app/_layout.tsx`; `apps/mobile/package.json` (add `@react-native-async-storage/async-storage` via `npx expo install`)

**Interfaces:**
- `getSupabase()` unchanged name; client now `{ auth: { storage: Platform.OS === 'web' ? undefined : AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: Platform.OS === 'web' } }`.
- `getAccessToken(): Promise<string | null>` in `supabase.ts` — reads `getSession()` at call time.
- `profile.ts`: `type Profile = { id: string; displayName: string | null }`; `fetchProfile(userId): Promise<Profile | null>`; `updateDisplayName(userId, name): Promise<void>`; `validateDisplayName(raw): { ok: true; value: string } | { ok: false; message: string }` — trims; empty → `'Scrie-ți numele.'`; > 60 → `'Numele poate avea cel mult 60 de caractere.'`.
- `AuthProvider` / `useAuth(): { status: 'loading' | 'signedOut' | 'needsName' | 'ready'; session: Session | null; profile: Profile | null; refreshProfile(): Promise<void>; signOut(): Promise<void> }`. Subscribes to `onAuthStateChange`; on native starts/stops `auth.startAutoRefresh()` with `AppState`.
- `api.ts`: `evaluateEssay` adds `Authorization: Bearer <token>`; 401 → `EvaluateApiError('unauthorized', 'Sesiunea a expirat. Intră din nou în cont.')` and calls `signOut`; `deleteAccount(): Promise<void>` posts to `${apiUrl()}/api/account/delete` with the bearer, throws `Error` with a Romanian message on non-204.
- Routing: root layout keeps the splash until fonts and `status !== 'loading'`; `Stack.Protected guard={status === 'signedOut'}` → `(auth)`, `guard={status === 'needsName'}` → `(auth)/name`, `guard={status === 'ready'}` → `(app)`; public routes `confidentialitate` and `sterge-cont` sit outside all guards (added in Task 9). No post-sign-in deep-link return (YAGNI; spec allowed skipping).

- [ ] **Step 1: Tests first:** `AuthProvider.test.tsx` with a mocked supabase client — no session → `signedOut`; session + profile without name → `needsName`; with name → `ready`; `SIGNED_OUT` event → `signedOut`; `getUser` error for a deleted user → `signedOut` (Review Focus 3). `profile.test.ts` covers `validateDisplayName` (`'  Ana  '` → `'Ana'`, `'   '` and 61 chars rejected — Review Focus 5). `api` test: evaluate sends the token read at call time (Review Focus 2) and maps 401.
- [ ] **Step 2: Run** `pnpm --filter @prepio/mobile test` → FAIL.
- [ ] **Step 3: Implement**; update existing mobile tests broken by the move/token (mock `getAccessToken`).
- [ ] **Step 4: Run** mobile tests + `pnpm typecheck` + `pnpm --filter @prepio/mobile exec expo export -p web` → PASS. **Step 5: Commit** `feat(mobile): persisted session, AuthProvider and protected routes`

### Task 6 [Opus]: Google sign-in (web + Android)

**Files:**
- Create: `apps/mobile/src/auth/google.web.ts`, `google.native.ts`, `google.ts` (types), `google.test.ts`
- Modify: `apps/mobile/app.json` (plugin `@react-native-google-signin/google-signin`), `apps/mobile/package.json` (`npx expo install @react-native-google-signin/google-signin`), `apps/mobile/.env.example`, jest mocks

**Interfaces:** `signInWithGoogle(): Promise<'ok' | 'cancelled'>` — throws `Error('Autentificarea cu Google nu a reușit. Încearcă din nou.')` on other failures. Web: `signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })` (page navigates away; returns `'ok'`). Native: `GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID })` once; `signIn()`; `type === 'cancelled'` or `statusCodes.SIGN_IN_CANCELLED` → `'cancelled'`; else `signInWithIdToken({ provider: 'google', token: idToken })`. Sign-out also calls `GoogleSignin.signOut()` on native (wire into `AuthProvider.signOut`).

- [ ] **Step 1: Tests first** (native module mocked): success passes the id token to `signInWithIdToken`; user cancel → `'cancelled'`, no error (Review Focus 4); missing id token → throws the Romanian error.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** mobile tests + typecheck → PASS.
- [ ] **Step 5: Commit** `feat(mobile): Google sign-in on web and Android`

### Task 7 [Sonnet]: Auth screens — welcome, email, code, name

**Files:**
- Create: `apps/mobile/app/(auth)/index.tsx` (welcome), `email.tsx`, `code.tsx`, `name.tsx`
- Create: `apps/mobile/src/screens/auth/{WelcomeScreen,EmailScreen,CodeScreen,NameScreen}.tsx` + tests
- Create: `apps/mobile/src/lib/emailAuth.ts` (+ test), `apps/mobile/src/lib/flags.ts`

**Interfaces:**
- `flags.ts`: `emailAuthEnabled(): boolean` → `process.env.EXPO_PUBLIC_AUTH_EMAIL_ENABLED === 'true'`.
- `emailAuth.ts`: `sendEmailCode(email): Promise<void>` (`signInWithOtp({ email, options: { shouldCreateUser: true } })`); `verifyEmailCode(email, code): Promise<void>` (`verifyOtp({ email, token: code, type: 'email' })`); errors mapped to Romanian: invalid email `'Adresa de email nu pare corectă.'`, wrong/expired code `'Codul nu este corect sau a expirat.'`, rate limit `'Prea multe încercări. Așteaptă puțin și încearcă din nou.'`, network `'Nu ne-am putut conecta. Verifică internetul și încearcă din nou.'`. Resend cooldown 60 s.
- Uses `signInWithGoogle` (Task 6), `useAuth().refreshProfile`, `validateDisplayName` / `updateDisplayName` (Task 5).
- Copy: welcome title `Bun venit la Prepio`, subtitle `Pregătește-te pentru BAC cu lecții scurte și exerciții. Intră sau creează-ți cont ca să începi.`, buttons `Continuă cu Google`, `Continuă cu email`, small print linking `Politica de confidențialitate` → `/confidentialitate`. Code screen: `Ți-am trimis un cod de 6 cifre la <email>.`, `Retrimite codul` (`Retrimite în 45 s` during cooldown), `Schimbă adresa`. Name screen: `Cum te numești?`, button `Continuă`.

- [ ] **Step 1: Tests first:** welcome hides `Continuă cu email` when the flag is off and shows it when on; Google cancel leaves no error text; email screen rejects `abc` with the invalid-email message without calling Supabase; code screen shows the mapped wrong-code message and disables resend during cooldown (fake timers); name screen rejects spaces-only (Review Focus 5) and calls `updateDisplayName` + `refreshProfile` on success.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** using the UI kit (welcome reuses the `Hero` look/gradient; `Button`, `TextArea`-style input, `Enter` animations). **Step 4: Run** mobile tests + typecheck → PASS.
- [ ] **Step 5: Commit** `feat(mobile): welcome, email code and name screens`

### Task 8 [Sonnet]: Profile screen

**Files:**
- Create: `apps/mobile/app/(app)/profile.tsx`, `apps/mobile/src/screens/ProfileScreen.tsx` + test
- Modify: `apps/mobile/src/screens/HomeScreen.tsx` (top-bar avatar button with the name's initial, `accessibilityLabel="Profil"`)

**Interfaces:** Consumes `useAuth`, `updateDisplayName`, `validateDisplayName`, `deleteAccount` (api.ts). Copy: title `Profilul tău`, `Nume`, `Salvează`, `Ieși din cont`, `Șterge contul`; in-app confirm panel `Ștergi contul definitiv? Numele, emailul și tot ce ține de cont se șterg și nu mai pot fi recuperate.` with `Da, șterge contul` / `Renunță`; link `Politica de confidențialitate`.

- [ ] **Step 1: Tests first:** rename saves the trimmed name; sign out calls `signOut`; delete requires the confirm step, calls `deleteAccount` then `signOut`; a failing `deleteAccount` shows its message and keeps the user signed in.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS. **Step 5: Commit** `feat(mobile): profile screen with sign-out and account deletion`

### Task 9 [Haiku]: Public pages — privacy and account deletion

**Files:**
- Create: `apps/mobile/src/lib/legal.ts` (`CONTACT_EMAIL = 'lucian.m91@gmail.com'`)
- Create: `apps/mobile/app/confidentialitate.tsx`, `apps/mobile/app/sterge-cont.tsx` + `src/screens/PrivacyScreen.tsx`, `DeleteAccountInfoScreen.tsx` + tests
- Modify: `apps/mobile/app/_layout.tsx` (register both outside the guards)

**Interfaces:** Consumes `useAuth`. Privacy text in Romanian covering exactly the spec's list (data: name, email, Google profile name; purpose: account, later progress; processors: Supabase EU region, Vercel, OpenAI for essays; retention: until deletion; rights + deletion via `/sterge-cont` or email; contact `CONTACT_EMAIL`; date `2 noiembrie 2026`). `/sterge-cont`: explains what is deleted; signed out → button `Intră în cont` (to welcome) + `După ce intri, mergi la Profil → Șterge contul.` + `Sau scrie-ne la <CONTACT_EMAIL>.`; signed in → button to `/profile`.

- [ ] **Step 1: Tests first:** both pages render signed out without any Supabase content query; `/sterge-cont` shows the right action for signed-out vs ready; both show `CONTACT_EMAIL`.
- [ ] **Step 2–4:** run (FAIL) → implement → run (PASS). **Step 5: Commit** `feat(mobile): privacy policy and account deletion pages`

### Task 10 [Opus, main session with Claude in Chrome]: Google Cloud + Supabase provider setup and docs

**Files:** Create `docs/auth-setup.md`; modify local `.env` files (not committed), `apps/mobile/.env.example`, `apps/mobile/eas.json` env (public ids only).

- [ ] **Step 1:** In Chrome (owner signs in when prompted): Google Cloud project `Prepio`; OAuth consent screen External, app name `Prepio`, support email `lucian.m91@gmail.com`, scopes `openid email profile`, publish to production.
- [ ] **Step 2:** OAuth client Web — origins `https://prepio-web.vercel.app`, `http://localhost:8081`; redirect URIs `https://pienbjvwjgnzmnjzmrbh.supabase.co/auth/v1/callback`, `http://127.0.0.1:54321/auth/v1/callback`. OAuth client Android — package `dev.musat.prepio`, SHA-1 from `eas credentials -p android` (preview profile keystore).
- [ ] **Step 3:** Supabase dashboard (prod): Google provider on with web client id + secret, Android client id added to authorized client ids, skip nonce check on; URL config: Site URL `https://prepio-web.vercel.app`, redirect URLs `https://prepio-web.vercel.app/**`, `http://localhost:8081/**`; user sign-ups allowed; **Email provider: sign-ups disabled** (until the domain/SMTP).
- [ ] **Step 4:** Vercel student web env: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_AUTH_EMAIL_ENABLED=false`; EAS env the same. Admin Vercel env unchanged (`STUDENT_WEB_ORIGINS` already set — verify).
- [ ] **Step 5:** Write `docs/auth-setup.md`: every setting above with expected values, how to grant admin (SQL `insert into public.admins …` through a migration), and the later "domain ready" checklist (Resend SMTP, OTP template, enable email sign-up, flag `true`).
- [ ] **Step 6: Commit** `docs: auth provider setup`

### Task 11 [Opus, main session]: Local browser verification and review

- [ ] **Step 1:** Full suites: `pnpm db:reset && pnpm seed && pnpm db:test`, `pnpm test`, `pnpm typecheck`, admin `e2e`. All green.
- [ ] **Step 2:** Chrome, local stack (`EXPO_PUBLIC_AUTH_EMAIL_ENABLED=true` locally), 360 px and desktop, console clean: welcome → email `[test]` address → code from Mailpit → name → Home → lesson → AI evaluation → profile rename → sign out → sign in again (no name prompt) → delete account → welcome; Google on web locally; direct `/lesson/<id>` while signed out lands on welcome; `/confidentialitate` and `/sterge-cont` signed out and in; admin login with admin works, with a student account is refused.
- [ ] **Step 3:** `superpowers:requesting-code-review` (Opus reviewer), fix findings, re-run Step 1.
- [ ] **Step 4:** Update `docs/STATUS.md` (accounts done locally; backlog: domain/SMTP + email enable, Apple with iOS, credits, progress) and commit.

### Task 12 [Opus, main session]: Production rollout

- [ ] **Step 1:** List production `auth.users` (count + emails) via the `db:cloud*` tooling without printing credentials; owner confirms all should become admins.
- [ ] **Step 2:** The admin guard needs `is_admin()` in production, so the migration goes first: `pnpm db:cloud:push:dry` → review → `pnpm db:cloud:push`, then immediately deploy admin and student web (per `docs/deploy.md`). The provider setup (Task 10) is already done, so sign-in works as soon as the web deploy is live.
- [ ] **Step 3:** Production walk in Chrome: Google sign-in on https://prepio-web.vercel.app, name, lesson, AI evaluation, profile, delete; email button hidden; a direct OTP request for a new address is refused; admin panel works for the owner; anon REST read of `lessons` returns `[]`.
- [ ] **Step 4:** EAS `preview` APK build; give the owner the phone test list: native Google picker shows Prepio, session survives app restart, sign out, delete account, AI evaluation, welcome/name/profile screens at phone size, keyboard on email/code/name screens.
- [ ] **Step 5:** Update `docs/STATUS.md` (deployed; Play Console data-safety: privacy URL `https://prepio-web.vercel.app/confidentialitate`, deletion URL `https://prepio-web.vercel.app/sterge-cont`) and commit.
