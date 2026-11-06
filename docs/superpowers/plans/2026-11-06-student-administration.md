# Student Administration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give admins a full student page:
- the progress per lesson, with reset;
- a support timeline;
- suspend and reactivate;
- add credits;
- delete, optionally blocking re-registration.

Suspended students see only a suspension screen.

**Architecture:**
- **Postgres:**
  - an append-only `student_events` table, fed by triggers on existing tables plus a few RPCs;
  - suspension columns on `profiles`, enforced by *restrictive* RLS policies on every student-facing table;
  - a `blocked_emails` fingerprint table, checked in `handle_new_user()`;
  - admin security-definer functions for progress, reset, suspension and the extended student list.
- **The admin app** (server actions + the student APIs) does deletion with the service role.
- **The student app** gets a `suspended` auth status and screen, and reports two client-only events: the app was opened, and a test was failed.

**Tech Stack:**
- Supabase: Postgres, RLS, pgTAP, pgcrypto `hmac`.
- Admin: Next.js App Router, react-bootstrap, vitest, Playwright.
- Student app: Expo / React Native (+ web), jest.

**Spec:** `docs/superpowers/specs/2026-11-06-student-administration-design.md`. Approved mockup: `docs/design/2026-11-06-student-admin-mockup.html`, option A.

Run every command as `wsl -d Ubuntu-22.04 -- bash -ic "cd ~/projects/prepio_new && <cmd>"`. Playwright needs `LD_LIBRARY_PATH=~/.local/pwlibs/root/usr/lib/x86_64-linux-gnu`.

## Global Constraints

- Never show the student's answers, verdicts, scores or typed text in the admin, and never store them in `student_events.details`.
- The timeline is visible only to admins. Students have no select on `student_events`.
- Suspension is enforced on the server.
  - A suspended student can read their own `profiles` row, their own `credit_ledger` and `credit_orders`, and can delete their account.
  - Nothing else student-facing works for them. `/api/consolidation/evaluate` and `/api/credits/purchase` answer 403 `{ error: 'suspended', message: 'Contul tău este suspendat.' }`.
- A suspension needs a non-blank reason. The student sees the exact text.
- Admin accounts never appear in Elevi and can't be suspended, reset or deleted there.
- A reset deletes `lesson_progress`, `consolidation_runs` and `consolidation_attempts`, for one lesson or for all. It never touches credits, the ledger, the profile or `learning_mode`.
- Blocked re-registration:
  - It is a keyed fingerprint, `private.email_fingerprint()`, the same pepper as the welcome grant, in `blocked_emails(email_hash, reason)`. It has no user foreign key.
  - It is always created when a **suspended** student is deleted, using their suspension reason.
  - On an admin delete it is created only with „Blochează reînregistrarea” ticked, and then the reason is required.
  - A blocked email signing up again gets an account created **suspended**, with that reason and `reregistration_blocked = true`.
  - Reactivating removes the fingerprint and clears the flag.
- „Activ azi” means any `student_events` row of the student created today, Europe/Bucharest day.
- `app_opened` is recorded at most once per student per Bucharest day.
- UI copy is Romanian, exactly as written in this plan. Code, comments and commits are in English.
- DB rules: a new migration via `pnpm db:new`, RLS on every new table, pgTAP tests, never edit an applied migration.

## Review Focus

1. **A suspended student calling PostgREST directly**, for example `select` on `lessons` / `cards` or an upsert on `lesson_progress` with their token. They get 0 rows or a denial. Pinned by pgTAP in Task 2.
2. **The admin resets a lesson while the student has it open** on another device. The student's next save re-creates progress from the beginning, with no error and no orphaned run. Pinned by pgTAP in Task 3: after a reset, an upsert works and the run is gone.
3. **A blocked email comes back with different case or spaces** („ Ion@Gmail.com ”). The account is still suspended. Pinned by pgTAP in Task 2.
4. **The admin deletes a student who is suspended** without ticking block. The email is blocked anyway, with the suspension reason. Pinned by the Task 4 test.
5. **A student whose suspension starts mid-session** taps a check. They get the 403, the app refreshes the profile and lands on the suspension screen. Pinned by the Task 7 test.

---

### Task 1: Student events (timeline) — schema, triggers, backfill

**Files:**
- Create: `supabase/migrations/<ts>_student_events.sql` (`pnpm db:new student_events`), `supabase/tests/student_events.test.sql`

**Interfaces:**
- **Table** `public.student_events`:
  - columns: `id bigint generated always as identity pk`, `user_id uuid not null references auth.users on delete cascade`, `kind text not null check (kind in (…))`, `lesson_id uuid references lessons on delete set null`, `exercise_id uuid references consolidation_exercises on delete set null`, `admin_id uuid references auth.users on delete set null`, `details jsonb not null default '{}'`, `created_at timestamptz not null default now()`;
  - indexes: `(user_id, id desc)` and `(user_id, created_at)`;
  - RLS on; admins select (`is_admin()`); no other policy; `revoke all` from anon and authenticated; service_role gets select only.
- **Kinds:**
  - `registered` (details `{provider}`), `welcome_credits` (`{credits}`), `name_changed`, `mode_changed` (`{mode}`), `app_opened`;
  - `lesson_started`, `lesson_finished`, `test_failed`, `consolidation_started`, `consolidation_finished`;
  - `check` (`{cost, target}`), `check_refunded` (`{credits}`), `check_blocked` (`{required, balance}`);
  - `purchase` (`{credits}`), `credits_adjusted` (`{delta, reason}`);
  - `suspended` (`{reason, blocked?}`), `reactivated`, `progress_reset` (`{scope: 'lesson' | 'all'}`).
- **Internal writer:** `public.log_student_event(p_user uuid, p_kind text, p_lesson uuid, p_exercise uuid, p_admin uuid, p_details jsonb)`. It is security definer, `search_path = ''`, executable by no client role. Task 4 grants a wrapper to service_role.
- **Triggers** (all `after`, security definer functions):
  - `profiles` insert → `registered`, with the provider from `auth.users.raw_app_meta_data->>'provider'`.
  - `profiles` update:
    - `display_name` changed and the old value not null → `name_changed`;
    - `learning_mode` changed → `mode_changed` with the new mode.
  - `lesson_progress`:
    - insert → `lesson_started`;
    - `finished_at` goes from null to non-null, on insert or update → `lesson_finished`.
  - `consolidation_runs`:
    - insert → `consolidation_started`;
    - `finished_at` goes from null to non-null → `consolidation_finished`.
  - `credit_ledger` insert:
    - `welcome` → `welcome_credits`;
    - `check` → `check` (with `exercise_id`, `cost = -delta`, `target`);
    - `refund` → `check_refunded`;
    - `purchase` → `purchase`;
    - `admin` → `credits_adjusted` (with `admin_id`, delta and reason).
- **Client RPCs** (authenticated, acting on `auth.uid()` only):
  - `public.log_app_open() returns void` inserts `app_opened` unless a row of that kind exists for today in Europe/Bucharest.
  - `public.log_test_failed(p_lesson uuid) returns void` inserts `test_failed`. The lesson must be published; otherwise it raises `bad_lesson`.
- **Backfill**, in the same migration, before the triggers are created:
  - `registered` at `auth.users.created_at`;
  - `lesson_finished` at `lesson_progress.finished_at`;
  - `consolidation_finished` at `consolidation_runs.finished_at`;
  - every `credit_ledger` row mapped as above, at its `created_at`;
  - each insert guarded with `where not exists` on `(user_id, kind, created_at)`.

- [ ] **Step 1: Write the failing pgTAP test `student_events.test.sql`.**
  - A new `auth.users` insert yields `registered` and `welcome_credits`.
  - Setting `display_name` from null does not log; renaming logs `name_changed`. Setting `learning_mode` logs `mode_changed`.
  - A `lesson_progress` insert logs `lesson_started`; setting `finished_at` logs `lesson_finished` once; updating the position again logs nothing.
  - A run insert logs `consolidation_started`; finishing it logs `consolidation_finished`.
  - `spend_credits` → `check` with cost; `refund_credits` → `check_refunded`; `purchase_credit_package` → `purchase`; `admin_adjust_credits` → `credits_adjusted` with `admin_id`.
  - As the student:
    - `log_app_open()` twice → 1 row;
    - `log_test_failed(published)` → 1 row; a draft lesson → `bad_lesson`;
    - `select from student_events` → 0 rows;
    - insert into `student_events` → 42501.
  - As an admin, the select sees the rows.
  - Deleting the user cascades the rows.
- [ ] **Step 2:** `pnpm db:test`. Expected: FAIL.
- [ ] **Step 3:** `pnpm db:new student_events`, then write the migration.
- [ ] **Step 4:** `pnpm db:reset && pnpm seed && pnpm db:test`. Expected: all suites pass.
- [ ] **Step 5: Commit** (`feat(db): student events timeline`).

### Task 2: Suspension, blocked emails, enforcement

**Files:**
- Create: `supabase/migrations/<ts>_student_suspension.sql`, `supabase/tests/student_suspension.test.sql`

**Interfaces:**
- **New `profiles` columns:**
  - `suspended_at timestamptz`, `suspended_reason text`, `suspended_by uuid references auth.users on delete set null`, `reregistration_blocked boolean not null default false`;
  - `check ((suspended_at is null) = (suspended_reason is null))` and `check (suspended_reason is null or btrim(suspended_reason) <> '')`;
  - students get no update grant on these columns.
- **`public.is_suspended() returns boolean`:** stable, security definer, true when the caller's profile has `suspended_at` set. It is executable by authenticated.
- **Restrictive policies** (`create policy … as restrictive for all to authenticated using (public.is_admin() or not public.is_suspended()) with check (same)`) on `nodes`, `lessons`, `cards`, `questions`, `sources`, `solution_templates`, `consolidation_exercises`, `consolidation_exercise_sources`, `lesson_progress`, `consolidation_attempts`, `consolidation_runs`, `credit_packages`, `settings`. None on `profiles`, `credit_ledger` or `credit_orders`.
- **`public.blocked_emails`:** `email_hash bytea pk`, `reason text not null check (btrim(reason) <> '')`, `blocked_at timestamptz not null default now()`. RLS on, no policies, `revoke all` from anon, authenticated and service_role.
- **`public.admin_suspend_student(p_user uuid, p_reason text) returns void`** (authenticated, `is_admin()` or 42501):
  - raises `reason_required` for a blank reason and `cannot_target_admin` for an admin target;
  - sets the four suspension values with `suspended_by = auth.uid()`; suspending an already suspended student just replaces the reason;
  - logs `suspended` with `admin_id` and `{reason}`.
- **`public.admin_reactivate_student(p_user uuid) returns void`** (admin):
  - clears the suspension fields and `reregistration_blocked`;
  - deletes the `blocked_emails` row of `private.email_fingerprint(auth.users.email)`;
  - logs `reactivated`.
- **`public.block_student_email(p_user uuid, p_reason text) returns void`** (service_role only):
  - upserts the fingerprint of the user's email with the reason;
  - raises `reason_required` for a blank reason; does nothing when the email is null.
- **`handle_new_user()`** is replaced with the same body, plus one step after the welcome grant: when `private.email_fingerprint(new.email)` is in `blocked_emails`, update the profile to suspended with that reason, `suspended_by = null` and `reregistration_blocked = true`, and log `suspended` with `{reason, blocked: true}`.

- [ ] **Step 1: Write the failing pgTAP test `student_suspension.test.sql`.**
  - Admin suspends student f1 with „Test”. As f1:
    - `select` from `lessons`, `cards` and `consolidation_exercises` → 0 rows;
    - `insert` into `lesson_progress` → 42501 (RLS violation);
    - own `profiles` row readable, with `suspended_reason = 'Test'`;
    - own `credit_ledger` readable;
    - `update profiles set suspended_at = null` → 42501.
  - A non-suspended f2 still reads lessons.
  - `admin_suspend_student` as f2 → 42501; a blank reason → `reason_required`; an admin target → `cannot_target_admin`.
  - Reactivate → f1 reads lessons again, and `reactivated` is logged.
  - As service_role, `block_student_email(f1, 'Abuz')`. Delete f1, then insert a new user with email `' F1@Test.local '`:
    - the new profile is suspended with „Abuz” and `reregistration_blocked`;
    - after admin reactivation, delete it, insert again → not suspended.
  - `block_student_email` with a blank reason → `reason_required`.
  - `blocked_emails` is not selectable by authenticated or service_role.
- [ ] **Step 2:** `pnpm db:test`. Expected: FAIL.
- [ ] **Step 3:** Write the migration.
- [ ] **Step 4:** `pnpm db:reset && pnpm seed && pnpm db:test`. Expected: PASS, and the existing suites unchanged.
- [ ] **Step 5: Commit** (`feat(db): student suspension and blocked re-registration`).

### Task 3: Admin progress, reset and the extended student list (DB)

**Files:**
- Create: `supabase/migrations/<ts>_student_admin.sql`, `supabase/tests/student_admin.test.sql`

**Interfaces** (all authenticated, security definer, `search_path = ''`, `is_admin()` or 42501; an admin target raises `cannot_target_admin`):
- **`public.admin_student_progress(p_user uuid)`** returns `table(lesson_id uuid, finished_at timestamptz, position jsonb, progress_updated_at timestamptz, cards_total int, questions_total int, run_index int, run_total int, run_finished_at timestamptz, run_updated_at timestamptz)`. It has one row per lesson that has progress or a run, and counts only published content.
- **`public.admin_reset_progress(p_user uuid, p_lesson uuid default null) returns void`:**
  - deletes that user's `consolidation_attempts` for the lesson's exercises, or all of them;
  - deletes `consolidation_runs` and `lesson_progress` for the lesson, or all of them;
  - logs `progress_reset` with `lesson_id` and `{scope}`.
- **`admin_students` is dropped and recreated** as `admin_students(p_search text, p_limit int, p_offset int, p_id uuid default null, p_filter text default 'all')`. It returns the previous columns plus `provider text`, `suspended_at timestamptz`, `suspended_reason text`, `reregistration_blocked boolean`, `last_activity_at timestamptz` (max `student_events.created_at`, falling back to `auth.users.last_sign_in_at`) and `lessons_finished int`.
  - `p_filter`: `'all'` | `'suspended'` | `'active_today'`; anything else raises `bad_filter`.
  - `total` counts after the filter.
- **`public.admin_student_events(p_user uuid, p_limit int, p_before bigint default null)`** returns `table(id bigint, kind text, details jsonb, created_at timestamptz, lesson_id uuid, lesson_title text, exercise_type text, exercise_prompt text, admin_email text)`, newest first.

- [ ] **Step 1: Write the failing pgTAP test `student_admin.test.sql`.**
  - Fixtures: two published lessons with cards, questions and exercises; the student has progress on both, a run and attempts on lesson A.
  - `admin_student_progress` returns both lessons with the correct `cards_total` / `run_total`.
  - `admin_reset_progress(f1, A)`:
    - removes A's progress, run and attempts, and leaves B;
    - the credit balance and the ledger are unchanged;
    - `progress_reset` is logged;
    - then, as f1, an upsert on `lesson_progress` for A succeeds.
  - `admin_reset_progress(f1)` removes everything.
  - Filters:
    - `admin_students` with `'suspended'` lists only suspended students;
    - with `'active_today'` it lists a student with an event today and not one whose only event is backdated 2 days;
    - `'nope'` → `bad_filter`.
  - `admin_student_events` returns the lesson title and the admin email.
  - Non-admin → 42501.
- [ ] **Step 2:** `pnpm db:test`. Expected: FAIL.
- [ ] **Step 3:** Write the migration. Update `credits.test.sql` only if the `admin_students` signature change breaks it, and keep its assertions.
- [ ] **Step 4:** `pnpm db:reset && pnpm seed && pnpm db:test`. Expected: PASS.
- [ ] **Step 5: Commit** (`feat(db): admin student progress, reset and filters`).

### Task 4: Server — suspended APIs, blocked deletion, check_blocked event

**Files:**
- Modify: `packages/shared/src/consolidation/types.ts` and `packages/shared/src/credits.ts` (add the `'suspended'` error code to `ConsolidationEvaluateErrorCode` and `CreditsPurchaseErrorCode`)
- Modify: `apps/admin/src/lib/consolidation/handler.ts` (+ test), `apps/admin/src/lib/credits/purchase.ts` (+ test), `apps/admin/src/lib/account/deleteAccount.ts` (+ int test)
- Create: `supabase/migrations/<ts>_student_event_service.sql` with `public.log_student_event_service(p_user uuid, p_kind text, p_exercise uuid, p_details jsonb)`, granted to service_role and limited to `kind = 'check_blocked'`; test in `student_events.test.sql`

**Interfaces:**
- `ERRORS.suspended = { status: 403, message: 'Contul tău este suspendat.' }` in both handlers.
- The evaluate handler, after parse and before load, reads `profiles.suspended_at` for the user with the service db. Suspended → 403 `suspended`, with no rate limit and no spend.
- On 402 `insufficient_credits`, it calls `log_student_event_service(userId, 'check_blocked', exerciseId, { required, balance })`. A failure is logged and ignored.
- Purchase handler: same suspension check before the RPC → 403.
- `deleteAccount(userId, db, opts?: { blockReason?: string })` returns `'deleted' | 'forbidden_admin'`.
  - It reads the profile.
  - When `suspended_at` is set, it calls `block_student_email(userId, opts?.blockReason ?? suspended_reason)`; when `opts.blockReason` is given, it calls it with that reason.
  - Then it deletes the auth user. A blank `blockReason` throws `UserError('Motivul este obligatoriu.')`.
  - The student route (`/api/account/delete`) calls it without opts, so a suspended student's own deletion always blocks.

- [ ] **Step 1: Write the failing tests.**
  - Handler: a suspended user → 403 `{error:'suspended', message:'Contul tău este suspendat.'}`, and `rateLimit`, `spend` and `evaluate` are not called. A 402 → the service event RPC is called with `required` and `balance`; an RPC failure still returns 402.
  - Purchase: suspended → 403, no purchase RPC.
  - `deleteAccount` int test:
    - suspended student deleted with no opts → a new sign-up with the same email is suspended with the old reason;
    - active student with `blockReason: 'X'` → the same, with „X”;
    - active student without opts → the new sign-up is active;
    - blank `blockReason` → UserError;
    - admin → `forbidden_admin`.
- [ ] **Step 2:** `pnpm --filter @prepio/admin test && pnpm --filter @prepio/admin test:int && pnpm db:test`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the same commands plus `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** (`feat(api): suspended students are refused; deletion can block re-registration`).

### Task 5: Admin data layer and Elevi list filters

**Files:**
- Modify: `apps/admin/src/lib/data/students.ts` (+ `students.int.test.ts`, `students.test.ts`), `apps/admin/src/app/(admin)/students/page.tsx`, `apps/admin/src/app/(admin)/students/actions.ts`

**Interfaces:**
- `StudentRow` gains `provider: string | null`, `suspendedAt: string | null`, `suspendedReason: string | null`, `reregistrationBlocked: boolean`, `lastActivityAt: string | null`, `lessonsFinished: number`.
- `type StudentFilter = 'all' | 'suspended' | 'active_today'`. `listStudents(db, { search, page, filter })`.
- `type LessonProgressRow = { lessonId; title; status: 'not_started' | 'in_progress' | 'finished'; where: string; lastActivityAt: string | null }`. `getStudentProgress(db, userId): Promise<LessonProgressRow[]>` returns every published lesson in tree order, the same order as `getTree` flattened depth-first by position.
  - `where` copy:
    - not started → „—”;
    - cards phase → „Card {index+1} din {cards_total}”;
    - questions phase → „Verificare, întrebarea {index+1}”;
    - finished with no run → „Terminată”;
    - a run not finished → „Consolidare {run_index+1}/{run_total}”;
    - a run finished → „Consolidare {run_total}/{run_total}”.
  - Status: finished if `finished_at` is set, in progress if progress or a run exists, otherwise not started.
  - Last activity = max(progress updated, run updated).
- `type StudentEvent = { id: number; kind: string; createdAt: string; label: string; details: string | null }`. `getStudentEvents(db, userId, before?)` returns 50 rows. `eventLabel(e)` gives this copy:
  - registered → „S-a înregistrat cu {Google | email}”; welcome_credits → „A primit {creditsLabel(n)} de bun venit”;
  - name_changed → „Și-a schimbat numele”; mode_changed → „A ales modul {Traseu ghidat | Explorare liberă}”; app_opened → „A intrat în aplicație”;
  - lesson_started → „A început lecția „{title}””; lesson_finished → „A terminat lecția „{title}””; test_failed → „Nu a trecut testul lecției „{title}””;
  - consolidation_started → „A început consolidarea „{title}””; consolidation_finished → „A terminat consolidarea „{title}””;
  - check → „Verificare cu profesorul digital · {type label} · −{cost}”; check_refunded → „Verificare nereușită · credite returnate”; check_blocked → „Verificare blocată · avea {balance}, trebuiau {required}”;
  - purchase → „A cumpărat {creditsLabel(n)}”; credits_adjusted → „{admin}: credite {±delta} · {reason}”;
  - suspended → „{admin | Sistem (reînregistrare blocată)}: cont suspendat · „{reason}””; reactivated → „{admin}: cont reactivat”;
  - progress_reset → „{admin}: parcurs resetat · {lecția „{title}” | toate lecțiile}”;
  - a deleted lesson → „(lecție ștearsă)”.
- Mutations, mapping RPC errors to `UserError`:
  - `suspendStudent(db, userId, reason)`; `reactivateStudent(db, userId)`; `resetProgress(db, userId, lessonId | null)`;
  - `deleteStudent(serviceDb, userId, { confirmEmail, block, reason })`. It checks that `confirmEmail` trimmed and lower-cased equals the student's email, else „Emailul nu se potrivește.”, then calls `deleteAccount(userId, serviceDb, block ? { blockReason: reason } : undefined)`.
  - Messages: „Motivul este obligatoriu.” (reason_required), „Conturile de administrator nu pot fi modificate aici.” (cannot_target_admin).
- **List page:**
  - chips „Toți” / „Suspendați” / „Activi azi” (query param `filter`), kept together with `q` and `page`;
  - new column „Stare” with a badge „Activ” (green) or „Suspendat” (red), plus a small „Reînregistrare blocată” when the flag is set;
  - a column „Ultima activitate”;
  - empty states „Niciun elev suspendat.” and „Niciun elev activ azi.”

- [ ] **Step 1: Write the failing tests.**
  - Unit (`students.test.ts`): every `where` case; every `eventLabel` kind, including the deleted lesson and a system suspension.
  - Int:
    - `listStudents` with each filter;
    - `getStudentProgress` order and statuses;
    - suspend → reactivate;
    - `resetProgress` for one lesson and for all;
    - `deleteStudent` with an email mismatch, with block (requires reason) and without block;
    - `getStudentEvents` pagination with `before`.
  - Clean up `[test]` users afterwards.
- [ ] **Step 2:** `pnpm --filter @prepio/admin test && pnpm --filter @prepio/admin test:int`. Expected: FAIL.
- [ ] **Step 3:** Implement the data layer, server actions (deletion uses `createAdminClient()` after checking `is_admin` through the session client) and the list page.
- [ ] **Step 4:** Run the same commands plus the admin typecheck and lint. Expected: PASS.
- [ ] **Step 5: Commit** (`feat(admin): student filters, progress, timeline and actions data layer`).

### Task 6: Admin student page (option A)

**Files:**
- Modify: `apps/admin/src/app/(admin)/students/[id]/page.tsx`
- Create, in `apps/admin/src/app/(admin)/students/[id]/`: `StudentHeader.tsx`, `ProgressTab.tsx`, `TimelineTab.tsx`, `SuspendDialog.tsx`, `DeleteDialog.tsx`, `ResetDialog.tsx`; keep `AdjustCreditsForm.tsx` and open it from the header
- Test: component tests next to them; `apps/admin/e2e/students.spec.ts` extended

**Interfaces:**
- Consumes the Task 5 data layer and actions.
- The tab is chosen by the query param `tab` = `parcurs` (default) | `cronologie` | `credite` | `comenzi`.
- **Header:**
  - initials avatar, name (or „Fără nume”), email · provider · „înregistrat {d MMM yyyy}” · „ultima activitate {relative or date}”;
  - status badge;
  - for a suspended student, a red strip „Suspendat de {admin | sistem} pe {date} · Motiv: „{reason}””;
  - three numbers: „Lecții terminate {n} / {total}”, „Credite 🪙 {balance}”, „Mod {Traseu ghidat | Explorare liberă | —}”;
  - buttons: „Ajustează credite”, „Resetează tot parcursul”, „Suspendă” (or „Reactivează” when suspended), „Șterge contul”.
- **ProgressTab:** a table with the columns Lecție / Stare (badges Neîncepută gray, În curs yellow, Terminată green) / Unde a rămas / Ultima activitate, and „Resetează” on rows that are not „Neîncepută”.
- **TimelineTab:** rows with the date and time („6 nov, 18:40”) and the label from `eventLabel`, newest first, then „Mai vechi” when 50 rows came back. Empty: „Încă nu există activitate.”
- **ResetDialog:**
  - one lesson: „Resetezi lecția „{title}”? Se șterg progresul și răspunsurile salvate ale elevului la această lecție. Creditele nu se schimbă.”
  - all: „Resetezi tot parcursul elevului? Se șterg progresul și răspunsurile salvate la toate lecțiile. Creditele nu se schimbă.”
  - buttons „Resetează” (danger) and „Renunță”.
- **SuspendDialog:** title „Suspendă contul”, field „Motiv (îl vede elevul)” (textarea, required), buttons „Suspendă” (danger) and „Renunță”. Reactivate uses a confirm dialog: „Reactivezi contul? Elevul își recapătă accesul imediat.”, with the extra sentence „ Emailul nu va mai fi blocat la reînregistrare.” when blocked.
- **DeleteDialog:**
  - title „Șterge contul”, text „Se șterg definitiv contul și toate datele elevului.”;
  - checkbox „Blochează reînregistrarea cu acest email”, checked and locked for suspended students, with the hint „Elevul e suspendat: emailul se blochează automat.”;
  - when checked, the field „Motiv (îl vede elevul dacă revine)”, prefilled with the suspension reason;
  - field „Scrie emailul elevului ca să confirmi”;
  - button „Șterge definitiv” (danger), disabled until the email field matches.
  - On success, redirect to `/students` with the notice „Contul a fost șters.”
- Every action shows its error inline and refreshes the page data on success.

- [ ] **Step 1: Write the failing tests.**
  - Component tests: the header for active and suspended students; ProgressTab statuses and reset buttons; the DeleteDialog checkbox locked when suspended and the button disabled until the email matches; the SuspendDialog requiring a reason.
  - e2e with a `[test]` student who has progress (seeded through the API):
    - reset one lesson → the status becomes Neîncepută and the timeline shows „parcurs resetat”;
    - suspend → the badge and strip appear; reactivate;
    - delete with block → back on the list, then a sign-up with the same email shows „Suspendat” and „Reînregistrare blocată”;
    - clean up.
- [ ] **Step 2:** Run the component tests and `pnpm exec playwright test e2e/students.spec.ts` (in `apps/admin`). Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the same, plus the admin test, typecheck and lint. Expected: PASS.
- [ ] **Step 5: Commit** (`feat(admin): student page with progress, timeline and account actions`).

### Task 7: Student app — suspended screen and client events

**Files:**
- Modify: `apps/mobile/src/lib/profile.ts` (`Profile` gains `suspendedReason: string | null`; select `suspended_reason`), `apps/mobile/src/auth/AuthProvider.tsx` (`AuthStatus` gains `'suspended'`; `statusFor` returns `'suspended'` first when `profile?.suspendedReason`), `apps/mobile/app/_layout.tsx` (a `Stack.Protected guard={status === 'suspended'}` group)
- Create: `apps/mobile/app/(suspended)/_layout.tsx`, `apps/mobile/app/(suspended)/index.tsx`, `apps/mobile/src/screens/SuspendedScreen.tsx` (+ test)
- Modify: `apps/mobile/src/lib/api.ts` and `apps/mobile/src/lib/credits.ts` (on a 403 `suspended`, call the registered profile refresh and throw with the server message), `apps/mobile/src/lib/activity.ts` (new: `logAppOpen()`, `logTestFailed(lessonId)`; both swallow errors), `AuthProvider` (calls `logAppOpen()` when the status becomes `ready` and on foreground, at most once per local day through an in-memory date), `apps/mobile/src/screens/LessonScreen.tsx` (calls `logTestFailed` when `GuidedFailed` is shown for a fresh attempt), `apps/mobile/src/screens/PrivacyScreen.tsx` (+ test)

**Interfaces:**
- **`SuspendedScreen` copy:**
  - 🔒 as an icon (use the existing `Icon` if one fits, otherwise a lock drawn with the UI kit);
  - title „Contul tău a fost suspendat”;
  - a Surface card with „Motiv:” in bold, then the reason;
  - „Dacă crezi că e o greșeală, scrie-ne la {CONTACT_EMAIL}.” (from `lib/legal`);
  - buttons „Ieși din cont” (secondary) and „Șterge contul” (danger text button). The latter goes through the existing deletion confirmation used by `ProfileScreen`; extract or reuse it, don't duplicate the logic.
- **Privacy sentence**, added after the fingerprint sentence: „Dacă un cont este șters în timp ce e suspendat sau dacă un administrator blochează reînregistrarea, păstrăm o amprentă ireversibilă a adresei de email și motivul, ca să nu poată fi creat un cont nou.”

- [ ] **Step 1: Write the failing tests.**
  - `statusFor` with a suspended profile → `'suspended'`, even without a name.
  - SuspendedScreen shows the reason and the contact; sign-out calls `signOut`; delete opens the confirmation.
  - An evaluate 403 `suspended` → `refreshProfile` called and an error with „Contul tău este suspendat.”
  - `logAppOpen` called once for two foregrounds on the same day.
  - The GuidedFailed path calls `logTestFailed(lessonId)` once per failed attempt.
  - The privacy sentence is present.
- [ ] **Step 2:** `pnpm --filter @prepio/mobile test`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the full mobile tests and typecheck. Expected: PASS.
- [ ] **Step 5: Commit** (`feat(mobile): suspension screen and activity events`).

### Task 8: Verification, browser walk, docs

**Files:**
- Modify: `docs/STATUS.md`, `docs/deploy.md` („Student administration rollout”: migrations then admin then web then APK; old APKs ignored, owner said)

- [ ] **Step 1:** `pnpm db:reset && pnpm seed && pnpm db:test && pnpm test && pnpm typecheck && pnpm --filter @prepio/admin test:int && pnpm --filter @prepio/content test:int`, then admin e2e. Expected: everything passes.
- [ ] **Step 2: Browser walk** (headless Playwright Chromium when Claude in Chrome is not available; 360 px with touch and 1280 px for the student, desktop for the admin; console captured; screenshots in the SDD workspace).
  - **Admin:**
    - list filters;
    - the student page tabs;
    - reset of one lesson and of everything;
    - suspend → the student web shows the screen with the reason, and an AI check attempt is refused;
    - reactivate → the app works again;
    - delete with block → re-sign-up suspended → reactivate → works;
    - the timeline shows the events.
  - **Student:** the suspended screen at 360 and 1280; „Ieși din cont”; „Șterge contul”.
  - `[test]` data removed afterwards; the seeded content intact.
- [ ] **Step 3:** Update STATUS: the "Where we are" entry, decisions, phone checks (the suspension screen, Android back can't leave it). Write `docs/deploy.md`.
- [ ] **Step 4: Commit** (`docs: student administration status`).
- [ ] **Step 5: Production** (owner pre-approved releases while there are no real users, but confirm in chat): `pnpm db:cloud:push:dry` (lists only this plan's migrations) → `pnpm db:cloud:push` → `git push` → admin and web Ready → EAS preview APK → read-only production checks (anon denied on `student_events` and `blocked_emails`; the backfill counts: one `registered` event per user).
