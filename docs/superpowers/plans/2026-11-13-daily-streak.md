# Daily Streak and Evening Reminder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A server-side daily streak shown as a „🔥 n” pill (web + phone) with a details sheet and a first-exercise toast, plus a local evening reminder on the phone that the student can move or turn off.

**Architecture:** Postgres stores one row per worked Bucharest day; `mark_active_today()` / `my_streak()` RPCs return a summary computed from those rows. A `StreakProvider` in the signed-in layout loads the summary, marks the day after each exercise check, shows the toast, and (phone only) reschedules 7 days of local notifications via `expo-notifications`, from a pure `planReminders()` function.

**Tech Stack:** Supabase Postgres + pgTAP, Expo SDK 58 / React Native / expo-router, Jest + Testing Library, `expo-notifications` (new native module), AsyncStorage.

**Spec:** `docs/superpowers/specs/2026-11-13-daily-streak-design.md`

## Global Constraints

- Branch `feat/daily-streak` in a worktree; never commit to `main`. Commit the spec with Task 1.
- Day = `Europe/Bucharest` date, midnight to midnight. Week = Monday–Sunday.
- A missed day resets the streak; no freezes. Existing students start at 0 (no backfill).
- Streak recording is best-effort: a failed mark never blocks, delays or errors an exercise check (pattern: `apps/mobile/src/lib/activity.ts`).
- Copy is Romanian, exactly as in the spec: „🔥 5 zile la rând”, „Recordul tău: 9 zile”, „Azi încă n-ai lucrat. Un singur exercițiu păstrează seria.”, „Rezolvă un exercițiu”, „Setări memento”, „Memento zilnic”, „Notificare seara”, „Ora”, „Primești notificarea doar în zilele în care n-ai rezolvat încă niciun exercițiu.”, toast „🔥 Seria continuă: 6 zile! Ne vedem mâine.” / day 1 „🔥 Ai început o serie nouă! Ne vedem mâine.”, notifications „🔥 Seria ta de 5 zile te așteaptă” + „Un exercițiu de 2 minute e de ajuns ca s-o păstrezi.” and „Hai să începem o serie nouă 🔥” + „Rezolvă un exercițiu azi.” Use `plural()` from `@prepio/shared` for „1 zi” / „n zile”.
- Reminder defaults: on, 19:00, device-local time; 7 days scheduled ahead; one per day max.
- Web: pill and sheet yes; no reminder settings, no „Setări memento” link, `expo-notifications` never imported.
- Old APK without the native module must not crash (guarded require).
- Database rules: `docs/database-migrations.md` (RLS on every new table, pgTAP, `pnpm db:reset && pnpm seed && pnpm db:test`). Migration pushed to production with `pnpm db:cloud:push` **before** merge.
- Commands run in WSL: `wsl -d Ubuntu-22.04 -- bash -ic "cd ~/projects/prepio_new/<worktree> && <cmd>"`.

## Review Focus

1. A check at 23:30 Bucharest (21:30 UTC) and one at 00:10 the next day count as two consecutive days, not one — SQL test in Task 1 pins it with explicit `p_today` dates; `bucharestDay()` test in Task 2 pins the UTC→Bucharest edge.
2. Two exercises in a row on the same day (double tap, fast checks, web + phone): one row, one toast — Task 1 (`on conflict`) and Task 3 (toast only on `todayDone` false→true).
3. The mark RPC failing or timing out (offline): the check result still shows and nothing throws — Task 3 test.
4. Notification permission denied: switch shows off, nothing scheduled, no crash; old APK without the module — Task 5 tests.
5. A reminder must not fire today after today is worked, and must use the „serie nouă” text from the second missed day — Task 2 `planReminders` tests.

---

### Task 1: Active days table and streak RPCs

**Files:**
- Create: `supabase/migrations/<timestamp>_daily_streak.sql` (via `pnpm db:new daily_streak`)
- Create: `supabase/tests/daily_streak.test.sql`
- Add: `docs/superpowers/specs/2026-11-13-daily-streak-design.md`, this plan

**Interfaces:**
- Produces:
  - table `public.student_active_days (user_id uuid not null references auth.users(id) on delete cascade, day date not null, created_at timestamptz not null default now(), primary key (user_id, day))`; RLS on; select policy `user_id = auth.uid()`; no insert/update/delete policies for clients.
  - `private.streak_summary(p_user uuid, p_today date) returns jsonb` → `{"current": int, "record": int, "today_done": bool, "week": ["YYYY-MM-DD", …]}` (`week` = worked days in the Monday–Sunday week containing `p_today`, ascending).
  - `public.my_streak() returns jsonb` — `security definer`, `set search_path = ''`, summary for `auth.uid()` and today's Bucharest date; error if `auth.uid()` is null.
  - `public.mark_active_today() returns jsonb` — inserts `(auth.uid(), (now() at time zone 'Europe/Bucharest')::date) on conflict do nothing`, returns `my_streak()`.
  - `execute` granted to `authenticated` only (revoke from `public`, `anon`).

- [ ] **Step 1: Write the failing pgTAP test** `supabase/tests/daily_streak.test.sql`, fixture style of `supabase/tests/student_events.test.sql` (fixed uuids, `begin; select plan(n); … rollback;`). Insert days directly as postgres, then assert on `private.streak_summary`:
  - no rows → `{"current":0,"record":0,"today_done":false,"week":[]}`
  - days 2026-11-10, 11, 12 with today 2026-11-12 → current 3, today_done true
  - same days, today 2026-11-13 → current 3, today_done false (alive until midnight)
  - same days, today 2026-11-14 → current 0
  - days 2026-11-01..05 and 2026-11-12..13, today 2026-11-13 → current 2, record 5
  - today 2026-11-13 (Friday) with days 2026-11-09, 11, 13 and 2026-11-08 → week `["2026-11-09","2026-11-11","2026-11-13"]` (Sunday 8th is the previous week)
  - RLS: as authenticated b1, `select` sees only b1's rows; `insert` into the table is denied (`throws_ok`)
  - `mark_active_today()` as b1 twice → exactly one row for today, returns `today_done` true
  - `my_streak()` as anon → throws; `private.streak_summary` not executable by `authenticated`
- [ ] **Step 2: Run** `pnpm db:test` → FAIL (relation / function missing).
- [ ] **Step 3: Write the migration.** `current`: if `p_today` is in the set, count back from `p_today`, else if `p_today - 1` is, count back from it, else 0. `record`: gaps-and-islands (`day - row_number() over (order by day)::int` grouped, max count), 0 when empty.
- [ ] **Step 4: Run** `pnpm db:reset && pnpm seed && pnpm db:test` → all pass.
- [ ] **Step 5: Commit** `feat(db): student active days and streak RPCs` (including the spec and this plan).

### Task 2: Pure streak helpers (shared)

**Files:**
- Create: `packages/shared/src/streak.ts`, `packages/shared/src/streak.test.ts`
- Modify: `packages/shared/src/index.ts` (export)

**Interfaces:**
- Produces:
  - `type StreakSummary = { current: number; record: number; todayDone: boolean; week: string[] }`
  - `parseStreak(json: unknown): StreakSummary | null` (snake_case RPC → camelCase; `null` on bad shape)
  - `bucharestDay(d: Date): string` — `YYYY-MM-DD` via `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' })`
  - `weekDays(today: string): string[]` — the 7 Monday–Sunday dates containing `today`
  - `streakToast(current: number): string` — day 1 text vs „Seria continuă: n zile!” (`plural`)
  - `type ReminderTime = { hour: number; minute: number }`, `DEFAULT_REMINDER: ReminderTime = { hour: 19, minute: 0 }`
  - `type PlannedReminder = { at: Date; title: string; body: string }`
  - `planReminders(now: Date, time: ReminderTime, s: StreakSummary, days = 7): PlannedReminder[]`

- [ ] **Step 1: Write failing tests** in `streak.test.ts`:
  - `bucharestDay(new Date('2026-11-12T21:30:00Z'))` → `'2026-11-12'`; `new Date('2026-11-12T22:10:00Z')` → `'2026-11-13'`; a summer date (`2026-07-01T21:30:00Z` → `'2026-07-02'`, UTC+3).
  - `weekDays('2026-11-13')` → `['2026-11-09', …, '2026-11-15']`; `weekDays('2026-11-15')` starts `'2026-11-09'`.
  - `streakToast(1)` → „🔥 Ai început o serie nouă! Ne vedem mâine.”; `streakToast(6)` → „🔥 Seria continuă: 6 zile! Ne vedem mâine.”
  - `parseStreak({current:3,record:5,today_done:true,week:['2026-11-13']})` → camelCase object; `parseStreak({})` → null.
  - `planReminders` (run the suite with `TZ=Europe/Bucharest` set in the test file's setup or use instants whose local hour is unambiguous): now 2026-11-13 10:00 local, 19:00, `{current:5,todayDone:false}` → 7 entries starting today 19:00; today's title „🔥 Seria ta de 5 zile te așteaptă”, tomorrow's „Hai să începem o serie nouă 🔥”.
  - same with `todayDone:true` → first entry tomorrow 19:00 with the 5-day streak text, then „serie nouă” texts; 6 entries (today skipped) — the window is `days` calendar days starting today.
  - now 20:00 (after the time), `todayDone:false` → today skipped.
  - `current:0` → every entry uses „Hai să începem o serie nouă 🔥” / „Rezolvă un exercițiu azi.”
- [ ] **Step 2: Run** `pnpm --filter @prepio/shared test streak` → FAIL.
- [ ] **Step 3: Implement.** In `planReminders`, for each local day i in `0..days-1`, trigger = that local date at `time`; skip if `trigger <= now`; let `D = bucharestDay(trigger)`, `today = bucharestDay(now)`; skip if `D === today && s.todayDone`; last worked day `L = todayDone ? today : (current > 0 ? today − 1 : null)`; alive iff `L` is the day before `D` → streak text with `s.current`, else „serie nouă”.
- [ ] **Step 4: Run** tests → PASS; `pnpm --filter @prepio/shared typecheck` clean.
- [ ] **Step 5: Commit** `feat(shared): streak summary, toast and reminder planning`.

### Task 3: StreakProvider, mark calls and the toast

**Files:**
- Create: `apps/mobile/src/lib/streak.ts`, `apps/mobile/src/streak/StreakProvider.tsx`, `apps/mobile/src/streak/StreakToast.tsx`, `apps/mobile/src/streak/StreakProvider.test.tsx`, `apps/mobile/src/streak/__mocks__/StreakProvider.tsx` (like `credits/__mocks__`)
- Modify: `apps/mobile/app/(app)/_layout.tsx` (wrap inside `AccessProvider`), `apps/mobile/src/screens/LessonScreen.tsx:312`, `apps/mobile/src/screens/consolidation/ExerciseScreen.tsx` (`finish`), `apps/mobile/src/components/consolidation/EssayInput.tsx` (after a successful `evaluateConsolidation`), `apps/mobile/src/screens/bac/BacPaperScreen.tsx` (`send`)

**Interfaces:**
- Consumes: `my_streak`, `mark_active_today` (Task 1); `parseStreak`, `streakToast` (Task 2).
- Produces:
  - `lib/streak.ts`: `fetchStreak(): Promise<StreakSummary | null>`, `markActiveToday(): Promise<StreakSummary | null>` — both never throw (warn + `null`).
  - `useStreak(): { summary: StreakSummary | null; refresh(): Promise<void>; onFirstOfDay(cb: () => void): () => void }` — throws outside the provider.
  - `useMarkActive(): () => void` — fire-and-forget; a **no-op outside the provider** (admin preview, `app/preview.tsx`).

- [ ] **Step 1: Write failing tests** (`StreakProvider.test.tsx`, mock `../lib/streak`):
  - loads `fetchStreak` on mount and on AppState `active`; exposes `summary`.
  - `mark()` with server reply `todayDone:true, current:6` after `todayDone:false` → toast text „🔥 Seria continuă: 6 zile! Ne vedem mâine.” visible; `onFirstOfDay` listeners called once.
  - a second `mark()` the same day (already `todayDone`) → no toast; also skips the RPC call (one call per Bucharest day per session).
  - `markActiveToday` resolving `null` → no throw, no toast, summary unchanged.
  - `useMarkActive()` rendered without the provider → calling it does nothing.
- [ ] **Step 2: Run** `pnpm --filter @prepio/mobile test streak` → FAIL.
- [ ] **Step 3: Implement** provider + toast (absolute overlay at the bottom above the safe area, auto-hides after ~3 s, `accessibilityLiveRegion="polite"`, reduced motion respected via `ui/motion`). Wire the calls:
  - `LessonScreen` `onAnswered` → `markActive()`.
  - `ExerciseScreen` `finish` → `markActive()` (covers instant and AI checks).
  - `EssayInput` after the successful response → `markActive()`.
  - `BacPaperScreen` `send`: after `submitBac` resolves, or when it throws `BacApiError` with code `grading_failed` or `already_grading`, or when `fetchOpenAttempt` returns `grading` / `failed` → `markActive()` (spec: BAC counts at submit, even if grading fails).
  - Update existing tests of these screens to use the provider mock so they keep passing; add one assertion per call site that `markActive` is called after a check.
- [ ] **Step 4: Run** `pnpm --filter @prepio/mobile test` and `pnpm --filter @prepio/mobile typecheck` → green.
- [ ] **Step 5: Commit** `feat(mobile): record active days and show the first-exercise toast`.

### Task 4: Streak pill and details sheet

**Files:**
- Create: `apps/mobile/src/streak/StreakPill.tsx`, `apps/mobile/src/streak/StreakSheet.tsx`, `apps/mobile/src/streak/HeaderPills.tsx`, tests `StreakPill.test.tsx`, `StreakSheet.test.tsx`
- Modify: the five `CreditChip` call sites → `HeaderPills` (`HomeScreen.tsx:104` inside `HomeTrailing`, `ExerciseScreen.tsx:303`, `BacListScreen.tsx:189`, `BacPaperScreen.tsx:283`, `LessonStart.tsx:49`)

**Interfaces:**
- Consumes: `useStreak` (Task 3), `weekDays`, `bucharestDay` (Task 2).
- Produces: `HeaderPills({ need?: number; onSolve?: () => void })` renders `StreakPill` then `CreditChip need={need}`; `StreakSheet({ visible, onClose, onSolve? })`.

- [ ] **Step 1: Write failing tests:**
  - pill: summary `current:5` → text „🔥 5”, yellow tone (`accentSubtle` bg, `onAccent` fg), a11y label „Serie de 5 zile, deschide detaliile”; `current:0` → „🔥 0” muted (`surfaceMuted` / `textMuted`); `summary null` → renders nothing.
  - sheet: „🔥 5 zile la rând”, „Recordul tău: 9 zile”, 7 day labels L M M J V S D; worked days marked ✓, today dashed until done; `todayDone:false` shows the hint text and „Rezolvă un exercițiu” only when `onSolve` is given (pressing calls it and closes); `todayDone:true` hides hint and button; `current:1` → „🔥 1 zi la rând”.
  - „Setări memento” shown when `Platform.OS !== 'web'`, navigates to `/profile`; hidden on web (mock `Platform.OS`).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**, sheet built like `BuyCreditsSheet` (Modal, same backdrop, bottom on phone, centred on wide). Home passes `onSolve` = the continue card's action when `target` exists (otherwise undefined → button hidden); other screens pass none (the student is already on an exercise).
- [ ] **Step 4: Run** mobile tests + typecheck → green.
- [ ] **Step 5: Commit** `feat(mobile): streak pill and details sheet in the top bar`.

### Task 5: Local evening reminders (phone)

**Files:**
- Modify: `apps/mobile/package.json` (`npx expo install expo-notifications`), `apps/mobile/app.json` (plugin `expo-notifications`), `apps/mobile/jest.config.js` (map `expo-notifications` to a manual mock)
- Create: `apps/mobile/__mocks__/expo-notifications.ts`, `apps/mobile/src/streak/reminderSettings.ts` (+ test), `apps/mobile/src/streak/reminders.native.ts`, `apps/mobile/src/streak/reminders.ts` (web no-op), `apps/mobile/src/streak/reminders.test.ts`
- Modify: `StreakProvider.tsx` (sync triggers, permission after first toast, notification tap)

**Interfaces:**
- Consumes: `planReminders`, `DEFAULT_REMINDER`, `ReminderTime` (Task 2); `useStreak().onFirstOfDay` (Task 3).
- Produces:
  - `reminderSettings.ts`: `type ReminderSettings = { enabled: boolean; time: ReminderTime; asked: boolean }`; `loadReminderSettings(): Promise<ReminderSettings>` (default `{ enabled: true, time: DEFAULT_REMINDER, asked: false }`, AsyncStorage key `prepio.reminder.v1`, bad JSON → default); `saveReminderSettings(s): Promise<void>`.
  - `reminders.(native.)ts`: `remindersSupported(): boolean` (false on web or when the native module is missing); `permission(): Promise<'granted' | 'denied' | 'undetermined'>`; `requestPermission(): Promise<boolean>`; `syncReminders(s: StreakSummary | null, settings: ReminderSettings, now?: Date): Promise<void>` — cancels all Prepio-scheduled notifications, then if enabled + granted schedules `planReminders(...)` as date triggers on Android channel `daily-reminder` („Memento zilnic”); `onReminderTap(cb: () => void): () => void`.
  - Exposed from the provider: `useReminders(): { settings: ReminderSettings; status: 'granted'|'denied'|'undetermined'|'unsupported'; setEnabled(on: boolean): Promise<void>; setTime(t: ReminderTime): Promise<void> }`.

- [ ] **Step 1: Write failing tests:**
  - settings: default when empty, round-trip, corrupt value → default.
  - `syncReminders` with the mock: granted + enabled → `cancelAllScheduledNotificationsAsync` then 7 (or 6) `scheduleNotificationAsync` calls with the planned titles/dates and `channelId: 'daily-reminder'`; disabled → only cancel; denied → only cancel.
  - `remindersSupported()` false when requiring the module throws (simulate with `jest.doMock` throwing) — no crash.
  - provider: after the first-of-day toast with `asked:false` and status `undetermined` → `requestPermission` called once and `asked` saved `true`; denied → `settings.enabled` stays but `status` `denied` (UI shows off); sync is called on mount, on AppState `active`, after a mark, and after `setEnabled` / `setTime`.
  - `setEnabled(true)` with status `undetermined` asks permission; with `denied` it does not schedule and returns (UI shows the phone-settings hint).
  - reminder tap → `router.replace('/')`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** `reminders.native.ts` requires `expo-notifications` inside `try` at module load; set `setNotificationHandler` so a reminder arriving with the app open shows as a banner. No exact-alarm permission. Do not touch the `.web` bundle.
- [ ] **Step 4: Run** mobile tests + typecheck; `npx expo install --check` reports `expo-notifications` aligned with SDK 58.
- [ ] **Step 5: Commit** `feat(mobile): local evening reminders with expo-notifications`.

### Task 6: „Memento zilnic” settings in Profil

**Files:**
- Modify: `apps/mobile/src/screens/ProfileScreen.tsx` (new group after the account group), `apps/mobile/src/screens/ProfileScreen.test.tsx`
- Create: `apps/mobile/src/streak/ReminderTimeSheet.tsx` (+ test)

**Interfaces:**
- Consumes: `useReminders` (Task 5).

- [ ] **Step 1: Write failing tests:**
  - native: eyebrow „Memento zilnic”, a row „Notificare seara” with a `Switch` (`accessibilityRole="switch"`) on when `enabled && status==='granted'` (or `undetermined`), off when `denied`; row „Ora” with value „19:00”; the note text.
  - toggling calls `setEnabled`; with status `denied` a line „Notificările sunt oprite din setările telefonului.” and a link „Deschide setările” (`Linking.openSettings()`).
  - „Ora” opens `ReminderTimeSheet`: times 15:00 to 22:30 every 30 minutes, current one selected; choosing 20:30 calls `setTime({hour:20,minute:30})` and closes.
  - web (`Platform.OS = 'web'`) or `status 'unsupported'` → the group is not rendered.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** with `Surface` / `SettingsRow` styles from the existing group; the switch row is a new small row (label + RN `Switch`, track colour `primary`).
- [ ] **Step 4: Run** mobile tests + typecheck → green.
- [ ] **Step 5: Commit** `feat(mobile): daily reminder settings in Profil`.

### Task 7: Verify, document, release

**Files:**
- Modify: `docs/STATUS.md` (entry under „Where we are”, owner phone checklist in the backlog), `docs/deploy.md` (short „Daily streak rollout”: push migration → merge → new APK).

- [ ] **Step 1: Full checks:** `pnpm db:reset && pnpm seed && pnpm db:test`, `pnpm -r test`, `pnpm -r typecheck`, lint as CI runs it → all green.
- [ ] **Step 2: Browser walk** (Claude in Chrome, local stack, a `[test]` student, 360 px and desktop, console clean): pill „🔥 0” grey on Home; solve a lesson question → toast with „Ai început o serie nouă”, pill „🔥 1” yellow; a second question → no toast; open the sheet (week dots, record, no button now; „Setări memento” absent on web); with SQL inserts for the previous days in the local DB, check „🔥 n” and the record; consolidation check and BAC submit each mark a day (verify the row); Profil on web has no „Memento zilnic”. Remove the `[test]` data afterwards.
- [ ] **Step 3: Update docs** (STATUS entry; phone checklist from the spec's „Owner checks on the phone”: permission after the first exercise, reminder at the chosen time and not on a worked day, time change and off, tap opens Home, after reboot, diacritics and 🔥).
- [ ] **Step 4: Release in order:** push branch, `gh pr create`, `gh pr checks --watch` until green; `pnpm db:cloud:push:dry` lists only `<timestamp>_daily_streak` → `pnpm db:cloud:push`; `gh pr merge --squash --delete-branch`; sync `main`; confirm prepio-web / prepio-admin Ready; build the APK (EAS `preview`) — mandatory for reminders (new native module).
