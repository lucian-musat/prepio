# Student administration — design

Date: 2026-11-06. Status: approved by the owner in brainstorming; awaiting review of this document.

## Intent

The admin needs to support students. When a student writes in („nu mai merge lecția X”), or an account looks odd, the owner opens the student's page and should see, in this order:

1. which lessons the student finished and where they stopped;
2. what they did in the app, as a timeline;
3. the actions to fix things: reset progress, add credits, suspend, delete.

This builds on the minimal **Elevi** section shipped with credits (`docs/superpowers/specs/2026-11-06-credits-design.md`): the list, the student page with the credit ledger and orders, and „Ajustează credite”.

Production has no real students yet. It is a test environment.

## Approved mockup

`docs/design/2026-11-06-student-admin-mockup.html`. The owner chose **option A**:

- a header with identity, status, key numbers and every action;
- below it, the tabs **Parcurs** (first), **Cronologie**, **Credite**, **Comenzi**.

The same file shows the suspended-student screen. Option B in the file is not used, except as an example of a suspended student and of timeline rows.

## Goals

- **Progress (Parcurs tab).** For every published lesson, in curriculum order:
  - the status: neîncepută / în curs / terminată;
  - where the student stopped: „Card 6 din 14”, „Verificare, întrebarea 3”, „Consolidare 4/10”;
  - the last activity date;
  - a „Resetează” button per lesson.
  - **No answers and no results**: no right/wrong, no verdicts, no typed text.
- **Reset progress.** Per lesson, or the whole journey („Resetează tot parcursul”), both with a confirmation. A reset deletes:
  - the lesson progress (finished flag and position);
  - the consolidation run;
  - the saved consolidation answers (attempts) of that lesson, or of all lessons.

  It does **not** touch credits, the ledger, the profile or the learning mode.
- **Timeline (Cronologie tab)**, mainly for support. It lists what the student did and what admins did to the account, newest first, with date and time, and is paginated.
- **Suspend / reactivate**, with a reason written by the admin.
  - A suspended student can sign in, but sees only the suspension screen: the reason, a contact line, „Ieși din cont” and „Șterge contul”.
  - Nothing else in the app works for them, and the server enforces this too, not only the UI.
  - Reactivating restores access immediately, with all progress intact.
- **Add credits:** the existing „Ajustează credite” stays, moved into the header actions.
- **Delete the account** from the admin:
  - confirmation by typing the student's email;
  - an option „Blochează reînregistrarea cu acest email”;
  - admin accounts can't be deleted.
- **Blocked re-registration.**
  - It applies when a **suspended** student deletes their own account, always.
  - It applies when an admin deletes with the block option ticked.
  - The email can then never create a new usable account.
- **List filters:** „Suspendați” and „Activi azi”, combinable with the existing search.
- **Header:**
  - avatar initials, name, email, sign-in provider, status badge (Activ / Suspendat);
  - registration date and last activity;
  - lessons finished out of the total, credit balance, learning mode;
  - the actions.

## Non-goals (owner said no)

- Editing the student's name or learning mode from the admin.
- Messages to the student shown in the app.
- Answers, verdicts or scores anywhere in the admin („nu rezultatele”).
- Screen-by-screen or click tracking.

## Anti-goals

- **A suspended student who can still use the app** by calling the APIs or the database directly.
- **Personal data kept after a deletion beyond what is stated here**, or a privacy policy that doesn't say what is kept.
- **A reset that leaves the student in a broken state**, for example a run that points at deleted attempts, or a „terminată” lesson with no progress row.
- **A timeline that shows content the student wrote.**

## Timeline events

Recording starts with this release.

- **Account:**
  - registered (with the provider), plus the welcome credits;
  - changed name;
  - changed learning mode;
  - opened the app, recorded at most once per day per student (Europe/Bucharest day).
- **Lessons:**
  - started lesson X (first progress);
  - finished lesson X;
  - failed the test of lesson X (guided mode). This one only exists if the client reports it, because a failed test isn't stored today;
  - started the consolidation;
  - finished the consolidation.
- **Digital teacher** (from the credit ledger and the evaluate route):
  - checked exercise Y, with its type and cost;
  - check failed and refunded;
  - blocked for insufficient credits.
- **Credits:** bought a package; admin adjustment.
- **Admin actions**, each with the admin's name:
  - suspended (with the reason);
  - reactivated;
  - progress reset (one lesson / all);
  - credits adjusted.
- **Backfill at release**, from existing data:
  - registration (`auth.users.created_at`);
  - lessons finished (`lesson_progress.finished_at`);
  - consolidations finished;
  - the whole credit ledger.

The timeline is visible to admins only. It is deleted with the account, like every other student row.

## Suspension

- **What a suspension stores:** a flag on the student, plus the reason (required), the admin who suspended and the time.
- **Server enforcement** (the builder chooses how; the requirement is fixed): a suspended student
  - gets nothing from the student-facing data: lessons, cards, questions, consolidation, progress writes;
  - gets a clear error from `/api/consolidation/evaluate` and `/api/credits/purchase`.
  - The student can still:
    - read their own profile, so the app knows it is suspended and can show the reason;
    - delete their account through the existing route.
- **Student app:** a new auth status (next to `needsName` / `needsMode` / `ready`) routes to the suspension screen.
  - The screen shows the lock, „Contul tău a fost suspendat”, a „Motiv:” card with the admin's text, and „Dacă crezi că e o greșeală, scrie-ne la {CONTACT_EMAIL}.”, then „Ieși din cont” and „Șterge contul”.
  - Deleting goes through the existing deletion flow and its confirmation.
  - On web and native, a suspension that happens while the student is signed in takes effect at the next profile refresh (foreground, navigation or app restart). It doesn't need to be instant.
- **Admin:** „Suspendă” opens a dialog with a required reason; „Reactivează” asks for confirmation. Both are logged in the timeline.

## Deletion and blocked re-registration

- **Deleting removes the account and all its rows**, as today: profile, progress, attempts, runs, ledger, orders and timeline, all through the cascade.
- **What may remain** is only:
  - the existing welcome fingerprint;
  - for blocked emails, a **keyed fingerprint** of the email (same HMAC approach and secret as the welcome grant, in a table without a user FK), with the block date and the suspension reason. No name, no other data.
- **A blocked email signing in again**: the account is created, but it starts **suspended**, with the stored reason. The student lands on the suspension screen instead of a generic sign-in error.
  - *(My call: a database error during Google sign-in would show a confusing technical message.)*
  - The admin list shows such accounts as „Suspendat”, with a „Reînregistrare blocată” note.
- **Admin unblock (owner):** a blocked-then-recreated account can be reactivated like any suspension. **Reactivating also removes the email's block fingerprint** and clears the „Reînregistrare blocată” note. Once forgiven, a later deletion and sign-up gives a normal, active account. A separate admin screen for managing blocked emails is not needed now.
- **Reason for an admin-deleted active student (owner):** when „Blochează reînregistrarea” is ticked, the delete dialog requires a reason. It is stored with the block and shown to the student if that email comes back. For a suspended student, the field is prefilled with the suspension reason.
- **Privacy screen:** one sentence. If an account is deleted while suspended, or an admin blocks re-registration, we keep an irreversible fingerprint of the email to stop a new account, together with the suspension reason.

## Admin UI (option A)

- **Elevi list:**
  - filter chips „Toți” / „Suspendați” / „Activi azi” (activity today = any timeline event today, Bucharest time);
  - a status column;
  - the existing search, name / email / balance / sign-up columns and pagination.
- **Student page:** the header as in the mockup, then the tabs.
  - The **Credite** and **Comenzi** tabs reuse the existing tables.
  - **Cronologie** shows icon, label and details per row, 50 rows per page with „Mai vechi”.
  - Destructive actions (reset all, suspend, delete) use a confirmation dialog. Delete requires typing the email.
- Every admin action reports success or an error inline, in the existing react-bootstrap style. Text copy is in Romanian and ends up in the plan.

## Decisions made by Claude (owner to check)

- **„Opened the app”** is recorded at most once per Bucharest day.
- **Failed tests** appear only from now on, and only if the client reports them.
- **A blocked email can sign in again**, but the new account is created suspended with the old reason, instead of the sign-up failing.
- **The block fingerprint** reuses the welcome-grant pepper and HMAC.
- **A reset deletes only learning data.** Credits are untouched, and the reset is logged in the timeline.
- **A suspension takes effect at the next profile refresh**, not instantly.
- **Admin accounts** can't be suspended or deleted from the Elevi section, and don't appear in it (as today).

## Out of scope / later

- Instant push of a suspension to an open session.
- A screen listing or unblocking blocked emails.
- Exporting a student's data.
- Timeline retention limits.

## Verification

- **pgTAP:**
  - RLS on every new table;
  - a suspended student is denied lesson, consolidation and progress reads and writes, but can read their own profile;
  - suspend, reactivate and reset are admin-only;
  - a per-lesson reset deletes exactly that lesson's progress, run and attempts, and a full reset deletes all of them;
  - timeline triggers fire for the progress, run and ledger events;
  - the app-open event appears at most once per day;
  - a blocked email re-creates the account suspended with the reason;
  - reactivating removes the block, so delete → sign up again gives an active account;
  - admin delete with block requires a reason;
  - the backfill is idempotent.
- **Admin:** unit and integration tests for the data layer (filters, reset, suspend, delete with and without block); e2e for suspend → reactivate, reset one lesson, delete with block.
- **API:** evaluate and purchase refuse a suspended student; account deletion still works for them.
- **Student app:** jest tests for the suspended status and screen (reason shown, sign-out, delete).
- **Browser (owner's rule):**
  - the admin student page (Parcurs, Cronologie, every action);
  - list filters;
  - the student web at 360 and 1280 px: suspended screen, reactivated, a reset lesson starting from the beginning, a deleted-and-blocked email coming back suspended;
  - `[test]` data, removed afterwards; clean console.
- **Native checks for the owner:** the suspension screen on the phone; Android back doesn't escape it.
