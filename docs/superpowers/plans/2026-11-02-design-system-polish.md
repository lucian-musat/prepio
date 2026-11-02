# Design System Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the minor findings deferred during the design-system migration (per-task and final reviews) — token-backed literals, stronger tests, small a11y/behaviour fixes, admin polish — with no visible design change except the listed bug fixes.

**Architecture:** Same as the design-system plan: tokens in `packages/shared/src/theme.ts`, student UI kit in `apps/mobile/src/ui/`, screens in `apps/mobile/src/screens|components/`, admin theme in `apps/admin/src/app/theme.ts|theme.css`.

**Tech Stack:** Expo 58 / RN 0.88 / react-native-web, Reanimated 4.7, jest-expo; Next.js + Bootstrap 5, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-31-design-system-design.md` (approved). Design reference: `docs/design-system.md`, prototype `docs/design/2026-10-31-design-directions-prototype.html` (variant B).

## Global Constraints

- Work on `main` (owner's choice for this project); commit per task. Commands: `wsl -d Ubuntu-22.04 -- bash -ic "cd ~/projects/prepio_new && <cmd>"`.
- No visual change to the student app or admin except the bugs fixed below; the prototype B match from the design-system plan must hold (pixel values unchanged).
- Components use tokens only — no hex, font family, or unexplained numeric literals.
- Entering animations on in-flow elements use shared values (`Enter`/`useEnter`), never Reanimated `Keyframe` `entering` (breaks layout on react-native-web).
- Every animation respects reduce motion (`ReduceMotion.System` / `useReducedMotion`).
- Tests must be able to fail for the right reason (a test that passes with the code under test removed is not acceptable).
- Owner's rule: any UI-touching task ends with a Chrome check at 360 px and desktop, console clean.

## Review Focus

1. Refactors of literals into tokens must not change any rendered value — compare computed styles before/after in Chrome for the touched components.
2. Writing exercise resubmit: an error after a resubmit must not leave the previous grade visible next to it; a successful resubmit replaces it.
3. CardTransition during a card change: the outgoing card must not be reachable by screen readers or touches.
4. Admin content tree at 360 px: no horizontal page overflow, all row actions reachable.
5. Effects refactored in OptionRow/ChoiceQuestion: hover, selection and reveal colours still correct in every state.

---

### Task 1: Tokens and UI-kit hardening (mobile + shared)

**Files:** `packages/shared/src/theme.ts`, `theme.test.ts`; `apps/mobile/src/ui/*` (elevation.ts, ProgressBar.tsx, IconButton.tsx, Button.tsx, Surface.tsx, Skeleton.tsx, TextArea.tsx, OptionRow.tsx, Enter.tsx, CardTransition.tsx, ScreenLayout.tsx, TopBar.tsx, motion.ts) and their tests.

**Interfaces produced:** `border = { hairline: 1, thick: 2 }`, `opacity = { disabled: 0.45, pressedScale … }` (or equivalent names), `shadowColor` token for neutral shadows — exported from `@prepio/shared`; `ProgressBar`/`TopBar`/`ScreenLayout` accept `progressLabel?: string` (default "Progres").

- [ ] Pin values in `theme.test.ts`: `typeScale` (every role's size/lineHeight/weight), `motion`, `elevation`, `layout`, `gradient`; replace the tautological "every semantic colour exists in the palette" test with one that pins each semantic key to its palette step (e.g. `color.primary === palette.teal[700]`).
- [ ] Add tokens for border widths, disabled opacity, press scales and the neutral shadow colour (`rgba(0,0,0,…)` in elevation.ts / ProgressBar `INNER_SHADOW`); replace the literals in ui/ (STROKE, PRESSED_SCALE, DISABLED_OPACITY, `borderWidth: 1|2`). Rendered values unchanged.
- [ ] `progressLabel` prop (default "Progres") threaded ScreenLayout → TopBar → ProgressBar; test.
- [ ] ScreenLayout: no raised state before the first layout (`viewH === 0` → not raised); test.
- [ ] `useEnter`/`useEffect([])` deps: make intent explicit (refs or eslint-disable with reason) so `react-hooks/exhaustive-deps` is clean on ui/.
- [ ] `Enter` API: make `index` and `config` mutually exclusive in the type (union); default stays `index=0`; typecheck proves misuse fails (`// @ts-expect-error` test).
- [ ] Stagger boundary: test that index 3 is still hidden at ~185 ms and moving by ~200 ms (pins 190).
- [ ] CardTransition: no ref mutation during render (derive in state/effect); the outgoing card is hidden from accessibility (`accessibilityElementsHidden`, `importantForAccessibility="no-hide-descendants"`, `aria-hidden` on web) and `pointerEvents="none"`; tests: outgoing not in the a11y tree during overlap; container min-height follows the incoming card (onLayout).
- [ ] OptionRow: fold the hover-border effect into the main colour effect (one writer of `border.value`); reduce-motion test rerenders idle → correct with reduced motion and asserts the final colour immediately (must fail if the reduce-motion branch is removed); test the `checked` override.
- [ ] Button: type `BRIGHTEN` without a cast; test primary hover (web) brightening.
- [ ] Tests for Confetti (renders nothing under reduce motion; `pointerEvents` none), Skeleton (static under reduce motion), ScoreRing fraction mapping (8 on 1–10 → 7/9) and count-up end value.
- [ ] Shared `Pop` helper in ui/ (scale .6 → 1.18 → 1, pop easing, reduce motion = static) used by `Cap` (LessonScreen) and `VerdictIcon` (QuestionView) — remove the duplicated constants.
- [ ] Verify: shared + mobile tests, typecheck, Chrome computed-style spot check (button, option row, progress bar, surface, text area) before/after at 360 px — identical. Commit `refactor(mobile): token-backed UI kit literals and stronger tests`.

### Task 2: Screen-level fixes (mobile)

**Files:** `apps/mobile/src/screens/HomeScreen.tsx`, `LessonScreen.tsx`, `components/QuestionView.tsx`, `ChoiceQuestion.tsx`, `OrderQuestion.tsx`, `WritingExercise.tsx` and tests; `ui/Hero.tsx`, `ui/LessonListItem.tsx` tests.

- [ ] WritingExercise: clear the previous result when a new submit starts, so an error after a resubmit shows alone (closes STATUS backlog item "result card stays visible next to a new error after resubmit"); tests: error after resubmit → no "Nota ta"; success after resubmit → new grade.
- [ ] WritingExercise counter row: replace the spacer `<View />` with layout (`justifyContent: 'flex-end'`).
- [ ] Tests that mute `console.error` (QuestionView `pressTwice`, WritingExercise double press): filter only the overlapping-act warning by message, re-throw/print anything else.
- [ ] QuestionView: when a choice question has no option marked correct, don't show "Vezi răspunsul corect mai sus." — show the verdict only; test.
- [ ] Reveal scroll target: scroll to the reveal's position relative to the scroll container (include content top padding) so it isn't a few px short; test the computed offset.
- [ ] ChoiceQuestion effect: no `return setX()` — explicit block; behaviour unchanged.
- [ ] Inline `borderWidth: 2` in QuestionView answer box → border token from Task 1.
- [ ] HomeScreen: section key uses a stable unique key (e.g. joined path + index) instead of `title` alone; tests for LessonListItem hover (web) and Hero circle static under reduce motion.
- [ ] Verify: mobile tests, typecheck; Chrome at 360 px + desktop: writing resubmit error/success (fetch override if no local AI key — never add/read secrets), a question reveal, home; console clean. Commit `fix(mobile): writing resubmit state and screen-level polish`.

### Task 3: Admin polish

**Files:** `apps/admin/src/app/theme.ts`, `theme.css`, `theme.test.ts`; content-tree component (`apps/admin/src/components/TreeEditor.tsx`) for the 360 px overflow.

- [ ] Map Bootstrap subtle variants to Prepio tokens: `--bs-{primary,success,danger,warning}-bg-subtle`, `-border-subtle`, `-text-emphasis` (text-emphasis = AA text colours: primaryStrong, feedbackText.good/wrong, `#8A6A00`); pin in theme.test.ts.
- [ ] Remove the `!important` on `.text-success/.text-danger` if the `-text-emphasis`/`--bs-*-rgb` mapping makes them correct without it (keep AA: #1A7C49 / #A54042 on white); test.
- [ ] Content tree at 360 px: row action buttons wrap or collapse so the page doesn't overflow horizontally (scrollWidth ≤ viewport) and every action stays reachable; desktop unchanged.
- [ ] Verify: admin unit tests, `pnpm --filter @prepio/admin build`, Playwright (with the local `LD_LIBRARY_PATH` pwlibs setup); Chrome with the local test admin at 360 px + desktop (tree, settings save message colour, an alert if any), `[test]` data removed; console clean. Commit `fix(admin): bootstrap subtle tokens and narrow-screen tree`.
- [ ] Update `docs/STATUS.md` (close the resubmit backlog item; note this polish) and `docs/design-system.md` (new tokens: border, opacity, shadow colour; `Pop`; `progressLabel`).
