# Prepio

Proof of concept for exam-prep lessons: a student app (Expo, Android + web), an admin panel (Next.js) for managing content, and Supabase (Postgres, Auth, Storage).

## Layout

- `apps/mobile` - student app (Expo / React Native, expo-router; also exported as a web app)
- `apps/admin` - admin panel (Next.js) and the `/api/evaluate` endpoint (OpenAI writing evaluation)
- `packages/shared` - shared types and validation (`@prepio/shared`)
- `packages/content` - seed content and the `pnpm seed` script
- `supabase` - migrations, RLS tests, local config

## Lesson cards

Lessons are made of cards of six types: text (formatted text: a small Markdown subset with bold, italic, lists, `### ` headings and `:::retine` / `:::atentie` / `:::exemplu` callouts, never rendered as HTML), images (single or gallery, zoom viewer), YouTube video (muted autoplay, optional start/end), timeline, cause-effect schema and link preview (metadata fetched by an admin server action). Shapes and validation live in `packages/shared/src/cards.ts`, renderers in `apps/mobile/src/components/cards/`.

The student web has a `/preview` route that renders one card from data posted by the admin card editor, which embeds it in an iframe as a live preview (Telefon / Desktop). It needs `NEXT_PUBLIC_STUDENT_WEB_URL` in the admin (default `http://localhost:8081`) and `EXPO_PUBLIC_ADMIN_ORIGIN` in the student web (default `http://localhost:3000`); see the `.env.example` files and [docs/deploy.md](docs/deploy.md). Admin Playwright runs start the student web server themselves.

## Local development

Requires Node 22, pnpm 9 and Docker.

```bash
pnpm install
pnpm db:start            # local Supabase (prints keys; copy .env.example files to .env.local)
pnpm seed                # seed lessons + local admin user (needs SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)
pnpm --filter @prepio/admin dev      # admin on :3000
pnpm --filter @prepio/mobile web     # student web on :8081 (or `android`)
pnpm test                # unit tests in all packages
pnpm typecheck
pnpm db:test             # database (RLS) tests
```

### Local auth (student accounts)

Students sign in with an emailed 6-digit code or with Google. Locally, codes arrive in the Mailpit inbox at http://127.0.0.1:54324.

Google sign-in needs an OAuth client (Google Cloud Console). Copy `supabase/.env.example` to `supabase/.env` (gitignored, read by the Supabase CLI on `pnpm db:start`) and fill in:

- `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`
- `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`

Both must be non-empty for the stack to start; any placeholder works if you don't test Google locally (only Google sign-in then fails). Never commit real values. Full provider setup (Google Cloud, Supabase dashboard, env vars): [docs/auth-setup.md](docs/auth-setup.md).

## Deployment

See [docs/deploy.md](docs/deploy.md). Database changes: [docs/database-migrations.md](docs/database-migrations.md).
