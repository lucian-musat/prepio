# Prepio POC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working POC of Prepio — Expo student app (Android APK + web), Next.js admin with an OpenAI essay-evaluation endpoint, Supabase backend — seeded with three real BAC history lessons.

**Architecture:** pnpm monorepo. The student app reads published content straight from Supabase (anon key + RLS). The Next.js admin does content CRUD through Supabase (authenticated owner) and hosts `POST /api/evaluate`, the only place the OpenAI key lives. Pure domain logic (types, answer checking, validation) lives in `packages/shared`; seed content lives in `packages/content`.

**Tech Stack:** TypeScript, pnpm workspaces, Expo (latest SDK, Expo Router, react-native-web, **React Native Paper**, `@expo-google-fonts/lora` + `@expo-google-fonts/source-sans-3`), Next.js (latest, App Router, **Bootstrap 5 + react-bootstrap**, no Tailwind), Supabase (Postgres, Auth, Storage, CLI + Docker for local), `@supabase/supabase-js`, `@supabase/ssr`, `openai` (Responses API, structured output), `zod`, Vitest, jest-expo + @testing-library/react-native, pgTAP (`supabase test db`).

**Spec:** `docs/superpowers/specs/2026-10-30-prepio-poc-design.md`

## Global Constraints

- All user-facing text (student app, admin UI, AI output, error messages) is **Romanian** with correct diacritics (ă â î ș ț — comma-below forms). Code, comments, docs in English.
- Shell: the repo lives in WSL (`~/projects/prepio_new`). Run every command inside WSL with nvm loaded: `wsl -d Ubuntu-22.04 -- bash -ic "cd ~/projects/prepio_new && <cmd>"`. Node 22, pnpm 9, Docker available.
- `.npmrc` at root contains `node-linker=hoisted` (required by Expo/Metro under pnpm).
- Workspace package names: `@prepio/shared`, `@prepio/content`, `@prepio/admin`, `@prepio/mobile`.
- The OpenAI key and Supabase service-role key never appear in `apps/mobile` or any `NEXT_PUBLIC_*`/`EXPO_PUBLIC_*` variable. Secrets live only in `.env*` files (gitignored) and hosting env vars.
- Essay input: max **3000 characters** (counted as Unicode code points, `[...text].length`), must be non-empty after trim.
- Rate limit: **10 evaluations per IP per rolling hour**.
- Grade: integer, clamped to `[grade_min, grade_max]` from `ai_settings` (default **1–10**). Default model: `gpt-5-mini` (editable in admin).
- Difficulty values `easy | medium | hard`, shown as **ușor / mediu / dificil**. Question types `single_choice | multiple_choice | chronological_order`.
- Lesson status `draft | published`; students only ever see `published`.
- Wide screens: student content centered, max width 720px.
- Free tiers only. Commit after each task (conventional commits, ending with the `Co-Authored-By` trailer).
- **Component libraries (owner's request):** admin uses Bootstrap 5 via `react-bootstrap` (+ `bootstrap` CSS); student app uses React Native Paper (Bootstrap doesn't run in React Native). Prefer library components over hand-rolled ones.
- **Visual design — "archive / old book" theme, simple and calm.** Tokens live in `packages/shared/src/theme.ts` and are used by both apps:
  - `parchment` `#F7F1E3` (page background), `paper` `#FFFDF7` (cards/surfaces), `ink` `#2B2118` (text), `inkMuted` `#6B5D4F`, `bordeaux` `#7A1F2B` (primary), `gold` `#B8893B` (accent, highlights, focus), `border` `#E3D8C3`, `success` `#2F6B3A`, `error` `#A12C2C`.
  - Difficulty badge colours: ușor `#2F6B3A`, mediu `#B8893B`, dificil `#7A1F2B`.
  - Typography: headings in **Lora** (serif), body in **Source Sans 3**; body 17px (app) / 16px (admin), line-height 1.5.
  - Shapes: radius 12px, soft shadow on cards, generous spacing; learning cards look like index cards (paper surface, thin gold top border, year/label chip when relevant).
  - App bar in bordeaux with parchment text and the wordmark „Prepio” in Lora. Admin: Bootstrap theme overridden via CSS variables (`--bs-primary` = bordeaux, `--bs-body-bg` = parchment, `--bs-body-font-family`, headings in Lora via `next/font/google`), navbar bordeaux.
  - No dark mode in the POC. Must remain readable at 360px wide (phones) and centered ≤ 720px on desktop (app).
- **Browser verification (owner's request):** every task with UI ends with a browser check done by the controller (main session) in Chrome via the Claude-in-Chrome extension against the local dev servers (student web `http://localhost:8081`, admin `http://localhost:3000`): walk the task's flows, check the console for errors, check 360px and desktop widths, and take screenshots. Problems found go back to the implementer before the task is marked done.

## Review Focus

- **Lesson with an empty section** (no cards, no questions, or no exercises) — the lesson screen skips the empty section and never crashes. Test in Task 6.
- **Card image fails to load or is absent** — the card still shows its text; no broken layout. Test in Task 6.
- **Chronological question shuffled into the correct order** — the student must never be shown an already-solved order (for ≥2 items). Test in Task 1.
- **Essay with diacritics near the limit** — 3000 code points with ș/ț/ă is accepted, 3001 rejected, regardless of byte length. Test in Task 11.
- **OpenAI failure, timeout, or malformed output, and rate-limit hits** — the student sees a clear Romanian message and can retry; the server returns typed errors, never a 500 with a stack. Tests in Tasks 11 and 12.

---

## File Structure

```
.npmrc, package.json, pnpm-workspace.yaml, tsconfig.base.json
packages/shared/src/
  types.ts            content model + API contract types
  answers.ts          checkAnswer, shuffleForDisplay
  validation.ts       validateQuestion, validateLesson
  index.ts
packages/content/
  src/tree.ts         programa tree
  src/lessons/01-unirea-principatelor.ts, 02-constitutia-1866.ts, 03-independenta.ts
  src/defaults.ts     welcome message, AI rules defaults
  src/index.ts        exports tree, lessons, defaults
  src/seed.ts         loads everything into Supabase
  images/*.jpg        public-domain images
supabase/
  config.toml, migrations/*.sql, tests/*.sql (pgTAP)
apps/mobile/          Expo app
  app/_layout.tsx, app/index.tsx, app/lesson/[id].tsx
  src/lib/supabase.ts, src/lib/api.ts, src/lib/content.ts
  src/components/ (Screen, CardStepper, QuestionView, ChoiceQuestion, OrderQuestion, WritingExercise, DifficultyBadge)
apps/admin/           Next.js app
  src/lib/supabase/{server,client,admin}.ts
  src/middleware.ts
  src/app/login, src/app/(admin)/{page,lessons/[id],settings}
  src/app/api/evaluate/route.ts
  src/lib/evaluate/{prompt,rateLimit,openai,handler,cors}.ts
```

---

### Task 1: Monorepo scaffold + shared domain package

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `.npmrc`, `tsconfig.base.json`
- Create: `packages/shared/{package.json,tsconfig.json,vitest.config.ts}`, `packages/shared/src/{types,answers,validation,theme,index}.ts`
- Test: `packages/shared/src/answers.test.ts`, `packages/shared/src/validation.test.ts`

**Interfaces:**
- Produces (`@prepio/shared`):
  ```ts
  type Difficulty = 'easy' | 'medium' | 'hard';
  type QuestionType = 'single_choice' | 'multiple_choice' | 'chronological_order';
  type ChoiceOption = { id: string; text: string; correct: boolean };
  type OrderItem = { id: string; text: string; label?: string }; // stored in correct order
  type QuestionBase = { id: string; position: number; prompt: string; difficulty: Difficulty; explanation: string | null };
  type Question = QuestionBase & (
    | { type: 'single_choice' | 'multiple_choice'; options: ChoiceOption[] }
    | { type: 'chronological_order'; options: OrderItem[] });
  type Answer = { type: 'single_choice' | 'multiple_choice'; selected: string[] } | { type: 'chronological_order'; order: string[] };
  type Card = { id: string; position: number; title: string | null; body: string; imagePath: string | null; imageCredit: string | null };
  type WritingExercise = { id: string; position: number; prompt: string; criteria: string };
  type LessonStatus = 'draft' | 'published';
  type LessonSummary = { id: string; nodeId: string; title: string; position: number };
  type Lesson = LessonSummary & { status: LessonStatus; cards: Card[]; questions: Question[]; exercises: WritingExercise[] };
  type TreeNode = { id: string; parentId: string | null; title: string; position: number };
  type EvaluateRequest = { exerciseId: string; text: string };
  type EvaluateResponse = { grade: number; gradeMin: number; gradeMax: number; summary: string; suggestions: string[] };
  type EvaluateErrorCode = 'empty' | 'too_long' | 'not_found' | 'rate_limited' | 'ai_failed' | 'bad_request';
  type EvaluateError = { error: EvaluateErrorCode; message: string }; // message in Romanian
  const MAX_ESSAY_CHARS = 3000;
  const DIFFICULTY_LABELS: Record<Difficulty, string>; // ușor / mediu / dificil
  function checkAnswer(q: Question, a: Answer): boolean;
  function shuffleForDisplay<T extends { id: string }>(items: T[], rng?: () => number): T[];
  function validateQuestion(q: Question): string[];   // Romanian error messages, [] if valid
  function validateLesson(l: Lesson): string[];       // structural rules only (see Step 3)
  const colors: { parchment; paper; ink; inkMuted; bordeaux; gold; border; success; error: string };
  const difficultyColors: Record<Difficulty, string>;
  const radius = 12;
  const fonts: { heading: 'Lora'; body: 'Source Sans 3' };  // values from Global Constraints
  ```

- [ ] **Step 1: Scaffold root.** Root `package.json` (private, `packageManager: pnpm@9`), scripts: `test` = `pnpm -r test`, `typecheck` = `pnpm -r typecheck`. `.npmrc` with `node-linker=hoisted`. `tsconfig.base.json` strict, `moduleResolution: bundler`. Shared package exports `src/index.ts` directly (no build step; `"main": "src/index.ts"`), uses Vitest.

- [ ] **Step 2: Write failing tests** in `answers.test.ts`:
  - `single_choice`: correct only when `selected` is exactly the one correct id; wrong id → false; empty → false.
  - `multiple_choice`: correct only for the exact set of correct ids, order-independent (`['b','a']` == `['a','b']`); subset → false; superset → false.
  - `chronological_order`: `order` equal to stored ids order → true; any swap → false; missing id → false.
  - mismatched answer type for the question → false.
  - `shuffleForDisplay` on 2–6 items with every seeded rng (`() => 0`, `() => 0.999`, a deterministic LCG) never returns the original id order and returns the same set of ids; on 1 item returns it unchanged; does not mutate input.

  In `validation.test.ts`:
  - `validateQuestion`: single_choice with 0 or 2 correct → error; multiple_choice with 0 correct or <2 options → error; chronological_order with <2 items → error; duplicate option ids → error; empty prompt → error; valid ones → `[]`.
  - `validateLesson`: error when empty title; aggregates question errors; valid fixture → `[]`.

- [ ] **Step 3: Implement** `types.ts`, `answers.ts` (Fisher–Yates; if result equals original order and length ≥ 2, rotate by one), `validation.ts`. `validateLesson` checks title non-empty, every card body non-empty, every question via `validateQuestion`, every exercise has non-empty prompt and criteria. (Content-volume rules live in Task 3's test, not here — the admin must accept small lessons.)

- [ ] **Step 4: Run** `pnpm install && pnpm --filter @prepio/shared test && pnpm --filter @prepio/shared typecheck` → all PASS.

- [ ] **Step 5: Commit** `feat(shared): monorepo scaffold and shared domain types`.

---

### Task 2: Supabase schema, RLS, storage, rate-limit function

**Files:**
- Create: `supabase/config.toml` (via `pnpm dlx supabase init`), `supabase/migrations/20261030000001_schema.sql`, `supabase/migrations/20261030000002_rls.sql`, `supabase/migrations/20261030000003_storage_and_rate_limit.sql`
- Test: `supabase/tests/rls.test.sql`, `supabase/tests/rate_limit.test.sql`
- Modify: root `package.json` (add devDependency `supabase`; scripts `db:start`, `db:stop`, `db:reset`, `db:test` = `supabase test db`)

**Interfaces:**
- Produces tables (snake_case; all ids `uuid default gen_random_uuid()`):
  - `nodes(id, parent_id → nodes on delete cascade, title text not null, position int not null default 0)`
  - `lessons(id, node_id → nodes on delete cascade, title, position, status text check in ('draft','published') default 'draft', created_at)`
  - `cards(id, lesson_id → lessons cascade, position, title text null, body text not null, image_path text null, image_credit text null)`
  - `questions(id, lesson_id cascade, position, type text check (3 types), prompt, difficulty text check (3 values), explanation text null, options jsonb not null)` — `options` holds `ChoiceOption[]` or `OrderItem[]` exactly as in `@prepio/shared`.
  - `writing_exercises(id, lesson_id cascade, position, prompt, criteria)`
  - `settings(id int primary key check (id = 1), welcome_message text not null)`
  - `ai_settings(id int primary key check (id = 1), rules text not null, grade_min int not null default 1, grade_max int not null default 10 check (grade_max > grade_min), model text not null default 'gpt-5-mini')`
  - `rate_limits(key text primary key, window_start timestamptz not null, count int not null)`
  - Function `consume_rate_limit(p_key text, p_limit int, p_window_seconds int) returns boolean` — `security definer`, atomic upsert: resets the window when expired, increments, returns `count <= p_limit`. `execute` revoked from `anon` and `authenticated` (service role only).
  - Storage bucket `images`, public read.
- RLS (enabled on every table):
  - `anon`: `select` on `nodes`, `settings`; `select` on `lessons` where `status = 'published'`; `select` on `cards`/`questions`/`writing_exercises` whose lesson is published. Nothing else.
  - `authenticated`: all operations on every content table, `settings`, `ai_settings`. No access to `rate_limits`.
  - `ai_settings`: no anon access at all.
  - Storage `images`: insert/update/delete for `authenticated` only.
  - `supabase/config.toml`: `[auth] enable_signup = false`.

- [ ] **Step 1: Write failing pgTAP tests.** `rls.test.sql` (inserts fixtures as `postgres`, then `set local role anon` / `authenticated`):
  - anon sees the published lesson and its cards/questions/exercises; does not see the draft lesson nor its children.
  - anon `select` from `ai_settings` returns 0 rows; anon `insert` into `lessons` throws.
  - authenticated can insert/update/delete a lesson and read `ai_settings`.
  - deleting a node cascades to its child nodes, lessons and their cards/questions/exercises.
  - `ai_settings` rejects `grade_max <= grade_min`.

  `rate_limit.test.sql`: 10 calls with limit 10 → true; 11th → false; a different key → true; after `update rate_limits set window_start = now() - interval '2 hours'` the key → true again; anon cannot execute the function.

- [ ] **Step 2: Run** `pnpm db:start && pnpm db:test` → FAIL (tables missing).

- [ ] **Step 3: Write the three migrations** implementing the interfaces above.

- [ ] **Step 4: Run** `pnpm db:reset && pnpm db:test` → all PASS.

- [ ] **Step 5: Commit** `feat(db): schema, RLS, storage bucket and rate limit`.

---

### Task 3: BAC content package (tree, three lessons, defaults, images)

**Files:**
- Create: `packages/content/{package.json,tsconfig.json,vitest.config.ts}`, `src/tree.ts`, `src/lessons/01-unirea-principatelor.ts`, `src/lessons/02-constitutia-1866.ts`, `src/lessons/03-independenta.ts`, `src/defaults.ts`, `src/index.ts`, `images/*.jpg`, `images/CREDITS.md`
- Test: `packages/content/src/content.test.ts`

**Interfaces:**
- Consumes: types from `@prepio/shared`.
- Produces:
  ```ts
  type SeedNode = { key: string; title: string; children?: SeedNode[] };
  type SeedLesson = { key: string; nodeKey: string; title: string; status: 'published';
    cards: Array<Omit<Card, 'id' | 'position' | 'imagePath'> & { image?: string /* file in images/ */ }>;
    questions: Array<Omit<Question, 'id' | 'position'>>;   // option ids are stable short strings ('a','b',...)
    exercises: Array<Omit<WritingExercise, 'id' | 'position'>> };
  export const tree: SeedNode[];
  export const lessons: SeedLesson[];
  export const welcomeMessage: string;
  export const aiDefaults: { rules: string; gradeMin: 1; gradeMax: 10; model: 'gpt-5-mini' };
  ```

- [ ] **Step 1: Write failing `content.test.ts`:**
  - `tree` has exactly the 4 domains (A–D) and 10 leaves of the spec §5a, titles verbatim.
  - there are 3 lessons; each `nodeKey` resolves to a leaf: lesson 1 → "Formarea statului român modern și realizarea României Mari", lesson 2 → "Constituțiile din România", lesson 3 → "România și marile alianțe europene".
  - each lesson: 6–10 cards; 8–10 questions; all three question types present; all three difficulties present; exactly 2 exercises; at least 2 cards with an image.
  - each lesson passes `validateLesson` (wrap with fake ids/positions).
  - every referenced image exists in `images/` and every card with an image has a non-empty `imageCredit`.
  - no text contains cedilla forms `ş`/`ţ`/`Ş`/`Ţ` (must use comma-below `ș`/`ț`).

- [ ] **Step 2: Run** `pnpm --filter @prepio/content test` → FAIL.

- [ ] **Step 3: Write the content.** Romanian, BAC 12th-grade level, factually accurate; cards are short (≤ ~80 words), cause–effect explicit. Required coverage:
  - **Lesson 1 — „Unirea Principatelor și domnia lui Alexandru Ioan Cuza (1857–1866)”**: Războiul Crimeii și Congresul de la Paris (1856); Adunările ad-hoc (1857) și rezoluțiile lor; Convenția de la Paris (1858); dubla alegere a lui Cuza (5 și 24 ianuarie 1859) și recunoașterea internațională; unificarea instituțiilor, guvern unic și capitala la București (1862); reformele: secularizarea averilor mănăstirești (1863), legea rurală (1864), legea instrucțiunii publice (1864), Statutul Dezvoltător al Convenției de la Paris (1864); abdicarea (februarie 1866) și „monstruoasa coaliție”.
    Exercises: (1) „Scrie introducerea unui eseu despre constituirea statului român modern în perioada 1857–1866.” (2) „Prezintă o acțiune desfășurată de români în perioada 1857–1859, precizând două informații referitoare la aceasta și utilizând relația cauză-efect.”
  - **Lesson 2 — „Constituția din 1866 și monarhia constituțională”**: aducerea lui Carol de Hohenzollern-Sigmaringen (1866); adoptarea Constituției (iulie 1866) după modelul celei belgiene (1831); numele de România; monarhia constituțională ereditară; separarea puterilor (executivă, legislativă — Parlament bicameral, judecătorească); drepturi și libertăți; vot cenzitar; modificările din 1879, 1884 și 1917; înlocuirea prin Constituția din 1923.
    Exercises: (1) „Precizează o măsură adoptată în statul român în perioada 1861–1866 și menționează două aspecte cu privire la această măsură.” (2) „Formulează un punct de vedere referitor la Constituția din 1866 și susține-l printr-un argument istoric.”
  - **Lesson 3 — „Războiul de Independență și România în relațiile internaționale (1875–1918)”**: criza orientală (1875); Convenția cu Rusia (aprilie 1877); proclamarea independenței (9 mai 1877); luptele de la Plevna, Grivița, Rahova, Smârdan; San Stefano și Congresul de la Berlin (1878) și condițiile recunoașterii; proclamarea Regatului (1881); aderarea la Tripla Alianță (1883); neutralitatea (1914); tratatul cu Antanta și intrarea în război (1916); Mărăști, Mărășești, Oituz (1917); pacea de la Buftea-București (1918); unirea Basarabiei, Bucovinei și Transilvaniei (1918).
    Exercises: (1) „Menționează două fapte istorice la care participă România în cadrul relațiilor internaționale din perioada 1875–1885.” (2) „Formulează un punct de vedere referitor la politica externă a României în perioada 1916–1918 și susține-l printr-un argument istoric.”
  - **Exercise criteria** are written in barem language, one point per line, naming the expected examples (e.g. for lesson 1 ex. 2: menționarea unei acțiuni — ex. rezoluțiile Adunărilor ad-hoc, dubla alegere a lui Cuza; două informații despre ea; relația cauză-efect explicită; limbaj istoric adecvat). Introduction exercises: context, enunțarea temei, 3–6 propoziții, fără detalii din cuprins.
  - Questions: mix types; every chronological question has 3–5 events with `label` = year; each question has an `explanation`.
  - `welcomeMessage`: short, friendly Romanian greeting explaining lessons → cards → questions → exercises with AI feedback.
  - `aiDefaults.rules`: per spec §5a (BAC history evaluator; grade on the configured scale; judge factual correctness, each criterion, historical language, cause–effect and connectors *deoarece/pentru că/așadar/astfel*, chronological/logical order; concrete suggestions in Romanian addressed to the student with „tu”; never rewrite the text for them; 2–5 suggestions).
  - Images: download 6+ public-domain/CC images from Wikimedia Commons (e.g. Cuza portrait, Carol I portrait, Kogălniceanu, a Plevna/Grivița painting, map of the United Principalities), max 1200px wide, JPEG ≤ 300 KB; record file, author, licence and source URL in `images/CREDITS.md` and in `imageCredit` (e.g. „Sursa: Wikimedia Commons, domeniu public”).

- [ ] **Step 4: Run** `pnpm --filter @prepio/content test` → PASS.

- [ ] **Step 5: Commit** `feat(content): BAC programa tree and three seed lessons`.

---

### Task 4: Seed script

**Files:**
- Create: `packages/content/src/seed.ts`, `packages/content/src/seed.int.test.ts`, `.env.example` (root)
- Modify: root `package.json` script `seed` = `pnpm --filter @prepio/content seed`; content `package.json` scripts `seed` (`tsx src/seed.ts`), `test:int`

**Interfaces:**
- Consumes: `tree`, `lessons`, `welcomeMessage`, `aiDefaults` (Task 3); schema (Task 2).
- Produces: `seed(client: SupabaseClient /* service role */, opts?: { adminEmail?: string; adminPassword?: string }): Promise<{ nodes: number; lessons: number }>`. Env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, optional `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

- [ ] **Step 1: Write failing integration test** (runs against local Supabase; skipped unless `SUPABASE_URL` set): after `seed()` → 14 nodes (4 + 10), 3 published lessons with their card/question/exercise counts matching the content package; `settings.welcome_message` and `ai_settings` set; every `cards.image_path` exists in bucket `images`; running `seed()` a second time leaves identical counts (idempotent); when admin credentials are passed, the user exists and signing in with them succeeds.

- [ ] **Step 2: Run** `pnpm --filter @prepio/content test:int` → FAIL.

- [ ] **Step 3: Implement `seed`.** Deletes all `nodes` (cascade clears lessons) and re-inserts in tree order with `position` = array index; uploads images with `upsert: true` to `images/seed/<file>`; upserts `settings`/`ai_settings` row 1 **only if missing** (never overwrite the owner's edits); creates the admin user via `auth.admin.createUser({ email_confirm: true })` if not present. CLI entry prints counts.

- [ ] **Step 4: Run** `pnpm db:reset && pnpm --filter @prepio/content test:int` → PASS.

- [ ] **Step 5: Commit** `feat(content): idempotent seed script`.

---

### Task 5: Student app scaffold, data layer, home screen

**Files:**
- Create: `apps/mobile` via `pnpm create expo-app@latest apps/mobile` (default template, then remove example screens), `app/_layout.tsx`, `app/index.tsx`, `src/lib/supabase.ts`, `src/lib/content.ts`, `src/components/Screen.tsx`, `apps/mobile/.env.example`
- Test: `apps/mobile/src/lib/content.test.ts`, `apps/mobile/app/index.test.tsx`

**Interfaces:**
- Consumes: shared types; RLS-visible tables.
- Produces:
  ```ts
  // src/lib/content.ts
  type HomeData = { welcomeMessage: string; sections: Array<{ path: string[]; lessons: LessonSummary[] }> };
  function fetchHome(client?: SupabaseClient): Promise<HomeData>;
  function fetchLesson(id: string, client?: SupabaseClient): Promise<Lesson | null>;  // children sorted by position
  function groupLessonsByTree(nodes: TreeNode[], lessons: LessonSummary[]): HomeData['sections']; // pure
  function imageUrl(path: string): string; // public storage URL
  // src/components/Screen.tsx — SafeArea + ScrollView, content centered, maxWidth 720
  ```
  Env: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL`.

- [ ] **Step 1: Write failing tests.** `groupLessonsByTree`: lessons grouped under their node, `path` = titles from root to node (e.g. `['C. Statul și politica', 'Formarea statului…']`), sections and lessons ordered by tree position then lesson position, nodes without lessons omitted. Mapping test: `fetchLesson` maps snake_case rows to shared camelCase types (mock client). `index.test.tsx` (jest-expo + RNTL, `fetchHome` mocked): renders welcome message and lesson titles grouped under section headers; shows a Romanian error with a „Reîncearcă” button when fetch rejects; tapping a lesson navigates to `/lesson/<id>`.

- [ ] **Step 2: Run** `pnpm --filter @prepio/mobile test` → FAIL.

- [ ] **Step 3: Implement** the data layer and home screen. Set up React Native Paper: `PaperProvider` in `app/_layout.tsx` with an MD3 light theme built from `@prepio/shared` `colors`/`fonts` (`src/theme/paperTheme.ts`), load Lora + Source Sans 3 with `useFonts` (splash held until loaded), bordeaux app bar with the „Prepio” wordmark. Home: welcome message in a Paper `Card`, domains as section headers (Lora), lessons as `List.Item`/`Card` rows with a chevron.

- [ ] **Step 4: Run** tests → PASS. Then: `pnpm db:start && pnpm seed`, `pnpm --filter @prepio/mobile web` (port 8081) — **browser verification** (Global Constraints): home shows the welcome message and three lessons grouped by domain, theme applied, no console errors, OK at 360px and desktop.

- [ ] **Step 5: Commit** `feat(mobile): Expo app scaffold and home screen`.

---

### Task 6: Lesson screen — cards and questions

**Files:**
- Create: `app/lesson/[id].tsx`, `src/components/{CardStepper,QuestionView,ChoiceQuestion,OrderQuestion,DifficultyBadge}.tsx`
- Test: `src/components/CardStepper.test.tsx`, `src/components/QuestionView.test.tsx`, `app/lesson/[id].test.tsx`

**Interfaces:**
- Consumes: `fetchLesson`, `imageUrl` (Task 5); `checkAnswer`, `shuffleForDisplay`, `DIFFICULTY_LABELS` (Task 1).
- Produces: lesson screen with phases `cards → questions → exercises → done`; `<QuestionView question onAnswered(correct: boolean)/>`. The exercises phase renders `WritingExercise` from Task 12 — until then a placeholder component `src/components/WritingExercise.tsx` exporting `WritingExercise({ exercise }: { exercise: WritingExercise })`.

Behaviour: cards one at a time with „Înapoi”/„Următorul” and a counter („3 / 8”); questions one at a time — single choice (radio), multiple choice (checkboxes, „Verifică” button), chronological order (items shuffled with `shuffleForDisplay`, up/down buttons to reorder, „Verifică”); after checking: „Corect!” / „Greșit”, correct answer highlighted (for order: correct sequence with `label` years), `explanation`, then „Următoarea întrebare”. Difficulty shown as a badge. Finished lesson shows a short summary (X din Y întrebări corecte) and „Înapoi la lecții”.

- [ ] **Step 1: Write failing tests:**
  - CardStepper: shows first card, counter, next/prev bounds; card with `imagePath` renders the image with `imageCredit` in small text under it, and the image's `onError` hides image + credit while text remains; card without image renders text only.
  - QuestionView: each type — correct path shows „Corect!”, wrong path shows „Greșit” plus correct answer and explanation; „Verifică” disabled until a selection exists; order question initial order differs from correct order.
  - Lesson screen: lesson with 0 cards starts at questions; with 0 questions goes from cards to exercises; with 0 exercises ends at summary; `fetchLesson` → `null` shows „Lecția nu a fost găsită”.

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** tests → PASS; **browser verification** of all three seeded lessons: every card, every question type answered both right and wrong, summary screen; index-card look and difficulty badges per the design tokens.
- [ ] **Step 5: Commit** `feat(mobile): lesson cards and questions`.

---

### Task 7: Admin scaffold and owner authentication

**Files:**
- Create: `apps/admin` via `pnpm create next-app@latest apps/admin --ts --no-tailwind --app --src-dir --eslint --use-pnpm`, add `bootstrap` + `react-bootstrap`, `src/app/theme.css` (Bootstrap CSS-variable overrides from the design tokens; Lora/Source Sans 3 via `next/font/google`), `src/lib/supabase/{server,client,admin}.ts`, `src/middleware.ts`, `src/app/login/page.tsx`, `src/app/login/actions.ts`, `src/app/(admin)/layout.tsx`, `apps/admin/.env.example`
- Test: `apps/admin/src/middleware.test.ts`, `apps/admin/e2e/auth.spec.ts` (Playwright)

**Interfaces:**
- Produces: `createServerClient()` (cookie-based `@supabase/ssr`, user session), `createBrowserClient()`, `createAdminClient()` (service role, server-only — imports `server-only`). Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `STUDENT_WEB_ORIGINS` (comma-separated). Admin layout: sidebar „Conținut”, „Setări”, „Ieșire”.
- Middleware: unauthenticated request to any path except `/login` and `/api/*` → redirect to `/login`.

- [ ] **Step 1: Write failing tests:** middleware unit test (no session → 307 to `/login`; `/api/evaluate` passes through; session present → passes). Playwright: wrong password shows „Email sau parolă greșită”; correct credentials (seeded admin) land on `/`; „Ieșire” returns to `/login`.
- [ ] **Step 2: Run** `pnpm --filter @prepio/admin test` and `pnpm --filter @prepio/admin e2e` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS; **browser verification**: login page (centered Bootstrap card, bordeaux button, Lora heading), wrong/right password, logout.
- [ ] **Step 5: Commit** `feat(admin): Next.js scaffold and owner login`.

---

### Task 8: Admin — content tree and lessons list

**Files:**
- Create: `src/app/(admin)/page.tsx` (tree view), `src/app/(admin)/actions/tree.ts`, `src/components/TreeEditor.tsx`
- Test: `src/app/(admin)/actions/tree.test.ts`, `e2e/tree.spec.ts`

**Interfaces:**
- Produces server actions (all use `createServerClient`, revalidate `/`):
  `createNode(parentId: string | null, title: string)`, `renameNode(id, title)`, `moveNode(id, direction: 'up' | 'down')`, `deleteNode(id)`, `createLesson(nodeId, title): Promise<{ id: string }>`, `moveLesson(id, direction)`, `setLessonStatus(id, status: LessonStatus)`, `deleteLesson(id)`.
  `moveX` swaps `position` with the adjacent sibling; positions stay contiguous after deletes.

UI: nested tree; each node has add-child / rename / up / down / delete; lessons listed under their node with status pill („Ciornă”/„Publicată”), publish toggle, up/down, edit link, delete. Deleting a node asks for confirmation stating how many sub-nodes and lessons will be deleted.

- [ ] **Step 1: Write failing tests:** action tests against local Supabase (authenticated test user): create/rename; move up at top is a no-op; delete renumbers siblings; publish toggles status. Playwright: create a node and lesson, publish it, see the pill change; delete-node confirm text shows the counts.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (Bootstrap `ListGroup`, `Button`, `Badge`, `Modal` for confirmations). **Step 4: Run** → PASS; **browser verification** of every tree/lesson action.
- [ ] **Step 5: Commit** `feat(admin): content tree and lessons management`.

---

### Task 9: Admin — lesson editor (cards with images, questions, exercises)

**Files:**
- Create: `src/app/(admin)/lessons/[id]/page.tsx`, `src/app/(admin)/lessons/[id]/actions.ts`, `src/components/editor/{LessonHeader,CardsEditor,QuestionsEditor,QuestionForm,ExercisesEditor}.tsx`
- Test: `src/components/editor/QuestionForm.test.tsx`, `src/app/(admin)/lessons/[id]/actions.test.ts`, `e2e/lesson-editor.spec.ts`

**Interfaces:**
- Consumes: `validateQuestion` (Task 1).
- Produces actions: `updateLesson(id, { title })`; `saveCard(lessonId, card: Partial<Card> & { body: string })` (insert when no id); `uploadCardImage(lessonId, file: File): Promise<{ path: string }>` (uploads to `images/lessons/<lessonId>/<uuid>.<ext>`, max 5 MB, jpeg/png/webp); `saveQuestion(lessonId, q)`; `saveExercise(lessonId, e)`; `deleteItem(table: 'cards' | 'questions' | 'writing_exercises', id)`; `moveItem(table, id, direction)`. `saveQuestion` rejects with the Romanian messages from `validateQuestion`.

UI: three tabs „Carduri” / „Întrebări” / „Exerciții de redactare”. Card form: title (optional), body (textarea; plain text with blank-line paragraphs), image upload with preview + credit field + remove. Question form adapts to type: choice options with add/remove and correct checkbox (radio for single); order items listed in correct order with optional year label and up/down. Exercise form: prompt + criteria (textarea, one criterion per line hint).

- [ ] **Step 1: Write failing tests:** QuestionForm switching type resets options appropriately; single-choice with two correct shows the validation error and does not call save; action tests: upload rejects >5 MB and non-image; save/delete/move round-trip. Playwright: add a card with an image, a question of each type and an exercise; publish; the lesson appears in the student app's `fetchLesson` result.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (Bootstrap `Tabs`, `Form`, `Card`, `Alert`). **Step 4: Run** → PASS; **browser verification**: create a full lesson in the admin, publish it, open it in the student web app.
- [ ] **Step 5: Commit** `feat(admin): lesson editor for cards, questions and exercises`.

---

### Task 10: Admin — settings page

**Files:**
- Create: `src/app/(admin)/settings/page.tsx`, `src/app/(admin)/settings/actions.ts`
- Test: `src/app/(admin)/settings/actions.test.ts`

**Interfaces:**
- Produces: `saveSettings({ welcomeMessage: string; rules: string; gradeMin: number; gradeMax: number; model: string })` — validates `gradeMin` < `gradeMax`, integers, `model` non-empty; Romanian errors.

UI: „Mesaj de bun venit” textarea; section „Evaluare AI”: rules textarea (large), grade min/max inputs, model input with hint.

- [ ] **Step 1: Write failing tests:** saving persists both rows; `gradeMin >= gradeMax` → error, nothing saved; unauthenticated call throws.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; **browser verification**: change the welcome message and see it in the student web app; invalid grade range shows the error.
- [ ] **Step 5: Commit** `feat(admin): settings for welcome message and AI rules`.

---

### Task 11: Essay evaluation API

**Files:**
- Create: `src/lib/evaluate/{prompt,rateLimit,openai,handler,cors}.ts`, `src/app/api/evaluate/route.ts`
- Test: `src/lib/evaluate/prompt.test.ts`, `src/lib/evaluate/handler.test.ts`

**Interfaces:**
- Consumes: `createAdminClient` (Task 7), `consume_rate_limit` (Task 2), shared `EvaluateRequest/Response/Error`, `MAX_ESSAY_CHARS`.
- Produces:
  ```ts
  function buildEvaluationInput(a: { rules: string; gradeMin: number; gradeMax: number; exercise: { prompt: string; criteria: string }; text: string }): { instructions: string; input: string };
  const evaluationSchema: z.ZodObject<{ grade: z.ZodNumber; summary: z.ZodString; suggestions: z.ZodArray<z.ZodString> }>;
  type Evaluator = (a: { model: string; instructions: string; input: string }) => Promise<unknown>; // raw parsed JSON
  function createOpenAIEvaluator(apiKey: string): Evaluator; // Responses API + zodTextFormat, 30s timeout
  type Deps = { db: SupabaseClient; evaluate: Evaluator; rateLimit: (key: string) => Promise<boolean> };
  function handleEvaluate(body: unknown, ip: string, deps: Deps): Promise<{ status: number; json: EvaluateResponse | EvaluateError }>;
  function corsHeaders(origin: string | null, allowed: string[]): Record<string, string>;
  ```
  Route: `POST` + `OPTIONS`; IP = first entry of `x-forwarded-for`, else `'unknown'`; rate-limit key `evaluate:<ip>` with limit 10 / 3600 s.

Error mapping (status / code / Romanian message):
400 `bad_request` (body not `{exerciseId: string, text: string}`), 400 `empty` („Scrie un text înainte de a-l trimite.”), 400 `too_long` („Textul depășește 3000 de caractere.”), 404 `not_found` (exercise missing or its lesson not published), 429 `rate_limited` („Ai atins limita de evaluări pentru moment. Încearcă din nou peste o oră.”), 502 `ai_failed` („Evaluarea nu a reușit. Încearcă din nou.”) on evaluator throw/timeout or schema mismatch.

Order of checks: shape → empty → length → exercise lookup → rate limit → AI. (Invalid requests never consume quota.)

- [ ] **Step 1: Write failing tests.** `prompt.test.ts`: instructions contain the rules and the scale („de la 1 la 10” for 1/10); input contains prompt, criteria and student text, with the student text delimited so it can't be confused with instructions. `handler.test.ts` (fake deps):
  - valid request → 200 with grade, summary, suggestions, `gradeMin`/`gradeMax`.
  - grade 14 from the model with scale 1–10 → 10; 7.6 → 8.
  - text of 3000 code points containing ș/ț/ă → 200; 3001 → 400 `too_long`; whitespace-only → 400 `empty`.
  - unpublished lesson's exercise → 404; unknown id → 404.
  - rateLimit false → 429; evaluator not called.
  - evaluator throws / returns `{grade: "x"}` → 502 `ai_failed`; response never contains a stack.
  - `corsHeaders`: allowed origin echoed; others get no `Access-Control-Allow-Origin`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; manual `curl` against `pnpm --filter @prepio/admin dev` with a real `OPENAI_API_KEY` (if the owner has provided it) returns a sensible Romanian evaluation.
- [ ] **Step 5: Commit** `feat(admin): essay evaluation API with rate limiting`.

---

### Task 12: Student writing exercise screen

**Files:**
- Modify: `apps/mobile/src/components/WritingExercise.tsx` (replace placeholder)
- Create: `apps/mobile/src/lib/api.ts`
- Test: `apps/mobile/src/lib/api.test.ts`, `apps/mobile/src/components/WritingExercise.test.tsx`

**Interfaces:**
- Consumes: `EvaluateRequest/Response/Error`, `MAX_ESSAY_CHARS`.
- Produces: `evaluateEssay(req: EvaluateRequest): Promise<EvaluateResponse>` — throws `EvaluateApiError { code: EvaluateErrorCode; message: string }`; network failure → code `ai_failed` with „Nu ne-am putut conecta. Verifică internetul și încearcă din nou.”

UI: prompt, multiline input with live counter („1234 / 3000”), „Trimite pentru evaluare” (disabled when empty or over limit), loading state („Se evaluează…”), result card with grade („Nota: 8 / 10”), summary and suggestions list; text stays editable and „Retrimite” re-evaluates; errors shown inline using the server's Romanian message. Multiple exercises in a lesson are shown one at a time with „Următorul exercițiu”.

- [ ] **Step 1: Write failing tests:** `api.test.ts` with mocked `fetch`: 200 → parsed response; 429 → `EvaluateApiError('rate_limited')`; network reject → `ai_failed` with the connection message. Component: button disabled for empty / 3001-char text; success renders grade and each suggestion; error renders message and keeps text; resubmit sends edited text.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; **browser verification** end-to-end on the student web app with the local admin API running (real OpenAI key if provided; otherwise the error path and the rate-limit message).
- [ ] **Step 5: Commit** `feat(mobile): writing exercises with AI feedback`.

---

### Task 13: Deploy (with the owner)

This task needs the owner. **Stop and ask** before creating any account, and ask the owner for their OpenAI API key (they must create it and set a monthly spend limit themselves; never create billing). The owner allowed using the Chrome extension for account sign-ups; the owner fills passwords/2FA.

**Files:**
- Create: `apps/mobile/eas.json`, `apps/mobile/vercel.json` (SPA rewrite to `/index.html`), `docs/deploy.md`
- Modify: `apps/mobile/app.json` (`web.output: "single"`, Android package `dev.musat.prepio`, app name „Prepio”), `README.md` (local setup + deploy summary)

- [ ] **Step 1: Supabase cloud.** Create project (region EU, e.g. Frankfurt); `supabase link`, `supabase db push`; disable sign-ups in Auth settings; run `pnpm seed` with cloud env and owner's admin credentials. Verify: anon REST call returns 3 published lessons.
- [ ] **Step 2: Admin on Vercel.** Import GitHub repo, root `apps/admin`, env vars from Task 7 (`STUDENT_WEB_ORIGINS` = student web URL, set after Step 3). Verify: login works on the production URL.
- [ ] **Step 3: Student web on Vercel.** Second project, root `apps/mobile`, build `pnpm expo export -p web`, output `dist`, `EXPO_PUBLIC_*` env vars. Verify in the browser: lessons load; a writing exercise returns an evaluation (CORS OK); admin production URL works end to end.
- [ ] **Step 4: Android APK.** `eas.json` profile `preview`: `android.buildType: "apk"`, `distribution: "internal"`, env `EXPO_PUBLIC_*` (production URLs). `pnpm dlx eas-cli build -p android --profile preview`. Verify: install link works on a real Android phone; lessons and evaluation work.
- [ ] **Step 5: Document** URLs, env vars and the rebuild/redeploy commands in `docs/deploy.md`; commit `chore: deployment config and docs`; push to `origin/main` after the owner confirms.
