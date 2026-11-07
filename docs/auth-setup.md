# Auth setup (student accounts)

Redo-able record of how sign-in is configured. No secrets live here.

## Google Cloud

Project id `prepio-513509` (owner's Google account). Google Auth Platform:

- Consent screen: External, app name "Prepio", support and developer contact `lucian.m91@gmail.com`, scopes `openid email profile`.
- Status is currently **Testing** with test user `lucian.m91@gmail.com`. It must be **published to production** at rollout. That requires the Branding page: app homepage `https://prepio-web.vercel.app`, privacy policy `https://prepio-web.vercel.app/confidentialitate`, authorized domain `prepio-web.vercel.app`. Basic scopes need no Google verification.

### OAuth client "Prepio web (Supabase)" (Web application)

- Id: `937265826350-m2821ldcll6s563875sq2m479dl955s3.apps.googleusercontent.com`
- Authorized JavaScript origins: `https://prepio-web.vercel.app`, `http://localhost:8081`
- Authorized redirect URIs: `https://pienbjvwjgnzmnjzmrbh.supabase.co/auth/v1/callback`, `http://127.0.0.1:54321/auth/v1/callback`
- Its secret exists only in Supabase (prod dashboard) and the owner's gitignored `supabase/.env`. Never in the repo.

### OAuth client "Prepio Android (EAS)" (Android)

- Id: `937265826350-2jvspd4c37ajjhs2f9b6fu8igr71pc6b.apps.googleusercontent.com`
- Package `dev.musat.prepio`
- SHA-1 `9F:42:72:7D:4C:A6:3B:D4:6D:E8:DF:B4:22:58:6A:27:B1:4D:C2:50` (EAS upload keystore: expo.dev, project, Credentials, Android).
- When the app goes to Google Play, add another Android client (or fingerprint) with the Play app-signing SHA-1 from Play Console, App integrity.

Native sign-in uses the WEB client id as `webClientId` (`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, committed in `apps/mobile/eas.json` for APK builds; it is a public value).

## Local Supabase

- `supabase/.env` (gitignored) with `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` (non-empty; placeholders are fine if you don't test Google).
- Email OTP mails land in Mailpit: http://127.0.0.1:54324.

## Production Supabase (project `pienbjvwjgnzmnjzmrbh`)

Apply these in the dashboard ONLY right after the `student_accounts` migration is pushed and the new admin is deployed (see "Rollout order" below). Before the migration, every new account would effectively be an admin.

Hosted Supabase has no "email sign-ups only" switch: "Allow new users to sign up" is global, and turning the Email provider OFF disables email entirely, which would break admin password login (`signInWithPassword`). So the Email provider stays ON. Until a domain + custom SMTP exist, Supabase's default SMTP only delivers to the project's team-member addresses, so OTP mails to outside addresses are not delivered, and the app hides the email button (`EXPO_PUBLIC_AUTH_EMAIL_ENABLED=false`).

Authentication, Sign In / Providers — in this order:

- [ ] Email provider: **Confirm email = ON**. Verify it BEFORE turning sign-ups on: with sign-ups on and confirmations off, anyone could create a password account for someone else's address through the raw API, and automatic identity linking would later attach the real owner's Google sign-in to that pre-registered account (account pre-hijacking).
- [ ] Email provider stays ON (admin password login needs it).
- [ ] Allow new users to sign up = ON
- [ ] Google provider ON with the web client id + secret
- [ ] Android client id added to the authorized client IDs list
- [ ] "Skip nonce checks": leave OFF. Supabase only checks a nonce when the ID token contains one, and native Google Sign-In (v17, no nonce) doesn't send one. Turn it ON only if Android sign-in fails with a nonce error.

Authentication, URL Configuration:

- [ ] Site URL `https://prepio-web.vercel.app`
- [ ] Redirect URLs `https://prepio-web.vercel.app/**` and `http://localhost:8081/**`

Production checks right after the dashboard change:

- [ ] Admin password login still works on `https://prepio-admin.vercel.app`.
- [ ] Confirm email shows ON after saving.
- [ ] An OTP request for an outside (non-team) address is not delivered / returns an error (default SMTP; expect `email_address_not_authorized`), and no session is issued.
- [ ] Google sign-in on `https://prepio-web.vercel.app` works.

## Sign-ups are currently OFF (pre-launch)

Since 2026-11-07 „Allow new users to sign up” is **OFF** in production (spam student accounts were being created through the public Supabase Auth API and the APK; the Vercel IP rule on `prepio-web` can't stop that). Existing accounts still sign in; no new account (Google, email OTP or password) can be created. Before a public launch: turn it back ON (Authentication → Sign In / Providers → User Signups, „Save changes”), keep „Confirm email” ON, then check that a new Google account can register on the web and on the APK.

## Rollout order (production)

1. List production `auth.users` and get the owner's confirmation: the migration backfill makes every existing user an admin.
2. `pnpm db:cloud:push:dry` → review → `pnpm db:cloud:push`.
3. Deploy admin (CORS allowing `Authorization`, admin guard, bearer APIs). Admin goes before student web because the old admin's CORS doesn't allow the `Authorization` header, so the new web's authenticated API calls would fail against it.
4. Deploy student web.
5. Immediately apply the Supabase dashboard settings above (Confirm email ON first, then sign-ups ON, Google provider) and run the production checks.
6. Google consent screen: fill Branding and Publish to production.
7. Production walk in Chrome.
8. New APK (`preview` build); the old APK can no longer read content.

## Environment variables

- Student web (Vercel `prepio-web`): `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (not used by the web flow, harmless) and `EXPO_PUBLIC_AUTH_EMAIL_ENABLED=false`.
- Admin (Vercel `prepio-admin`): `STUDENT_WEB_ORIGINS` must include `https://prepio-web.vercel.app`.
- APK: same `EXPO_PUBLIC_*` values in `apps/mobile/eas.json`.

## Granting admin to an existing user

Add a new migration (follow [database-migrations.md](database-migrations.md); never by hand in production):

```sql
insert into public.admins (user_id)
select id from auth.users where email = '<email>'
on conflict do nothing;
```

## When the domain is ready

- [ ] Configure Resend (or other) SMTP in Supabase.
- [ ] Set the OTP template from `supabase/templates/otp.html`, subject "Codul tău Prepio".
- [ ] Check that an OTP to an outside address is now delivered (sign-ups and the Email provider are already ON).
- [ ] Set `EXPO_PUBLIC_AUTH_EMAIL_ENABLED=true` (Vercel + `eas.json`) and redeploy / rebuild.
- [ ] Update `CONTACT_EMAIL` in `apps/mobile/src/lib/legal.ts`.
- [ ] Add the domain to the Google OAuth origins and Branding, and to the Supabase URL configuration.
