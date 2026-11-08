# Paid Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Accounts start in a trial with only the first lesson; a one-off payment (still `provider='none'`) opens every lesson for an admin-set number of months and adds admin-set bonus credits; expiry returns the account to the trial; admins configure the offer and grant / revoke access.

**Architecture:**
- **Postgres decides access.** `profiles.access_until` (no client write grant) is changed only by security-definer functions that also write `access_ledger`. Restrictive RLS policies hide locked lessons' content and refuse progress writes; `now()` is the only clock.
- **The admin app's API routes** sell access (`POST /api/access/purchase`) and refuse digital-teacher checks on locked lessons before any charge.
- **Student app:** an `AccessProvider` (next to `CreditsProvider`) exposes the plan and the offer; lesson state `paywall`, a combined plan + credits pill, banners, `PaywallSheet`, „Abonamentul meu”.

**Tech Stack:** Supabase (Postgres, RLS, pgTAP, pg_cron) · Admin: Next.js App Router, react-bootstrap, vitest, Playwright · Student app: Expo / React Native (+ web), jest · `@prepio/shared`.

**Spec:** `docs/superpowers/specs/2026-11-08-paid-access-design.md`. Mockup: `docs/design/2026-11-08-paid-access-mockup.html` (top-bar option **B**).

Run every command from Windows as `wsl -d Ubuntu-22.04 -- bash -ic "cd ~/projects/prepio_new && <cmd>"`. Below, only `<cmd>` is shown. Follow `docs/database-migrations.md` for the migration. Previous feature plans with the same patterns: `docs/superpowers/plans/2026-11-06-credits.md`.

## Global Constraints

- Defaults: price **15000 bani (150 lei)**, bonus **100** credits, duration **3** months. Checks: price 1–10000000 bani, bonus 0–10000, months 1–24. Admin grant months 1–24.
- Full access ⇔ `access_until > now()` (server). Expiring ⇔ full and `days_left <= 7`, `days_left = ceil((access_until - now) / 1 day)`.
- Extension rule everywhere: `new_until = greatest(now(), coalesce(access_until, now())) + duration_months * interval '1 month'` (Postgres month arithmetic in UTC: Jan 31 + 1 month = Feb 28/29).
- Free lesson = first published lesson in Home order: depth-first over `nodes` (siblings by `position, id`), a node's own lessons (by `position, id`) before its children. SQL and `groupLessonsByTree` must use the same tie-break.
- Admins (`is_admin()`) always see and write everything. Suspension (`*_not_suspended`) still applies on top.
- Config changes apply only to future payments (orders snapshot price, bonus, months).
- Student copy in Romanian with diacritics, from the mockup; never the word „AI”. Prices with `formatLei` from `@prepio/shared`. Dates shown in Europe/Bucharest, e.g. „8 februarie 2027”.
- Every new table has RLS and a pgTAP test; every new function revokes execute from `public, anon, authenticated, service_role` and grants only the intended role.
- Never edit applied migrations; `admin_students` changes its return type, so it is dropped and recreated in the new migration (body copied from `20261106200001_student_event_service.sql`).

## Review Focus

1. **Double tap on „Deblochează”** — two orders and two extensions. Expect the button to be disabled while the request is in flight (test in Task 9).
2. **Access expires while the student is inside a lesson or consolidation** — progress writes get 42501 and evaluate answers 403 `access_required`. Expect the app to refresh access and show the paywall sheet, keeping the typed answer, never an error loop (tests in Tasks 5 and 9).
3. **Month-end and timezone math** — the end date shown in the sheet must equal what the server stores (Jan 31 + 3 months, purchase at 23:30 Bucharest). Shared helper tested against the same cases as pgTAP (Tasks 1 and 4).
4. **Admin reorders or unpublishes the free lesson** — a trial student's previously open lesson becomes `paywall`, a new one opens, nothing crashes; with zero published lessons `free_lesson_id()` is null and every policy still evaluates (tests in Tasks 2 and 8).
5. **Stale offer** — admin changes price / bonus / months while the sheet is open → 409 `offer_changed`, the sheet shows the new offer and asks again; no charge (tests in Tasks 1, 5, 9).

---

### Task 1: Access schema, offer and money functions

**Files:**
- Create: `supabase/migrations/<ts>_paid_access.sql` (via `pnpm db:new paid_access`; Tasks 1–3 all go in this one file)
- Create: `supabase/tests/paid_access.test.sql`

**Interfaces:**
- Produces (SQL):
  - table `access_settings (id int pk check id=1, price_bani int, bonus_credits int, duration_months int)`; select to authenticated (students read the offer), no direct writes.
  - `profiles.access_until timestamptz null` (no student update grant).
  - table `access_orders (id uuid, user_id, price_bani, bonus_credits, duration_months, status in ('pending','approved','failed'), provider text default 'none', provider_ref text, created_at, approved_at)`; unique index on `(provider, provider_ref) where provider_ref is not null`; own select + admin select.
  - table `access_ledger (id bigint identity, user_id, kind in ('purchase','admin_grant','admin_revoke'), months int null, until_before timestamptz null, until_after timestamptz not null, order_id uuid null, admin_id uuid null, reason text null, created_at)`; check: admin kinds need a non-blank reason; own select + admin select.
  - `credit_ledger.kind` check gains `'access_bonus'` (drop and re-add the check constraint); `credit_ledger.access_order_id uuid null references access_orders`.
  - `student_events.kind` check gains `'access_purchased','access_granted','access_revoked','access_expired'`.
  - `public.student_event_of_ledger`: `access_bonus` → kind null; `public.student_events_on_ledger_insert` skips rows whose kind is null (the purchase event is logged by `purchase_access` itself).
  - `public.purchase_access(p_user uuid, p_price_bani int, p_bonus int, p_months int) returns table (order_id uuid, access_until timestamptz, bonus int, balance int)` — service role only; raises `offer_changed` (P0001) when any argument differs from `access_settings`; locks the profile; bonus 0 skips `credit_apply`; logs `access_purchased` with details `{months, until, price_bani, credits}`.
  - `public.admin_grant_access(p_user uuid, p_months int, p_reason text) returns timestamptz` and `public.admin_revoke_access(p_user uuid, p_reason text) returns void` — authenticated + `is_admin()`; errors `forbidden` (42501), `reason_required`, `bad_months`, `cannot_target_admin`, `student_not_found`; revoke sets `access_until = now()` and logs `access_revoked` with details `{reason, until}`; grant logs `access_granted` with `{months, until, reason}`; both set `admin_id`.
  - `public.admin_save_access_settings(p_price_bani int, p_bonus int, p_months int) returns void`.
  - `private.log_access_expiries() returns int` — inserts one `access_expired` event (created_at = `access_until`, details `{until}`) for each non-admin profile with `access_until <= now()` that has no `access_expired`/`access_revoked` event whose `details->>'until'` equals that `access_until`; scheduled with pg_cron every 10 minutes (`create extension if not exists pg_cron`; `cron.schedule('log-access-expiries', '*/10 * * * *', ...)`).

- [ ] **Step 1: Write the failing pgTAP tests** in `supabase/tests/paid_access.test.sql` (pattern: `credits.test.sql`):
  - defaults row is `(15000, 100, 3)`; a student can select it and cannot update it; a student cannot `update profiles set access_until` (42501).
  - `purchase_access(student, 15000, 100, 3)` on a trial account: one approved order with snapshot `(15000,100,3)`, `access_until` = `now() + interval '3 months'`, balance +100, a `credit_ledger` row `access_bonus` with `access_order_id`, an `access_ledger` `purchase` row, exactly one `access_purchased` event and no other event from the bonus.
  - renew while active (set `access_until = now() + interval '14 days'`): new until = old + 3 months; renew after expiry (`now() - interval '1 day'`): new until = `now() + 3 months`; `'2027-01-31 12:00Z'` + 1 month = `'2027-02-28 12:00Z'` (compute through a helper `private.extend_access(p_until timestamptz, p_months int, p_now timestamptz)` used by both functions).
  - `purchase_access(student, 14999, 100, 3)` and `(15000, 99, 3)` and `(15000, 100, 2)` raise `offer_changed` and write nothing.
  - admin settings changed to `(20000, 50, 6)` after a purchase: the old order keeps `(15000,100,3)`.
  - bonus 0: purchase succeeds with no credit ledger row.
  - grant: as admin, months 2 + reason → until extended, no credit change, `access_granted` with `admin_id`; blank reason → `reason_required`; months 0 / 25 → `bad_months`; target admin → `cannot_target_admin`; as student → 42501.
  - revoke: until = now(), credits unchanged, `access_revoked`; then `private.log_access_expiries()` returns 0 for that student.
  - expiry: a student with `access_until = now() - interval '1 hour'` → `log_access_expiries()` returns 1, a second call returns 0.
  - anon and students cannot execute `purchase_access`, `private.*`; students see only their own `access_orders` / `access_ledger`.

- [ ] **Step 2: Run to verify failure** — `pnpm db:reset && pnpm db:test` → `paid_access.test.sql` fails (relation / function does not exist).
- [ ] **Step 3: Implement** the schema and functions above in the migration, reusing `credit_apply` and `log_student_event` exactly as `purchase_credit_package` and `admin_suspend_student` do.
- [ ] **Step 4: Verify** — `pnpm db:reset && pnpm seed && pnpm db:test` → all files pass.
- [ ] **Step 5: Commit** — `git commit -m "feat(db): access offer, orders, ledger and purchase/grant/revoke functions"`

### Task 2: Lesson access functions and RLS enforcement

**Files:**
- Modify: the Task 1 migration
- Modify: `supabase/tests/paid_access.test.sql`
- Modify: `apps/mobile/src/lib/content.ts` (tie-break) and `apps/mobile/src/lib/content.test.ts`

**Interfaces:**
- Produces (SQL):
  - `public.free_lesson_id() returns uuid` (stable, security definer; null with no published lessons).
  - `public.has_full_access() returns boolean` (auth.uid()), `public.access_open_all() returns boolean` = `is_admin() or has_full_access()`.
  - `public.can_open_lesson_for(p_user uuid, p_lesson uuid) returns boolean` — service role only (admin user → true).
  - Restrictive policies named `<table>_access`:
    - `for all` (using + with check) on `cards`, `questions`, `sources`, `consolidation_exercises` (row's `lesson_id`), `consolidation_exercise_sources` (via `consolidation_exercises.lesson_id`).
    - `for insert` (with check) and `for update` (using + with check) on `lesson_progress`, `consolidation_runs` (row's `lesson_id`), `consolidation_attempts` (via its exercise's `lesson_id`). Select on these stays as today.
  - Expression shape: `(select public.access_open_all()) or lesson_id = (select public.free_lesson_id())`, so both functions run once per statement.
- Produces (TS): `groupLessonsByTree` sorts by `position`, then `id`.

- [ ] **Step 1: Write failing tests.**
  - pgTAP: with seed-like fixture (two root nodes, nested child node, lessons with equal positions): `free_lesson_id()` is the expected lesson; after swapping node positions it changes; after unpublishing it, the next one; with no published lessons it is null and a trial student's `select count(*) from cards` returns 0 without error.
  - pgTAP, trial student: free lesson's cards / questions / consolidation exercises / sources readable; another lesson's are 0 rows; insert `lesson_progress` for another lesson → 42501; insert / update for the free lesson works; insert `consolidation_runs` / `consolidation_attempts` for another lesson → 42501.
  - pgTAP, full access (`access_until = now() + 1 day`): everything readable / writable. Expired (`now() - 1 second`): back to trial; own `lesson_progress` rows of locked lessons still selectable.
  - pgTAP: admin reads all; a suspended student with full access still reads 0 cards; `can_open_lesson_for` not executable by authenticated.
  - jest (`content.test.ts`): two sibling nodes and two lessons with equal `position` sort by `id`.
- [ ] **Step 2: Run to verify failure** — `pnpm db:reset && pnpm db:test`; `pnpm --filter @prepio/mobile test -- content.test` → new cases fail.
- [ ] **Step 3: Implement** the functions and policies (recursive CTE ordered by a path array of `(position, id)`), and the tie-break in `byPosition`. Check every other student-readable table that exposes lesson content (grep `lessons l where` in migrations) and cover it too; `lessons`, `nodes`, `solution_templates`, `ai_templates` stay unrestricted.
- [ ] **Step 4: Verify** — `pnpm db:reset && pnpm seed && pnpm db:test` all pass; `explain` a trial student's `select * from cards where lesson_id = ...` shows the two InitPlans, not a per-row function scan; mobile tests pass.
- [ ] **Step 5: Commit** — `git commit -m "feat(db): restrict locked lessons' content and progress writes"`

### Task 3: Admin data functions for the plan

**Files:**
- Modify: the Task 1 migration, `supabase/tests/paid_access.test.sql`, `supabase/tests/student_admin.test.sql` (signature change)

**Interfaces:**
- Produces: `admin_students(p_search, p_limit, p_offset, p_id default null, p_filter default 'all')` with the current columns plus `access_until timestamptz`; `p_filter` accepts `'all','suspended','active_today','trial','full'` (`full` = `access_until > now()`).
- Produces: `admin_access_orders(p_user uuid) returns table (id uuid, price_bani int, bonus_credits int, duration_months int, status text, provider text, created_at timestamptz)` (admin only, newest first).

- [ ] **Step 1: Failing pgTAP:** filters `trial` / `full` return the right students; `access_until` column present; `admin_access_orders` refuses non-admins and lists the snapshot.
- [ ] **Step 2: Run** `pnpm db:test` → fails.
- [ ] **Step 3: Implement** (drop + recreate `admin_students`, keep grants).
- [ ] **Step 4: Verify** — `pnpm db:reset && pnpm seed && pnpm db:test` all pass; `pnpm --filter @prepio/admin test` still passes.
- [ ] **Step 5: Commit** — `git commit -m "feat(db): plan in admin student list and access orders"`

### Task 4: Shared access model

**Files:**
- Create: `packages/shared/src/access.ts`, `packages/shared/src/access.test.ts`; export from `packages/shared/src/index.ts`

**Interfaces:**
- Produces:
  - `type AccessOffer = { priceBani: number; bonusCredits: number; durationMonths: number }`
  - `const EXPIRING_DAYS = 7`
  - `type AccessStatus = { plan: 'trial' } | { plan: 'full' | 'expiring'; until: Date; daysLeft: number }`
  - `accessStatus(accessUntil: string | null, now: Date): AccessStatus`
  - `extendAccessUntil(accessUntil: string | null, months: number, now: Date): Date` — UTC calendar months, clamped to month end (same as Postgres).
  - `formatAccessDate(d: Date): string` — Europe/Bucharest, „8 februarie 2027”.
  - `type AccessPurchaseRequest = { expectedPriceBani: number; expectedBonusCredits: number; expectedDurationMonths: number }`
  - `type AccessPurchaseResponse = { orderId: string; accessUntil: string; bonus: number; balance: number }`
  - `type AccessPurchaseErrorCode = 'bad_request' | 'unauthorized' | 'suspended' | 'offer_changed' | 'server_error'`
  - `type AccessPurchaseError = { error: AccessPurchaseErrorCode; message: string; offer?: AccessOffer }`

- [ ] **Step 1: Failing tests:** null → trial; past → trial; now + 30 days → full, 30; now + 7 days → expiring, 7; now + 6 days 1 hour → expiring, 7; `extendAccessUntil('2027-01-31T12:00:00Z', 1, before)` = `2027-02-28T12:00:00Z`; active until +14 days extended by 3 months adds to that date; past date extends from now; `formatAccessDate(new Date('2027-02-07T23:30:00Z'))` = „8 februarie 2027”.
- [ ] **Step 2: Run** `pnpm --filter @prepio/shared test -- access` → fails.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → passes; `pnpm typecheck` passes.
- [ ] **Step 5: Commit** — `git commit -m "feat(shared): access status, extension and purchase types"`

### Task 5: Server — purchase route and evaluate gate

**Files:**
- Create: `apps/admin/src/lib/access/purchase.ts`, `apps/admin/src/lib/access/purchase.test.ts`, `apps/admin/src/app/api/access/purchase/route.ts`
- Modify: `apps/admin/src/lib/consolidation/handler.ts` (+ its test), its error map

**Interfaces:**
- Consumes: Task 1 `purchase_access`, Task 2 `can_open_lesson_for`, Task 4 types.
- Produces: `handleAccessPurchase(body: unknown, userId: string, db: SupabaseClient): Promise<{ status: number; json: AccessPurchaseResponse | AccessPurchaseError }>`; route mirrors `api/credits/purchase/route.ts` (origin, JSON, bearer, CORS, `no-store`).
- Produces: evaluate error `access_required` → 403, message „Lecția face parte din accesul complet.”

- [ ] **Step 1: Failing vitest:**
  - purchase: non-integer / missing fields → 400 `bad_request`; suspended → 403; RPC `offer_changed` → 409 with `offer` read from `access_settings` (camelCase); success → 200 with the row mapped; RPC failure → 500 „Plata nu a reușit. Încearcă din nou.”
  - evaluate: exercise in a lesson where `can_open_lesson_for` is false → 403 `access_required`, `credits.spend` never called, a `check_blocked` event is logged with details `{ reason: 'access_required', cost }` through `log_student_event_service`; order: suspended check first, then access, then rate limit and spend.
- [ ] **Step 2: Run** `pnpm --filter @prepio/admin test -- access consolidation` → fails.
- [ ] **Step 3: Implement** (exercise loader also selects `lesson_id`).
- [ ] **Step 4: Run** → passes.
- [ ] **Step 5: Commit** — `git commit -m "feat(api): access purchase and access gate on checks"`

### Task 6: Admin Setări → „Acces”

**Files:**
- Create: `apps/admin/src/app/(admin)/settings/AccessForm.tsx`, `AccessForm.test.tsx`
- Modify: `settings/actions.ts`, `settings/page.tsx`

**Interfaces:** action `saveAccessSettings(input: { price: string; bonusCredits: number; durationMonths: number })` → `parseLei` then `admin_save_access_settings`; result per `lib/actionResult.ts`.

- [ ] **Step 1: Failing test:** form loads `150,00` / `100` / `3`; shows „Modificările se aplică doar plăților viitoare.”; invalid price „0” and months 25 blocked with messages; save calls the action with `{price:'200,00', bonusCredits:50, durationMonths:6}` and shows the success alert.
- [ ] **Step 2: Run** `pnpm --filter @prepio/admin test -- AccessForm` → fails.
- [ ] **Step 3: Implement** a card titled „Acces” under „Credite”, fields „Preț acces (lei)”, „Credite incluse”, „Durată (luni)”.
- [ ] **Step 4: Run** → passes.
- [ ] **Step 5: Commit** — `git commit -m "feat(admin): access offer settings"`

### Task 7: Admin Elevi — plan, grant, revoke, orders, timeline

**Files:**
- Create: `students/[id]/GrantAccessDialog.tsx`, `RevokeAccessDialog.tsx` (+ tests)
- Modify: `students/page.tsx` (column „Plan”, filter options „Trial” / „Acces complet”), `students/actions.ts`, `lib/data/students.ts` (access_until, access orders), `students/[id]/StudentHeader.tsx` (+test), `TimelineTab.tsx` (+test), the „Comenzi” and „Credite” tab rendering, `students/[id]/format.ts` (+test)
- Modify: `apps/admin/e2e/students.spec.ts`

**Interfaces:** actions `grantAccess(userId: string, months: number, reason: string)`, `revokeAccess(userId: string, reason: string)`; `planLabel(accessUntil: string | null, now: Date): string` in `format.ts` → „Trial” / „Acces până la 8 februarie 2027”.

- [ ] **Step 1: Failing tests:** header shows the plan and „Acordă acces” / „Retrage accesul” (revoke only when full); grant dialog requires reason and months 1–24, says „Lunile se adaugă la accesul curent. Nu se adaugă credite.”; revoke dialog requires reason, says „Elevul revine la trial acum. Creditele rămân.”; timeline renders `access_purchased` „⭐ Acces cumpărat · 3 luni · 150,00 lei”, `access_granted` „🎟️ <admin>: acces acordat · 2 luni · Motiv: „…””, `access_revoked` „⛔ <admin>: acces retras · Motiv: „…””, `access_expired` „⌛ Accesul a expirat”, `check_blocked` with `reason: access_required` „🚫 Verificare refuzată · lecție fără acces”; Comenzi lists access orders („Acces 3 luni · +100 credite · 150,00 lei · Aprobată (fără plată)”) with credit orders, newest first; Credite labels `access_bonus` „Credite incluse în acces”. E2E: grant then revoke on a `[test]` student, list filter „Acces complet” shows / hides them.
- [ ] **Step 2: Run** `pnpm --filter @prepio/admin test` → fails.
- [ ] **Step 3: Implement**, following `SuspendDialog` / `AdjustCreditsForm`.
- [ ] **Step 4: Run** vitest and `pnpm --filter @prepio/admin e2e -- students` (Playwright; needs the local stack, see README) → pass.
- [ ] **Step 5: Commit** — `git commit -m "feat(admin): student plan, grant and revoke access"`

### Task 8: Student data layer, AccessProvider and lesson states

**Files:**
- Create: `apps/mobile/src/access/AccessProvider.tsx` (+test), `apps/mobile/src/lib/access.ts` (+test)
- Modify: `apps/mobile/src/lib/profile.ts` (select `access_until`, `Profile.accessUntil: string | null`), `lib/lessonFlow.ts` (+test), `ui/LessonListItem.tsx` (+test), the provider tree in `apps/mobile/app/(app)/_layout.tsx`
- Modify: `apps/mobile/src/lib/credits.ts` history label for `access_bonus` „Credite incluse în acces”

**Interfaces:**
- `fetchAccessOffer(client?): Promise<AccessOffer>`; `fetchAccessHistory(userId, client?): Promise<{ kind: 'purchase'|'admin_grant'|'admin_revoke'; months: number|null; untilAfter: string; createdAt: string; priceBani: number|null }[]>`; `purchaseAccess(offer: AccessOffer): Promise<AccessPurchaseResponse>` throwing a typed error carrying `AccessPurchaseError` (same pattern as `purchaseCredits` in `lib/credits.ts`).
- `useAccess(): { status: AccessStatus; offer: AccessOffer | null; refresh(): Promise<void>; applyPurchase(r: AccessPurchaseResponse): void; canOpen(lessonId: string): boolean; freeLessonId: string | null }` — `freeLessonId` = first of `orderedLessons` from Home data; refresh on focus / foreground and from `profileRefresh` when an API answers 403 `access_required`.
- `LessonState` gains `'paywall'`; `lessonAccess(order, finished, mode, canOpen: (id: string) => boolean)` — non-openable lessons are `paywall` (finished ones too, keeping a `finished` flag for the ✓), guided / free rules apply among openable ones.
- `LessonListItem` `state="paywall"`: pressable, 🔒 trailing, muted text, label „<titlu>, blocată, face parte din accesul complet”; finished+paywall shows „✓ 🔒”.

- [ ] **Step 1: Failing tests:** trial + guided: lesson 1 `current`, others `paywall`; trial + free: lesson 1 `open`, others `paywall`; full: today's behaviour unchanged; expired with lesson 2 finished: lesson 2 `paywall` with ✓; free lesson moved to position 2 → canOpen follows; empty Home → `freeLessonId` null, no crash; paywall row calls `onPress`, locked row does not.
- [ ] **Step 2: Run** `pnpm --filter @prepio/mobile test -- lessonFlow LessonListItem AccessProvider access` → fails.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → passes; `pnpm typecheck`.
- [ ] **Step 5: Commit** — `git commit -m "feat(app): access state and paywall lesson state"`

### Task 9: Pill, banners, PaywallSheet and locked deep links

**Files:**
- Create: `apps/mobile/src/access/PaywallSheet.tsx` (+test), `apps/mobile/src/access/AccessBanner.tsx` (+test)
- Modify: `apps/mobile/src/credits/CreditChip.tsx` (+test) → combined pill, `screens/HomeScreen.tsx` (+test), `app/(app)/lesson/[id]/index.tsx`, `app/(app)/lesson/[id]/consolidare.tsx`, `screens/consolidation/ExerciseScreen.tsx` (+test) for 403 `access_required`

**Interfaces:**
- `CreditChip` renders plan + balance in one pill: trial „Trial · 🪙 n” (neutral), full „★ · 🪙 n” (green), expiring „⏳ n zile · 🪙 n” (orange); keeps the „−2” / „+50” floats; press → `/abonament`; label e.g. „Trial, 12 credite, deschide abonamentul”.
- `PaywallSheet({ visible, lessonTitle?: string, onClose, onUnlocked(): void })`, copy from the mockup: „Deblochează toate lecțiile”, „„<lecție>” face parte din accesul complet.”, „📚 Toate cele N lecții, în orice mod de învățare”, „🪙 +100 de credite pentru profesorul digital”, „📅 Acces 3 luni — până la <extendAccessUntil>”, „🎁 Îți păstrezi creditele pe care le ai deja”, „150 lei · plată unică · nu se reînnoiește automat”, „Deblochează · 150 lei” / „Mai târziu”, the credits footnote; expired: title „Reînnoiește accesul”; success: „Ai acces complet!” + pill „+100”.
- `AccessBanner` on Home: trial „Ești în perioada de probă. …” / expired „Accesul tău a expirat pe <dată>. …” with „Vezi oferta · 150 lei” / „Reînnoiește · 150 lei”; expiring „Accesul tău expiră în n zile (<dată>). …” with „Reînnoiește · 150 lei” and a close button that hides it until the next Bucharest day (`AsyncStorage`/`localStorage` wrapped in try/catch).
- Deep links: a non-openable `/lesson/<id>` or `/lesson/<id>/consolidare` replaces the route with `/?paywall=<id>`; Home opens the sheet for that lesson.

- [ ] **Step 1: Failing tests:** pill states and press target; banner variants and once-a-day dismissal (with storage throwing → still renders); sheet: shows the offer from `useAccess`, button disabled while pending (double tap → one `purchaseAccess` call), success calls `applyPurchase` + credits `setBalance` + `onUnlocked` (opens the tapped lesson), `offer_changed` updates the shown offer with „Oferta s-a schimbat. Verifică noul preț.” and does not close; Home: tapping a paywall lesson opens the sheet; `/?paywall=<id>` opens it; lesson route for a locked id redirects; ExerciseScreen: 403 `access_required` → access refresh + sheet, typed answer still there.
- [ ] **Step 2: Run** `pnpm --filter @prepio/mobile test` → new cases fail.
- [ ] **Step 3: Implement**, reusing the bottom-sheet pattern of `BuyCreditsSheet`.
- [ ] **Step 4: Run** → passes; `pnpm typecheck`.
- [ ] **Step 5: Commit** — `git commit -m "feat(app): plan pill, access banners and paywall sheet"`

### Task 10: „Abonamentul meu”

**Files:**
- Create: `apps/mobile/app/(app)/abonament.tsx`, `apps/mobile/src/screens/AccessScreen.tsx` (+test)
- Modify: `screens/ProfileScreen.tsx` (+test): row „Abonamentul meu” with the plan label, above „Creditele mele”

**Interfaces:** consumes `useAccess`, `useCredits`, `fetchAccessHistory`, `PaywallSheet` purchase logic (extract a `useAccessPurchase()` hook in Task 9 if both need it).

- [ ] **Step 1: Failing tests:** full: card „★ Acces complet”, „Activ până la <dată>”, progress bar, „mai ai n zile”; trial / expired cards with „Deblochează · 150 lei” / „Reînnoiește · 150 lei”; „Ce include”; „Prelungește cu 3 luni · 150 lei” with „Lunile noi se adaugă după <dată>.”; balance row with link to „Creditele mele”; history rows „8 noiembrie 2026 · Acces 3 luni · 150 lei”, „Acces acordat · 2 luni”, „Acces retras” (no admin email or reason); empty history hides the section.
- [ ] **Step 2: Run** `pnpm --filter @prepio/mobile test -- AccessScreen ProfileScreen` → fails.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → passes.
- [ ] **Step 5: Commit** — `git commit -m "feat(app): Abonamentul meu screen"`

### Task 11: End-to-end verification, docs and status

**Files:** Modify: `docs/STATUS.md`, `docs/deploy.md` (rollout section „Paid access”), `apps/mobile/src/screens/PrivacyScreen.tsx` only if it lists stored data (access dates and orders).

- [ ] **Step 1: Full suites** — `pnpm db:reset && pnpm seed && pnpm db:test`, `pnpm test`, `pnpm typecheck`, admin e2e → all green; output quoted in the report.
- [ ] **Step 2: API proof as a trial student** (local REST with the student's JWT): cards / questions / consolidation exercises of lesson 2 → `[]`; insert `lesson_progress` for lesson 2 → 42501; `PATCH profiles access_until` → refused; `POST /api/consolidation/evaluate` for a lesson-2 exercise → 403 `access_required`, balance unchanged; `POST /api/access/purchase` with a stale price → 409.
- [ ] **Step 3: Browser walk (Claude in Chrome), 360 px and 1280 px, console clean:** new `[test]` student → trial pill, banner, locks in both modes; tap lesson 2 → sheet → buy → „+100”, lessons open; renew → date +3 months; backdate `access_until` to +5 days (psql) → orange pill and banner, dismiss; backdate to past → expired banner, ✓ 🔒 rows, deep link to lesson 2 → sheet; „Abonamentul meu” and Profile row; admin: settings change (then restore), list filter, grant, revoke, Comenzi, Cronologie (run `select private.log_access_expiries()` for the expiry row), Credite label. Remove `[test]` data; `pnpm db:reset && pnpm seed`; seed content intact.
- [ ] **Step 4: Docs** — STATUS.md: feature entry, release steps (push migration, deploy web + admin, new APK; old APKs show locked lessons empty), accepted gap (public `images` bucket), provider notes from the spec, native items for the owner to check on the APK (sheet, pill, banner dismissal).
- [ ] **Step 5: Commit** — `git commit -m "docs: paid access status and rollout"`
