# Referrals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Students invite others with a code/link; a paying invitee earns the inviter either credits or, on trial, progress toward a free access period; students and admins see all of it.

**Architecture:** One migration adds referral tables and security-definer RPCs; the reward engine is hooked into the existing `purchase_access` transaction. The student app (Expo, web + native) gets a pending-code store, a public invite route, a Welcome code field, an invite screen with three discreet entry points and a public explainer page. The admin (Next.js) gets a settings form and a per-student referrals section.

**Tech Stack:** Supabase Postgres (pgTAP), Expo Router + React Native (jest), Next.js admin (vitest), `@prepio/shared`.

**Spec:** `docs/superpowers/specs/2026-11-12-referrals-design.md` (read it first; rule numbers below refer to its "Rules").

## Global Constraints

- Code and docs in English; all student/admin UI copy in Romanian.
- Migrations: new file via `pnpm db:new referrals`, never edit an applied one; RLS on every new table; clients only read, all writes through security-definer functions with `set search_path = ''` and explicit `revoke`/`grant` (follow `20261108091845_paid_access.sql`).
- Settings defaults: `enabled=false`, `threshold=5`, `credits_per_invitee=40`, `max_rewarded=100`. Free access length is `access_settings.duration_months` (no new setting). Free access gives no bonus credits.
- Code: 8 chars from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, case-insensitive input, spaces and dashes ignored.
- Link: `https://prepio.ro/invita/<CODE>`. "New account" for attaching: younger than 24 h, onboarding (terms, name, mode) incomplete, no purchase, no lesson activity, no inviter yet.
- Do not bump `TERMS_VERSION`; add the privacy sentence to the Terms/Privacy text only.
- Visible, not intrusive: no modal, no badge on Home; the one-time note is dismissible and shown once per device.
- Frontend work is not done until browser-validated (360px + desktop, console clean) per `CLAUDE.md`; native-only items go in the final report for the owner.
- Commands run as `wsl -d Ubuntu-22.04 -- bash -ic "cd ~/projects/prepio_new && <cmd>"` in the feature worktree (`using-git-worktrees`, branch `feat/referrals`).

## Review Focus

1. The same invitee purchase processed twice, a renewal, or an `admin_grant_access`: exactly one reward, only for the first paid purchase (Task 3).
2. Inviter and invitee buying at the same moment: no deadlock, no double count (Task 3).
3. A signed-in or existing user opening an invite link or typing a code on Welcome: no attach, no error shown (Tasks 2, 5).
4. Code typed lowercase, with spaces/dashes, or arriving via a link that then goes through the web Google redirect: still applied once (Task 5).
5. Threshold lowered after pending invitees accumulated, and invitee account deleted after paying: surplus waits, deleted payer still counts (Task 3).

---

### Task 1: Schema, codes, settings, RLS

**Files:**
- Create: `supabase/migrations/<ts>_referrals.sql` (via `pnpm db:new referrals`)
- Test: `supabase/tests/referrals.test.sql`

**Interfaces:**
- Produces tables: `referral_settings(id=1, enabled, threshold, credits_per_invitee, max_rewarded)`; `referral_codes(user_id pk → auth.users on delete cascade, code text unique)`; `referrals(id uuid pk, inviter_id → auth.users on delete cascade, invitee_id uuid unique → auth.users on delete set null, invitee_first_name text not null, created_at, first_paid_at, state text check in ('registered','pending','consumed_access','converted_credits','over_cap','not_rewarded_disabled'), reward_credits int, access_ledger_id bigint, credit_ledger_id bigint)`.
- Produces: `private.new_referral_code() returns text`; code created for every new profile (extend `handle_new_user` flow) and backfilled for existing non-admin profiles; `admin_save_referral_settings(p_enabled bool, p_threshold int, p_credits int, p_max int) returns void` (admin only, check constraints 1..100 / 0..10000 / 1..10000).
- Extend `access_ledger.kind` with `referral_reward`; `credit_ledger.kind` with `referral` plus nullable `referral_id uuid references referrals on delete set null`; `student_events.kind` with `referral_joined`, `referral_access`, `referral_credits`; map `referral` in `student_event_of_ledger`.
- Deleting an invitee's account removes its `referrals` row if `first_paid_at is null`, else keeps it with `invitee_id` null (a before-delete trigger plus the FK); deleting an inviter cascades their rows.

- [ ] **Step 1: Write failing pgTAP tests** — `has_table` for the three tables; every profile has a code matching `^[A-HJKMNP-Z2-9]{8}$`; backfill covers an existing student, not an admin; a student reads only their own `referral_codes`/`referrals` rows and cannot insert/update/delete any (42501); `admin_save_referral_settings` refuses a student (42501) and rejects `threshold=0`; deleting an unpaid invitee removes the row, deleting a paid invitee leaves it with null `invitee_id` and the first name.
- [ ] **Step 2: Run** `pnpm db:reset && pnpm db:test` — expect the new file to fail.
- [ ] **Step 3: Write the migration** with the interfaces above.
- [ ] **Step 4: Run** `pnpm db:reset && pnpm seed && pnpm db:test` — all files pass.
- [ ] **Step 5: Commit** `feat(db): referral tables, codes and settings`.

### Task 2: Lookup and attach RPCs

**Files:** Modify the Task 1 migration file (not yet pushed) or add a follow-up migration; Test: `supabase/tests/referrals.test.sql`.

**Interfaces:**
- Produces: `referral_public_settings() returns table(enabled bool, threshold int, credits_per_invitee int, duration_months int, max_rewarded int)` (anon + authenticated); `referral_lookup(p_code text) returns table(valid bool, inviter_first_name text)` (anon + authenticated, normalizes the code, returns `valid=false` when disabled, rate-limited using the existing mechanism in `rate_limit.test.sql`); `referral_attach(p_code text) returns text` (authenticated) → `'attached' | 'invalid' | 'disabled' | 'not_allowed' | 'self'`.
- `referral_attach` creates the `referrals` row (`state='registered'`, snapshot of the invitee's first name from `profiles.display_name` at attach time, refreshed when the name is set later in onboarding: also update the snapshot in the name-setting path or at first payment), logs `referral_joined`, and is idempotent (second call → `'not_allowed'`, no change).

- [ ] **Step 1: Write failing tests** — valid code attaches; lowercase and `ab-cd 2345` style input normalizes; own code → `'self'`; unknown → `'invalid'`; enabled=false → `'disabled'` and lookup `valid=false`; account with completed onboarding, a purchase, lesson activity or older than 24 h → `'not_allowed'`; second attach → `'not_allowed'`; admins can't be invited; anon can call lookup but not attach; lookup returns only `valid` and a first name.
- [ ] **Step 2: Run** `pnpm db:reset && pnpm db:test` — fail.
- [ ] **Step 3: Implement** the three functions.
- [ ] **Step 4: Run** `pnpm db:reset && pnpm seed && pnpm db:test` — pass.
- [ ] **Step 5: Commit** `feat(db): referral lookup and attach`.

### Task 3: Reward engine inside `purchase_access`

**Files:** Modify: add a new migration that `create or replace`s `public.purchase_access` (same signature) and adds `private.referral_on_purchase(p_invitee uuid)`; Test: `supabase/tests/referrals_rewards.test.sql`.

**Interfaces:**
- Consumes: `purchase_access(p_user, p_price_bani, p_bonus, p_months)` unchanged for callers; `private.extend_access`, `credit_apply` (see how `purchase_access` calls it).
- Produces: after the purchase is recorded, in the same transaction: (a) the buyer's own `pending` referrals (as inviter) convert to credits (`credit_ledger.kind='referral'`, one row per invitee, `reward_credits` snapshot, state `converted_credits`); (b) if the buyer is an invitee with a `registered` row and this is their first approved order: set `first_paid_at`; then apply rules 2, 3, 11, 12 (flag off → `not_rewarded_disabled`; over cap → `over_cap`; inviter has `access_until > now()` → credits and state `converted_credits`; else state `pending` and, when pending count ≥ threshold, one `access_ledger` row `kind='referral_reward'` via `extend_access` for `duration_months`, `threshold` oldest pending → `consumed_access`). Log `referral_access`/`referral_credits` events for the inviter.
- Lock order: buyer profile, then inviter profile, then referral rows of that inviter. `admin_grant_access` never triggers anything.

- [ ] **Step 1: Write failing tests** (pgTAP): trial inviter + 5 paying invitees → access granted of `duration_months`, no bonus credits, 5 rows `consumed_access`, 6th invitee pays → 40 credits; inviter with access + invitee pays → +40 credits immediately; inviter with 4 pending buys → 160 credits, 4 rows `converted_credits`, plus the normal bonus; a second `purchase_access` by the same invitee changes nothing; `admin_grant_access` to an invitee changes nothing; flag off → `not_rewarded_disabled`, nothing granted, and switching on later doesn't reward retroactively; cap 1 → 2nd paying invitee is `over_cap`; threshold lowered 5→2 with 3 pending → one grant, 1 left pending; pending invitee deletes account → still counted; inviter's access expiring leaves pending intact; credit-history rows reference the invitee via `referral_id`.
- [ ] **Step 2: Run** `pnpm db:reset && pnpm db:test` — fail.
- [ ] **Step 3: Implement** per the interfaces; keep `purchase_access` return shape.
- [ ] **Step 4: Concurrency check** — a script in `supabase/tests` is not possible in pgTAP; instead add an integration test `apps/admin/src/lib/access/referrals.int.test.ts` (pattern of the other `*.int.test.ts`) that fires inviter and invitee `purchase_access` calls in parallel 20 times and asserts no error and consistent totals.
- [ ] **Step 5: Run** `pnpm db:reset && pnpm seed && pnpm db:test && pnpm --filter @prepio/admin test:int` — pass (check the exact int script name in `apps/admin/package.json`).
- [ ] **Step 6: Commit** `feat(db): referral rewards on purchase`.

### Task 4: Student and admin read RPCs

**Files:** Add to the migration of Task 3 (or a follow-up); Test: `supabase/tests/referrals.test.sql`.

**Interfaces:**
- Produces: `my_referral_summary() returns table(code text, enabled bool, threshold int, credits_per_invitee int, duration_months int, has_access bool, pending_count int, invitee_count int, credits_earned int, free_periods_earned int)`; `my_referrals() returns table(id uuid, first_name text, email text, state text, created_at timestamptz, first_paid_at timestamptz, reward_credits int, account_deleted bool)` (email null when deleted; only own rows); `admin_referrals(p_user uuid)` same columns for any student (admin only) plus `admin_referral_context(p_user uuid) returns table(code text, inviter_id uuid, inviter_name text)`.

- [ ] **Step 1: Write failing tests** — summary counts for trial vs active access; `my_referrals` shows first name + email of invitees and `account_deleted=true` with null email after deletion; a student cannot read another's list; `admin_*` refuse students (42501) and work for admins.
- [ ] **Step 2: Run** fail → **Step 3: Implement** → **Step 4: Run** `pnpm db:reset && pnpm seed && pnpm db:test` pass.
- [ ] **Step 5: Commit** `feat(db): referral read functions`.

### Task 5: Student app — pending code, link route, Welcome field, attach

**Files:**
- Create: `apps/mobile/src/lib/referrals.ts`, `apps/mobile/src/lib/referrals.test.ts`, `apps/mobile/app/invita/[code].tsx`, `apps/mobile/src/screens/InviteLinkScreen.tsx`, `apps/mobile/src/components/ReferralCodeField.tsx` (+ tests)
- Modify: `apps/mobile/src/screens/auth/WelcomeScreen.tsx`, `apps/mobile/src/auth/AuthProvider.tsx`, root `apps/mobile/app/_layout.tsx` (make `/invita/*` public like `/termeni`)

**Interfaces:**
- Produces in `lib/referrals.ts`: `normalizeCode(input: string): string`; `inviteUrl(code: string): string`; `storePendingCode(code: string): Promise<void>`, `getPendingCode(): Promise<string | null>`, `clearPendingCode(): Promise<void>` (storage that survives the web OAuth redirect, same approach as `termsConsent.ts`); `lookupReferralCode(code): Promise<{ valid: boolean; inviterFirstName: string | null }>`; `attachReferralCode(code): Promise<'attached'|'invalid'|'disabled'|'not_allowed'|'self'>`; `fetchReferralPublicSettings(): Promise<ReferralPublicSettings>`; types `ReferralPublicSettings`, `ReferralSummary`, `ReferralRow` (camelCase of Task 4 columns).
- `ReferralCodeField` props: `{ onChange(code: string | null): void; disabled?: boolean }`; collapsed "Ai un cod de invitație?", shows "Invitat de <prenume> ✓" when the pending code is valid, and the privacy line "Cel care te-a invitat va vedea prenumele și e-mailul tău."; hidden when public settings `enabled=false`.
- `AuthProvider`: after sign-in, alongside the `acceptTerms` step, if a pending code exists call `attachReferralCode`, then `clearPendingCode()` whatever the result; never blocks or shows an error.

- [ ] **Step 1: Write failing tests** — `normalizeCode('ab-cd 2345') === 'ABCD2345'`; `inviteUrl('ABCD2345')` is `https://prepio.ro/invita/ABCD2345`; `InviteLinkScreen` stores the normalized param and replaces to `/`; for a signed-in user it stores nothing; `ReferralCodeField` shows the inviter name for a valid code, a neutral message for an invalid one, nothing when disabled; `AuthProvider` attaches once after sign-in, clears the pending code on `'not_allowed'`, and still completes sign-in when attach throws; Welcome stores the pending code before starting Google.
- [ ] **Step 2: Run** `pnpm --filter @prepio/mobile test -- referrals` — fail.
- [ ] **Step 3: Implement** per interfaces.
- [ ] **Step 4: Run** `pnpm --filter @prepio/mobile test && pnpm --filter @prepio/mobile typecheck` — pass.
- [ ] **Step 5: Commit** `feat(mobile): invite link, code field and attach on sign-in`.

### Task 6: Student app — invite screen, entry points, history labels

**Files:**
- Create: `apps/mobile/app/(app)/invita.tsx`, `apps/mobile/src/screens/InviteScreen.tsx`, `apps/mobile/src/components/InviteNote.tsx` (+ tests)
- Modify: `apps/mobile/src/screens/HomeScreen.tsx`, `apps/mobile/src/screens/ProfileScreen.tsx`, `apps/mobile/src/lib/credits.ts` (`ledgerLabel`, kind `referral`: "Recomandare: <prenume>"), `apps/mobile/src/lib/access.ts` (history label for `referral_reward`: "Recomandări"), `apps/mobile/src/lib/referrals.ts` (add `fetchReferralSummary`, `fetchMyReferrals`)

**Interfaces:**
- Consumes: Task 4 RPCs, Task 5 types.
- `InviteScreen`: summary block (trial: "Încă N colegi care își iau abonament și primești <durata> gratis" + progress; active: "Primești 40 de credite pentru fiecare coleg…" + totals), code with copy, share via native share sheet / Web Share API / copy fallback with a prefilled Romanian message, invitee list (first name, email, status text incl. "cont șters", "numără spre abonamentul gratuit", "+N credite", "fără recompensă (limita a fost atinsă)"), "Cum funcționează" link to `/recomandari`; loading, empty and error states; renders nothing but a redirect home when `enabled=false`.
- Home: one text line "🎁 Invită colegi, 2/5 ›" (or "Invită colegi ›") under the content, hidden when disabled. Profile: a row with the progress badge. `InviteNote`: shown on Home once after the first finished lesson, dismissible, remembered via AsyncStorage key `prepio.inviteNoteSeen` (wrapped in try/catch).

- [ ] **Step 1: Write failing tests** — InviteScreen in trial (2/5 → "Încă 3 colegi…"), with access (credit copy and totals), empty list, error state with retry, disabled → redirect; share falls back to copy when `navigator.share` is missing; Home line text with and without progress and hidden when disabled; `InviteNote` appears after one finished lesson, dismiss persists, a storage failure doesn't crash; `ledgerLabel` for `referral`; access history label for `referral_reward`.
- [ ] **Step 2: Run** the new tests — fail.
- [ ] **Step 3: Implement** per interfaces; reuse `ui` primitives and the Credits/Access screens' patterns.
- [ ] **Step 4: Run** `pnpm --filter @prepio/mobile test && pnpm --filter @prepio/mobile typecheck` — pass.
- [ ] **Step 5: Commit** `feat(mobile): invite screen and entry points`.

### Task 7: Explainer page and legal sentence

**Files:**
- Create: `apps/mobile/app/recomandari.tsx`, `apps/mobile/src/screens/ReferralsInfoScreen.tsx` (+ test)
- Modify: public-route handling in `apps/mobile/app/_layout.tsx`, `apps/mobile/src/screens/TermsScreen.tsx` and `PrivacyScreen.tsx` (one sentence each), link from `ReferralCodeField` and `InviteScreen`

**Interfaces:** `ReferralsInfoScreen` reads `fetchReferralPublicSettings()` and renders every point in the spec's "Explainer page" list with live numbers (threshold, credits, duration, cap); worked examples for trial and active access; FAQ including "invitatul a plătit după ce am cumpărat eu", "abonamentul meu a expirat", "invitatul și-a șters contul"; works signed out.

- [ ] **Step 1: Write failing tests** — renders with numbers from mocked settings (change the mock → text changes), contains each required topic heading, reachable signed out (routing test like `/termeni`), shows a graceful state when settings fail to load.
- [ ] **Step 2: Run** fail → **Step 3: Implement** → **Step 4: Run** `pnpm --filter @prepio/mobile test && pnpm --filter @prepio/mobile typecheck` pass.
- [ ] **Step 5: Commit** `feat(mobile): referrals explainer page`.

### Task 8: Admin settings

**Files:**
- Create: `apps/admin/src/lib/data/referralSettings.ts`, `apps/admin/src/app/(admin)/settings/ReferralsForm.tsx`, `ReferralsForm.test.tsx`
- Modify: `apps/admin/src/app/(admin)/settings/actions.ts`, `settings/page.tsx`

**Interfaces:** `getReferralSettings(db): Promise<{ enabled: boolean; threshold: number; creditsPerInvitee: number; maxRewarded: number }>`; `validateReferralSettings(i)` (same bounds as the DB); `saveReferralSettings(db, input)` calling `admin_save_referral_settings`; form copy explains that turning it off stops rewards completely and that it should stay off until real payments exist. Mirror `accessSettings.ts` and `AccessForm.tsx`.

- [ ] **Step 1: Write failing tests** — validation bounds; form shows current values, blocks invalid input, calls the action, shows the saved/error state; `settings.int.test.ts`-style integration test for save/get round trip.
- [ ] **Step 2: Run** `pnpm --filter @prepio/admin test` — fail → **Step 3: Implement** → **Step 4: Run** `pnpm --filter @prepio/admin test && pnpm --filter @prepio/admin typecheck` pass (plus the int script).
- [ ] **Step 5: Commit** `feat(admin): referral settings`.

### Task 9: Admin student page

**Files:**
- Create: `apps/admin/src/lib/data/referrals.ts`, `apps/admin/src/app/(admin)/students/[id]/ReferralsSection.tsx` (+ tests)
- Modify: `students/[id]/page.tsx`, `apps/admin/src/lib/data/students.ts` (`eventLabel`/`eventIcon` for `referral_joined`, `referral_access`, `referral_credits`)

**Interfaces:** `accessSource(entries: AdminAccessLedgerEntry[], accessUntil: string | null, now: Date): { kind: 'trial' | 'purchase' | 'referral_reward' | 'admin_grant'; at: string | null }` (the latest ledger entry whose `until_after` equals the current end; trial when none active); `getStudentReferrals(db, userId): Promise<{ code: string | null; invitedBy: { id: string; name: string } | null; invitees: AdminReferralRow[] }>` via the Task 4 admin RPCs. The page shows the label "Cum a fost obținut accesul" (Plătit / Recomandări / Acordat manual / Trial) and a "Recomandări" section: code, invited by (link), table of invitees with first name, e-mail, registered at, status, reward outcome.

- [ ] **Step 1: Write failing tests** — `accessSource` for each of the four outcomes incl. expired access → trial; section renders the table with every status, "cont șters" rows, and the empty state; event labels.
- [ ] **Step 2: Run** fail → **Step 3: Implement** → **Step 4: Run** `pnpm --filter @prepio/admin test && pnpm --filter @prepio/admin typecheck` pass.
- [ ] **Step 5: Commit** `feat(admin): student referrals and access source`.

### Task 10: Docs, browser walk, rollout

**Files:** Modify `docs/STATUS.md`, `docs/deploy.md` (rollout: push migration before merge, flag off by default, turn on only with real payments), `docs/database-migrations.md` only if a new rule appears.

- [ ] **Step 1: Local stack** — `pnpm db:start`, `pnpm db:reset && pnpm seed`, start admin (:3000) and student web (:8081) detached.
- [ ] **Step 2: Browser walk (Claude in Chrome), 360px and desktop, console checked** — admin: turn the feature on, set threshold 2 and credits 40; student A (trial) copies code/link; invite link opened signed out → Welcome shows "Invitat de A ✓"; manual code on Welcome without link; invalid code; student B and C sign up and buy (the app's simulated purchase) → A's screen shows 2/2 → free access; D invited by A buys → 40 credits and credit history row; A's invitee list and statuses; explainer page signed out; Home line/Profile row/one-time note; disabled flag hides everything; admin student page shows access source and invitees. Test data prefixed `[test]` and removed afterwards.
- [ ] **Step 3: Full checks** — `pnpm db:test`, `pnpm test`, `pnpm typecheck`.
- [ ] **Step 4: Update `docs/STATUS.md`** (feature, decisions, backlog: legal review of the privacy sentence and explainer, turn the flag on when payments are real, phone checks: share sheet, clipboard, keyboard on the code field, Welcome with a typed code, deep link on Android).
- [ ] **Step 5: Wrap up** per `CLAUDE.md`: `pnpm db:cloud:push:dry` → `pnpm db:cloud:push`, push branch, `gh pr create`, `gh pr checks --watch`, fix until green, merge with `gh pr merge --squash --delete-branch`, sync `main`; use `superpowers:requesting-code-review` and `finishing-a-development-branch`.
