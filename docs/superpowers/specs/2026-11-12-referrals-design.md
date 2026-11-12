# Referrals (invite friends) — design

Date: 2026-11-12. Status: draft for owner approval. Decisions marked **(owner)** were taken by the owner in the brainstorming conversation; items marked **(my call)** are the designer's defaults and are open to change.

## Intent

Students bring in other students. A student has a personal code and link. When an invited student **pays for access**, the inviter is rewarded:

- inviter has **no active access** (trial or expired): each paying invitee counts toward a **free access period**; at **5 paying invitees** (configurable in admin) the inviter gets access, identical to a purchased one **including the same bonus credits** (`access_settings.bonus_credits`) **(owner; changed by owner 2026-11-12 — the first draft said "without the bonus credits")**;
- inviter **has active access**: **40 credits** (configurable in admin) per paying invitee, immediately.

Students must always be able to see exactly who they invited, each invitee's status, how many more are needed, and the credits that referrals brought (in the credit history). The feature must be visible but not intrusive. A dedicated page explains every rule in full so there are no disputes with students afterwards. Admins must see on a student's page how that student's access was obtained and the status of their invitees.

## Goals

- Code + link per student; copy and share on web and mobile.
- Reward logic that is deterministic, idempotent (one reward per invitee, ever) and auditable.
- Student screen with progress, invitee list (first name + e-mail), and reward history.
- Admin: settings (threshold, credits per invitee), per-student view of access source and invitees.
- A public explainer page whose numbers come from the live settings.

## Non-goals

- Notifications (push, e-mail, in-app toast) when an invitee pays. The student sees the change next time they open the invite screen **(owner)**.
- Clawback: once an invitee has paid the reward stays, even after cancellation or refund **(owner)**.
- Entering a code after registration **(owner)**: only at registration.
- Deferred deep links / install attribution, universal links, store links (there is no store listing yet; Android is an APK). **(my call)**
- Multi-level rewards, leaderboards, rewards for non-paying actions, rewards for accounts that existed before the invitee signed up.
- A new payment flow. Purchases keep going through `purchase_access` (still simulated, `provider='none'`).

## Anti-goals (what would make this a failure even if it "works")

- A reward given twice, or an invitee counted in two rewards.
- Numbers on the explainer page or the screens that differ from the real behaviour.
- Intrusive prompts: nothing modal, no repeated banners, no badge that nags.
- A student losing a reward silently because of a rule they were not told about.

## Rules (all **owner** unless marked)

1. **Reward trigger:** the invitee's access purchase is approved (`purchase_access`, same transaction). Admin grants (`admin_grant_access`) do **not** trigger a reward **(my call)**. Only the invitee's **first** paid purchase triggers; later renewals do not.
2. **Who gets what is decided at that moment:** if the inviter has `access_until > now()` → credits now. Otherwise → the invitee becomes *pending* for the inviter.
3. **Threshold:** when the inviter's pending count reaches the threshold (5), grant access of `access_settings.duration_months` (same extension rule as a purchase: from the later of now and the current end) together with `access_settings.bonus_credits` (read at grant time, credited like a purchase's bonus: an `access_bonus` credit row, none when the bonus is 0), mark exactly threshold-many pending invitees *consumed by access*. Remaining pending stay pending. *(Changed by owner 2026-11-12: the free access includes the bonus credits; it used to carry none. The bonus row links to the grant through the oldest consumed invitee's referral row.)*
4. **Inviter buys access themselves:** all of their pending invitees convert retroactively to credits (n × credits per invitee), marked *converted to credits*, with a credit-history row naming the invitees.
5. **Pending invitees persist** until they are consumed (rule 3) or converted (rule 4); they never expire and an access period ending does not reset them. "Counter from zero" only means consumed invitees do not count again. **(my call)** Pending is therefore always below the threshold at rest. At most one access grant per paying-invitee event; if the threshold was lowered so that more than one period's worth is pending, the surplus waits for the next event. The inviter's own purchase converts all pending (fewer than the threshold) to credits; it never double-grants.
6. One inviter per invitee. A student cannot use their own code. The code is accepted **only during registration** and never afterwards.
7. Reward values are snapshotted on the reward rows at the time of the event, so later changes of the settings do not rewrite history. The threshold applies as configured when the pending count is evaluated.
8. Inviter with access granted only by an admin (`admin_grant`) counts as having active access (same `access_until` test). Pending invitees are **not** converted by an admin grant, only by the inviter's own purchase **(my call)**.
9. A suspended inviter still accrues rewards (visible, usable after reactivation). Deleted invitees: see rule 13; rewards already granted stay. A deleted inviter: their invitees keep working normally, no more rewards. **(my call)**
10. **Settings (my call):** `referrals_enabled` (default **off** in production until real payments exist, because payments are simulated and anyone could farm rewards) and `max_rewarded_invitees_per_student` (default 100), see rules 11 and 12.
11. **`referrals_enabled` off is a full kill switch (my call):** no new codes attached, no old links accepted, no rewards. A first payment made while off is recorded on the referral row as `not_rewarded_disabled` and is not rewarded retroactively when the flag is switched on again. Existing rows and rewards are kept and stay readable by their owner in history. Since the flag starts off, nothing is attached before it is turned on.
12. **Cap (my call):** evaluated at the invitee's first payment, counting only already rewarded (paying) invitees of that inviter, with the setting's current value. Beyond it the invitee is marked `over_cap` and shown to the student as "Abonat, fără recompensă (limita a fost atinsă)"; the explainer states the cap.
13. **Deleting an invitee account (owner):** any invitee who has paid keeps counting, including a pending one, even if the account is later deleted. The referral row survives with its invitee link set null and keeps only a snapshot of the first name (the e-mail is erased with the account). The inviter's list shows such a row as "<first name> · cont șters" with the status it had. An invitee who never paid is removed from the list with the account.
14. Admins (`admins` table) neither have a code nor can be invited.

## Registration and the code

The student app signs in with Google or an e-mail code; there is no password form. The account is created at first sign-in (`handle_new_user` trigger creates the profile and the welcome grant), followed by onboarding (terms → name → mode).

- **Link:** `https://prepio.ro/invita/<CODE>` (route name is the builder's choice). It opens the student web, stores the code locally (must survive the Google OAuth redirect), and the Welcome screen shows "Invitat de <first name> ✓". Invalid or unknown code: the Welcome screen shows the manual field with a neutral message. Never blocks sign-in.
- **Manual entry:** if no code came with the link, the Welcome screen shows a collapsed "Ai un cod de invitație?" field. Codes are looked up with a public, rate-limited RPC that returns only validity and the inviter's first name.
- **Application:** after the account exists, during onboarding and before it completes, the app calls a security-definer RPC that attaches the code. The RPC refuses when the account already has an inviter, has completed onboarding (terms, name and mode all done), has any purchase or lesson activity, or is older than 24 hours **(my call: "new" means all of these)**, so an existing user who signs in through the Welcome screen with a code never gets attached. It must be safe against double calls.
- **Privacy notice:** under the code field: "Cel care te-a invitat va vedea prenumele și e-mailul tău." The Terms and Privacy drafts (for the lawyer) get one sentence about it. **(owner decided e-mail + first name are shown; the notice is my call)**
- **Mobile:** the link opens the web version. In the APK the student types the code on Welcome (copying a code from the invite screen is supported). No install attribution. **(my call)**
- **Code format (my call):** 8 characters from an unambiguous alphabet, unique, generated at profile creation and backfilled for existing accounts; case-insensitive input, spaces and dashes ignored.

## Student UI (Romanian copy; browser-validated at 360px and desktop)

Entry points, variant **C (owner)**:

1. Home: one quiet text line under the content, e.g. "🎁 Invită colegi, 2/5 ›", no card, no badge. Shown as "Invită colegi ›" when there is no progress yet.
2. Profile: a full row "Invită colegi" with the progress badge.
3. One-time soft note after the first finished lesson ("Ai terminat prima lecție. Invită un coleg"), dismissible, remembered on the device (AsyncStorage); never shown again.

Invite screen:

- Top block depends on state: trial → "Încă N colegi care își iau abonament și primești <durata> gratis" + progress bar; active access → "Primești 40 de credite pentru fiecare coleg care își ia abonament" + totals earned.
- Code with copy; "Trimite linkul" (native share sheet on mobile, Web Share API when available, else copy) with a prefilled message; copy-link.
- Invitee list: first name, e-mail, status. Statuses: "Cont creat, fără abonament"; "Abonat" with the outcome ("numără spre abonamentul gratuit", "+40 credite", "a contribuit la abonamentul gratuit").
- Link "Cum funcționează" to the explainer page.
- Credit history (existing screen) shows referral rows with the invitee's first name (new ledger kind). The access history shows the free access with its source.
- Disabled feature (`referrals_enabled` off): no entry points, no code field, no screen.
- Empty, loading and error states for each.

## Explainer page (owner)

A dedicated page "Cum funcționează recomandările" in the student app, **public** (no sign-in, like Terms/Privacy) so an invitee can read it from the link. Plain language, step by step, worked examples, FAQ. It must cover at least: what counts as a paid invitee; trial vs active access; the threshold and what the free access includes (the same bonus credits as a purchase, with the live number; changed by owner 2026-11-12); credits per invitee; conversion when the inviter buys; what happens when the free period ends; one inviter per invitee, code only at registration; no clawback; the per-student cap; privacy (what the inviter sees); where to look (screen, credit history); who to ask. All numbers are read from live settings through a public RPC, never hard-coded. Copy needs the owner's review (and the lawyer's for the privacy part).

## Admin

- **Settings** (next to the existing access/credit settings page): `referrals_enabled`, threshold, credits per invitee, cap. Free access duration is **not** a new setting; it reuses `access_settings.duration_months`.
- **Student page:** a clear "Cum a fost obținut accesul" label from the `access_ledger` entries that define the current `access_until`: Plătit / Recomandări (with the invitees that earned it) / Acordat manual de admin / Trial. A "Recomandări" section: the student's code, who invited them (link to that student), and a table of their invitees (first name, e-mail, registered at, status, reward outcome). The student timeline gets the new events. Read-only; manual corrections keep using the existing admin grant/adjust tools.

## Data (guidance for the builder)

- New tables (RLS on every one, clients read their own rows only, all writes through security-definer functions): per-student code; one referral row per invitee (unique invitee, inviter, created at, first paid at, state: registered / pending / consumed_access / converted_credits / over_cap, links to the ledger rows); settings singleton.
- Extend `access_ledger.kind` with `referral_reward`; `credit_ledger.kind` with `referral`; `student_events` kinds as needed. Extend `student_event_of_ledger` accordingly.
- The reward logic hooks into `purchase_access` (and only there), inside its transaction, under the existing profile lock ordering (invitee profile, then inviter profile; avoid deadlocks with simultaneous purchases by both).
- pgTAP: every rule above, idempotency, concurrency, RLS (a student cannot read another's referrals or write anything), the registration RPC refusals, the anon lookup limits.

## Left to the builder

Route names, component structure, exact copy beyond the strings above, code generator, rate-limit mechanism for the public lookup, admin page layout, handling of the `welcome_grants` interplay for re-registration, migration ordering and the backfill.

## Delivery

Branch `feat/referrals`, worktree. The migration is pushed to production (`pnpm db:cloud:push`) before the merge (see `docs/deploy.md`), with the feature **off** by default. Browser walk per `CLAUDE.md` (student web 360px + desktop, admin). Native-only items for the owner to test on the next APK: share sheet, clipboard copy, keyboard on the code field, the Welcome flow with a typed code.
