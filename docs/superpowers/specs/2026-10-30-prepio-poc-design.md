# Prepio POC — Design

Date: 2026-10-30
Status: draft, pending owner approval

## 1. Intent

Prepio helps Romanian 12th-grade students prepare for the **Bacalaureat (BAC) history exam**. The long-term product has three pillars: interactive lessons, BAC exam simulations, and AI feedback on essay writing.

The POC proves the full loop across all three components — **student app (Android + web), admin, and AI essay feedback** — on free hosting, with deploys simple enough for one developer. The owner will test the Android app with a few friends; no public store release.

The owner works mostly with PHP, Node.js and React, and is open to another stack if it fits better. The chosen stack stays in the React/TypeScript/Node world.

All user-facing content (student app, admin UI) is in **Romanian**. Code, comments and docs are in English.

This is a **clean start**: an earlier attempt (`~/projects/prepio`) was deleted on the owner's request; nothing is reused from it. All work happens in this repo.

## 2. Goals, non-goals, anti-goals

**Goals (POC)**
- Admin (owner only) manages a content tree and lesson content: learning cards (text + images), three question types, and writing exercises with AI grading criteria.
- Student app, available as an Android APK and as a website from the same codebase: welcome message → lesson list → lesson (cards → questions → writing exercises).
- Writing exercises: student writes a part of an essay (e.g. the introduction for theme X), the AI returns a grade and improvement suggestions, based on criteria the owner wrote in natural language in the admin.
- AI rules (global behaviour, grading scale, tone) are configurable from the admin without code changes.
- Free hosting; one-command (or push-to-deploy) deploys; Android APK shareable via link.

**Non-goals (POC)**
- Student accounts, login, saved progress, history, statistics.
- BAC exam simulations.
- Public Google Play / App Store release; iOS.
- Payments, multi-admin roles, content versioning.

**Anti-goals** (would make it a failure even if it "works")
- OpenAI API key exposed in client code.
- Anyone on the internet able to run up unbounded OpenAI costs.
- Android app and web app drifting into two separate codebases.
- An admin so clumsy that adding a lesson's content is slower than editing a spreadsheet.

## 3. Constraints

- Free tiers only for the POC.
- Single developer; deploys must be simple.
- Android distribution: direct APK download link (EAS internal distribution), no store.
- No student authentication, so the AI endpoint must be protected by rate limiting.

## 4. Architecture

```
┌──────────────────────┐      read published content      ┌───────────────────────┐
│ apps/mobile (Expo)   │ ───────────────────────────────▶ │ Supabase              │
│  Android APK + Web   │                                   │  Postgres (content)   │
│                      │ ── POST essay ─┐                  │  Storage (images)     │
└──────────────────────┘                │                  │  Auth (admin only)    │
                                        ▼                  └───────────▲───────────┘
                         ┌─────────────────────────────┐               │
                         │ apps/admin (Next.js, Vercel) │──── CRUD ─────┘
                         │  admin UI                    │
                         │  /api/evaluate  ──▶ OpenAI   │
                         └─────────────────────────────┘
```

| Part | Tech | Hosting (free) |
|---|---|---|
| Student app | Expo (React Native, TypeScript, Expo Router), web via react-native-web | Web: Vercel (static export) or EAS Hosting; Android: EAS Build APK, internal distribution link |
| Admin + AI endpoint | Next.js (App Router, TypeScript) | Vercel |
| Database, image storage, admin auth | Supabase (Postgres, Storage, Auth) | Supabase free tier |
| AI | OpenAI API, called only from the Next.js server | OpenAI (pay-as-you-go, with a monthly spend cap set in the OpenAI dashboard) |

**Repo layout** — monorepo with npm/pnpm workspaces:
```
apps/mobile      Expo app (Android + web)
apps/admin       Next.js admin + /api/evaluate
packages/shared  shared TypeScript types (content model, API contracts)
supabase/        SQL migrations, RLS policies, seed data
docs/
```

**Data access**
- Student app reads content directly from Supabase with the anon key. Row Level Security allows anon `SELECT` only on **published** lessons and their children, the content tree, and public settings (welcome message). No anon writes.
- Admin uses Supabase Auth (email + password, single owner account, sign-ups disabled). RLS allows full CRUD to authenticated users.
- AI rules / prompts are **not** readable by anon — only the admin server reads them.
- Images live in a public Supabase Storage bucket; uploads only by the authenticated admin.

**Known free-tier limits** (accepted for POC): Supabase free projects pause after ~1 week of inactivity (one click to resume); EAS Build has a limited monthly quota of free builds and queues.

## 5. Content model

**Content tree** — themes → chapters → subchapters, depth may vary. Modeled as a single self-referencing `nodes` table (`id, parent_id, title, position`) so depth isn't fixed. Lessons attach to any node.

**Lesson** — `title, node_id, position, status (draft|published)`. Contains three ordered sections, always in this order:
1. **Cards** — `title?, body (text), image?` ordered by `position`. Body is plain text with light formatting (builder's call: plain text or Markdown).
2. **Questions** — each has `type`, `prompt`, `difficulty`, `position`, and an optional `explanation` shown after answering.
   - `single_choice`: options, exactly one correct.
   - `multiple_choice`: options, one or more correct; answer correct only if the selected set matches exactly.
   - `chronological_order`: items with their correct order (optionally a year/date label shown after answering); student reorders; correct only if the full order matches.
   - `difficulty`: three levels — easy / medium / hard (owner's levels; labels in Romanian: ușor / mediu / dificil).
3. **Writing exercises** — `prompt` (e.g. "Scrie introducerea pentru tema X"), `criteria` (natural-language points the student should cover), `position`.

**Settings** (singleton): welcome message (public); AI settings (private): global rules (free text: tone, general instructions), grade scale as structured `grade_min` / `grade_max` fields (default 1–10), model name.

## 5a. POC content (written by the builder)

The owner has no content prepared. The builder researches and writes the POC content, delivered as seed data (SQL or JSON + seed script in `supabase/`), so the app is usable right after setup. Content is in Romanian, written for 12th-grade BAC level, and the owner reviews it for historical accuracy before testers see it.

**Content tree** — mirrors the official BAC history programa (unchanged for the 2025 and 2026 sessions; the new 2030 programa is out of scope):

- A. Popoare și spații istorice
  - Romanitatea românilor în viziunea istoricilor
- B. Oamenii, societatea și lumea ideilor
  - Secolul XX: între democrație și totalitarism
  - Ideologii și practici politice în România și Europa
  - Constituțiile din România
- C. Statul și politica
  - Autonomii locale și instituții centrale (secolele IX–XVIII)
  - Formarea statului român modern și realizarea României Mari
  - România postbelică: regimul comunist și tranziția democratică
- D. Relațiile internaționale
  - Diplomație și conflict în Evul Mediu și modernitate timpurie
  - România și marile alianțe europene
  - România în contextul Războiului Rece

The full tree is seeded; only some leaves get lessons.

**Lessons (3, published)** — chosen because they match the BAC 2025 Subiectul III (statul român modern, 1857–1918):
1. *Unirea Principatelor și domnia lui Al. I. Cuza (1857–1866)* — under "Formarea statului român modern…"
2. *Constituția din 1866 și monarhia constituțională* — under "Constituțiile din România"
3. *Războiul de Independență și România în relațiile internaționale (1875–1918)* — under "România și marile alianțe europene"

Each lesson has:
- 6–10 cards (key facts, dates, people, cause–effect), some with an image.
- ~8–10 questions covering all three types and all three difficulty levels.
- 2 writing exercises modelled on the BAC barem, e.g. "write the introduction for an essay on …" and "formulate a point of view about … and support it with a historical argument". Criteria are written in the barem's language: mention a fact (with the expected examples), present it with two pieces of information and a cause–effect relation, use causal (*deoarece, pentru că*) and conclusive (*așadar, astfel*) connectors, adequate historical language, chronological/logical order.

**Images** — public-domain / freely licensed images (e.g. Wikimedia Commons), uploaded to Supabase Storage by the seed script, with the source/licence stored in a `credit` field shown under the image.

**Default AI global rules** (seeded, editable) — act as a BAC history evaluator; grade on the configured scale; judge factual correctness, coverage of each criterion, historical language, cause–effect and connectors, logical/chronological order; suggestions must be concrete, in Romanian, addressed to the student, and must not rewrite the text for them.

Reference used: Ministry of Education BAC 2025 programa and the official barem for *Proba E.c) Istorie, 2025, Varianta 1* (Subiectul III: 24 p historical information + 6 p ordering/expression — limbaj istoric 2 p, structură 1 p, succesiune cronologică/logică 2 p, limită de spațiu 1 p).

## 6. Student app behaviour

1. **Home**: welcome message (from settings) + list of published lessons, grouped by the content tree.
2. **Lesson**: step through cards one at a time (next/previous). Then questions one at a time: student answers, gets immediate feedback (correct/incorrect, correct answer, explanation). Then writing exercises.
3. **Writing exercise**: student sees the prompt, writes text, submits. Shows loading, then the **grade** and a **list of improvement suggestions**. Student may edit and resubmit. Nothing is persisted after leaving.
4. **Layout**: same UI on Android and web; on wide screens content is centered with a max width.
5. Questions are shown in the owner-defined order (difficulty is displayed as a badge; no filtering in the POC).

## 7. Admin behaviour

- Login (owner only).
- Content tree: create / rename / reorder / delete nodes.
- Lessons: create under a node, set draft/published, reorder.
- Lesson editor with three tabs/sections: cards (with image upload), questions (form adapts to type), writing exercises.
- Settings page: welcome message, AI global rules, grade min/max, model.
- Reordering via up/down buttons or drag-and-drop (builder's call).
- Simple per-item forms are enough: the owner adds content by hand in small volumes; **no bulk import** in the POC.
- **No draft preview** in the POC: to see a lesson as students do, the owner publishes it (decided by Claude; an admin preview can come later).

## 8. AI essay evaluation

`POST /api/evaluate` on the Next.js app, body `{ exerciseId, text }`.

1. Server loads the exercise (prompt + criteria) and the AI global rules from Supabase (service role key, server-only).
2. Builds the prompt: global rules as system instructions; exercise prompt + criteria + student text as input.
3. Calls OpenAI with **structured output** so the response is `{ grade: number, suggestions: string[] }` (optionally `summary: string`). Grade is a single number on the `grade_min`–`grade_max` scale from settings (default 1–10), clamped server-side. Per-criterion BAC-point scoring is a later step (decided by Claude).
5. Only exercises belonging to published lessons can be evaluated.
4. Returns that JSON to the app. Nothing is stored.

**Abuse protection** (no student login): per-IP rate limit (e.g. 10 requests/hour, builder picks the mechanism — e.g. a small Postgres table or Upstash free tier); max input length (e.g. 3000 characters); CORS restricted to the student web origin (the Android app isn't subject to CORS, so the rate limit is the real guard); monthly spend cap in the OpenAI dashboard.

## 9. Deploy

- Admin: Vercel, auto-deploy on push to `main`.
- Student web: static export of the Expo web build, deployed to Vercel (separate project) or EAS Hosting.
- Android: `eas build -p android --profile preview` → APK, shared via the EAS internal distribution link.
- Database: SQL migrations in `supabase/`, applied with Supabase CLI.
- Secrets (Supabase service key, OpenAI key) only in Vercel env vars and local `.env` (gitignored).

## 10. Left to the builder

- Package manager (pnpm or npm workspaces), UI component libraries for admin and app, styling approach.
- Card body format (plain text vs Markdown).
- Rate-limit mechanism and exact limits.
- Exact OpenAI model (cheap, structured-output capable) and prompt wording.
- Testing approach per superpowers TDD workflow.
- Exact wording of the seeded lessons, questions and AI rules (within §5a).

## 11. Suggested build order (incremental)

1. Monorepo scaffold + Supabase schema/RLS + seed content (§5a).
2. Student app: home + lesson with cards and questions (reading seed data), running on web and Android.
3. Admin: login, content tree, lesson editor, image upload, settings.
4. AI evaluation endpoint + writing exercise screen.
5. Deploys: Vercel (admin, web), EAS APK.
