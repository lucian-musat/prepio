# Learning modes and student progress — design

Date: 2026-11-04
Status: reviewed, waiting for the owner's approval

## Intent

Students get two ways to go through the lessons:

- **Traseu ghidat** (guided path): lessons have to be done in the order set in the admin. A lesson counts as finished only when every answer in its test is correct. A student who gets something wrong goes back to the learning cards to review, then takes the test again.
- **Explorare liberă** (free exploration): any lesson can be opened in any order. A lesson counts as finished when the student reaches its end.

Why: the owner wants the default experience to lead the student through the material in a deliberate order and to make sure each lesson is actually understood before the next one opens. Students who prefer to pick their own path can switch.

The app doesn't save student progress yet (the "save student progress" item in the `docs/STATUS.md` backlog). This feature adds it, because both modes need to know which lessons are finished.

## Goals

1. A student chooses a learning mode during onboarding and can change it at any time from the profile. Each mode is clearly explained wherever it can be chosen.
2. Guided mode locks lessons that come after the first unfinished one and unlocks the next lesson once the test is passed with every answer correct.
3. Progress (finished lessons, plus where the student left off inside a lesson) is saved to the student's account, so it is the same on the web and on Android.
4. In both modes a student can skip the learning cards and go straight to the test.

## Non-goals

- No admin changes. Viewing student progress and modes in the admin belongs to a later, dedicated user-management topic.
- No support for lessons added or reordered after launch. The owner confirmed the lesson set stays fixed once real students use the app. The unlock rule below happens to stay sensible if that changes, but nothing else is built for it.
- No server-side enforcement of the guided-mode rules or server-side grading. Correctness is checked in the app, as it is today (see "Decisions made by Claude").
- The writing exercises (AI-graded) are not moved yet. Later they move to a separate "aprofundare" (deeper study) section that isn't part of passing a lesson.

## Anti-goals

- Students losing progress they already earned: switching modes never removes finished lessons.
- A guided-mode student stuck without a way forward. A failed test always offers both "review the cards" and "retake the test now".
- Mode descriptions so vague that a student doesn't understand what changes when they pick one.

## Behaviour

Approved mockup (owner, 2026-11-04): `docs/design/2026-11-04-learning-modes-mockup.html`. It covers the mode choice, Home in guided mode, the lesson start screen and the guided pass/fail screens. It is a rough wireframe to match in structure and copy. The visual style comes from `docs/design-system.md`.

### Learning mode

- Two modes: `guided` (UI name „Traseu ghidat”) and `free` (UI name „Explorare liberă”). The default is guided.
- **Onboarding:** a new screen „Cum vrei să înveți?” comes right after „Cum te numești?”. It shows both modes as selectable cards, each with a short explanation. Traseu ghidat is preselected and labelled „Recomandat”. „Continuă” saves the choice. The screen says the mode can be changed later from the profile.
- **Profile:** the profile screen shows the current mode and lets the student change it, with the same two cards and explanations.
- Explanations (the copy used in the approved mockup, Claude may polish wording):
  - Traseu ghidat: „Parcurgi lecțiile în ordine, una după alta.” · „Lecția următoare se deschide după ce răspunzi corect la toate exercițiile.” · „Dacă greșești, revezi cardurile și reiei testul.” · „Știi deja materia? Sari direct la exerciții.”
  - Explorare liberă: „Începi orice lecție, în ce ordine vrei.” · „O lecție e terminată când ajungi la final.”

### Lesson order

The order is the one students already see on Home: sections in tree order (node `position`), lessons inside a section by `position`, flattened into one list across all sections. Only published lessons count.

### Home

- Finished lessons show a ✓ in place of the number tile and a „Terminată” label, in both modes.
- **Guided:** finished lessons and the first unfinished lesson in order are open. Every other lesson is locked (dimmed, 🔒) and can't be opened. The first unfinished lesson is highlighted as the current one („Continuă ›”). A chip above the list shows the mode and the count, for example „🧭 Traseu ghidat · 1 din 5 terminate”.
- **Free:** every lesson is open.
- Tapping a locked lesson does nothing beyond, at most, a short hint that the previous lessons must be finished first (builder's choice).

### Lesson start screen (new)

Opening a lesson shows a start screen first, in both modes: the lesson title, the number of cards and exercises, „Începe învățarea” (go to the cards) and „Știu deja — sari la exerciții” (go straight to the test). In guided mode a line explains that answering every question correctly unlocks the next lesson.

If the student has a saved position inside this lesson (see "Resuming"), the start screen also offers to continue from there. Exact layout is the builder's choice.

### The test

The "test" is everything after the cards: the questions (`questions`: single choice, multiple choice, chronological order), then the writing exercises (`writing_exercises`). This is the current phase order and it stays.

- **Questions** count as correct or wrong exactly as the app grades them today. The per-question feedback after „Verifică” (verdict, correct answer, explanation) stays as it is, in both modes (owner, 2026-11-04).
- **Writing exercises always count as correct** for finishing a lesson, in both modes, whatever the AI says and whether or not the student submits. This is temporary: these exercises will move to a separate "aprofundare" section. Mark it in the code with a comment pointing to that future move.

### Finishing a lesson

- **Guided:** when the student reaches the end of the test:
  - **All correct:** the lesson is marked finished, the next lesson in order unlocks, and the done screen says so („Lecție terminată!”, „Ai deblocat: <next lesson title>”), with „Mergi la lecția următoare” and „Înapoi acasă”. On the last lesson there is no next lesson, only Home.
  - **Not all correct:** the lesson is not marked finished. A result screen shows the score (for example 3/5), explains that every answer has to be correct to move on, lists which questions were wrong (for example „Ai greșit la: întrebarea 2, întrebarea 4”), and offers „Revezi cardurile” (back to the first card) and „Reia testul acum” (straight back to the first question). Either way the whole test is taken again, every question, not just the wrong ones. From the cards the student can again skip straight to the test.
- **Free:** reaching the end of the test marks the lesson finished, whatever the score. The done screen stays as it is today (score, confetti), plus a way back Home.
- A lesson that is already finished can always be reopened and redone in either mode. Redoing it never un-finishes it.

### Switching modes

- Finished lessons stay finished in both directions.
- Free → guided: the open lessons are the finished ones plus the first unfinished lesson in order. Example from the owner: lessons 1 and 4 finished in free mode → lesson 2 is the current one, 4 stays finished, 3 and 5+ are locked.
- A lesson finished in free mode with wrong answers counts as finished in guided mode too. The owner accepted this consequence.

### Resuming

If a student leaves a lesson midway, through the back button, Android back, closing the app or switching device, and opens it again, they continue where they left off: the same card, or the same question or exercise with the answers they already gave in this attempt. Reaching the end of the lesson, passed or failed, clears the saved position.

## Data

The owner wants progress kept in the account so it follows the student across devices. The shape below is Claude's proposal; the builder may adjust names.

- `profiles.learning_mode`: `'guided' | 'free'`, nullable. `null` means the student hasn't chosen yet, and the app shows the mode screen (after the name screen). The student may update this column, like `display_name`.
- New table for lesson progress, one row per (student, lesson): `finished_at` (null until finished), and the saved in-lesson position (phase, index, answers given in the current attempt). RLS: a student reads, inserts and updates only their own rows. Rows cascade on account deletion (`/api/account/delete` and `/sterge-cont` keep working) and on lesson deletion. pgTAP tests per `docs/database-migrations.md`.
- Existing production accounts get `learning_mode = null`, so they see the mode screen once on their next visit.

## Platforms and validation

- Student app only (web + Android), `apps/mobile`. Admin unchanged.
- Browser validation per CLAUDE.md: onboarding with the new mode screen, switching mode in the profile, Home in both modes (locks, ✓, chip), start screen, skipping to the test, failed and passed guided tests, the last lesson, resuming midway, free → guided switch, at 360 px and desktop, console clean.
- Native: no new native modules expected. The owner should check on the phone that Android back mid-lesson saves the position, and that the new screens look right at phone size.

## Release prerequisite

The production lessons „test” and „test 2” (section A) must be deleted before this ships (owner, 2026-11-04), otherwise guided mode would put them ahead of the real lessons. Delete them through the production admin, not by hand in the database. Claude has no production admin login, so the owner does it, or Claude does it if given a session. Make it a checklist step in the release.

## Decisions made by Claude (owner, check these)

1. Progress is stored server-side in the student's account, not on the device.
2. Correctness is checked in the app. A determined student could write their own progress rows through the API; this is accepted because it only affects their own learning. No server-side grading.
3. `learning_mode` is nullable, and `null` sends the student to the mode screen. Existing accounts therefore see it once.
4. The start screen appears in both modes, every time a lesson is opened.
5. The guided failure screen lists which questions were wrong, by number.
6. Locked lessons are visible but dimmed with a 🔒, not hidden.
7. A finished lesson can always be redone. Redoing it never un-finishes it, even if the student gets answers wrong in guided mode.
8. Resuming restores the answers given so far in the current test attempt.

9. Small calls from the review: a lesson with no questions is passed as soon as its end is reached. A saved position on a lesson that becomes locked after a free → guided switch is kept but unreachable until the lesson unlocks. Redoing a finished lesson shows the normal done/result screen without "Ai deblocat".

## Left to the builder

- Exact layout and copy polish of the new screens, within `docs/design-system.md` and the approved mockup.
- How the in-lesson position is serialised, how often it is saved (on every step is fine), and how saving errors are handled without blocking the student. Progress must not be silently lost when the student finishes a lesson.
- Table and column names.
