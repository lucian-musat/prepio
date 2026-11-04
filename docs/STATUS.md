# Project status

Last updated: 2026-11-03

## Where we are

**Typed learning cards (2026-11-03) — deployed (web + admin), new APK `49e3ebbd-ae94-4cc1-8bd0-392101ab9c8f`.** Spec `docs/superpowers/specs/2026-11-03-card-types-design.md`, plan `docs/superpowers/plans/2026-11-03-card-types.md`. Cards now have six types: text (formatted Markdown subset with callouts), images (single / gallery + zoom viewer), YouTube video (muted autoplay, start/end), timeline, cause-effect schema and link preview (server-side metadata fetch). Migration `20261103122901_card_types` (`cards.type` + `cards.content` jsonb, old `body`/`image_path`/`image_credit` copied and dropped); seed lessons converted and given one card of each new type. Admin: per-type editor forms, drag/↑↓ reordering, formatted-text toolbar, link autofill, image cleanup on save/delete, live preview through the student web's `/preview` route (Telefon / Desktop). All suites green, browser walk done locally with Playwright Chromium (Claude in Chrome was not available), final review fixes applied. Released 2026-11-03 per `docs/deploy.md` ("Typed cards rollout"); the previous APK shows empty cards — install the new one.

**Student accounts (2026-11-02) — deployed.** Spec `docs/superpowers/specs/2026-11-02-student-accounts-design.md`, plan `docs/superpowers/plans/2026-11-02-student-accounts.md`, setup record `docs/auth-setup.md`. Students must sign in before using the app (web + Android): Google (live), email + 6-digit code (built, hidden in production until a domain + SMTP exist). Admins are explicit (`public.admins`, `is_admin()`); students read published content only, anonymous visitors read nothing. Profile screen (rename, sign out, delete account), public `/confidentialitate` and `/sterge-cont`, `/api/evaluate` requires a session (10/h per student + 300/day global), `/api/account/delete`. Production: migrations `20261102094219_student_accounts` and `20261102145928_grant_admin_owner_gmail` pushed; admins `lucian@musat.dev` and `lucian.m91@gmail.com`; Supabase sign-ups ON, Confirm email ON, Google provider ON; Google OAuth app (project `prepio-513509`) published "In production". Verified in production (Chrome): Google sign-in links to the existing account, Home loads, real AI evaluation (200, ~13 s), admin panel works, anonymous REST read of lessons returns `[]`, CORS allows `Authorization`. New APK: EAS build `95bd8726-f39f-4ab2-95eb-681a2db949af` (preview, finished 2026-11-02) — the previous APK can no longer read lessons.


The student app and admin were restyled with the "Mentă Prietenoasă" design system (2026-10-31/11-01; `docs/design-system.md`) and **deployed on 2026-11-01**: both Vercel projects from `main` (`dd517be`, production checklist from `docs/deploy.md` passed, prod walked in Chrome) and a new Android `preview` APK (EAS build `81fa1fef-0077-47f6-a447-bc331f1ebee3`). The owner still has to install that APK and go through the phone test list below.

The POC described in `docs/superpowers/specs/2026-10-30-prepio-poc-design.md` is **implemented, deployed and in use** (plan `docs/superpowers/plans/2026-10-30-prepio-poc.md`, all 13 tasks done).

| Component | Production |
|---|---|
| Student web | https://prepio-web.vercel.app |
| Admin + `/api/evaluate` | https://prepio-admin.vercel.app |
| Android APK | EAS internal distribution (expo.dev → `lucianm91s-team/prepio` → Builds), installed and working on the owner's phone |
| Database | Supabase `pienbjvwjgnzmnjzmrbh` (eu-west-2), migration history in sync with `supabase/migrations/` |

Content: 3 published lessons (BAC history 1857–1918), written by Claude from the 2025 programa/barem — the owner still needs to review them for accuracy (see backlog).

Verified at the end of the POC: all unit, pgTAP, integration and Playwright suites green; `next build` and `expo export` OK; production checks (sign-up blocked, anon can't read `ai_settings`, CORS/403 on the evaluate API, real OpenAI evaluation in Romanian, ~15 s).

Design-system polish (tokens, `Pop`, `progressLabel`, writing resubmit state, reveal scroll offset, admin Bootstrap subtle variables, narrow-screen tree) is done; see `docs/design-system.md`.

## Decisions taken during implementation (not in the original spec)

- Design system (spec `docs/superpowers/specs/2026-10-31-design-system-design.md`, doc `docs/design-system.md`): variant B "Mentă Prietenoasă" chosen by the owner; tokens in `packages/shared/src/theme.ts`; fonts Nunito + Nunito Sans (family keys CSS-safe in `apps/mobile/src/theme/fonts.ts`, react-native-web writes `fontFamily` unquoted). The old archive theme (Lora, Source Sans, parchment/bordeaux/gold) is removed.
- Primary is the darker teal `#0F766E` (white label 5.5:1) instead of the prototype's `#0D9488` (3.7:1) for AA; medium/accent text `#8A6A00`, feedback text `#1A7C49` / `#A54042`. Gradients keep the prototype colours.
- Student app uses an own UI kit (`apps/mobile/src/ui/`) instead of React Native Paper, whose Material look fought the design; Paper is removed.
- New native modules: `react-native-svg` (icons, score ring) and `expo-linear-gradient` (hero, progress bar). No `expo-updates`, so a new APK is required.
- Admin keeps Bootstrap 5 / react-bootstrap; the tokens are mapped to Bootstrap CSS variables in `apps/admin/src/app/theme.ts` (calm: no 3D/confetti/springy motion).
- Motion: in-flow enter animations use shared-value `Enter`/`useEnter`, not Reanimated `Keyframe` `entering` (on react-native-web 4.7.1 Keyframe leaves elements `position:absolute` with a frozen size). The prototype's outgoing-screen exit animation is not reproduced (the old screen/phase disappears at once on web; native uses the stack's `slide_from_right`) — would need to keep the previous phase mounted during the swap.
- Admin data access: functions in `apps/admin/src/lib/data/*.ts` taking a `SupabaseClient`; server actions are thin wrappers returning `ActionResult` (`{ok,error}`) with Romanian messages; every update/delete uses `.select('id')` and fails on 0 affected rows (RLS denials are silent otherwise).
- Rate limiting: fixed 1-hour window, 10 evaluations per IP, plus a global cap of 300/day (`consume_rate_limit`).
- `/api/evaluate`: per-request nonce delimiters around the student text (prompt-injection), 403 for foreign `Origin`, 415 unless JSON, `maxDuration = 60`.
- Seed is non-destructive by default (`SEED_RESET=1` replaces everything); DB-backed test suites refuse to run against non-local Supabase.
- Android package `dev.musat.prepio`; EAS keystore generated by EAS (stored in EAS credentials).
- Initial cloud schema + content were applied via the Supabase SQL editor; history repaired afterwards — all future changes go through `docs/database-migrations.md`.
- The POC was built directly on `main` (owner's choice at the time).
- Typed cards (2026-11-03; spec "Decisions made by Claude"): one `content` jsonb per card with TypeScript discriminated unions and a hand-written `validateCard` in `@prepio/shared`; `cardFromRow` is the only way untrusted JSON (DB rows, preview messages, `saveCard` input) becomes a `Card` and assigns deterministic, unique item ids (`point-<i>`, `cause-<i>`, `consequence-<i>`, `central`). The link preview's title is `content.pageTitle`, distinct from the optional card heading `title`.
- Formatted text is a small Markdown subset parsed by an own parser and rendered as native `Text` (never HTML); the admin edits it in a textarea with a toolbar.
- Preview fidelity: the admin embeds the real student code (`/preview` on the student web) in an iframe and posts the unsaved card; both sides check origin, source and message shape; `/preview` has a `frame-ancestors` CSP and needs no login.
- Video: `react-native-youtube-iframe` (WebView) on Android, a YouTube iframe on web; leaving the card unmounts the player. Links: `expo-web-browser` on native, a new tab (`Linking.openURL`, `noopener`) on web.
- Link metadata fetch (admin server action): http(s) only, every resolved address must be public, manual redirects re-checked (max 3), 5 s budget, 1 MB cap, `text/html` only. DNS-rebinding residual risk accepted (see backlog).
- Lesson 3 merged two pairs of text cards (titles became `### ` headings) to stay within 6–10 cards after adding video + link.
- Admin preview toggle labels are plain `Telefon` / `Desktop` (no emoji).
- Accessibility on web: react-native-web 0.21 ignores `accessibilityState`, so expanded/selected states use `aria-*` props; tappable images use the `button` role.
- The student app's only raw palette values (timeline line and key-dot ring, schema cause edge) are documented exceptions in `docs/design-system.md`.

## Backlog (known follow-ups, prioritised)

### Owner actions
- [x] Typed cards release (2026-11-03): Vercel env vars set (`NEXT_PUBLIC_STUDENT_WEB_URL` on prepio-admin, `EXPO_PUBLIC_ADMIN_ORIGIN` on prepio-web), migration `20261103122901_card_types` pushed, `main` pushed (`bcbd3d7`), both deployments Ready, CSP `frame-ancestors` present on `/preview`, `/preview/`, `/preview?x=1`, admin origin inlined in the web bundle, `/preview`, `/` and admin `/login` load with a clean console (headless Chromium), EAS `preview` build `49e3ebbd-ae94-4cc1-8bd0-392101ab9c8f` started.
- [x] Every seed lesson has all six card types (2026-11-04): 14 cards from `packages/content/src/extraCards.ts` added to production with `pnpm content:cloud:add-cards --apply` (dry run first; re-run plans 0). Owner: watch the two new videos (TVR „Istoria cu Virgil” 1859; Cristina Gherasim, Constituția din 1866).
- [ ] Test on the phone with the next APK (swipe + tappable details, 2026-11-04): swipe left/right between cards (follows the finger, commits at ~25% or a flick, springs back otherwise, resistance on the first/last card, never finishes the lesson); vertical scrolling of long cards still works and a diagonal drag doesn't change card; taps still work on timeline points, schema boxes, gallery thumbnails (the thumbnail strip scrolls without changing card), image viewer, link button, video sound pill; swiping after pinch-zooming in the viewer; no crash when a swipe or pinch ends (the worklet `timing` fix); timeline chevrons and schema "+" badges only on items with details, hint line above, smooth reveal; TalkBack reads the details when expanded.
- [ ] Walk the logged-in production flows (Claude had no production credentials): admin card editor live preview (Telefon / Desktop) for each type with a `[test]` draft lesson, then delete it; student web lessons render the converted cards; existing production cards (incl. "test" / "test 2") look as expected after the migration.
- [ ] `npx expo install --check` reports `expo` ~58.0.22 and `expo-router` ~58.0.29 patch updates (pre-existing, not applied in this release).
- [ ] Test typed cards on the phone with the new APK (mandatory after the migration; new native modules `react-native-webview`, `react-native-youtube-iframe`, `expo-web-browser`):
  1. Install and build: before the EAS build run `npx expo install --check` (or `expo-doctor`); `react-native-webview` is pinned to `14.0.1`, confirm it matches SDK 58.
  2. Video autoplay and audio: autoplays muted when its card becomes active; "Atinge pentru sunet" turns sound on; sound stops on Continuă, Înapoi, the header back button, the Android back button, and when the app goes to the background or the screen locks (nothing pauses the WebView on background — check).
  3. Video loading and fallback: the embed loads in the WebView (depends on the remote `lonelycpp.github.io` page; watch for YouTube errors 152/153); a non-embeddable video falls back to the thumbnail and "Deschide pe YouTube".
  4. Video fullscreen works; the app is portrait-locked — check whether fullscreen video can rotate.
  5. Video in transitions: sliding away from an active video doesn't crash; several video cards in a row don't build up memory.
  6. Images card: images show at their natural aspect ratio.
  7. Image viewer: pinch zoom and pan with clamping (zoom centres on the middle, not the focal point — judge whether it feels right); Android back closes the viewer; previous/next and credit; safe areas with `statusBarTranslucent`.
  8. Gallery: the thumbnail strip scrolls horizontally, selected border visible.
  9. Timeline and schema with TalkBack: tapping expands; TalkBack announces the expanded state and reads the details.
  10. Link card opens in a Custom Tab; closing it returns to the lesson.
  11. Rich text: italic renders (no italic Nunito file is loaded); bold uses the bold family; callout colours are right.
  12. Emoji: the 🔇 pill and other emoji render.
  13. Long content: the `[test]` long lesson at 360 dp (20 points, 200-character boxes, 120-character URL) — nothing overflows.
- [ ] Install the new APK (EAS `95bd8726…`) and test accounts on the phone: native Google account picker shows "Prepio" and signs in; closing the picker shows no error; session survives an app restart; sign out → welcome, sign in again shows the picker; profile rename / delete account; AI evaluation from the writing exercise; open the app offline after > 1 h then reconnect (must stay signed in); keyboard on the name screen; welcome/profile screens at phone size.
- [ ] Review the legal text on `/confidentialitate` and `/sterge-cont` (written by Claude; data in Supabase London/UK, OpenAI processes essay text possibly in the USA) before the Play Store listing.
- [ ] Production content has two published lessons named "test" / "test 2" (section A) — unpublish or delete if they are leftovers.
- [ ] When the domain exists: Resend SMTP + OTP template, `EXPO_PUBLIC_AUTH_EMAIL_ENABLED=true`, new `CONTACT_EMAIL` (checklist in `docs/auth-setup.md`).
- [ ] Google Play release: add the Play app-signing SHA-1 as an Android OAuth client (`docs/auth-setup.md`).
- [ ] Review the 3 lessons for historical accuracy. Known simplifications: universal-suffrage dates inconsistent across lessons (principle 1917 / decree-law Nov 1918 / first applied 1919); 1918 peace card says Romania "lost Dobrogea" (Cadrilater + south to Bulgaria, rest under Central Powers administration); L3 exercise 1 examples Plevna/Grivița overlap (could be credited as two facts); L2 card 6 "democratice" → "liberale"; L3 card 6 repeats "a aderat".
- [ ] Test on the phone with the next APK (design system; native-only behaviour not verifiable on web). The APK must be rebuilt (new native modules `react-native-svg`, `expo-linear-gradient`):
  - Fonts and diacritics: Nunito / Nunito Sans everywhere, ă â î ș ț in both cases never in a fallback font; text line spacing looks right (fractional line heights are rounded by Android's text engine); the 🎓 emoji (56 px) and the "📚 n lecții" chip render without clipping (emoji line box differs per platform).
  - Insets: status bar with dark icons on the light background; top bar below the status bar; action bar and the Home list clear the gesture/nav bar.
  - Writing exercise: with the keyboard open the action bar stays above it and the focused field is not covered (`behavior='height'` on Android); TextArea focus ring and multiline typing.
  - Back: Android hardware back leaves the lesson (and `slide_from_right` screen transition); back button 48 px target and press feedback.
  - Animations smooth on Android (Reanimated): screen/content enter, staggered lists, card slide + tilt and dot width, option press scale / correct pop / wrong shake, verdict icon pop and tinted action bar, smooth scroll to the revealed answer, Home hero floating circle (8 s loop).
  - Gradients and SVG (new native modules): hero gradient angle/colours, progress-bar fill, score ring arc and count-up, skeleton shimmer.
  - Shadows (`boxShadow`, new architecture): solid card/option/button edges, top/action bar edge shadows when content scrolls under them, progress-bar inner shadow.
  - Confetti (28 views) and ring count-up performance.
  - Lesson-row and button press feedback on touch; no hover on native, and bar tint/edge changes are instant there (CSS transitions are web-only).
  - TalkBack: options read as "…, corect" / "…, greșit, ai ales-o" with the right checked state; verdict announcement after "Verifică"; writing error alert.
  - Long card/question keeps the progress bar and action bar on screen; CardTransition overlap with real card images.
  - Screen push on Android doesn't look doubled (native stack slide + ScreenLayout content slide-in).
  - Android splash/icon background now mint/teal (`#F3FAF7` splash, `#0F766E` adaptive icon).
  - Reduce motion: with Android "Remove animations" on, everything shows at rest (no hero loop, confetti, count-up or enter animations).
- Android emulator: **not wanted for now** (owner decision, 2026-10-31). Native-only behaviour is tested by the owner on the phone; Claude flags such changes. Revisit only if the owner asks.

### Product / UX
- [ ] Next steps of the production roadmap: save student progress; AI credits per account; Sign in with Apple when an iOS build exists.
- [ ] Accounts follow-ups (from reviews, non-blocking): `sendEmailCode` maps unknown server errors to the "no connection" message (fix before enabling email); `/code` without `email` param; signed-out redirect keeps query params (`/?id=…`); delete-confirm panel doesn't auto-scroll on small screens; admin server actions could add an explicit `is_admin` guard (RLS already blocks); transient `is_admin` RPC error shows the not-admin message; policies call `is_admin()` per row.
- [ ] Typed cards follow-ups (deferred minors from the reviews, non-blocking): key-moment ★ is teal, only the dot is yellow (check against the mockup); no visible "has details" affordance on timeline points / schema boxes; video seconds accept decimals (round, `step=1`, integer check in `validateCard`); link `image.url` not validated as http(s); `/preview` origin check not normalised (`new URL(...).origin`); video accessible name is the generic "Video YouTube" (use the card title); admin preview iframe could get `allow="autoplay; fullscreen"`; legacy-data hardening in the card migration (blank title / empty `image_path`); link autofill can overwrite edits made during the fetch, and an empty result is silent; viewer image has no `onError`; YouTube web handshake gives up silently after ~10 s.
- [ ] AI output sometimes uses cedilla ş/ţ — add a rule in admin Settings → AI rules, or normalise server-side.
- [x] Student web: opening `/lesson/<id>` directly has no back button in the header (fixed: the lesson top bar back goes Home without history, design-system Task 6).
- [ ] Student app: no fetch-error test/retry on the lesson screen; English fallback label `'Card'` in `CardStepper`. (The writing resubmit result-card bug is fixed: a new submit clears the previous grade.)
- [ ] Admin: login form clears the email after a failed attempt; logged-in user can still see `/login`; all login errors shown as "wrong password" (also when Supabase is down); row buttons not disabled while an action is pending; modal closes before the action result.
- [ ] Admin wording: „cartonaș” vs „card”; missing period in „Titlul nu poate fi gol”.
- [ ] Admin preview of draft lessons (spec: publish to preview in the POC).
- [ ] AI grading per BAC barem criteria instead of a single grade (spec: later step).

### Robustness / security hardening
- [ ] Storage: images bucket SELECT policy lets anon list all objects (incl. draft-lesson images) — scope listing to authenticated; orphaned storage objects when an image is removed or a card deleted.
- [ ] `saveQuestion` persists client option objects as-is (map explicitly to `{id,text,correct}` / `{id,text,label?}`); `saveCard` accepts any `image_path`.
- [ ] Defence in depth: revoke default anon INSERT/UPDATE/DELETE grants on content tables and all grants on `ai_settings` (RLS is currently the only barrier).
- [ ] `/api/evaluate`: global quota is consumed even when the AI call fails; IP taken from first `x-forwarded-for` (fine on Vercel; use `x-real-ip` if hosting changes); no `max_output_tokens`/reasoning effort, no `.max()` on summary/suggestions.
- [ ] Mobile `evaluateEssay`: shape-check the 200 body; use `instanceof EvaluateApiError` for messages; `useRef` in-flight guard.
- [ ] Settings save writes `settings` and `ai_settings` non-atomically.
- [ ] `rate_limits` table grows forever (one row per IP) — periodic cleanup.
- [ ] Link metadata fetch (`apps/admin/src/lib/linkPreview.ts`): DNS-rebinding TOCTOU — the hostname is resolved and vetted, then `fetch` resolves it again, so an attacker-controlled DNS name could answer public then private. Accepted residual risk (admin-only action, blind GET from a Vercel function). Zero-dependency fix: make the request with `node:http`/`node:https` `request({ lookup })`, vetting the addresses inside the `lookup` callback so the vetted address is the one connected to.
- [ ] Native video player loads `https://lonelycpp.github.io/react-native-youtube-iframe/iframe_v2.html` (react-native-youtube-iframe default): every Android video depends on a third-party GitHub Pages site. Self-host that HTML on `prepio-web.vercel.app` and pass `baseUrlOverride` (keep an https origin: YouTube embeds without a referer fail with 152/153); verify on the phone.
- [ ] Orphaned card uploads: images uploaded in a card form that is then cancelled (new or edited card) stay in storage; cleanup only runs on save and delete. Deleting a lesson doesn't clean its `lessons/<id>/` folder either.

### Tests / tooling
- [ ] pgTAP gaps: authenticated cannot execute `consume_rate_limit`; anon update/delete; storage anon insert; assert `42501` instead of `throws_ok(null,null)`.
- [ ] Admin tests: root-node move, middle-of-three move, e2e up/down; e2e can leave `[test]` rows / uploaded images behind on failure.
- [ ] Mobile tests: 429 message, double-press, HTML 5xx body, next-exercise reset.
- [ ] Playwright Chromium runs with locally extracted libs: prefix runs with `LD_LIBRARY_PATH=~/.local/pwlibs/root/usr/lib/x86_64-linux-gnu` (e.g. `pnpm --filter @prepio/admin e2e`); permanent fix: `sudo pnpm exec playwright install-deps chromium` (owner, once).
- [ ] Typed cards test gaps: the `ImageViewer` drag/tap logic only has a callback-level test (global no-op gesture mock); `CardView.test.tsx` prints "overlapping act()" errors; no tests for `cardFromRow` coercion paths, link autofill overwrite, link image upload, drag-and-drop reorder; seed has no link-image `path` / timeline `imagePath` example.
- [ ] Unused admin scaffold files (`globals.css` with a dark-mode rule, `public/*.svg`); proxy matcher doesn't exclude `public/` assets.
- [ ] Local branch `backup/pre-secret-scrub` (pre-rewrite history) can be deleted: `git branch -D backup/pre-secret-scrub`.
