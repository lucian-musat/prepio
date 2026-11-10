# Full BAC subjects (Subiecte BAC) — design

Date: 2026-11-09. Status: draft for owner review.

## Intent

Students can already practise every BAC exercise type, one at a time, in a lesson's Consolidare zone. What's missing is the exam itself. The goal is to give students a full official-style paper (Subiectul I, II and III, worth 90 points plus 10 ex officio), let them work through it at their own pace, and then return **a grade** and a **very short** feedback line on everything they didn't get full marks for. Grading is **strict and realistic, like the real exam**: if in doubt, the point is not awarded. A grade that is too generous is worse than one that is too harsh, because a generous grade gives the student false confidence.

The owner transcribes subjects and their marking schemes (barem) by hand in the admin, the same way consolidation content is entered. Reference documents: `E_c_istorie_2026_var_03_LRO` (subject) and `E_c_istorie_2025_bar_01_LRO` (barem). Their structure is described under "Subject structure" below.

## Goals

- A dedicated student section, **„Subiecte BAC”**, completely independent of lessons, reached from Home.
- The student works the whole paper **without any checks along the way** and with **no timer**. They can leave and come back, and the draft is saved in the account.
- A **„💡 Cum rezolv”** hint is shown at **every** requirement.
- **Credits are set per subject** by the admin. They are spent **once, when the paper is submitted for grading**. Every redo needs the credits again.
- After grading, the student sees:
  - the grade, e.g. **8,40**, with a small note: „Notă orientativă — poate diferi de corectarea unui profesor.”;
  - one very short feedback line for each requirement that didn't get full points.
- After grading, the subject is ticked as **„Completat”** with its last grade. It can be redone at any time.
- **Trial students can't open subjects.** They see the list with locks, and a tap opens the existing PaywallSheet.

## Non-goals

- A timer or exam simulation (fullscreen, anti-cheat).
- PDF import of subjects or baremes.
- Subjects other than history, and statistics or progress charts across attempts.
- A teacher or admin re-grading the student's paper by hand.
- Per-requirement checks during the paper (that's what Consolidare is for).

## Anti-goals

These would make the feature a failure even if it technically works:

- Inflated grades.
- Long, lecture-style feedback.
- Charging the student when grading fails.
- Copy that sounds mercenary. Never write „se plătește din nou”; write e.g. „Reluarea necesită credite suplimentare.” This applies to all student-facing credit wording in this feature.
- Subjects leaking to trial students through the API.

## Subject structure (from the reference documents)

The paper follows the official structure:

- **Subiectul I (30 p):**
  - one or two short sources (A, B);
  - 7 requirements. In the reference these are: name (2), detail from a source (2), two items present in both sources (6), letter of the source (3), cause-effect from a source (7), present two historical facts (6), similarity (4).
- **Subiectul II (30 p):**
  - one long source;
  - 6 requirements. In the reference these are: name (2), century (2), two-part mention (3+3), two pieces of information (3×2), point of view + two supporting pieces of information (4 + 3×2, scored 10 / 7 / 0), argument with causal and conclusion connectors (4).
- **Subiectul III (30 p):** an essay with four requirements.
  - Historical information: 24 p, broken down per requirement, e.g. 2+3, 2+3×2, 3×2, 1+4.
  - Ordering and expression: 6 p, made up of historical language 2/1, structure 1, chronological or logical order 2/1, and length 1.
- **Grade** = (10 ex officio + points) / 10, shown with two decimals and a comma (8,40). No fractions of a point. The barem's general rules apply: any correct solution counts, and there are no intermediate scores other than those the barem states explicitly.

## Decided with the owner

- Student flow, mockup in `.superpowers/brainstorm/…/student-flow.html`:
  1. The list grouped by year, each row showing its state (Neînceput / În lucru · position / ✓ Completat · grade) and its cost.
  2. The paper, with tabs Subiectul I / II / III, sources, requirements with their points and the hint, plus previous / next.
  3. A submit screen summarising what's filled in and what's empty, then „Trimite la corectat · 🪙 n”.
  4. A result screen with the grade, the note, a short line for each requirement below full marks, and „Reia subiectul”.
- A paper can be submitted with empty requirements. They score 0.
- Admin data entry is by hand, in forms like the consolidation ones.
- Each requirement is one of the existing consolidation types, gets its points, the transcribed barem portion, and a hint from the existing „Șabloane de rezolvare” library.
- The total must be exactly 90 before the subject can be published.

## Existing code to build on

- **Consolidation types and checkers:**
  - `packages/shared/src/consolidation/`: `types.ts`, `exercises.ts` (`validateExercise`), `check.ts` (`checkExercise`), `marks.ts`, `normalize.ts`, `connectors.ts`.
  - Every exercise currently requires a `lesson_id`.
- **Student inputs** per type: `apps/mobile/src/components/consolidation/*Input.tsx`.
- **Marker and sources:** `apps/mobile/src/components/marker/` (`SourceReader`, `SourceSplit`, …).
- **Hint sheet:** `apps/mobile/src/screens/consolidation/TemplateSheet.tsx`.
- **Admin exercise forms:**
  - `apps/admin/src/components/editor/consolidation/` (`ExerciseForm`, the field components, `SourcesEditor`, `SpanMarker`).
  - Hints: `solution_templates` (`/templates`).
- **AI evaluation pipeline:** `apps/admin/src/lib/consolidation/handler.ts`, `prompt.ts`, `schema.ts`, `lib/evaluate/openai.ts`, `lib/evaluate/rateLimit.ts`.
  - Today the prompt explicitly forbids grades and points („Nu acorda nicio notă și niciun punctaj”). BAC grading needs its own prompt and output contract.
- **Credits:**
  - SQL `spend_credits` / `refund_credits` / `credit_apply` (`20261106132444_credits.sql`). Ledger kinds: `welcome, purchase, check, refund, admin, access_bonus`.
  - Mobile `useCreditGate`, `BuyCreditsSheet`.
- **Access:**
  - `has_full_access()`, `access_open_all()`, restrictive `<table>_access` policies.
  - Mobile `AccessProvider`, `PaywallSheet`.
  - Suspension uses the same restrictive pattern with `is_suspended()`.
- **Timeline:** `student_events` kinds and `log_student_event_service`, labels in `apps/admin/src/lib/data/studentLabels.ts`.

## How it works (Claude's proposal; builder may refine)

### Data (new migration; RLS on every table; pgTAP)

- **`bac_subjects`**: `id, title, year smallint, variant text, credit_cost smallint (1..50), published bool, position, created_at, updated_at`.
- **`bac_sources`**: `id, subject_id → bac_subjects (cascade), section smallint 1..3, label ('A'..'D'), title, author, work, body, position`.
- **`bac_items`**:
  - Columns: `id, subject_id (cascade), section 1..3, number smallint, type, prompt, content jsonb, points smallint, template_id → solution_templates (restrict), position`.
  - `type` and `content` use exactly the consolidation types and shapes, so the shared validators and checkers apply. This also means the shared helpers must stop assuming a lesson (see "Reuse strategy").
- **`bac_item_barem`** (admin-only, like `consolidation_ai_context`):
  - `item_id` PK and `barem jsonb`, made of `{ text, steps?, parts? }`:
    - `text` is the transcribed barem portion;
    - `steps` is the allowed point values, default every integer 0..points (e.g. `[0,7,10]` for the viewpoint);
    - `parts` holds the per-part points for the essay (see below).
  - The barem never reaches the student.
- **Item–source links**: `bac_item_sources (item_id, label, source_id)`, mirroring `consolidation_exercise_sources`.
- **`bac_attempts`**:
  - Columns: `id, user_id, subject_id, status ('draft' | 'grading' | 'graded' | 'failed'), answers jsonb (by item id), position, submitted_at, graded_at, points smallint, grade numeric(4,2), results jsonb (per item: points, max, feedback), ledger_entry bigint`.
  - At most one open attempt (`draft`, `grading` or `failed`) per user and subject, enforced by a partial unique index. Graded attempts are kept as history.
  - The student reads and writes only their own drafts. The status, points and results are written only by the service role.
- **Access:**
  - Restrictive policies on `bac_sources`, `bac_items` and `bac_item_sources`: `access_open_all() and not is_suspended()`.
  - `bac_subjects` (title, year, variant, cost, published) is readable by every signed-in, non-suspended student, so trial students see the locked list.
  - Writes to `bac_attempts` require full access.
- **Timeline:** new `student_events` kinds `bac_started`, `bac_submitted`, `bac_graded` (details: subject, points, grade), `bac_grading_failed`.
- **Credits:** reuse `spend_credits(p_user, p_amount, null, 'bac:<subject_id>')`, so the ledger kind stays `check`. The exercise is null and the target is prefixed `bac:`. `refund_credits` then works unchanged. Labels (admin and the student's „Creditele mele”) recognise the `bac:` target and show „Corectare subiect · <titlu>”. This was settled while planning; no new ledger kind.

### Reuse strategy

Move whatever the lesson-bound consolidation code needs into lesson-agnostic shared pieces, rather than copying it:

- the exercise and content types;
- `validateExercise` and `checkExercise`;
- the input components;
- the source reader / marker;
- the admin field components.

Source labels in TypeScript are `'A' | 'B'`, while the DB allows A–D. That's enough for the reference papers; widen it only if needed.

### Grading (new endpoint `POST /api/bac/submit` on the admin app)

The order is the same as the consolidation handler:

1. Auth, then suspended (403 `suspended`), then full access (403 `access_required`).
2. Load the subject, the items, the barem and the draft.
3. Validate the answers.
4. Rate limit: BAC grading has **its own global daily cap**, separate from the 300/day consolidation budget, so papers can't starve consolidation checks. The cap is counted in papers, 60 papers per day, as a constant (Claude's call). When the cap is hit, answer 429 `rate_limited` before spending. The student sees „Corectarea nu este disponibilă acum. Încearcă din nou mai târziu.”.
5. `spend` the subject's cost once. If the balance is too low, answer 402 `insufficient_credits` with `required` / `balance`.
6. Grade every item. AI calls run in parallel.
7. Save the results and mark the attempt `graded`.
8. If any AI call fails after a retry, refund everything, set the attempt to `failed` with its answers kept, and answer `grading_failed`. The student sees „Corectarea nu a reușit. Nu ți-am luat niciun credit. Încearcă din nou.”, and retrying is just submitting again.

Timing and stuck attempts (Claude's call, after the builder check):

- The route keeps `maxDuration` 60 s, and all calls run in parallel. A paper has at most about 10 calls: the AI items, four essay parts and the ordering call.
- Each call gets a ~40 s timeout with **no retry**, because a retry wouldn't fit in 60 s. Any failure goes to the refund path.
- **Stale grading:** if an attempt stays in `grading` for more than 5 minutes (for example, the function was killed), it is refunded and set to `failed`. A `pg_cron` sweep does this, using the same pattern as `log-access-expiries`. The student's next open of the subject shows the „Corectarea nu a reușit…” state with the answers kept. Submitting again is allowed.
- A `failed` attempt counts as the open draft for the partial unique index, so the student continues from it.

How each item is scored:

- **Deterministic types** (short answer, multi answer, source info, letter, cause-effect) are scored without AI and without reading the barem text, following how the real barem scores these types. Claude's call, after the builder check:
  - **Short answer:** a correct answer gets full points, including the typo-tolerant match (`check.ts` already returns `ok` for it; the barem accepts „orice mod de redactare”). Anything else gets 0.
  - **Multi answer and source info:** points per correct unit = points / count („câte 3 puncte pentru oricare două”). For source info, a mark that contains the expected span plus extra text counts as correct (the barem accepts „citat din sursă”). A mark that is too short, or unrelated, gets 0.
  - **Letter:** full points or 0.
  - **Cause-effect:** full points only for an exact pair with the right roles. Swapped, near or partial gets 0. The barem gives the 7 points only for the whole relation, with no partial scores.
  - An empty answer gets 0, with feedback „Necompletat.”.
  - The feedback line for deterministic items comes from the existing verdict messages, shortened.
- **AI types** (facts, comparison, viewpoint, argument, and each essay part) get one call per item. The prompt is:
  - a new admin setting **„Reguli de notare BAC”**: strict examiner, the barem's general rules, any correct solution counts, no fractions, when in doubt don't award;
  - then the item's requirement, the source text, and the barem text with its allowed steps;
  - then the nonce-delimited student answer;
  - then a fixed contract: return `{ points, feedback }`, where `points` must be one of `steps` (the server rejects and clamps anything else to the nearest lower step) and `feedback` is one sentence of at most ~20 words in Romanian, empty on full points.
  - Deterministic signals that already exist (detected connectors, accepted viewpoint support) are passed in as facts, the way the consolidation prompt does it.
- **Essay:** the student writes in the existing `EssayInput`, one field per requirement. This was the owner's decision, made to match consolidation.
  - Historical information (24 p) is scored requirement by requirement against each requirement's barem part.
  - Ordering and expression (6 p) is scored with one extra call over the essay. The parts are concatenated in requirement order and the call uses three sub-criteria:
    - historical language 2/1/0;
    - structure 1/0: an introductory sentence before the first requirement and a concluding sentence after the last, judged on the first and last fields;
    - chronological or logical order 2/1/0.
  - **Length (1/0) is deterministic.** It is awarded when the essay's total word count is between 300 and 900 words, which is roughly two handwritten pages. Claude's call; the bounds are constants in shared code.

The **grade** is (10 + Σ points) / 10, rounded to 2 decimals, shown as „8,40”.

### Student app (apps/mobile)

- **Routes:**
  - `(app)/bac/index`: the list.
  - `(app)/bac/[id]`: the paper.
  - `(app)/bac/[id]/rezultat`: the latest graded result.
  - Entry is a „Subiecte BAC” card on Home. Claude's call: there's no tab bar today.
- **List** (as in the mockup):
  - grouped by year;
  - row states: Neînceput; În lucru · „Subiectul II, cerința 3”; ✓ Completat · last grade;
  - the cost shown as a coin tag.
  - In trial, rows show 🔒 and open the PaywallSheet. Locked deep links behave like locked lessons.
- **Paper:**
  - Subiectul I / II / III tabs, sources (inline when short; reader or split when long, as in consolidation), and the requirement text with „· n puncte”.
  - The hint is available at every requirement: the template body inline in a collapsible „💡 Cum rezolv” block, collapsed by default (owner, 2026-11-10: open it took most of the page; first built open by default).
  - The existing per-type inputs, with no check buttons.
  - Previous / next and a map of requirements.
  - Answers autosave to the draft (debounced, plus on leave).
- **Submit screen:**
  - „Ai răspuns la x din y cerințe”, then the empty ones listed.
  - „După trimitere nu mai poți modifica răspunsurile.”
  - „Trimite la corectat · 🪙 n” and „Mai lucrez”.
  - Too few credits: the existing BuyCreditsSheet via `useCreditGate`, then „Trimite acum”.
- **Grading state:** a calm waiting screen („Corectăm lucrarea…”). If the app is closed, the result is shown the next time the subject opens.
- **Result:**
  - the grade, large, with „Notă orientativă — poate diferi de corectarea unui profesor.”;
  - a „De lucrat” list with one short line per requirement below full marks, e.g. „I.5 — Ai inversat cauza cu efectul.”, ordered by section and number, each with the points earned („3 / 7 p”, Claude's call);
  - „Reia subiectul”, with the note „Reluarea necesită credite suplimentare.”, which starts an empty draft.
  - Full marks everywhere shows a short congratulation instead of the list.
- **Copy:** no „AI” in the student UI (existing rule); credit wording as in the anti-goals.

### Admin (apps/admin)

- **Menu entry „Subiecte BAC”** (`/bac`):
  - the list (title, year, variant, cost, published, total points);
  - add / edit / delete. Deleting a subject that has attempts is refused; unpublish instead.
- **Subject editor:**
  - **Detalii** tab: title, year, variant, credit cost, published.
  - One tab per **Subiectul I / II / III**, each with:
    - its sources (the existing `SourcesEditor` / `SpanMarker`);
    - its numbered requirements, using the existing `ExerciseForm` field components;
    - per requirement: **Punctaj**, **Barem** (textarea for the transcribed portion plus „Trepte de punctaj”, e.g. `0, 7, 10`, default 0..punctaj) and **„Cum rezolv”** (template picker, required).
  - The essay additionally has the ordering-and-expression part with its fixed sub-criteria. The points are editable but default to the official 2/1/2/1.
  - The total is shown live: „Total: 84 / 90”. Publishing is refused unless the total is 90 and every item is valid („Subiectul nu poate fi publicat: totalul este 84 din 90.”).
- **Settings:** a new „Reguli de notare BAC” text, prefilled with the strict-examiner rules.
- **Student page:**
  - timeline labels for the new kinds;
  - the „Credite” tab shows `bac_grading` rows as „Corectare subiect · <titlu>”;
  - a new tab „Subiecte BAC” lists the student's graded attempts (subject, date, points, grade).
  - Reading the student's answers is out of scope.

### Seed / content

- Seed one complete published subject locally (Istorie 2026, Varianta 3, transcribed from the reference PDF, with its barem written to match the 2025 barem's style) for tests and the browser walk.
- Production subjects are entered by the owner in the admin. There is no content script.

## Constraints

- Follow `docs/database-migrations.md`: a new migration, RLS on every new table, pgTAP, `pnpm db:reset && pnpm seed && pnpm db:test`, then push through `pnpm db:cloud:*`.
- No new native modules expected, but a new APK is needed for the mobile changes.
- Owner's rule: browser walk (360 px and desktop, console) before done. Native checks are listed for the owner's phone.
- Before implementing, ask the owner whether to work on a branch or on `main`.

## Left to the builder

- Exact component splits, the debounce for autosave, file names, the prompt wording within the rules above, and the waiting-screen copy.
