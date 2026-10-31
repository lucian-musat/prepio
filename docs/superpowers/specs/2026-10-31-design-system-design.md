# Prepio design system ("Mentă Prietenoasă") — design

Date: 2026-10-31
Status: approved by the owner (2026-10-31); work directly on `main`

## Intent

The current "archive / old book" look (parchment, bordeaux, gold, Lora serif) feels dated. The owner wants students (BAC, ~15–19 years old) to feel the app is **friendly but professional**, with **very smooth, beautiful transitions and animations**, and a **design system** that makes adding new UI elements simple.

Three directions were prototyped and walked through in the browser; the owner chose **variant B, "Mentă Prietenoasă"**: fresh teal + sunny yellow, rounded Nunito typography, tactile "3D" buttons that press down, slightly springy motion — close in spirit to Duolingo / Brilliant.

Visual reference (source of truth for look and motion): `docs/design/2026-10-31-design-directions-prototype.html` — open it in a browser, select **B · Mentă Prietenoasă**, use the "Telefon 360px / Desktop" and "Text normal / Text lung" toggles. The student app must match variant B of this prototype **pixel for pixel** on the screens the prototype covers (home, card stepper, single-choice question incl. right/wrong feedback, writing exercise incl. loading + result, lesson done), at 360 px and desktop width.

## Goals

1. **One token source** in `packages/shared/src/theme.ts`, consumed by the student app (React Native / web) and by admin (Bootstrap CSS variables, generated as today in `apps/admin/src/app/theme.ts`).
2. **Token structure** (inspired by Khan Academy's Wonder Blocks):
   - *Primitives*: full tonal scales per hue (teal, yellow, green, red, neutral-green), named `teal50 … teal900` etc. Never used directly by components.
   - *Semantic tokens* by purpose, not appearance: `bg`, `surface`, `surfaceMuted`, `text`, `textMuted`, `border`, `primary`, `primaryStrong`, `primarySubtle`, `onPrimary`, `accent`, `accentSubtle`, `onAccent`, `success`, `successSubtle`, `danger`, `dangerSubtle`, `warning`… Components only use these.
   - *Scales*: spacing (4-px based), radius (`sm 14`, `md 20`, `lg 26`, `pill`), typography roles (display, title, heading, body, label, caption — size/line-height/weight/family), elevation (the "3D" bottom shadow), motion (durations `fast 160`, `base 320`, `slow 420` ms; easing `standard` = cubic-bezier(.34,1.4,.64,1); spring configs for Reanimated).
   - Difficulty colours become semantic aliases (easy → success, medium → accent, hard → danger).
   - Values are exactly those of variant B in the prototype (`.app[data-v="b"]` block).
3. **Student UI kit** in `apps/mobile/src/ui/` — small, documented, reusable components built on the tokens: `Button` (primary / secondary / ghost, 3D press), `Surface`/`Card`, `ScreenLayout`, `TopBar` (back button, title, optional progress), `ProgressBar` (animated), `ActionBar` (fixed bottom, safe-area aware, feedback slot), `OptionRow` (idle / selected / correct / wrong, with shake + pop), `Chip`/`Badge`, `Hero`, `ListItem`, `Skeleton`, `ScoreRing`, `Confetti`. New screens are composed from these, not from raw styles.
4. **Layout rule (owner requirement, from mobile UX guidance)**: header (back, title, progress) is fixed at the top, the primary action is fixed at the bottom in the thumb zone, only the content between scrolls. Edge shadows appear only when content scrolls under the bars. The action bar respects the bottom safe area and is never covered by the on-screen keyboard. Answer feedback (correct / wrong + explanation) appears inside the action bar, above the button, tinted green/red. Touch targets ≥ 48 px.
5. **Motion** as in the prototype: screen push/pop slide + fade, staggered list entrance, card stepper slide with slight rotation, animated progress bar, option select scale, correct = pop + confetti, wrong = short shake, writing evaluation = shimmer skeleton → score ring and number counting up, suggestions staggered. All animations respect the OS "reduce motion" setting.
6. **Restyle every student screen**: Home, Lesson (cards, questions — single, multiple, chronological order —, writing exercises, done), and the loading / error / not-found states, following the system even where the prototype has no exact screen (multiple choice, order question, errors).
7. **Admin** gets the same palette and fonts in a calmer form: Bootstrap variables from the semantic tokens, Nunito / Nunito Sans, white top navbar with the teal logo mark instead of the bordeaux bar, primary buttons teal. No confetti, no 3D press, no springy motion in admin; only subtle hover/focus transitions.
8. **A short design-system doc** (`docs/design-system.md`): token tables, component catalogue with when-to-use, layout rule, motion rules, how to add a new token/component.

## Non-goals

- No database, API or content changes. The home lesson list shows what `LessonSummary` already has (title); the prototype's per-lesson meta line ("6 cartonașe · 3 exerciții") and difficulty chip on lessons are **omitted** rather than adding queries.
- No dark mode now (the token structure must make it possible later).
- No new features: no streaks, accounts, progress persistence, gamification beyond the visual feedback in the prototype.
- No haptics. The only new native modules are `react-native-svg` and `expo-linear-gradient` (see builder's calls).
- No new lesson behaviour: no stepping back through lesson stages, no minimum essay length, no new evaluation fields.

## Anti-goals (failure even if it "works")

- Childish / cartoonish result — it must stay credible for teachers and parents.
- Janky or slow animations, layout jumps, or animation that blocks the student (no animation longer than ~500 ms on a critical path; buttons respond immediately).
- Primary action or progress pushed off-screen by long content.
- Hard-coded colours, sizes or fonts in components after the migration (everything goes through tokens).
- Romanian diacritics (ă â î ș ț, both cases) rendering in a fallback font anywhere.
- Regressions in existing behaviour or in the automated test suites.

## Constraints

- Stack stays as is: Expo / React Native + react-native-web for the student app (Reanimated 4 is already installed), Next.js + Bootstrap 5 for admin. Fonts from Google Fonts: `@expo-google-fonts/nunito` and `@expo-google-fonts/nunito-sans` on mobile (CSS-safe family keys, as with the current fonts), `next/font/google` in admin. Lora / Source Sans 3 packages are removed once unused.
- Expo Router's native Stack header is replaced by the app's own `TopBar` (`headerShown: false`), which also fixes the backlog item "opening `/lesson/<id>` directly has no back button" (back goes to `/` when there is no history).
- Owner's testing rule (CLAUDE.md): every changed flow walked in Chrome at 360 px and desktop, console clean, admin checked with the local test admin and `[test]` data cleaned up. Native-only behaviour (keyboard, safe areas, fonts on device, Reanimated on Android) is listed for the owner to test on the next APK.
- Existing jest, vitest, pgTAP and Playwright suites stay green; tests that assert old colours/fonts (e.g. `paperTheme.test.ts`) are updated to the new tokens; new UI-kit components get unit tests for behaviour (states, disabled, callbacks), not for pixels.
- Code, comments and docs in English; UI copy in Romanian (existing strings kept unless the prototype changes them).

## Decided by the owner

- Variant B "Mentă Prietenoasă" (palette, fonts, motion character).
- Fixed header with progress + fixed bottom action bar; nothing essential scrolls away.
- Pixel-perfect match with the prototype, verified in the browser.

## Builder's calls (Claude's, flagged for review)

- React Native Paper is phased out of the student app in favour of the own UI kit (Paper's Material look fights the design); `PaperProvider` and the dependency are removed when no component uses them.
- Home hero shows the admin-configured `welcomeMessage` (the prototype's headline/sub-text become: label "Bine ai venit!", title "Pregătește BAC-ul, pas cu pas.", body = `welcomeMessage`, chip = total lesson count). If `welcomeMessage` is empty the hero still shows label + title.
- Lesson progress bar spans the whole lesson: cards + questions + exercises, done = 100 %.
- Confetti is a small in-house Reanimated component (no new dependency).
- Work order: tokens → fonts → UI kit → student screens → admin → docs. Each step is verified in the browser before the next.
- **Native modules:** add `react-native-svg` (score ring, icons) and `expo-linear-gradient` (hero, progress bar). The app has no `expo-updates`, so this redesign already needs a new APK; the two Expo-supported modules add only items to the owner's phone test list.
- **What "pixel perfect" means:** the reference is variant B of the prototype in Chrome on react-native-web, at 360 px and desktop width. Verification is side-by-side comparison in Chrome (prototype tab next to the app, same width, screenshots of each screen and state), using a local `[test]` lesson whose content mirrors the prototype's sample data (3 cards, one single-choice question, one writing exercise), deleted afterwards. Spacing, sizes, radii, colours, fonts, shadows and motion must match; differences that come only from text rendering (emoji glyphs, sub-pixel font hinting) are accepted. Android is checked by the owner on the APK for look and feel, not pixel-compared.
- **Content without prototype equivalent:** kept and styled with the system — card title, image + credit, done-screen score ("X din Y întrebări corecte"). Prototype-only decorations without data are omitted: card category eyebrow becomes "Cartonaș N din M", no "De reținut" box, no lesson meta line, no difficulty chip on lessons (question difficulty badge stays).
- **Writing exercise keeps today's behaviour**, restyled: max-length counter (`MAX_ESSAY_CHARS`), submit → "Retrimite" after a result, skip allowed via the action bar's "Continuă"/"Următorul exercițiu", inline error shown as a `danger`-tinted message in the content above the action bar. Action bar holds the primary action (submit / resubmit) and the continue action. The result card shows the grade in the score ring scaled from `gradeMin` to `gradeMax`, heading "Nota ta" with the `summary` as text under it, then the suggestions — no invented verdict text.
- **Back button:** always leaves the lesson (router back if there is history, otherwise `/`). Lesson stages stay local state; the Android hardware back button does the same (default Expo Router behaviour).
- **Feedback in the action bar** holds only the verdict and one short line (single correct answer text when it fits on one line, else "Vezi răspunsul corect mai sus"); the full correct answers / correct order and the admin explanation appear in the scrolling content under the question, and the content scrolls to them smoothly. This keeps the bar small on a 360 px screen.
- **Remaining Paper usages** (`TextInput`, `ActivityIndicator`, radio/checkbox items, icons) are replaced by UI-kit components (`TextArea`, `Spinner`, `OptionRow` with radio/checkbox indicator, icons via `@expo/vector-icons` or SVG). Paper is removed when nothing imports it.
