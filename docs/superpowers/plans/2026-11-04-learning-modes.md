# Learning modes and student progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Students choose between „Traseu ghidat” (lessons in order, the next one unlocks only after a test with every answer correct) and „Explorare liberă” (any lesson, finished on reaching the end), with progress saved to their account.

**Architecture:** One migration adds `profiles.learning_mode` and a `lesson_progress` table (own-rows RLS). The student app gets a pure `lessonFlow` module (order, access, attempt outcome, resume point), a `progress` data module, a mode picker reused by a new onboarding screen and the profile, lesson states on Home, and a lesson screen that gains a start phase, resume and guided pass/fail screens. The admin is untouched.

**Tech Stack:** Supabase Postgres + pgTAP, Expo Router / React Native (web + Android), Jest + Testing Library, `@prepio/shared` theme tokens.

**Spec:** `docs/superpowers/specs/2026-11-04-learning-modes-design.md` (mockup `docs/design/2026-11-04-learning-modes-mockup.html`)

## Global Constraints

- Mode values `'guided' | 'free'`; UI names „Traseu ghidat” / „Explorare liberă”; default (preselected, „Recomandat”) is guided.
- Mode copy (exact, from the spec):
  - Traseu ghidat: „Parcurgi lecțiile în ordine, una după alta.” · „Lecția următoare se deschide după ce răspunzi corect la toate exercițiile.” · „Dacă greșești, revezi cardurile și reiei testul.” · „Știi deja materia? Sari direct la exerciții.”
  - Explorare liberă: „Începi orice lecție, în ce ordine vrei.” · „O lecție e terminată când ajungi la final.”
- Lesson order = Home order: `groupLessonsByTree` sections flattened, published lessons only.
- Writing exercises always count as correct (temporary — comment in code: they move to a future „aprofundare” section).
- Per-question feedback after „Verifică” stays unchanged in both modes.
- Finished lessons never become unfinished (not by mode switches, not by a failed redo).
- Database: follow `docs/database-migrations.md` (`pnpm db:new`, RLS, pgTAP, `pnpm db:reset && pnpm seed && pnpm db:test`). Never edit an applied migration.
- Code, comments, commits in English; UI copy in Romanian with correct diacritics (ș ț, not ş ţ).
- Styling only through `@prepio/shared` tokens and `apps/mobile/src/ui` (see `docs/design-system.md`); no new native modules.
- Run commands in WSL: `wsl -d Ubuntu-22.04 -- bash -ic "cd ~/projects/prepio_new && <cmd>"`.

## Review Focus

1. Opening `/lesson/<id>` directly (typed URL, old link) for a lesson that is locked in guided mode must show a "locked" message, not the lesson — test in Task 8.
2. Progress fails to load (offline) on Home or in a lesson: show the existing error + „Reîncearcă”, never treat everything as unfinished and lock the student out silently — tests in Tasks 7 and 8.
3. Marking a lesson finished fails on the result screen: the student must see an error with „Reîncearcă”, and the lesson must not appear finished — test in Task 8.
4. A saved position that no longer fits the lesson (index past the end, unknown phase, junk JSON) must fall back to the start screen, not crash — test in Task 6 (`resumePoint`) and Task 5 (`positionFromJson`).
5. Free → guided switch with a saved position on a lesson that is now locked: Home shows it locked and the direct URL shows the locked message — covered by Review Focus 1's test plus a Task 6 `lessonAccess` case.

---

### Task 1: Database — learning mode and lesson progress

**Files:**
- Create: `supabase/migrations/<timestamp>_learning_modes.sql` (via `pnpm db:new learning_modes`)
- Create: `supabase/tests/learning_modes.test.sql`

**Interfaces:**
- Produces:
  - `public.profiles.learning_mode text null check (learning_mode in ('guided','free'))`; `grant update (learning_mode)` to `authenticated` (existing `profiles_own_update` policy covers it).
  - `public.lesson_progress (user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, lesson_id uuid not null references lessons(id) on delete cascade, finished_at timestamptz null, position jsonb null, updated_at timestamptz not null default now(), primary key (user_id, lesson_id))`, trigger `set_updated_at` (reuse `public.set_updated_at()`).
  - RLS enabled; policies `lesson_progress_own_select` (select, `user_id = auth.uid()`), `lesson_progress_own_insert` (insert, with check `user_id = auth.uid()`), `lesson_progress_own_update` (update, using + with check `user_id = auth.uid()`). No delete policy.
  - `revoke all on public.lesson_progress from anon, authenticated; grant select, insert (lesson_id, finished_at, position), update (finished_at, position) on public.lesson_progress to authenticated;` (`user_id` comes from the default.)
  - Existing profiles keep `learning_mode = null`.

- [ ] **Step 1: Write the pgTAP test** `supabase/tests/learning_modes.test.sql`, fixtures in the style of `accounts.test.sql` (two students d1/d3, one published lesson), assertions:
  - `has_column('public','profiles','learning_mode')`; updating own `learning_mode` to `'free'` as d1 succeeds; `'other'` fails with check violation (`23514`).
  - As d1: insert own row `(lesson_id, position)` succeeds and `user_id` = d1; update own `finished_at` succeeds; d1 sees 0 rows of d3; d1 updating d3's row affects 0 rows; inserting with `user_id = d3` fails (`42501`); delete affects 0 rows.
  - As anon: select from `lesson_progress` fails (`42501`).
  - Deleting d1 from `auth.users` (as postgres) removes d1's rows; deleting the lesson removes its rows.
- [ ] **Step 2: Run** `pnpm db:test` — expected FAIL (column/table missing).
- [ ] **Step 3: Write the migration** with exactly the Produces block above.
- [ ] **Step 4: Run** `pnpm db:reset && pnpm seed && pnpm db:test` — expected: all suites PASS.
- [ ] **Step 5: Commit** `feat(db): learning mode and lesson progress`

### Task 2: Learning mode in the profile and the auth status

**Files:**
- Create: `apps/mobile/src/lib/learningMode.ts`
- Modify: `apps/mobile/src/lib/profile.ts`, `apps/mobile/src/lib/profile.test.ts`
- Modify: `apps/mobile/src/auth/AuthProvider.tsx` (+ its test if present, otherwise create `AuthProvider.test.tsx` cases for `statusFor`)

**Interfaces:**
- Produces:
  - `learningMode.ts`: `export type LearningMode = 'guided' | 'free'`; `export const DEFAULT_MODE: LearningMode = 'guided'`; `export const MODE_INFO: Record<LearningMode, { name: string; icon: string; points: string[] }>` with the exact Global Constraints copy, icons `🧭` / `🗺️`.
  - `profile.ts`: `Profile = { id: string; displayName: string | null; learningMode: LearningMode | null }`; `fetchProfile` also selects `learning_mode`; `updateLearningMode(userId: string, mode: LearningMode, client?): Promise<void>` (same 0-rows → `'Modul nu a putut fi salvat. Încearcă din nou.'` rule as `updateDisplayName`).
  - `AuthStatus` gains `'needsMode'`; export `statusFor(profile, loadFailed)` for tests: name missing → `needsName`; name present, `learningMode` null → `needsMode`; otherwise `ready`; load failed → `ready` as today.
  - `export const modeOf = (p: Profile | null): LearningMode => p?.learningMode ?? DEFAULT_MODE` in `learningMode.ts` (used when the profile is missing offline).

- [ ] **Step 1: Write failing tests**: `profile.test.ts` — `fetchProfile` maps `learning_mode`; `updateLearningMode` sends `{ learning_mode: 'free' }` for `id`, throws the Romanian message on 0 rows. `statusFor` — `{displayName:null}`→`needsName`; `{displayName:'Ana', learningMode:null}`→`needsMode`; `{…,'guided'}`→`ready`; `(null, true)`→`ready`.
- [ ] **Step 2: Run** `pnpm --filter @prepio/mobile test -- profile AuthProvider` — FAIL.
- [ ] **Step 3: Implement** the Produces block. `settle`'s "already settled" check in `AuthProvider` must treat `needsMode` like `needsName`.
- [ ] **Step 4: Run** the same tests — PASS; then `pnpm --filter @prepio/mobile test` (whole suite, fixing mocks that build a `Profile`).
- [ ] **Step 5: Commit** `feat(mobile): learning mode in profile and auth status`

### Task 3: Mode picker and onboarding screen

**Files:**
- Create: `apps/mobile/src/components/LearningModePicker.tsx` (+ `.test.tsx`)
- Create: `apps/mobile/src/screens/auth/ModeScreen.tsx` (+ `.test.tsx`)
- Create: `apps/mobile/app/(onboarding)/mode.tsx`
- Modify: `apps/mobile/app/_layout.tsx` (new `Stack.Protected guard={status === 'needsMode'}` with `(onboarding)/mode`, title „Cum vrei să înveți?”)

**Interfaces:**
- Consumes: `LearningMode`, `MODE_INFO`, `DEFAULT_MODE` (Task 2); `updateLearningMode`, `refreshProfile`.
- Produces: `LearningModePicker({ value: LearningMode; onChange(mode: LearningMode): void; disabled?: boolean })` — two selectable cards (radio semantics: `accessibilityRole="radio"`, `aria-checked`), guided card shows „Recomandat”, each lists its `MODE_INFO.points`. Layout per mockup screen 1.

- [ ] **Step 1: Write failing tests**: picker renders both names and all six points, guided has „Recomandat”, pressing „Explorare liberă” calls `onChange('free')`, the selected card has `aria-checked` true. ModeScreen: title „Cum vrei să înveți?”, subtitle „Poți schimba oricând din Profil.”, guided preselected, „Continuă” calls `updateLearningMode(userId, 'guided')` then `refreshProfile`; choosing free then „Continuă” saves `'free'`; a failing save shows the error with `accessibilityRole="alert"` and keeps the screen.
- [ ] **Step 2: Run** `pnpm --filter @prepio/mobile test -- LearningModePicker ModeScreen` — FAIL.
- [ ] **Step 3: Implement** following `NameScreen` (same `ScreenLayout logo actions`, saving latch, error handling) and the route/guard.
- [ ] **Step 4: Run** the tests — PASS.
- [ ] **Step 5: Commit** `feat(mobile): learning mode onboarding screen`

### Task 4: Mode in the profile

**Files:**
- Modify: `apps/mobile/src/screens/ProfileScreen.tsx`, `ProfileScreen.test.tsx`

**Interfaces:**
- Consumes: `LearningModePicker`, `updateLearningMode`, `modeOf`, `refreshProfile`.

- [ ] **Step 1: Write failing tests**: a „Mod de învățare” section shows the picker with the profile's current mode; pressing the other mode calls `updateLearningMode` immediately, then `refreshProfile`, then shows „Modul a fost salvat.”; on failure the picker reverts to the previous mode and shows the error.
- [ ] **Step 2: Run** `pnpm --filter @prepio/mobile test -- ProfileScreen` — FAIL.
- [ ] **Step 3: Implement**: section between the name block and „Ieși din cont”; picker `disabled` while saving or deleting.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(mobile): change learning mode from the profile`

### Task 5: Progress data module

**Files:**
- Create: `apps/mobile/src/lib/progress.ts`, `progress.test.ts`

**Interfaces:**
- Produces:
  - `export type LessonPosition = { phase: 'cards' | 'questions' | 'exercises'; index: number; results: Record<string, boolean> }` (`results`: question id → answered correctly, for the current attempt).
  - `export type Progress = { finished: Set<string>; positions: Map<string, LessonPosition> }`
  - `positionFromJson(raw: unknown): LessonPosition | null` — null unless `phase` is one of the three, `index` a non-negative integer and `results` an object of booleans (drop non-boolean entries).
  - `fetchProgress(client?): Promise<Progress>` — `select('lesson_id,finished_at,position')` (RLS scopes to the student).
  - `savePosition(lessonId: string, position: LessonPosition | null, client?): Promise<void>` — upsert `{ lesson_id, position }` on `user_id,lesson_id` (only the `position` column changes on conflict, so `finished_at` is kept).
  - `markFinished(lessonId: string, client?): Promise<void>` — upsert `{ lesson_id, finished_at: new Date().toISOString(), position: null }`; throws `Error('Progresul nu a putut fi salvat. Încearcă din nou.')` on error.

- [ ] **Step 1: Write failing tests** with a fake client (pattern of `profile.test.ts`): `fetchProgress` builds `finished` from rows with `finished_at`, `positions` only from valid positions; `positionFromJson` rejects `null`, `{phase:'done'}`, `{index:-1}`, `{index:1.5}`, strings, and keeps `{phase:'questions',index:2,results:{q1:true,q2:'x'}}` as `results:{q1:true}`; `savePosition` and `markFinished` send the expected upsert payload and `onConflict: 'user_id,lesson_id'`; `markFinished` throws the Romanian message on error.
- [ ] **Step 2: Run** `pnpm --filter @prepio/mobile test -- progress` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(mobile): lesson progress data module`

### Task 6: Lesson flow rules (pure)

**Files:**
- Create: `apps/mobile/src/lib/lessonFlow.ts`, `lessonFlow.test.ts`

**Interfaces:**
- Consumes: `HomeData` (content.ts), `LearningMode`, `LessonPosition`, `Lesson`.
- Produces:
  - `orderedLessons(sections: HomeData['sections']): LessonSummary[]` — flatten in section order.
  - `export type LessonState = 'finished' | 'current' | 'open' | 'locked'`
  - `lessonAccess(order: LessonSummary[], finished: Set<string>, mode: LearningMode): Map<string, LessonState>` — finished → `finished`; guided: first unfinished → `current`, other unfinished → `locked`; free: unfinished → `open`.
  - `export type AttemptOutcome = { passed: boolean; correct: number; total: number; wrong: number[] }` (`wrong`: 1-based question numbers in lesson order).
  - `attemptOutcome(lesson: Lesson, results: Record<string, boolean>): AttemptOutcome` — counts `lesson.questions` only (writing exercises always count as correct — add the „aprofundare” comment here); an unanswered question counts as wrong; a lesson without questions → `passed: true, total: 0`.
  - `resumePoint(lesson: Lesson, position: LessonPosition | null): LessonPosition | null` — null when no position, or when `phase` has no items or `index` is past its end; for `questions`, the index moves to the first question at or after `index` not in `results` (past the end → `exercises` index 0 if there are exercises, else null).

- [ ] **Step 1: Write failing tests**: `orderedLessons` keeps section then lesson order; `lessonAccess` — owner's example (lessons 1–5, finished {1,4}, guided) → 1 finished, 2 current, 3 locked, 4 finished, 5 locked; same in free → 2,3,5 open; all finished guided → no `current`; nothing finished guided → first `current`. `attemptOutcome` — 5 questions with q2,q4 false → `{passed:false, correct:3, total:5, wrong:[2,4]}`; all true → passed; missing q5 → wrong includes 5; no questions → passed. `resumePoint` — null position; `{cards, 3}` on a 2-card lesson → null; `{questions, 1, {q1:true,q2:false}}` → `{questions, 2, …}`; all questions answered with exercises → `{exercises, 0, results}`; `{exercises, 5}` with 1 exercise → null.
- [ ] **Step 2: Run** `pnpm --filter @prepio/mobile test -- lessonFlow` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(mobile): lesson order, access and attempt rules`

### Task 7: Home shows lesson states

**Files:**
- Modify: `apps/mobile/src/screens/HomeScreen.tsx`, `HomeScreen.test.tsx`
- Modify: `apps/mobile/src/ui/LessonListItem.tsx` (+ test if present)

**Interfaces:**
- Consumes: `fetchProgress`, `orderedLessons`, `lessonAccess`, `modeOf(profile)`.
- Produces: `LessonListItem` props gain `state: LessonState` (default `'open'`): `finished` → ✓ in a filled primary tile + caption „Terminată”; `current` → primary border + „Continuă”; `locked` → dimmed, 🔒, `disabled`, `aria-disabled`, accessibility label `"<title>, blocată"`, no `onPress`; `open` → today's look.

- [ ] **Step 1: Write failing tests**: Home loads `fetchHome` and `fetchProgress` together; guided profile + finished {l1} → l1 „Terminată”, l2 „Continuă”, l3 locked and pressing it doesn't call `router.push`; chip „🧭 Traseu ghidat · 1 din 3 terminate”; free profile → chip „🗺️ Explorare liberă · 1 din 3 terminate”, l3 opens; `fetchProgress` rejecting → the existing error surface with „Reîncearcă”, and retry reloads both; profile null (offline) → treated as guided.
- [ ] **Step 2: Run** `pnpm --filter @prepio/mobile test -- HomeScreen LessonListItem` — FAIL.
- [ ] **Step 3: Implement**: chip above the first section (`Chip` from `ui`); Home reloads progress when it regains focus (`useFocusEffect` from expo-router) so returning from a lesson shows the new state.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(mobile): lesson states on Home`

### Task 8: Lesson screen — start, resume, guided results

**Files:**
- Modify: `apps/mobile/src/screens/LessonScreen.tsx`, `LessonScreen.test.tsx`
- Modify: `apps/mobile/src/components/CardStepper.tsx` (prop `initialIndex?: number`, default 0)
- Create (if `LessonScreen.tsx` would pass ~350 lines): `apps/mobile/src/screens/lesson/LessonStart.tsx`, `lesson/GuidedResult.tsx`

**Interfaces:**
- Consumes: Tasks 5–6, `modeOf(profile)`, `fetchHome` (for order and the next lesson's title).
- Phases become `'start' | 'cards' | 'questions' | 'exercises' | 'done'`. Loading fetches lesson, home and progress together; any failure → existing „Nu am putut încărca lecția” message (add a „Reîncearcă” button to `Message`).
- Behaviour:
  - Guided and the lesson is `locked` → `Message` „Lecția este blocată” / „Termină mai întâi lecțiile de dinainte, în ordine.”
  - **Start** (every opening): title, „<n> carduri · <m> exerciții” (exercises = questions + writing exercises), „Începe învățarea” → cards index 0, „Știu deja — sari la exerciții” → first non-empty test phase; guided adds „Dacă răspunzi corect la toate, treci la lecția următoare.”; with a `resumePoint` also „Continuă de unde ai rămas” as the primary button. A lesson with no cards hides „Începe învățarea”.
  - `savePosition` after every card change, „Verifică” (store `results[question.id]`) and exercise change; errors are ignored (logged with `console.warn`).
  - End of lesson: free → `markFinished`, then today's `LessonDone`. Guided → `attemptOutcome`; passed → `markFinished`, then the passed screen („Lecție terminată! 🎉”, „Ai deblocat: <next title>” when a next lesson exists and this lesson wasn't finished before, buttons „Mergi la lecția următoare” → `router.replace('/lesson/<next>')` and „Înapoi acasă”; last lesson: only „Înapoi acasă”); failed → `savePosition(null)`, failed screen (score ring `correct/total`, „Aproape!”, „Ca să treci mai departe, ai nevoie de toate răspunsurile corecte. Revezi cardurile și încearcă din nou.”, „Ai greșit la: întrebarea 2, întrebarea 4”, „Revezi cardurile” → cards 0 with fresh results, „Reia testul acum” → questions 0 with fresh results).
  - Redoing a finished lesson in guided mode that fails: show the failed screen; nothing is un-finished (no write besides `savePosition(null)`).
  - `markFinished` failure → error line + „Reîncearcă” on the result screen; the success content waits for the write.

- [ ] **Step 1: Write failing tests** (extend the existing mocks with `fetchHome`, `../lib/progress`, `../auth/AuthProvider`): start screen shows counts and both buttons; skip goes to question 1; guided all-correct → `markFinished('l1')` and „Ai deblocat: <l2 title>”, the next button replaces to `/lesson/l2`; guided one wrong → „Ai greșit la: întrebarea 1”, „Reia testul acum” shows question 1 unanswered, „Revezi cardurile” shows card 1; free with a wrong answer → `markFinished` and „Ai terminat lecția!”; locked lesson in guided → „Lecția este blocată”; saved `{questions,1,{q1:true}}` → „Continuă de unde ai rămas” opens question 2 and a correct q2 passes; `markFinished` rejecting → error + „Reîncearcă” retries; progress fetch rejecting → load error with „Reîncearcă”; last lesson passed → no „Mergi la lecția următoare”. `CardStepper` with `initialIndex={1}` starts on card 2.
- [ ] **Step 2: Run** `pnpm --filter @prepio/mobile test -- LessonScreen CardStepper` — FAIL.
- [ ] **Step 3: Implement.** Reuse `ScoreRing`, `Button`, `Surface`, `ScreenLayout` from `ui`; layout per mockup screens 3 and 4.
- [ ] **Step 4: Run** the tests, then the whole suite `pnpm --filter @prepio/mobile test` and `pnpm -r typecheck` (or the repo's typecheck script) — PASS.
- [ ] **Step 5: Commit** `feat(mobile): lesson start screen, resume and guided results`

### Task 9: Browser validation, docs and release notes

**Files:**
- Modify: `docs/STATUS.md`, `docs/deploy.md` (a "Learning modes rollout" section)

- [ ] **Step 1: Run all suites**: `pnpm test`, `pnpm db:test`, `pnpm --filter @prepio/mobile exec expo export --platform web` (build check). All green.
- [ ] **Step 2: Browser walk** (local stack, student web :8081, Playwright Chromium if Claude in Chrome is unavailable), at 360 px and desktop, console clean: new account → name → mode screen (both choices); existing account with `learning_mode` null sees the mode screen once; Home guided (✓ / current / 🔒 / chip) and free; locked lesson direct URL; start screen; skip to the test; guided fail (both buttons) and pass (next lesson), last lesson; leave mid-test and resume (also after reload); profile mode switch free → guided with lessons 1 and 4 finished → lesson 2 current, 4 finished; offline progress error on Home. Remove `[test]` accounts/data afterwards.
- [ ] **Step 3: Update docs**: STATUS "Where we are" + decisions (the spec's "Decisions made by Claude") + backlog: remove "save student progress"; owner phone checks (Android back mid-lesson saves the position, new screens at phone size, resume after killing the app); release prerequisite: delete production lessons „test” / „test 2” through the production admin before release. `deploy.md`: push migration (`pnpm db:cloud:push:dry` → `pnpm db:cloud:push`), delete the two test lessons, deploy prepio-web, new EAS `preview` APK (old APKs keep working without progress — the new columns are nullable/additive).
- [ ] **Step 4: Commit** `docs: learning modes status and rollout`
