# Daily streak and evening reminder — design

Date: 2026-11-13. Status: approved by the owner on 2026-11-13.
Mockups (brainstorm, not committed): the Home placement options (owner chose **A**) and the details screen shown in the browser companion; the agreed screens are described below.

## Intent

Encourage the student to work **every day**. A visible streak (consecutive days with work) gives a reason to come back, and on the phone an evening reminder nudges the student on days they haven't worked yet. The reminder must be easy to turn off.

## Decisions taken by the owner

- **A day counts** when the student solves **at least one exercise** in any of the three places: a lesson question, a consolidation exercise, or a BAC subject.
- **A missed day resets the streak to 0.** No freezes, no grace days.
- **Reminder at 19:00 by default; the student can choose the time** and can turn the reminder off in settings.
- **Placement: option A** — a small „🔥 n” pill in the top bar next to the access and credits pills, visible on every screen that shows that bar.
- The four details screens (below) were approved as shown, together with the assumptions written under them.

## Approved behaviour (shown to and confirmed by the owner)

1. **The pill.** „🔥 5” on a yellow tint (`accentSubtle` / `onAccent`) while the streak is alive; „🔥 0” in grey (muted) when there is no streak. It shows on web and on the phone.
2. **Tapping the pill** opens a bottom sheet:
   - „🔥 5 zile la rând”, „Recordul tău: 9 zile”
   - the current week Monday–Sunday: worked days get a filled yellow dot with ✓, today is a dashed teal ring until it is worked, future days are empty
   - before working today: „Azi încă n-ai lucrat. Un singur exercițiu păstrează seria.” and a button „Rezolvă un exercițiu”, which goes where the Home continue card goes (the lesson the student is on)
   - a link „Setări memento”, which goes to the reminder settings in Profil (phone only; hidden on web)
3. **Profil → „Memento zilnic”** (phone only, not on web): a „Notificare seara” switch, „Ora” (default 19:00, opens a time picker), and the note „Primești notificarea doar în zilele în care n-ai rezolvat încă niciun exercițiu.”
4. **The first exercise of the day** shows a short toast after its check: „🔥 Seria continuă: 6 zile! Ne vedem mâine.” (for day 1: a „Ai început o serie nouă” variant), and the pill updates. Later exercises that day show nothing.
5. **The notification** at the chosen time, only on days without work:
   - with a live streak: „🔥 Seria ta de 5 zile te așteaptă” / „Un exercițiu de 2 minute e de ajuns ca s-o păstrezi.”
   - with no streak: „Hai să începem o serie nouă 🔥” / „Rezolvă un exercițiu azi.”
   - tapping it opens the app on Home.
6. **Permission** for notifications is asked after the student's first solved exercise (the first toast), not at first launch. If the student refuses, the switch shows as off. Turning it on later asks again, or explains how to allow notifications in the phone settings if Android no longer shows the prompt.

## Assumptions confirmed by the owner

- The day follows **Romania's time (Europe/Bucharest)**, midnight to midnight, wherever the student is.
- An exercise counts when it is **submitted for checking, whether the answer is right or wrong**.
- The streak is stored **on the server**, the same on web and phone.
- The **record** (longest streak) is kept and shown.
- Web shows the streak but has **no notifications**.

## Goals

- A correct, server-side streak that web and phone agree on.
- An evening reminder that never fires on a day the student already worked (from that device), and that can be turned off or moved.

## Non-goals

- Web push notifications, e-mail reminders.
- Server-sent push (FCM / Expo push service). See "How the reminder works".
- Streak freezes, rewards, credits or badges for streaks, leaderboards.
- Showing the streak in admin (could come later).

## Anti-goals

- Nagging: a reminder after the student already worked today, more than one reminder a day, or asking for notification permission on first launch.
- A streak that disagrees between web and phone, or that resets because of a time-zone edge (a student working at 23:30 Bucharest time must keep the day).
- Breaking or slowing an exercise check because streak recording failed: recording is best-effort, like the activity events (`apps/mobile/src/lib/activity.ts`).

## Constraints from the project

- Database changes follow `docs/database-migrations.md` (migration, RLS, pgTAP, cloud push before merge).
- Adding `expo-notifications` is a **new native module**: the next APK is mandatory for reminders. The JS must not crash on an older APK or on web (guard the module).
- Frontend changes need the browser walk (360 px + desktop, console); native-only behaviour goes on the owner's phone checklist.

## How it works (Claude's calls, open for the owner to check)

### Recording active days (server)

- New table `student_active_days (user_id, day date, primary key (user_id, day))`, RLS: a student reads only their own rows; no direct client writes.
- A `security definer` function `mark_active_today()` inserts today's Bucharest date (`(now() at time zone 'Europe/Bucharest')::date`) with `on conflict do nothing`, and returns the streak summary. The client calls it after **each lesson question check** (lesson questions are checked in the app and not stored per answer on the server today, so this is the only signal) and after each **consolidation check**. A **BAC submit** marks the day inside the existing submit path on the server (or with the same client call, whichever the plan finds cleaner).
- A function `my_streak()` returns `{ current, record, today_done, week: [dates worked this Monday–Sunday] }`. `current` counts consecutive days ending today, or ending yesterday if today is not worked yet (the streak is still alive until midnight). `record` is the longest run, computed from the rows (gaps-and-islands), so no stored counter can drift.
- Trust: a student could call `mark_active_today` without solving anything. Acceptable — the streak gives no rewards.
- Existing students start at 0 (no backfill from history).

### Client

- A small streak provider (like the access/credits providers) loads `my_streak()` on start and after each mark, feeds the pill, the sheet and the toast. Failures leave the pill hidden rather than wrong.
- The toast shows when a mark changes `today_done` from false to true.

### How the reminder works (phone only)

- **Local scheduled notifications** with `expo-notifications`, no push server and no tokens. The app schedules one reminder per day for the **next 7 days** at the chosen time, skipping today if today is done (or the time has passed). Each reminder's text is computed in advance: tomorrow still has a live streak if today is done (or yesterday was), later days use the „serie nouă” text.
- It re-schedules on app start, on return to the foreground, after each mark, and when the settings change; turning the switch off cancels everything.
- Limitation, accepted: work done on **web** doesn't cancel the reminder already scheduled on the phone until the app next opens; and after 7 days without opening the app the reminders stop (no point nagging further).
- Settings (on/off, time) are stored **on the device** (AsyncStorage), since only the device rings. Default on (subject to permission), 19:00.
- Android: a notification channel „Memento zilnic”; inexact scheduling is fine (no exact-alarm permission).

### Edge cases settled after the builder check (Claude's calls)

- **BAC counts at submit**, the moment the paper is handed in through `/api/bac/submit`, even if the AI grading then fails and the credits are refunded: the student did the work, and the failure isn't theirs.
- **Lesson questions** count from `LessonScreen` `onAnswered`. **Consolidation** counts from the `/api/consolidation/evaluate` path. The admin lesson preview (`app/preview.tsx`) never marks a day.
- **The reminder's „Ora” is the phone's local time.** Which days are done is decided by Bucharest dates. For a student in Romania the two match. Abroad, the reminder rings at that local hour, and the skip uses the Bucharest date at that moment.
- **„Rezolvă un exercițiu” without a target.** When the continue card has no target (every lesson finished), the button is hidden and only the text stays. When the continue card points to a lesson the student can't open (locked or paid), the button opens what the continue card opens today.
- **Before permission is asked**, the switch shows as on with the note. Turning it on, or the first exercise, asks for permission.
- **Account deletion** removes the active days (`on delete cascade` to `auth.users`).

## Left to the builder

- Component structure, file names, test layout, exact sheet/toast animation (reuse the existing sheet and `ui` pieces).
- Whether BAC marks the day server-side or via the client call.
- The time picker implementation (native picker vs a simple list of times), as long as it works on Android.

## Owner checks on the phone (next APK)

Permission prompt after the first exercise; reminder arrives at the chosen time and not on a worked day; changing the time and turning it off take effect; tapping the notification opens Home; the reminder after a reboot; text with diacritics and 🔥 in the notification.
