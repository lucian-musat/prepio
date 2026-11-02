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

Apply these in the dashboard ONLY right after the `student_accounts` migration is pushed. Before it, every new account would effectively be an admin.

Authentication, Sign In / Providers:

- [ ] Allow new users to sign up = ON
- [ ] Google provider ON with the web client id + secret
- [ ] Android client id added to the authorized client IDs list
- [ ] "Skip nonce checks" ON
- [ ] Email provider: sign-ups OFF until the domain + SMTP exist

Authentication, URL Configuration:

- [ ] Site URL `https://prepio-web.vercel.app`
- [ ] Redirect URLs `https://prepio-web.vercel.app/**` and `http://localhost:8081/**`

Production check: an OTP request for a new address must be refused while email sign-up is off.

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
- [ ] Turn email sign-up ON.
- [ ] Set `EXPO_PUBLIC_AUTH_EMAIL_ENABLED=true` (Vercel + `eas.json`) and redeploy / rebuild.
- [ ] Update `CONTACT_EMAIL` in `apps/mobile/src/lib/legal.ts`.
- [ ] Add the domain to the Google OAuth origins and Branding, and to the Supabase URL configuration.
