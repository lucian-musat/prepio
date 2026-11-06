# Credits for digital-teacher checks — design

Date: 2026-11-06. Status: approved by the owner in brainstorming; awaiting review of this document.

## Intent

Today every AI evaluation is free. The owner wants to monetise it: the money students pay should cover the OpenAI cost and make a profit. Students get a small free allowance when they create an account. After that they buy credit packages. Each check that goes to the AI costs credits.

There is no real payment yet. Every purchase is approved at once. The purchase is still modelled as a real order, so a payment step can be inserted later without reworking anything.

**Naming rule (owner):** the student app never says "AI". The feature is called **„Verificare cu profesorul digital”**. The currency is just „credite”, never „credite AI”.

## Approved mockups

Approved by the owner, 2026-11-06 („toate 3”, „este perfect”). The behaviour and copy in them are part of this spec. Visual style comes from `docs/design-system.md`.

- `docs/design/2026-11-06-credits-balance-mockup.html` shows how the balance and the cost appear. The owner chose **all three** placements together (option C):
  - a balance chip in the top bar;
  - a cost tag on the exercise card;
  - a coin pill with the cost on the check button.
- `docs/design/2026-11-06-credits-purchase-mockup.html` shows the flow from „Îți mai trebuie N credite” to the purchase, then „Verifică acum”, plus the „Creditele mele” page.

The mockups are fragments written for the brainstorming frame, so some generic CSS (`.cards`, `.subtitle`) is missing when they are opened directly. The package prices in them are the starting values (below).

## Goals

- Each check that reaches the digital teacher costs the exercise's credit cost. This includes every re-check after a wrong answer, at full price.
- New accounts get the welcome credits, an admin setting with a starting value of 12. Every account that already exists when the feature ships gets them once too.
- When the balance is too low, the student sees exactly how many credits are missing. In the same sheet they can buy a package or skip the exercise. Their typed answer is never lost.
- After a purchase, „Verifică acum” runs the check that was blocked.
- The student always knows three things: the balance (top bar), what this exercise costs (card tag), and what this press costs (button pill).
- Admin manages:
  - the welcome credits;
  - the packages (credits, price in lei, featured flag, active flag, order);
  - each exercise's cost, from 1 to 5;
  - a minimal **Elevi** section: a list, a student page, and a manual credit adjustment with a reason.
- Every balance change is recorded in a ledger. The student sees it as „Istoric”; the admin sees it on the student page.

## Non-goals

- Real payments, invoices or fiscal receipts.
- Refunding a purchase.
- Credit expiry, promo codes, subscriptions.
- The full student administration: progress reset, blocking, other data and actions. That is the **next project**. It builds on the Elevi pages added here.
- Charging for local checks. Lesson questions and the non-AI consolidation types stay free.

## Anti-goals (a failure even if it "works")

- A student is charged for a check that failed on our side (timeout, OpenAI error, invalid output).
- The balance can be bypassed or altered from the client, or goes negative under concurrent presses.
- The student loses what they typed because they ran out of credits or went to buy more.
- The word "AI" appears anywhere in the student UI. The legal pages are the exception, see "Decisions".
- The order model only works for "approved instantly", so real payments would mean a redesign.

## What costs what

- AI types are `facts`, `comparison`, `viewpoint`, `argument` and `essay` (`AI_TYPES`). Every exercise of these types has a `credit_cost` from 1 to 5.
- **Defaults** apply to new exercises and are backfilled on existing ones at launch:

  | Type | Default cost |
  | --- | --- |
  | facts | 1 |
  | viewpoint | 1 |
  | comparison | 2 |
  | argument | 2 |
  | essay | 1 per requirement |

- **Essay.** `credit_cost` is the cost **per requirement**:
  - „Verifică cerința” costs `credit_cost`.
  - „Verifică eseul întreg” costs `credit_cost × number of requirements`.
  - The admin field is labelled „Cost pe cerință”, with a hint that shows the whole-essay total.
- **No charge** when the instant local check already blocks the answer (`aiBlocked`: empty, too short or repeated field), because no request is sent. No charge either when the server rejects the request before the AI step: validation, unpublished exercise, rate limit.
- **Refund.** When the AI call or its output validation fails after the credits were taken, the same amount goes back automatically as a `refund` ledger entry. The error row says „Nu ți-am luat niciun credit.”
- A cost change applies only to checks made after it.

## Server

The evaluate route (`apps/admin/src/app/api/consolidation/evaluate`, handler `lib/consolidation/handler.ts`) is the only place credits are spent. The server is authoritative; client checks are only for the user experience.

Handler order:

1. parse;
2. load the exercise;
3. validate;
4. rate limit;
5. **compute the cost on the server**, from the exercise row and the target;
6. **spend**, atomically;
7. call the AI;
8. on any failure after step 6, **refund**.

The spend is one statement: `update … set credit_balance = credit_balance - cost where id = user and credit_balance >= cost`, plus a ledger row, all inside a security-definer function that only `service_role` may execute (same pattern as `consume_rate_limit`).

**Not enough credits:** HTTP **402** with code `insufficient_credits` and the body `{ required, balance }`.

**Success response:** `{ items, credits: { spent, balance } }`. The client updates the balance from it, without a second request.

**Error responses** after a refund carry `credits: { spent: 0, balance }`.

**Purchase:** a new route, `POST /api/credits/purchase` with `{ packageId }`, in the admin app. It reuses the same Bearer, CORS and origin handling as evaluate.

- It calls a service-role function. The function creates a `credit_orders` row from a **snapshot** of the package (credits, price), marks it `approved`, writes the `purchase` ledger row and increases the balance, all in one transaction.
- The route returns `{ order, balance }`.
- Inactive or unknown package: 404 or 409, with a Romanian message.
- Later, a payment provider fits in like this: the route creates a `pending` order and returns a checkout. A webhook then calls the same "approve order" function.

**Native-store note (for later, not now):** Apple and Google require their own in-app purchase systems for digital goods bought inside a native app. When real payment arrives, the mobile app will likely need App Store and Play billing, while the web app can use a card processor. The order model (`provider`, `provider_ref`, `status`) must allow both.

## Data model (new migration)

- `profiles.credit_balance int not null default 0 check (credit_balance >= 0)`.
  - Students can read it; they have no update grant.
  - Admin profiles get the column too. Admins are excluded from the Elevi list.
- `credit_settings` is a singleton (`id = 1`) with `welcome_credits int not null check 0..1000`, starting value 12.
  - Admin read and write; no student access.
  - It is saved in a single statement, so the non-atomic save in the backlog is not made worse.
- `credit_packages`:
  - columns: `id`, `credits int > 0`, `price_bani int > 0` (prices are stored in bani), `featured bool`, `active bool`, `sort_order`, `created_at`;
  - a partial unique index allows at most one row with `featured and active`;
  - students can read active rows; admins have full access;
  - a package is never deleted, only deactivated (`on delete restrict` from orders).
- `credit_orders`:
  - columns: `id`, `user_id → auth.users on delete cascade`, `package_id`, `credits`, `price_bani` (snapshots), `status` (`pending | approved | failed`), `provider` (`'none'` for now), `provider_ref`, `created_at`, `approved_at`;
  - students read their own rows; admins read all; writes go only through the functions.
- `credit_ledger`:
  - columns: `id`, `user_id` (cascade), `delta int` (non-zero), `balance_after int`, `kind` (`welcome | purchase | check | refund | admin`), `exercise_id` (nullable, `on delete set null`), `order_id`, `admin_id`, `reason text`, `created_at`;
  - a unique partial index on `(user_id) where kind = 'welcome'` makes the welcome grant idempotent;
  - students read their own rows; admins read all; it is written only by the functions;
  - a check entry stores the exercise and, for an essay, the target, so the history can show „Eseu · cerința 2” or „Eseu întreg”.
- `consolidation_exercises.credit_cost smallint not null check 1..5`, backfilled with the type defaults. The editor sets the type default on new exercises.
- **Welcome grant:** `handle_new_user()` also grants `welcome_credits` (profile balance plus a ledger row). The migration grants it once to every existing profile that has no welcome row.
- **The welcome grant survives account deletion (owner):** deleting the account and signing in again with the same email must **not** grant the welcome credits again.
  - A `welcome_grants` table stores a **keyed hash** of the normalised (lower-cased, trimmed) email. It has no foreign key to `auth.users`, so it is never cascaded, and only admins and the service role can access it.
  - The hash is an HMAC with a server-side secret that clients can never read (for example Supabase Vault). It is not a plain hash of the email.
  - `handle_new_user()` grants only when the hash is absent, and records it.
  - The backfill records the hashes of existing accounts.
  - An account without an email gets the grant. None exist today: sign-in is Google or email OTP only.
  - The privacy screen gets one sentence: after deletion we keep only an irreversible fingerprint of the email, used solely to know that the welcome credits were already given.
- **Functions**, each `security definer`, `search_path = ''`, `revoke` from public:
  - `spend_credits`, `refund_credits`, `purchase_credit_package`: service role only;
  - `admin_adjust_credits(user, delta, reason)`: authenticated and checked with `is_admin()`. It requires a non-empty reason and never takes the balance below 0;
  - an admin-only function or view that lists the students with their email from `auth.users`.

## Student app (mobile + web)

- **Balance source:** `credit_balance` becomes part of the profile in `AuthProvider`. It is updated from the evaluate and purchase responses, and refetched when the „Creditele mele” page opens and when the app returns to the foreground.
- **`CreditChip`:**
  - It is a coin and a number in the `TopBar` `trailing` slot, on Home (next to the avatar) and on the consolidation screen (next to „n/N”).
  - It turns into the danger tone when the balance is below the cost of the current exercise.
  - Tapping it opens „Creditele mele”.
  - When the balance changes, a floating „−2” or „+50” animates and the number counts. It respects reduced motion.
- **Cost tag** on AI exercise cards: „✦ Profesorul digital · 🪙 2”. For an essay: „🪙 1 / cerință”.
- **Coin pill** on „Verifică”, „Verifică cerința” and „Verifică eseul întreg”, showing what that press costs.
- **Insufficient-credits sheet** (`BuyCreditsSheet`):
  - It opens when the student presses a check button with a balance below that press's cost, or when the server answers 402.
  - It is rendered inside `ExerciseScreen` like `TemplateSheet`: a bottom sheet on phones and a dialog from 900 px, so the answer state is untouched.
  - Title: „Îți mai trebuie N credite” (with the correct singular). Line: „Verificarea cu profesorul digital costă 🪙 X la acest exercițiu. Ai Y. Răspunsul tău rămâne salvat.”
  - The active packages are listed with the price and the price per credit; the featured one is preselected with the badge „CEL MAI ALES”.
  - Buttons: „Cumpără N credite · P lei” and „Sari peste exercițiu” (the existing skip).
  - Success state: „+N”, „Credite adăugate!”, „Acum ai X credite”, **„Verifică acum · 🪙 cost”**, which re-runs the exact blocked target (exercise, requirement or whole essay), and „Înapoi la exercițiu”.
  - A small note under it: „Plata nu e încă activă — cererea a fost aprobată automat.”
  - A purchase error is shown inline with a retry. An in-flight guard prevents double purchases.
- **„Creditele mele” page** (new route `credits`, also linked from Profile):
  - a gradient balance card with the approximate number of checks left;
  - the packages, with the same purchase behaviour but no „Verifică acum”;
  - „Istoric”: the latest ledger entries, newest first, with „Încarcă mai multe”. Each entry has a Romanian label per kind (bun venit, pachet, exercise title for a check, „returnat” for a refund, „ajustare” plus the reason for an admin entry).
- **Copy sweep:** every student-visible "AI" string becomes „profesorul digital” (`AI_NOTE`, the mixed-type notes in `FeedbackView.tsx`, error messages from the handler such as `ai_failed`). The privacy screen is the exception, see "Decisions".
- Prices are shown as `19,99 lei` (Romanian format, from bani).

## Admin

- **Settings → card „Credite”:**
  - the welcome credits;
  - a package table: credits, price in lei, computed price per credit, featured radio, active toggle, order up/down, add and edit.
  - It is saved with its own action, like the existing cards. Validation is hand-written in the existing style.
- **Exercise editor:**
  - a „Cost verificare” field (1–5) for the AI types, in `AiFields` / `EssayFields`;
  - for an essay the field is „Cost pe cerință”, with a hint such as „Eseul întreg: 4 credite”;
  - validated in the shared `validateExercise`.
- **Elevi (minimal):**
  - Sidebar entry and the `/students` list: name, email, balance, sign-up date; search by name or email; paginated; admins excluded.
  - `/students/[id]`: the profile basics, the balance, the ledger (all kinds, including which admin made an adjustment) and the orders.
  - The action „Ajustează credite”: an amount (positive or negative), a required reason and a confirmation. It is refused if the balance would go below 0.

## Decisions made by Claude (owner to check)

- Welcome credits start at 12. Changing the value affects only accounts created afterwards. Admin accounts get the column and the grant too, which is harmless.
- A failed check after the spend is refunded automatically. Rejections before the spend (validation, rate limit) never charge.
- The existing rate limit (30 per hour per student, 300 per day globally) stays in front of the spend. **Amended by the owner, 2026-11-06:** the per-student hourly limit is removed (credits pace the students); only the global 300/day cap stays.
- Packages are never deleted, only deactivated. At most one package is featured.
- The starting packages, seeded and changeable in admin: **20 credits for 9,99 lei, 50 for 19,99 lei (featured), 120 for 39,99 lei**.
- Purchases go through an admin-app API route, not a client-callable RPC, so the payment step slots in later.
- **Owner decision:** free instant purchases ship to production as they are, with no gate. Production is a deployed test environment with no real students yet. **Before a public launch** the purchase must be gated or the real payment added.
- The refund runs in the same request, best effort. If the function is killed between the spend and the refund (the 60 s limit; OpenAI has a 50 s budget), or if the network drops after a successful check, no automatic refund happens. Support then uses „Ajustează credite”. There is no hold-and-sweep mechanism.
- The privacy and legal screen keeps mentioning OpenAI processing. It is a legal disclosure, not product copy. The rest of the student UI says „profesorul digital”.
- The balance is a column on `profiles`, kept consistent with the ledger by the functions (`balance_after` on every row). There is no separate balance table.
- The approximate number of checks left on „Creditele mele” uses cost 1 to 2: „≈ balance/2 – balance verificări”.

## Out of scope / later

- The real payment step: card processor on web, App Store / Play billing on native, fiscal receipts.
- The full student administration (next project).
- Purchase refunds, credit expiry, promo codes, gifting.
- Tracking real OpenAI cost per call in the database. The token counts stay in the Vercel logs.

## Verification

- **pgTAP:**
  - RLS on every new table (students see only their own ledger and orders and only active packages, with no writes);
  - `credit_balance` is not writable by students;
  - spend is atomic, with no negative balance under two concurrent spends;
  - the refund;
  - welcome idempotency (trigger and backfill), including no second grant after deleting and re-creating an account with the same email;
  - the purchase snapshot;
  - `admin_adjust_credits` (admin only, reason required, floor at 0);
  - the featured uniqueness;
  - the `credit_cost` check and backfill.
- **Handler unit tests (fake evaluator):**
  - cost per type and target (essay requirement versus whole);
  - 402 with `required` and `balance`;
  - the spend happens after the rate limit;
  - the refund on AI and validation failure;
  - the `credits` field in the responses;
  - no spend when validation fails.
- **Purchase route tests:** auth, inactive package, snapshot, the balance returned.
- **Mobile tests:** chip states, the sheet's math and pluralisation, the target that „Verifică acum” re-runs, price formatting, and that no "AI" string remains in the student UI (outside the privacy screen).
- **Admin:** form model and validation tests for the credits card and the cost field; e2e for packages, the cost field and a manual adjustment.
- **Browser (owner's rule), at 360 px and desktop:**
  - the chip and pill on Home and in consolidation;
  - run out of credits mid-exercise, then buy, then „Verifică acum” with the typed answer intact (short exercise, essay requirement, whole essay);
  - „Sari peste”;
  - a forced AI failure shows the refund;
  - „Creditele mele” and its history;
  - admin settings, packages, the exercise cost, the Elevi list and adjustment with `[test]` data, removed afterwards;
  - a clean console.
- **Production rollout:** `pnpm db:cloud:push:dry`, then `pnpm db:cloud:push`. Check that existing students got exactly one welcome grant.

## Native-only checks for the owner (next APK)

No new native module is expected. On the phone, check:

- the sheet over the keyboard;
- Android back closes the sheet before leaving the exercise;
- the chip animation and haptics, if they are added;
- the balance refreshes after the app returns from the background.
