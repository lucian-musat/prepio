# Paid access (trial → full access for a period) — design

Date: 2026-11-08 · Status: draft, awaiting owner approval
Mockup (approved, top-bar variant B): `docs/design/2026-11-08-paid-access-mockup.html`

## Intent

Today every signed-in student sees every published lesson; credits pay only for digital-teacher checks. The owner
wants a paid entry: a new student gets a **trial** with only the first lesson, then pays a one-off sum (admin-set,
e.g. 150 lei) that **opens every lesson for a period** (admin-set, e.g. 3 months) and **adds a credit bonus**
(admin-set, e.g. 100). When the period ends the account falls back to the trial. Credit packages keep working as
today. The system must be impossible for students to bypass, and ready for a real payment provider (card processor
on the web, Google Play / App Store billing in the apps) that the owner will implement separately.

## Goals

- Two plans per account, computed on the server: **trial** and **full access until `<date>`**.
- Trial: only the free lesson (cards, questions and its consolidation) is usable, whatever the learning mode.
- Paying (still `provider='none'`, approved instantly like credit purchases) opens all lessons for the period and
  adds the credit bonus; renewing at any time adds the period to what is left and adds the bonus again.
- Expiry returns the account to the trial automatically (no job needed); remaining credits stay and stay usable.
- Admin: configure price / credits / duration; grant and revoke access manually per student; see the plan.
- Student: a clear plan indicator in the top bar, a paywall popup, a 7-day expiry warning, „Abonamentul meu”.
- Enforced by the database (RLS) and the API, never only by the app.

## Non-goals

- No real payment provider, no store billing integration (owner's separate work; see "Payment providers later").
- No auto-renewing subscription, no email / push notifications, no discounts or coupons, no refunds flow.
- No per-lesson purchases, no admin choice of which lessons are free (it is always the first one).

## Anti-goals (would make this a failure even if it "works")

- Any way for a trial student to read the cards / questions / consolidation of a locked lesson, write progress for
  it, or get a digital-teacher check on it (modified app, direct REST calls, changed device clock, old APK).
- Losing a student's progress or credits at expiry.
- A price or duration change in admin silently changing what someone already paid for.
- A trial that feels like a broken app (empty lesson screens, errors) instead of a clear, friendly paywall.

## Decisions taken with the owner

- Payment: keep `provider='none'` (instant approval), structured so a provider plugs in later.
- Free lesson: lesson 1 only, regardless of learning mode.
- Welcome credits stay (they become the trial's credits); trial students can buy credit packages.
- Access bonus credits are added on every access payment; credits are independent from the plan.
- At expiry: back to trial (lesson 1 only), remaining credits are kept, no new credits.
- Renewal allowed any time; the new period is added after the current end; the bonus is added again.
- Admin can grant and revoke access manually.
- Warning 7 days before expiry.
- Top bar: **one combined pill** (mockup option B): „Trial · 🪙 12”, „★ · 🪙 112” (green), orange with days left
  in the last 7 days.
- The rest of the mockup was approved as shown (trial banner, paywall sheet, active / expiring / expired Home,
  „Abonamentul meu”).
- Defaults confirmed by the owner when I listed them:
  - "Lesson 1" = the first published lesson in Home order; it follows reordering in admin. Its consolidation is open.
  - Every existing account starts in the trial at release (production has only test accounts).
  - Admins and the admin preview always see everything.
  - Suspension wins over access: a suspended account stays fully blocked.
  - Config changes apply only to future payments; past payments keep their snapshot.

## How it works

### Data (new migration)

- `access_settings` (single row, like `credit_settings`): `price_bani`, `bonus_credits`, `duration_months`, with
  checks (price ≥ 1, bonus 0–10000, months 1–24). Seed / defaults: 15000 bani, 100 credits, 3 months. Readable by
  students (they see the price), writable only through an admin function.
- `profiles.access_until timestamptz null`. Students get **no update grant** on it (their only column grants stay
  `display_name` / `learning_mode`). Full access ⇔ `access_until > now()` (server time).
- `access_orders`: like `credit_orders` but without a package: `user_id`, snapshot `price_bani`, `bonus_credits`,
  `duration_months`, `status`, `provider` default `'none'`, `provider_ref` (unique where not null, for provider
  idempotency later), `created_at`, `approved_at`. Own-row select for students, admin select, no client writes.
- `access_ledger` (append-only audit of every change of `access_until`): `kind` in
  (`purchase`, `admin_grant`, `admin_revoke`), `months` (null for revoke), `until_before`, `until_after`,
  `order_id`, `admin_id`, `reason` (required for admin kinds), `created_at`. Own select for students (history in
  „Abonamentul meu”), admin select.
- Credit ledger: new `kind = 'access_bonus'` (linked to the access order) so the history reads „Credite incluse în
  acces”; the bonus goes through `credit_apply` like every other balance change.
- Timeline (`student_events`): new kinds `access_purchased`, `access_granted`, `access_revoked`. **Expiry** appears
  in the admin Cronologie as a row at the expiry moment; the builder picks the mechanism (e.g. derived from
  `access_ledger` in the admin timeline query rather than a cron job). Builder's call.

### Functions

- `public.free_lesson_id()` — security definer, stable: the first published lesson in Home order, i.e. the same
  depth-first walk as `groupLessonsByTree` in `apps/mobile/src/lib/content.ts` (root nodes by `position`, a node's
  own lessons by `position` before its children). Ties on `position` must be broken the same way in SQL and in the
  app (builder adds a deterministic tie-break, e.g. `id`, to both). A shared test fixture proves both agree.
- `public.has_full_access()` — security definer, stable: `access_until > now()` for `auth.uid()`.
- `public.can_open_lesson(p_lesson uuid)` — `is_admin() or has_full_access() or p_lesson = free_lesson_id()`.
- `purchase_access(p_user, p_expected_price_bani, p_expected_bonus, p_expected_months)` — service role: locks the
  profile, refuses with `offer_changed` when any of the three differs from the current settings (the student saw a
  stale offer; my call to guard the whole offer, not only the price),
  creates an approved `access_orders` row from a settings snapshot, sets
  `access_until = greatest(now(), coalesce(access_until, now())) + duration_months`, writes `access_ledger`, adds the
  bonus via `credit_apply(kind 'access_bonus')`, logs `access_purchased`. One transaction. Returns order id, new
  `access_until`, bonus, balance.
- `admin_grant_access(p_user, p_months, p_reason)` — adds months the same way, **no credits**, reason required,
  refuses admins as targets; logs `access_granted` with the admin.
- `admin_revoke_access(p_user, p_reason)` — sets `access_until = now()` (back to trial at once), keeps credits and
  orders, reason required; logs `access_revoked`.
- `admin_save_access_settings(...)` and an extension of `admin_students` (plan / `access_until`, filter by plan).
- Same grant / revoke discipline as the credits migration (revoke from public / anon / authenticated, grant only to
  the intended role).

### Enforcement (the security core)

Add **restrictive** policies, like `*_not_suspended`, using `can_open_lesson(<the row's lesson id>)`:
- **Content tables, select and writes:** `cards`, `questions`, `sources`, `consolidation_exercises`,
  `consolidation_exercise_sources`.
- **The student's own progress tables, writes only** (insert / update): `lesson_progress`, `consolidation_runs`,
  `consolidation_attempts`. Their select stays as today (own rows), so after expiry Home still shows the ✓ marks,
  the "n din N terminate" count and the saved position, and everything reappears unchanged at renewal (no progress
  lost). My call: the student's own saved answers and feedback stay readable too; the lesson content itself stays
  hidden because the consolidation screen can't load the exercises.

`lessons` and `nodes` stay readable (titles are needed for the locked list). The builder checks every other table that exposes lesson content (anything joined from
lessons) and covers it too. Wrap function calls in `(select …)` where the argument allows, and check the query
plans stay sane on Home / lesson loads.

The API repeats the check server-side (service role bypasses RLS):
- `/api/consolidation/evaluate`: after the suspension check and **before spending credits**, refuse a check on an
  exercise whose lesson the student can't open → 403 `access_required` („Lecția face parte din accesul complet.”),
  no charge, logged like other blocked checks.
- New `POST /api/access/purchase` (same origin / JSON / bearer / suspended rules as `/api/credits/purchase`), body
  `{ expectedPriceBani, expectedBonusCredits, expectedDurationMonths }`; errors `bad_request`, `unauthorized`, `suspended` (403), `offer_changed` (409, with the
  current offer), `server_error`.
- Credit purchases stay open to trial students.

Why this can't be bypassed: the client never writes `access_until`; time comes from Postgres `now()`; locked content
is filtered by RLS, so a modified app or a hand-made REST call gets empty results / 42501; AI checks are refused by
the server before any charge. Known, accepted gap: lesson **images** live in the public `images` bucket; their URLs
only appear inside card content the student can't read, so this is accepted for now and listed in STATUS.

### Student app (web + mobile, `apps/mobile`)

- **Access state** comes from the profile (`access_until`) plus the settings (price, bonus, months) and is refreshed
  like the credit balance (on focus / foreground and after a purchase or a 403 `access_required`). The app computes
  "days left" for display only; enforcement is server-side.
- **Lesson states**: new state `paywall` (distinct from the guided-mode `locked`). In trial every lesson except the
  free one is `paywall`; guided / free rules apply only among openable lessons. Finished lessons stay ✓ but
  `paywall` after expiry. Tapping a `paywall` lesson opens the paywall sheet; deep links to a locked lesson or its
  consolidation show the sheet over Home instead of an empty screen.
- **Top bar pill** (Home and consolidation, replaces `CreditChip`): one pill with plan + balance, option B in the
  mockup; orange with „⏳ n zile” in the last 7 days. It keeps the floating „−2” / „+50” credit animations. Tapping
  it opens „Abonamentul meu”.
- **Home banner**: trial / expired banner with the offer (price, months, bonus) and „Vezi oferta”; in the last 7 days
  the orange renewal banner, dismissible for the rest of the day (local storage, best-effort).
- **Paywall sheet**: title, the lesson that was tapped, benefits (all N published lessons in any mode, +bonus
  credits, months with the end date computed as the server would, „Îți păstrezi creditele”), price „plată unică · nu
  se reînnoiește automat”, „Deblochează · 150 lei” / „Mai târziu”, the same "payment coming soon" footnote as
  credits. Success: „Ai acces complet!”, „+100” on the pill, lessons open, and the tapped lesson opens.
  `offer_changed` → the sheet refreshes the offer and asks again.
- **„Abonamentul meu”** (from the pill and a Profile row): plan card (active until, days left, progress bar) or the
  trial / expired card, what's included, „Prelungește cu n luni · price” / „Deblochează”, the access history
  (purchases and admin grants / revocations, without admin emails or reasons — builder's call on wording). My call:
  this screen also shows the credit balance with a link to „Creditele mele”, because the pill now opens here.
- All student copy in Romanian with diacritics, no „AI” wording (same rule as credits).

### Admin (`apps/admin`)

- **Setări → „Acces”**: price (lei), bonus credits, duration (months), with a note that changes apply to future
  payments only.
- **Elevi list**: plan column („Trial” / „Până la 8 feb 2027”) and a plan filter.
- **Student page**: plan in the header; actions „Acordă acces” (months + required reason, adds to the current end,
  no credits) and „Retrage accesul” (required reason, back to trial now); access orders in „Comenzi” next to credit
  orders; access rows in „Cronologie” (purchase, grant, revoke with admin email, expiry); the bonus visible in
  „Credite”.
- Admin preview keeps seeing every lesson.

### Payment providers later (notes for the owner's work)

- The flow already has the provider seam: `access_orders.status` (`pending` → `approved` / `failed`), `provider`,
  unique `provider_ref`. A provider integration creates a pending order, verifies the payment **server-side**
  (receipt / webhook), then approves it through the same function that extends `access_until`.
- Inside apps distributed through Google Play / the App Store, digital content must be sold with their billing:
  access maps to a **non-renewing subscription** (App Store) / a **prepaid plan** or one-time product (Play), credit
  packages to **consumables**. Store prices are set in the store consoles, so the admin price applies to the web;
  the builder of that work must keep them aligned. Refund / chargeback notifications should revoke the access
  through the same ledger.

## Testing and validation

- pgTAP: plan math (new, renew while active, renew after expiry), bonus via `credit_apply`, snapshot vs settings
  change, `offer_changed` (price, bonus or months), admin grant / revoke (reason, admin target refused, non-admin refused), every restrictive
  policy (trial student: free lesson readable / writable, other lessons' content empty and writes 42501; full access:
  everything; expired: back to trial; admin: everything; suspended: still blocked), `free_lesson_id()` follows
  reordering, students can't update `access_until`.
- API tests: `/api/access/purchase` all errors; `/api/consolidation/evaluate` refuses a locked lesson before charging.
- App unit tests: lesson states with `paywall` in both modes, pill states, banners, sheet flows, deep links.
- Admin tests / e2e: settings form, grant / revoke, plan column and filter.
- Browser walk (owner's rule): trial → paywall → purchase → renew → expiring (backdated `access_until`) → expired →
  admin grant / revoke, at 360 px and desktop, console clean; plus direct REST calls as a trial student proving the
  locked content stays hidden. `[test]` data removed afterwards; seed content intact.
- Native: no new native dependencies expected; the owner checks the paywall sheet and pill on the next APK.

## Release

New migration pushed with the usual `db:cloud:push:dry` → `push`; every existing account starts in the trial; web +
admin deploy; a new APK (old APKs show locked lessons as broken/empty rather than the paywall, but still can't read
the content). STATUS.md updated with the feature, the accepted images gap and the provider notes.

## Left to the builder

Exact table / column names, the expiry-in-timeline mechanism, the tie-break for lesson order, query-plan tuning,
component structure, exact Romanian copy within the mockup's tone, banner dismissal storage.
