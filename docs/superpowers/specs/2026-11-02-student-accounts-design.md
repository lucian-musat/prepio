# Student accounts and access — design

Date: 2026-11-02 · Status: approved by the owner (2026-11-02)

## Intent

Prepio is moving from POC to a production app. The first step is accounts: every student signs up / signs in before using the app (web + Android), so later steps can attach saved progress and AI credits to a person. All users of the student app are students; there are no other roles there. Admins stay a separate, small group that uses the admin panel.

Why now: progress saving (next step) and AI credits (later step) both need a stable student identity, and opening sign-up safely requires fixing how admins are identified (see "Security prerequisite").

## Goals

1. A welcoming auth screen shown on launch to anyone not signed in; nothing in the student app is usable without an account (no lessons, no AI evaluation).
2. Sign in / sign up with **Google** (one button, same flow for new and returning students).
3. Sign in / sign up with **email + 6-digit code** (passwordless OTP), built and tested now, but **hidden in production** behind a flag until the owner has a domain and SMTP.
4. Ask for the student's **name only**: taken from Google automatically; asked once after the first email sign-in.
5. Session persists on the device / in the browser until the student signs out.
6. Profile screen: name (editable), "Ieși din cont", "Șterge contul".
7. A public web page for account deletion (Google Play requirement: in-app deletion plus a web link).
8. Admins explicitly separated from students at the database level and in the admin panel.
9. `/api/evaluate` requires a signed-in student; rate limit keyed per student instead of per IP.
10. Code structured so **Sign in with Apple** can be added when an iOS build exists (no Apple work now).

## Non-goals (this step)

- Saving progress (separate next step).
- AI credits per account (separate later step; this step only switches the rate-limit key to the user).
- iOS build, Sign in with Apple, Facebook, Instagram (Instagram has no consumer login API).
- Any student data beyond the name (no class, profile, BAC year, school). Keeps GDPR exposure minimal; under-16 consent rules not triggered by extra data.
- Custom domain, Resend/SMTP setup, custom email templates in production (owner will have a domain in a few days; done then as a follow-up).
- Passwords (no password sign-up UI, no reset flow).

## Anti-goals (failure even if it "works")

- Any signed-in student able to write content, read `ai_settings`, upload images, or reach the admin panel.
- An anonymous visitor able to read lessons or call the AI.
- Production email button visible while emails can't actually be delivered to students.
- A clunky first impression: raw Supabase domain / browser redirect where a native Google picker is possible, unstyled screens, English strings.
- Breaking the existing admin login or the seeded content.

## Current state (relevant facts)

- Supabase Auth already exists; `enable_signup = false`; the only users are admins.
- RLS: `anon` reads published content and `settings`; **`authenticated` has full write on every content table, `settings`, `ai_settings`, and storage `images`** (`supabase/migrations/20261030000002_rls.sql`, `…03_storage_and_rate_limit.sql`). This is safe only because sign-up is closed.
- Admin proxy (`apps/admin/src/proxy.ts`) only checks "is logged in".
- Student app (Expo Router, `apps/mobile/app/`: `index`, `lesson/[id]`) uses an anon Supabase client with `persistSession: false` (`apps/mobile/src/lib/supabase.ts`). No async-storage / secure-store / Google sign-in packages installed.
- `/api/evaluate` (admin app) rate-limits per IP (10/h) plus a global 300/day cap via `consume_rate_limit`; allows requests without `Origin` (native app).
- Android package `dev.musat.prepio`, EAS-managed keystore; no `expo-updates`, so new native modules require a new APK.
- Production web: https://prepio-web.vercel.app (student), https://prepio-admin.vercel.app (admin).

## Design

### Security prerequisite: admins vs students

- New table `admins (user_id uuid primary key references auth.users on delete cascade)`; RLS enabled, no policies for API roles (readable only through the function below / service role).
- `is_admin()` — `security definer`, `stable`, returns whether `auth.uid()` is in `admins`. Execute granted to `authenticated`.
- Content tables, `settings`, `ai_settings`, storage `images` write policies: replace `to authenticated using (true)` with `using (is_admin()) with check (is_admin())`.
- Students (`authenticated`, not admin): `select` on published lessons and their cards/questions/writing exercises, `nodes`, `settings` — same visibility rules the anon policies have today. No access to `ai_settings`.
- `anon`: **drop** all content select policies (nothing is readable without an account). Storage `images` bucket stays public (public URLs for card images; listing hardening remains in the existing backlog item).
- Migration backfill: `insert into admins select id from auth.users` — at migration time every existing user is an admin (sign-up was closed), so production admins keep working with no manual step. Seed adds the local test admin to `admins`.
- Admin panel: proxy and login action check `is_admin()` after authentication; a non-admin session is signed out and shown "Contul nu are acces de administrator." Students can't use the admin panel even with a valid session.

### Student profile data

- Table `profiles (id uuid primary key references auth.users on delete cascade, display_name text, created_at, updated_at)`.
- Trigger on `auth.users` insert creates the profile, filling `display_name` from Google metadata (`full_name` / `name`) when present, else null.
- RLS: a user selects and updates only their own row (`id = auth.uid()`); `display_name` length-checked (1–60 chars, trimmed). No insert/delete for API roles (trigger + cascade handle it).
- Admins get no special access to profiles in this step.

### Auth configuration

- `enable_signup = true` (needed for Google first sign-in and OTP sign-up).
- Google provider enabled (local config via env-substituted client id/secret in `supabase/config.toml`; production via Supabase dashboard).
- Email provider: OTP enabled, email confirmations on, OTP length 6, template contains `{{ .Token }}` (code, not magic link). Locally emails land in the Supabase local mail inbox (Mailpit/Inbucket).
- **Production until the domain exists:** email sign-up disabled in Supabase (so nobody can create email accounts through the API either) and the email button hidden in the app. When the domain + Resend SMTP are ready: configure SMTP, set the OTP template, enable email sign-up, flip the app flag. No code change.
- Password sign-up via the raw API can't be fully disabled while email sign-up is on; with confirmations required it still produces only email-verified student accounts, which are harmless now that admins are explicit. Acceptable.
- *Note (2026-11-02, final review):* hosted Supabase has no email-only sign-up switch — sign-ups are global, and turning the Email provider off would also break admin password login. Production therefore keeps the Email provider ON with **Confirm email ON** (verified before sign-ups are turned on, to prevent account pre-hijacking via raw-API password sign-up + automatic identity linking). Until the domain + custom SMTP exist, Supabase's default SMTP only delivers to team-member addresses, so OTP mails to outside addresses aren't delivered, and the app hides the email button. The "email sign-up disabled in production" bullet above is superseded; current checklist in `docs/auth-setup.md`.
- *Note (2026-11-02, final review):* the student client uses `flowType: 'pkce'` (supabase-js defaults to implicit), so the web Google redirect returns `?code=` and `detectSessionInUrl` exchanges it.

### Student app (web + Android)

**Session/client.** One Supabase client with `persistSession: true`, `autoRefreshToken: true`; storage = AsyncStorage on native (`@react-native-async-storage/async-storage`), localStorage on web; `detectSessionInUrl` on web only (OAuth redirect). An `AuthProvider` exposes `session`, `profile`, `loading`, and actions; on native, auto-refresh is started/stopped with `AppState`.

**Routing gate.** Root layout waits for fonts + initial session, keeping the splash up. Signed-out → auth screens; signed-in with no `display_name` → "Cum te numești?"; otherwise the existing Home/Lesson stack. Implemented with Expo Router route groups (e.g. `(auth)` and `(app)`) and a redirect/guard in the layout. Deep links to `/lesson/<id>` while signed out land on the welcome screen, then continue to the lesson after sign-in (nice-to-have; builder's call if costly).

**Screens (Romanian, design system "Mentă Prietenoasă", own UI kit in `apps/mobile/src/ui/`):**

1. **Bun venit** — logo/hero, one-line pitch, "Continuă cu Google" (primary), "Continuă cu email" (secondary, only if `EXPO_PUBLIC_AUTH_EMAIL_ENABLED=true`), small print linking to privacy note / terms placeholder. Single screen covers both sign-up and sign-in; copy says so ("Intră sau creează-ți cont").
2. **Email** — email field → "Trimite codul".
3. **Cod** — 6-digit code entry, "Retrimite codul" with cooldown, change-email link; clear errors (cod greșit/expirat, prea multe încercări, fără conexiune).
4. **Cum te numești?** — shown once when `display_name` is empty; saves to `profiles`.
5. **Profil** — reachable from Home's top bar (avatar/initial button). Edit name, "Ieși din cont", "Șterge contul" (confirm step in-app — not a browser `confirm()` dialog — explaining that the account and data are deleted permanently).

Visual details of each screen are left to the builder within the design system; the welcome screen should feel as polished as Home's hero.

**Google sign-in.**
- **Web:** `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: <current origin> } })` (PKCE), session picked up on return.
- **Android:** native Google sign-in (`@react-native-google-signin/google-signin`, Credential Manager) → ID token → `supabase.auth.signInWithIdToken({ provider: 'google', token })`. Chosen over the browser redirect so students see a native account picker with "Prepio" instead of a Custom Tab on the Supabase project domain. New native module → new APK; config plugin in `app.json`.
- Isolated behind a small `signInWithGoogle()` platform module (`.web.ts` / `.native.ts`) so Apple can be added the same way later.

**Account deletion.**
- Endpoint in the admin app (it already holds the service role key): `POST /api/account/delete`, requires `Authorization: Bearer <access token>`, verifies the user via Supabase, calls `auth.admin.deleteUser(id)` (cascades to `profiles`; future progress tables must cascade too). Same CORS/Origin rules as `/api/evaluate`. Refuses to delete admins.
- In-app: Profil → Șterge contul → confirm → call endpoint → sign out locally → welcome screen.
- Public web page on the student web, e.g. `https://prepio-web.vercel.app/sterge-cont`: reachable without login, explains what is deleted; offers "Intră în cont ca să îl ștergi" (sign in, then the same confirm + delete) and a contact email as fallback. This URL goes into the Play Console data-safety form.

**AI evaluation.**
- Mobile `evaluateEssay` sends `Authorization: Bearer <access token>`.
- `/api/evaluate` rejects missing/invalid tokens with 401 ("Trebuie să fii autentificat."), rate limit key becomes `user:<id>` (10/h kept), global 300/day cap kept. IP limit dropped. Credits come in a later step.

### Google Cloud / provider setup (done by Claude in Chrome, owner only for login/approvals)

- Google Cloud project (owner's Google account): OAuth consent screen (External, app name "Prepio", support email, scopes `openid email profile`, published to production — basic scopes need no verification; logo/branding verification is optional and can come with the domain).
- OAuth client **Web**: authorised JS origins `https://prepio-web.vercel.app`, `http://localhost:8081`; redirect URI = Supabase callback `https://pienbjvwjgnzmnjzmrbh.supabase.co/auth/v1/callback` (+ local `http://127.0.0.1:54321/auth/v1/callback`).
- OAuth client **Android**: package `dev.musat.prepio`, SHA-1 of the EAS keystore (from `eas credentials`).
- Supabase dashboard (production): enable Google with the web client id/secret, add the Android client id to authorised client IDs; Site URL / redirect allow-list includes `https://prepio-web.vercel.app/**` and `http://localhost:8081/**`.
- Secrets (client secret) go into Supabase dashboard and local `.env` files only — never committed. Client IDs (public) go into `EXPO_PUBLIC_*` env vars on Vercel/EAS.
- The owner is asked only to sign in to Google / Supabase / Expo and approve what needs his account; every step is written down in `docs/auth-setup.md` so it can be redone.

### Tests and verification

- pgTAP: anon can't read any content; student reads published content only, can't write any content / settings / storage, can't read `ai_settings` or `admins`; admin can do everything they could before; profiles own-row only; `is_admin()` correct; profile trigger fills name from metadata; backfill leaves existing users as admins.
- Admin: unit/integration tests for `/api/evaluate` 401 + per-user key, `/api/account/delete` (401, deletes self, refuses admins), admin proxy rejecting non-admins.
- Mobile: tests for the auth gate routing (signed-out / no name / ready), email OTP screens (errors, resend cooldown), profile actions, `evaluateEssay` sends the token.
- Browser (owner's rule): local stack, walk welcome → email OTP (local mailbox) → name → Home → lesson → AI evaluation → profile rename → sign out → sign in again → delete account; Google sign-in on web locally and on production; `/sterge-cont`; admin login still works and a student session is refused by admin; 360 px + desktop; console clean. `[test]` data cleaned up.
- Phone (owner, next APK): native Google picker, session survives app restart, sign out / delete, AI evaluation with token.

### Rollout order

1. Migration (admins, is_admin, profiles, policy rewrite, backfill) → `db:cloud:push:dry` → push. Because anon content access is dropped, the **current production student web and APK stop showing lessons** the moment this is pushed; push it together with the new web deploy and accept the old APK breaking until the new one is installed (only the owner uses it today).
2. Google Cloud + Supabase provider setup.
3. Deploy admin (evaluate + delete endpoints, admin guard) and student web; walk production in Chrome.
4. New Android `preview` APK; owner phone test list.
5. Later (domain ready): Resend SMTP, OTP template, enable email sign-up, set `EXPO_PUBLIC_AUTH_EMAIL_ENABLED=true`.

*Note (2026-11-02, final review):* the exact order is now in `docs/deploy.md` "Accounts rollout": confirm `auth.users` with the owner → migration dry-run + push → deploy admin (its CORS must allow `Authorization` before the new web calls it) → deploy student web → dashboard settings (Confirm email ON first, then sign-ups, Google) → Google consent screen Branding + Publish → production walk → new APK.

## Constraints

- Follow `docs/database-migrations.md` (new migration, RLS, pgTAP, cloud dry-run). Never edit applied migrations, never change the production DB by hand; production DB credentials only via `pnpm db:cloud*`.
- Secrets never committed or printed.
- UI in Romanian, code/docs in English, design system tokens.
- **Token economy (owner request):** the implementation plan must tag each task with the model tier to use. Security-sensitive or judgement-heavy work (RLS rewrite + pgTAP, auth gate/session handling, Google native/web flows, API token verification, review) on the strong model; mechanical work (screens from the design system once the pattern exists, copy, docs, env wiring, simple tests) on a cheaper model (Sonnet/Haiku) via subagents.
- Ask the owner branch vs `main` before implementing.

## Calls made by Claude (owner can override)

- Passwordless email code instead of email + password.
- Native Google sign-in on Android (`@react-native-google-signin/google-signin`) instead of the browser redirect.
- `admins` table + `is_admin()` instead of custom JWT claims / app_metadata roles.
- Anonymous visitors lose all content access (follows "nothing without an account").
- Account-deletion endpoint lives in the admin app (already has the service role key) rather than a Supabase Edge Function.
- Rate limit per user replaces per IP; global cap kept.
- Card images bucket stays public.

## Clarifications (from the builder check)

- **Same email via Google and email code:** Supabase links identities with the same verified email into one user (Google emails are verified; OTP verifies by sending the code). Keep automatic linking on (default). Result: one account, one profile; the trigger only runs on the first identity, so no merge path is needed. pgTAP/integration covers "second identity doesn't create a second profile" where feasible locally.
- **Admins in the student app:** allowed — an admin's account works as a normal student account there. Granting admin to an existing student = inserting their id into `admins` through a migration or the SQL documented in `docs/auth-setup.md` (no admin UI for it in this step).
- **Backfill safety:** before `db:cloud:push`, list production `auth.users` (count + emails, via the `db:cloud*` tooling, no credentials printed) and confirm with the owner that all of them should be admins.
- **Cutover:** Google + Supabase provider setup happens first. Then migration push, admin deploy and student web deploy back-to-back (the admin guard calls `is_admin()`, so the migration must land before the admin deploy); a few minutes of "no lessons" on production web is acceptable (only the owner uses it today). The welcome screen and `/sterge-cont` read no content.
- **CORS:** `STUDENT_WEB_ORIGINS` already lists the student origins; `corsHeaders` must add `Authorization` to `Access-Control-Allow-Headers` (both endpoints) — otherwise the web preflight fails.
- **Rate-limit key:** `consume_rate_limit(p_key text, …)` already takes any text; `user:<uuid>` needs no schema change. Old IP rows are left to the existing cleanup backlog item.
- **Production auth settings** live in the Supabase dashboard (`config.toml` is local only). `docs/auth-setup.md` lists each setting with its expected value, and the production walk-through checks them (incl. that an email OTP request for a new address is refused while email sign-up is off). *Note 2026-11-02: superseded — the checks are now "admin password login still works" and "an OTP for an outside address is not delivered / errors" (default SMTP), see `docs/auth-setup.md`.*

- **Privacy policy (owner decision):** Claude writes a simple Romanian privacy page on the student web (e.g. `/confidentialitate`): data collected (name, email, and Google profile name when used), purpose (account and, later, progress), processors and location (Supabase EU region, Vercel hosting, OpenAI for essay evaluation — the essay text is sent for grading; *note 2026-11-02: corrected — the Supabase project is in eu-west-2, London, UK (EU adequacy decision), not the EU; OpenAI may process the essay outside the EU, in the USA*), retention (until the account is deleted), rights and how to delete (`/sterge-cont`), contact email. Linked from the welcome screen, the profile screen and `/sterge-cont`; its URL goes into the Play Console. The owner reviews it before publishing.
- **Contact email:** one address used on `/confidentialitate` and `/sterge-cont`, `lucian.m91@gmail.com` for now (owner decision; will change with the domain), kept in one constant/env var so it can change when the domain arrives).

## Left to the builder

- Exact screen layouts and microcopy within the design system.
- Route group structure and guard mechanics in Expo Router.
- Whether the post-sign-in deep-link return is worth it.
- Test file organisation.
