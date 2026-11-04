# Deploy runbook

## Services

| Service | Where | URL / id |
| --- | --- | --- |
| Database + Auth + Storage | Supabase (eu-west-2, London) | `https://pienbjvwjgnzmnjzmrbh.supabase.co` |
| Admin + `/api/evaluate` | Vercel project `prepio-admin`, root `apps/admin` | `https://prepio-admin.vercel.app` |
| Student web | Vercel project `prepio-web`, root `apps/mobile` | `https://prepio-web.vercel.app` |
| Android APK | Expo EAS, owner `lucianm91s-team`, slug `prepio` | projectId `706d0198-4bc6-4079-90f5-6a1ffbde3ef3`, package `dev.musat.prepio` |

Both Vercel projects deploy from `main` of the GitHub repo. Config lives in `apps/admin/vercel.json` (region `lhr1`, next to Supabase) and `apps/mobile/vercel.json` (pnpm install from the repo root, `expo export -p web`, SPA rewrite).

## Environment variables

Admin (Vercel project `prepio-admin`):

- `NEXT_PUBLIC_SUPABASE_URL` = Supabase URL above
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = publishable key (`sb_publishable_...`, public)
- `SUPABASE_SERVICE_ROLE_KEY` - secret, server only
- `OPENAI_API_KEY` - secret, server only (set a monthly spend limit in the OpenAI dashboard)
- `STUDENT_WEB_ORIGINS` = `https://prepio-web.vercel.app` (comma-separated CORS allow-list for `/api/evaluate`)
- `NEXT_PUBLIC_STUDENT_WEB_URL` = `https://prepio-web.vercel.app` (the student web that the card editor embeds as its live preview, `/preview`). Inlined at build time.

Student web (Vercel project `prepio-web`) and the APK (`apps/mobile/eas.json`, profiles `preview` and `production`):

- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL` = `https://prepio-admin.vercel.app`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` = Google OAuth web client id (public). Used by native Google sign-in as `webClientId`; the web flow doesn't need it but it is harmless. Set on Vercel and in `eas.json`.
- `EXPO_PUBLIC_AUTH_EMAIL_ENABLED` = `false` in production (hides the email-code sign-in button until the domain + SMTP exist); `true` locally. Set on Vercel and in `eas.json`.
- `EXPO_PUBLIC_ADMIN_ORIGIN` = `https://prepio-admin.vercel.app` (Vercel `prepio-web` only; the APK has no `/preview`). The only origin whose `postMessage` the `/preview` route accepts. Exact origin: no trailing slash and no path, otherwise the preview silently waits forever.

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

1. Set the two env vars on Vercel **before** pushing: `prepio-admin` → `NEXT_PUBLIC_STUDENT_WEB_URL=https://prepio-web.vercel.app`; `prepio-web` → `EXPO_PUBLIC_ADMIN_ORIGIN=https://prepio-admin.vercel.app` (no trailing slash). Both are inlined at build time; if they are set after the push, both projects need a redeploy.
2. Optional insurance: export the `cards` table from the Supabase dashboard.
3. `pnpm db:cloud:push:dry` (must list only `20261103122901_card_types`) → `pnpm db:cloud:push`.
4. `git push` immediately: both Vercel projects deploy from `main`. Between steps 3 and 4 the live admin errors (it selects dropped columns) and the live student web shows empty cards.
5. Check the `/preview` CSP header (both forms of the path must carry it):
   `curl -sI https://prepio-web.vercel.app/preview | grep -i content-security-policy` and the same for `/preview/` → `frame-ancestors 'self' https://prepio-admin.vercel.app http://localhost:3000`.
6. Production walk in Chrome: existing lessons render (converted text and image cards); in the admin, create a `[test]` draft lesson with one card of each type, check the live preview (Telefon / Desktop) against production web, then delete it; console clean.
7. New EAS `preview` APK, **mandatory**: after the migration the installed APK shows empty or placeholder cards. New native modules: `react-native-webview`, `react-native-youtube-iframe`, `expo-web-browser` (config plugin in `app.json`). Run `npx expo install --check` before the build. Then the owner's phone-test list in `docs/STATUS.md`.

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

Seed cards written after the first production seed live in `packages/content/src/extraCards.ts` (the seed lessons append them, so a fresh local seed has them too). To add them to the existing production lessons without touching anything else:

```bash
pnpm content:cloud:add-cards           # dry run: prints, per lesson, the cards to add / already present and images to upload
pnpm content:cloud:add-cards --apply   # inserts the missing cards at the end of each lesson
```

`scripts/content-cloud.sh` uses the same credentials file as `db:cloud` (only `SUPABASE_ACCESS_TOKEN` is needed), fetches the project's service key with `supabase projects api-keys --reveal` (a new `secret` key, or the legacy `service_role` one) and passes it to `packages/content/src/addCards.ts` through the environment only; nothing secret is printed or passed as an argument. The script finds each lesson by its exact seed title (renamed or duplicated lessons are reported and skipped, exit code 1), skips a card when the lesson already has one with the same type and title (re-running is safe), uploads missing images under `images/seed/` without overwriting, and never edits or deletes existing cards. Locally the same script runs with `pnpm --filter @prepio/content add-cards [--apply]` against the `.env` Supabase.

## Auth settings (Supabase dashboard)

- Anonymous sign-ins: OFF. Sign-up and provider settings for student accounts: see [auth-setup.md](auth-setup.md). The Email provider stays ON (admin password login) with Confirm email ON; there is no email-only sign-up switch.
- The admin user is created manually in Authentication > Users with "Auto Confirm User" checked.

## Android APK

Config: `apps/mobile/eas.json` (`preview`: internal distribution, APK; `production`: app bundle). `appVersionSource` is `local` so no EAS login is needed to read the config; bump `version` in `app.json` when needed.

- From the expo.dev dashboard: project `prepio` > Builds > connect GitHub, build Android with profile `preview`.
- Or from the CLI: `cd apps/mobile && eas login && pnpm dlx eas-cli build -p android --profile preview`.

Share the internal-distribution install link from the build page; the phone must allow installing from unknown sources. Unauthenticated access to internal builds is enabled in the Expo project settings, so testers don't need an Expo account. Builds expire after 14 days on the free plan; run a new `preview` build to refresh. The Android upload keystore was generated by EAS on the first CLI build and is stored in EAS credentials (`dev.musat.prepio`).

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
   `curl -si -X OPTIONS https://prepio-admin.vercel.app/api/evaluate -H "Origin: https://prepio-web.vercel.app" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: authorization,content-type"`
5. Admin login works on `https://prepio-admin.vercel.app`; student web loads lessons and a writing exercise returns an evaluation.
6. The card preview may only be framed by the admin: `curl -sI https://prepio-web.vercel.app/preview` and `curl -sI https://prepio-web.vercel.app/preview/` both return `Content-Security-Policy: frame-ancestors 'self' https://prepio-admin.vercel.app http://localhost:3000`; the admin card editor shows the live preview (not "previzualizarea nu este disponibilă").
