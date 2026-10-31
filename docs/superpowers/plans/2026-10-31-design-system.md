# Design System ("Mentă Prietenoasă") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "archive" theme with the approved variant B design system — one token source, a student UI kit with fixed header/action bar and smooth motion, all student screens restyled pixel-perfect to the prototype, admin re-themed.

**Architecture:** `packages/shared/src/theme.ts` holds primitives → semantic tokens → scales (space, radius, type, motion, elevation). The student app gets its own UI kit in `apps/mobile/src/ui/` (Reanimated 4, react-native-svg, expo-linear-gradient) and drops React Native Paper; every screen is composed from `ScreenLayout` (fixed `TopBar` with progress, scrolling content, fixed `ActionBar`). Admin keeps Bootstrap and gets CSS variables generated from the same semantic tokens.

**Tech Stack:** Expo 58 / React Native 0.88 / react-native-web 0.21, expo-router, Reanimated 4.7, react-native-svg, expo-linear-gradient, `@expo-google-fonts/nunito` + `@expo-google-fonts/nunito-sans`; Next.js + react-bootstrap + `next/font/google`; jest-expo + Testing Library, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-31-design-system-design.md`
**Visual reference:** `docs/design/2026-10-31-design-directions-prototype.html`, variant **B** (`.app[data-v="b"]` CSS block and the B-specific rules). Pixel values below are taken from it; when this plan and the prototype disagree on a visual value, the prototype wins.

## Global Constraints

- Work directly on `main` (owner's choice); commit after every task.
- Commands run in WSL with nvm: `wsl -d Ubuntu-22.04 -- bash -ic "cd ~/projects/prepio_new && <cmd>"`.
- Components use **only semantic tokens / scales** from `@prepio/shared` — no hex, font family or magic size literals in component files (anti-goal "hard-coded colours, sizes or fonts").
- Semantic colour values (exact): `bg #F3FAF7`, `surface #FFFFFF`, `surfaceMuted #E6F4EF`, `text #0F2E28`, `textMuted #4C6A63`, `border #D8EAE3`, `primary #0D9488`, `primaryStrong #0A6E66`, `primarySubtle #E0F5F1`, `onPrimary #FFFFFF`, `accent #FFC93C`, `accentSubtle #FFF6D9`, `onAccent #3A2C00`, `success #22A55B`, `successSubtle #E5F7EC`, `danger #E5484D`, `dangerSubtle #FDECEC`.
- Gradients: hero `135deg #0D9488 0% → #14B8A6 55% → #5EEAD4 100%`; progress fill `90deg #0D9488 → #2DD4BF`.
- Fonts: headings Nunito 900 (Black) / 800 (ExtraBold); text Nunito Sans 400 / 600 / 700. Family keys must be CSS-safe identifiers (react-native-web writes them unquoted).
- Motion: durations fast 160 ms, base 320 ms, slow 420 ms; standard easing `cubic-bezier(.34,1.4,.64,1)`; spring/pop easing `cubic-bezier(.34,1.56,.64,1)`; shake 420 ms `cubic-bezier(.36,.07,.19,.97)`. Every animation honours OS reduce-motion (Reanimated `ReduceMotion.System` / `useReducedMotion`). Nothing on a critical path > ~500 ms.
- Layout: content max width 720 px; side padding 16 px (phone) / 32 px (≥ 768 px); touch targets ≥ 48 px; action bar bottom padding = 14 px + safe-area inset.
- UI copy stays Romanian and unchanged unless listed here; code/comments/docs in English.
- New native modules allowed: only `react-native-svg` and `expo-linear-gradient` (install with `npx expo install` so versions match SDK 58). No haptics.
- No database / API / content changes.
- Frontend rule (CLAUDE.md): every task that changes UI ends with a Chrome check at 360 px and desktop, console clean; anything native-only goes on the owner's APK test list in `docs/STATUS.md`.

## Review Focus

1. **Long text at 360 px** (long prompt, long options, long admin explanation, long essay prompt): progress bar and primary action must stay on screen; only the middle scrolls — pinned by the `ScreenLayout` structure test (Task 3) and the "Text lung" browser pass (Task 9).
2. **Direct link to `/lesson/<id>` with no history**: back button goes to `/` — test in Task 3 (`TopBar`).
3. **Double tap on a primary action during an animation or an evaluation**: only one submit / one advance — tests in Task 6 (`Verifică` pressed twice → `onAnswered` once) and Task 7 (`evaluateEssay` called once).
4. **Reduce motion enabled**: flows complete and final states render (no element stuck at opacity 0) — test in Task 2 (`motion` presets return `ReduceMotion.System`) and Task 4 (`OptionRow` correct state rendered with reduced motion mocked).
5. **Romanian diacritics in every weight**: every typography role references a loaded, CSS-safe family — test in Task 1/2 (`typography` families ⊆ loaded font keys).

---

### Task 1: Shared tokens

**Files:**
- Modify: `packages/shared/src/theme.ts`
- Create: `packages/shared/src/theme.test.ts`
- Modify: `packages/shared/src/index.ts` (exports, if theme is not re-exported wholesale)

**Interfaces:**
- Produces (all `as const`):
  - `palette` — primitives: `teal`, `yellow`, `green`, `red`, `neutral` scales keyed `50…900`; every semantic colour above must appear exactly in some scale; other steps are interpolated by the implementer and listed in docs (Task 10).
  - `color` — the semantic map from Global Constraints (keys exactly as named there).
  - `gradient` — `{ hero: { colors: string[]; locations: number[]; angle: 135 }, progress: { colors: string[]; angle: 90 } }`.
  - `difficultyTone: Record<Difficulty, { fg: string; bg: string }>` — easy → success/successSubtle, medium → `#8A6A00`/accentSubtle (deliberate deviation: the prototype's `color-mix(accent 65%, text)` = `#AB9335` is only 2.8:1 on `accentSubtle`; the same `#8A6A00` is used for the accent number tile on home), hard → danger/dangerSubtle.
  - `space` — `{ 1: 4, 1.5: 6, 2: 8, 2.5: 10, 3: 12, 3.5: 14, 4: 16, 4.5: 18, 5: 20, 5.5: 22, 6: 24, 8: 32, 10: 40, 12: 48 }`.
  - `radius` — `{ xs: 9, sm: 12, md: 14, lg: 20, xl: 26, pill: 999 }` (option key 9, icon button 12, small boxes 14, buttons/cards 20, large cards/hero 26).
  - `typeScale` — roles → `{ size, lineHeight, weight: 'body'|'bodySemi'|'bodyBold'|'headExtra'|'headBlack', letterSpacing?, uppercase? }`: `logo 22/27 headBlack -0.22`, `display 24/29 headBlack -0.24`, `title 22/28 headBlack -0.22`, `question 20/26 headBlack -0.2`, `section 18/23 headBlack -0.18`, `bar 17/22 headBlack -0.17`, `body 17/27 body`, `bodyStrong 16/21 bodyBold`, `option 16/22 body`, `small 15/23 body`, `caption 13/18 body`, `eyebrow 12/16 bodyBold +0.96 uppercase`, `button 16/20 bodyBold`, `chip 12/16 bodyBold`, `badge 11/14 bodyBold`.
  - `motion` — `{ duration: { fast: 160, base: 320, slow: 420, shake: 420 }, easing: { standard: [.34,1.4,.64,1], pop: [.34,1.56,.64,1], shake: [.36,.07,.19,.97], out: [.22,1,.36,1] }, stagger: 50 }` (bezier control points as tuples so both RN and CSS can use them).
  - `elevation` — `{ card: { offsetY: 2, blur: 0, color: border }, button: { offsetY: 4, color: primaryStrong }, buttonPressed: { offsetY: 1 }, optionRest: { offsetY: 3, color: border }, raised: { offsetY: -10, blur: 24, spread: -16, opacity: 0.25 } }`.
  - `layout` — `{ maxContentWidth: 720, gutter: 16, gutterWide: 32, wideBreakpoint: 768, minTouch: 48 }`.
  - Keep old `colors`, `difficultyColors`, `radius`(number) **temporarily** as `legacyColors`, `legacyDifficultyColors`, `legacyRadius` so apps keep compiling until Task 10 removes them. Rename usages in apps with a mechanical find/replace in this task (no visual change yet).
- Also export `contrastRatio(fg: string, bg: string): number` (WCAG relative luminance) for tests and docs.

- [ ] **Step 1: Write the failing tests** in `theme.test.ts`:
  - `semantic colours match the approved variant B` — `expect(color).toEqual({ bg: '#F3FAF7', …all 17… })`.
  - `every semantic colour exists in the primitive palette` — flatten `palette`, each `Object.values(color)` included.
  - `text pairs meet WCAG AA` — `contrastRatio(color.text, color.bg) >= 4.5`, `textMuted/bg >= 4.5`, `textMuted/surface >= 4.5`, `onAccent/accent >= 4.5`, `difficultyTone.medium.fg/accentSubtle >= 4.5`, `feedbackText.wrong` (`#A54042`, = mix(danger 70%, text) from the prototype) on `dangerSubtle >= 4.5`, `feedbackText.good` (`#1C814C`, = mix(success 70%, text)) on `successSubtle >= 4.5`. Export these two as `feedbackText = { good, wrong }`.
  - `button label contrast is documented` — `contrastRatio(color.onPrimary, color.primary)` is `> 3.5` and `< 4.5` (prototype value, passes AA large/UI 3:1 only; see owner note in handoff). If the owner changes `primary`, update this test.
  - `space and radius scales are the prototype values` — `toEqual` on both objects.
- [ ] **Step 2: Run** `pnpm --filter @prepio/shared test` → FAIL (exports missing).
- [ ] **Step 3: Implement** the exports in `theme.ts`; rename old exports to `legacy*` and update all imports in `apps/mobile/**` and `apps/admin/src/app/theme.ts` (pure rename).
- [ ] **Step 4: Run** `pnpm --filter @prepio/shared test && pnpm typecheck && pnpm --filter @prepio/mobile test` → PASS.
- [ ] **Step 5: Commit** `feat(shared): variant B design tokens`.

---

### Task 2: Fonts, native deps and motion helpers (mobile)

**Files:**
- Modify: `apps/mobile/package.json` (add `@expo-google-fonts/nunito`, `@expo-google-fonts/nunito-sans`, `react-native-svg`, `expo-linear-gradient`; Lora / Source Sans stay until Task 10)
- Modify: `apps/mobile/src/theme/fonts.ts`
- Create: `apps/mobile/src/ui/typography.ts`, `apps/mobile/src/ui/motion.ts`
- Test: `apps/mobile/src/theme/fonts.test.ts` (replaces the font part of `paperTheme.test.ts`), `apps/mobile/src/ui/motion.test.ts`
- Modify: `apps/mobile/jest.setup.js` (mocks for `react-native-svg` / `expo-linear-gradient` if jest-expo doesn't provide them)

**Interfaces:**
- Consumes: `typeScale`, `motion` (Task 1).
- Produces:
  - `fontFamily` keys `headBlack: 'Nunito-Black'`, `headExtra: 'Nunito-ExtraBold'`, `body: 'NunitoSans'`, `bodySemi: 'NunitoSans-SemiBold'`, `bodyBold: 'NunitoSans-Bold'` (old keys kept until Task 10); `fontFiles` maps them to the expo-google-fonts exports (check exact export names in the installed packages, e.g. `Nunito_900Black`, `NunitoSans_400Regular`).
  - `type(role: keyof typeof typeScale): TextStyle` in `typography.ts` — returns `{ fontFamily, fontSize, lineHeight, letterSpacing, textTransform }` with `fontWeight` left default (weights live in the family).
  - `motion.ts`: `easing.standard|pop|shake|out` as Reanimated `Easing.bezier(...)`; `enterStagger(index: number)` → Reanimated entering animation (fade + translateY 12 → 0, `duration.slow`, delay `40 + index*50`, `ReduceMotion.System`); `enterScreen(direction: 'forward'|'back')` (fade + translateX ±32 → 0, slow, `out` easing); `cardIn(direction)` / `cardOut(direction)` (translateX ±60 with rotate ±2deg in, −50/+50 scale .96 out); `timing(duration)` helper that always sets `reduceMotion: ReduceMotion.System`.

- [ ] **Step 1: Install** with `pnpm --filter @prepio/mobile exec npx expo install @expo-google-fonts/nunito @expo-google-fonts/nunito-sans react-native-svg expo-linear-gradient`; confirm `pnpm --filter @prepio/mobile typecheck` still passes.
- [ ] **Step 2: Write failing tests**:
  - `fonts.test.ts`: `every typography role uses a loaded, CSS-safe family` — for each role in `typeScale`, `type(role).fontFamily` ∈ `Object.keys(fontFiles)` and matches `/^[A-Za-z_][A-Za-z0-9_-]*$/`; `headings use Nunito and text uses Nunito Sans` (`type('title').fontFamily === 'Nunito-Black'`, `type('body').fontFamily === 'NunitoSans'`).
  - `motion.test.ts`: `entering presets respect reduce motion` — build `enterStagger(0)`, `enterScreen('forward')`, `cardIn('next')` and assert their config has `reduceMotion === ReduceMotion.System` (inspect via the builder's `build()` or the `reduceMotionV` property of the Reanimated builder); `stagger delay grows by 50 ms` (index 0 → 40, index 3 → 190).
- [ ] **Step 3: Run** `pnpm --filter @prepio/mobile test -- fonts motion` → FAIL.
- [ ] **Step 4: Implement** `fonts.ts`, `typography.ts`, `motion.ts`; load the new fonts in `app/_layout.tsx` (`useFonts(fontFiles)` already does it once keys are added).
- [ ] **Step 5: Run** the two tests → PASS; full mobile suite still green.
- [ ] **Step 6: Browser check**: start student web (`pnpm --filter @prepio/mobile web`), in DevTools confirm `document.fonts` has Nunito / Nunito Sans loaded with status `loaded`; console clean. (No visual change expected yet.)
- [ ] **Step 7: Commit** `feat(mobile): Nunito fonts, svg/gradient deps, motion presets`.

---

### Task 3: Layout primitives — `ScreenLayout`, `TopBar`, `ProgressBar`, `ActionBar`

**Files:**
- Create: `apps/mobile/src/ui/ScreenLayout.tsx`, `TopBar.tsx`, `ProgressBar.tsx`, `ActionBar.tsx`, `IconButton.tsx`, `AppText.tsx`, `index.ts`
- Test: `apps/mobile/src/ui/ScreenLayout.test.tsx`, `TopBar.test.tsx`, `ProgressBar.test.tsx`
- Modify: `apps/mobile/app/_layout.tsx` — `headerShown: false`, `contentStyle: { backgroundColor: color.bg }`, `animation: 'slide_from_right'`, `StatusBar style="dark"`.

**Interfaces:**
- Consumes: tokens (Task 1), `type`, motion presets (Task 2).
- Produces:
  - `AppText({ role?: TypeRole = 'body', color?: keyof typeof color = 'text', ...TextProps })`.
  - `IconButton({ icon: 'back'|'chevron-right'|'check'|'close'|'up'|'down', accessibilityLabel: string, onPress, disabled? })` — 40×40 visual, 48×48 hit area (`hitSlop`), radius `sm`, 1 px `border`, `surface` bg, press scale .92 (fast). Icons drawn with `react-native-svg` paths from the prototype `svg` object (stroke 2.2, round caps).
  - `ProgressBar({ value: number /*0..1*/, accessibilityLabel?: string })` — track 12 px, radius pill, `surfaceMuted`; fill = `gradient.progress` + inner bottom shadow (rgba(0,0,0,.08), 3 px); width animates with `duration.slow` + `easing.out`. `accessibilityRole="progressbar"`, `accessibilityValue={{ min: 0, max: 100, now: Math.round(value*100) }}`.
  - `TopBar({ title?: string; logo?: boolean; progress?: number; onBack?: () => void; raised: boolean })` — padding 16/16/12 (32 px sides on wide), title role `bar` single line ellipsis, back = `IconButton icon="back" accessibilityLabel="Înapoi"`; progress row under the title with 6 px top margin; `raised` → 1 px `border` bottom + shadow `elevation.raised` mirrored.
  - `ActionBar({ children: ReactNode; feedback?: ReactNode; tone?: 'neutral'|'good'|'wrong'; raised: boolean })` — padding 12 16 (14 + bottom inset); row gap 10; `tone` tints bg (`successSubtle`/`dangerSubtle`) and removes border/shadow; `feedback` slot above the row with the slide-up entering (translateY 14, slow).
  - `ScreenLayout({ title?, logo?, progress?, onBack?, actions?: ReactNode, feedback?: ReactNode, tone?, children, contentKey?: string, scrollRef? })` — column: `TopBar` (fixed) → `Animated.ScrollView` (flex 1, content max 720 centered, padding top 12, bottom 24, gutters) → `ActionBar` (only if `actions`). Tracks scroll offset / content / layout heights to set `TopBar.raised` (`y > 4`) and `ActionBar.raised` (`y + h < contentH - 4`). Wraps everything in `KeyboardAvoidingView` (`behavior='padding'` on iOS, `'height'` on Android) and `SafeAreaView edges={['top','left','right']}` (bottom inset handled by `ActionBar`). Content enters with `enterScreen('forward')` keyed by `contentKey`.
  - `goBackOrHome()` helper in `TopBar.tsx`: `router.canGoBack() ? router.back() : router.replace('/')`.

- [ ] **Step 1: Write failing tests**:
  - `ScreenLayout.test.tsx`: `renders actions outside the scroll view` — render with `actions={<Text>Verifică</Text>}` and long children; the `Verifică` element's ancestor chain does not include the element with `testID="screen-scroll"`, and the TopBar (`testID="top-bar"`) is also outside it. `no action bar when actions is undefined` — `queryByTestId('action-bar')` is null. `progress is in the top bar` — `within(getByTestId('top-bar')).getByRole('progressbar')`.
  - `TopBar.test.tsx`: `back goes home when there is no history` — mock `router.canGoBack → false`; press `Înapoi` → `router.replace('/')`; `back pops when there is history` — `canGoBack → true` → `router.back()` called.
  - `ProgressBar.test.tsx`: `exposes progress to accessibility` — `value={0.5}` → `accessibilityValue.now === 50`; clamps `value={1.4}` → 100 and `-1` → 0.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the components; switch `Screen.tsx` users nowhere yet (screens migrate in Tasks 5–8).
- [ ] **Step 4: Run** `pnpm --filter @prepio/mobile test` → PASS.
- [ ] **Step 5: Browser check**: temporarily render a dev-only route `app/_dev/layout.tsx` (deleted before commit) with long content; at 360 px and desktop confirm top bar + progress fixed, action bar fixed with shadow only when content is below, side by side with the prototype B question screen: heights (top bar 68 px incl. progress, action bar 76 px), paddings and shadows match. Console clean.
- [ ] **Step 6: Commit** `feat(mobile): ScreenLayout, TopBar, ProgressBar, ActionBar`.

---

### Task 4: Content primitives — `Button`, `Surface`, `Chip`, `OptionRow`, `Skeleton`, `ScoreRing`, `Confetti`, `TextArea`, `Spinner`

**Files:**
- Create in `apps/mobile/src/ui/`: `Button.tsx`, `Surface.tsx`, `Chip.tsx`, `OptionRow.tsx`, `Skeleton.tsx`, `ScoreRing.tsx`, `Confetti.tsx`, `TextArea.tsx`, `Spinner.tsx`; export from `index.ts`
- Modify: `apps/mobile/src/components/DifficultyBadge.tsx` → uses `Chip` + `difficultyTone`
- Test: `Button.test.tsx`, `OptionRow.test.tsx`, `ScoreRing.test.tsx`, `TextArea.test.tsx`

**Interfaces:**
- Produces:
  - `Button({ label: string; onPress; variant?: 'primary'|'secondary' = 'primary'; disabled?; loading?; tone?: 'primary'|'success'|'danger'; flex?: boolean })` — prototype `.btn` B: padding 14/18, radius `lg`, label role `button`; primary: bg (`primary` | `success` | `danger` per tone), bottom shadow 4 px of the strong shade; pressed: translateY 3 + shadow 1 px (fast, `pop` easing); secondary (= prototype `.btn.ghost`): `surface` bg, 1 px `border`, shadow 3 px `border`; disabled opacity .45; `accessibilityRole="button"`, `accessibilityState.disabled`; `loading` shows `Spinner` and blocks presses. Presses while `disabled || loading` never call `onPress`.
  - `Surface({ children, padding?: SpaceKey = 5, radius?: 'lg'|'xl' = 'xl', style? })` — `surface` bg, 1 px `border`, bottom shadow 2 px `border` (prototype B `--shadow`).
  - `Chip({ label, fg, bg, size?: 'chip'|'badge' })`.
  - `OptionRow({ label: string; marker: string /*'A'..*/ | 'checkbox'; state: 'idle'|'selected'|'correct'|'wrong'; onPress?; disabled? })` — prototype `.opt` B: padding 14, radius `lg`, 2 px border, rest shadow 3 px `border`; key 30×30 radius `xs`; selected → `primary` border, `primarySubtle` bg, key `primary` + scale 1.08 (pop); correct → success colours, key shows check icon with pop (scale .6→1.18→1, slow); wrong → danger colours, key shows close icon, horizontal shake ±5 px (shake 420 ms). `accessibilityRole` `radio` / `checkbox`, `accessibilityState.checked` = selected/correct-selected.
  - `Skeleton({ lines: number[] /* widths in % */ })` — shimmer 1.2 s linear loop (static under reduce motion), plus the "Se evaluează răspunsul…" thinking dots row.
  - `ScoreRing({ value: number; min: number; max: number; size?: 76 })` — svg ring, stroke 8, r 32, track `surfaceMuted`, arc `primary` round cap; arc and the centred number animate from `min` to `value` over 1.1 s `out` easing (number counts with cubic ease-out). `accessibilityLabel={\`Nota ${value} din ${max}\`}`.
  - `Confetti({ trigger: number })` — 28 particles 8×12 radius 2, colours primary/accent/success/white, burst 900 ms; renders nothing when reduce motion is on; absolutely positioned, `pointerEvents="none"`.
  - `TextArea({ value, onChangeText, accessibilityLabel, placeholder, invalid? })` — min height 150, radius `lg`, 2 px border, focus → `primary` border + 4 px ring `primary` 18 %.
  - `Spinner()` — small `ActivityIndicator` coloured `primary` (RN core), replaces Paper's.

- [ ] **Step 1: Write failing tests**:
  - `Button.test.tsx`: `calls onPress once per press`; `does not call onPress when disabled`; `does not call onPress while loading` (and shows `accessibilityState.busy`).
  - `OptionRow.test.tsx`: `exposes checked state` (selected → `checked: true`); `wrong state shows the close icon and correct state the check icon` (testIDs `option-icon-close` / `option-icon-check`); `correct state renders final colours with reduce motion on` — mock `useReducedMotion → true`, render `state="correct"`, assert background style equals `color.successSubtle`.
  - `ScoreRing.test.tsx`: `labels the grade for accessibility` — `value=8 min=1 max=10` → label `Nota 8 din 10`.
  - `TextArea.test.tsx`: `forwards text changes`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Browser check** via the temporary dev route: every component in every state next to the prototype B (button rest/pressed/disabled, option idle/selected/correct/wrong incl. shake & pop, skeleton, ring count-up, confetti) at 360 px; console clean. Delete the dev route.
- [ ] **Step 6: Commit** `feat(mobile): UI kit content components`.

---

### Task 5: Home screen

**Files:**
- Modify: `apps/mobile/src/screens/HomeScreen.tsx`
- Create: `apps/mobile/src/ui/Hero.tsx`, `apps/mobile/src/ui/LessonListItem.tsx`
- Test: `apps/mobile/src/screens/HomeScreen.test.tsx` (update)

**Interfaces:**
- Consumes: `ScreenLayout` (with `logo`, no actions), `Surface`, `Button`, `Chip`, `enterStagger`, `fetchHome` (unchanged `HomeData`).
- Produces:
  - `Hero({ welcomeMessage: string; lessonCount: number })` — `LinearGradient` `gradient.hero`, radius `xl`, padding 20, margin 4/0/22; label "Bine ai venit!" (13/600, 85 % white), title "Pregătește BAC-ul, pas cu pas." (`display`, white), body = `welcomeMessage` (15/1.5, 92 % white, hidden when empty), chip "📚 {n} lecții" / "📚 1 lecție" (white 18 % bg); decorative 180 px circle (white 14 %) top-right floating 8 s loop (static under reduce motion).
  - `LessonListItem({ index: number; title: string; onPress })` — prototype `.lesson` B: padding 14, radius `lg`, `surface`, 1 px border, shadow; number tile 44×44 radius `md` (`primarySubtle`/`primary`; every 2nd item `accentSubtle`/accent-text), title `bodyStrong`, chevron right `textMuted`; press scale .98; on wide screens the list is a 2-column grid (gap 10).
- Section header: path joined with " › " (`section` role) + right "{n} lecții" (`caption`, `textMuted`).
- Loading = centred `Spinner` (margin top 48); error = `Surface` with title "Nu am putut încărca lecțiile", text, `Button` "Reîncearcă" (existing copy).

- [ ] **Step 1: Update tests**: keep existing behaviour tests; add `shows the welcome message in the hero`, `shows the total lesson count chip` ("📚 3 lecții"), `opens a lesson on press` (`router.push('/lesson/<id>')`), `hides the welcome text when empty but keeps the title`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Browser check** (`pnpm db:start`, seeded data, student web :8081): home at 360 px and desktop side by side with prototype B home — hero, section title, list items, 2-column grid on desktop, stagger entrance, hover/press; error state (stop Supabase briefly) and loading state; console clean.
- [ ] **Step 6: Commit** `feat(mobile): home screen in the new design`.

---

### Task 6: Lesson shell, cards and questions

**Files:**
- Modify: `apps/mobile/src/screens/LessonScreen.tsx`, `apps/mobile/src/components/CardStepper.tsx`, `QuestionView.tsx`, `ChoiceQuestion.tsx`, `OrderQuestion.tsx`
- Test: `LessonScreen.test.tsx`, `CardStepper.test.tsx`, `QuestionView.test.tsx` (update; drop `PaperProvider` wrappers)

**Interfaces:**
- Consumes: Tasks 3–4.
- Produces:
  - `lessonProgress(lesson: Lesson, phase: Phase, index: number): number` (exported from `LessonScreen.tsx`) — `(completedSteps) / totalSteps` where steps = cards + questions + exercises; done = 1; the current step counts as reached (prototype: card 1 of 3 with 2 exercises → 1/5).
  - Phase components render their own `ScreenLayout` and receive `frame: { title: string; progress: number; onBack: () => void }` from `LessonScreen`. Loading / error / not-found states also use `ScreenLayout` (title "Lecție", back button).
  - `CardStepper({ cards, onFinish, frame })` — card = `Surface radius xl padding 20`; eyebrow "Cartonaș {i} din {n}" (`eyebrow`, `primary`); title (`title`), optional image (radius `md`, height 200, credit `caption`), body (`body`); dots row (7 px, active 22 px `primary`, width animates base); transitions `cardIn/cardOut` by direction; scroll to top on change. Action bar: `Button secondary "Înapoi"` (disabled on first) + `Button "Continuă"`; last card → "La exerciții" when questions/exercises follow, else "Continuă".
  - `QuestionView({ question, onAnswered, onNext, nextLabel, frame })` — content: eyebrow with type label ("Alegere unică" / "Alegere multiplă" / "Ordine cronologică") + `DifficultyBadge`, prompt (`question`), options (`OptionRow` list, gap 10, stagger). After checking: full correct answers / correct order and the admin `explanation` appear in the content below the options (slide-up), and the scroll view scrolls to them (smooth). Action bar before check: `Button "Verifică"` (disabled until a selection; always enabled for order questions); after: `tone` good/wrong, feedback slot = 28 px icon circle (pop) + "Corect, bravo!" / "Nu chiar." + one line (single correct option text if ≤ 60 chars, else "Vezi răspunsul corect mai sus."; for correct answers the first sentence of the explanation if any), button = `nextLabel` with `tone` success/danger. Correct → `Confetti`.
  - `OrderQuestion` rows: `Surface`-like row (radius `lg`, 2 px border) with index, text and up/down `IconButton`s (labels "Mută în sus: …" / "Mută în jos: …" unchanged); after a wrong answer the correct order appears in the content as a success-tinted box with `Chip` labels.
  - `ChoiceQuestion` / `OrderQuestion` no longer render the submit button; selection state is lifted: `ChoiceQuestion({ options, multiple, answered, selected, onToggle })`, `OrderQuestion({ order, items, answered, correct, onMove })`; `QuestionView` owns `selected` / `order` and builds the `Answer`.
- Text and labels in tests stay: "Verifică", "Corect" verdict now "Corect, bravo!", "Greșit" verdict now "Nu chiar." (update test expectations accordingly), "Răspuns corect: " / "Răspunsuri corecte: " and "Ordinea corectă:" in the content.

- [ ] **Step 1: Update/write tests**:
  - `LessonScreen.test.tsx`: existing walk-through passes with new labels; `lessonProgress` table test (cards 3/q 1/e 2: card index 0 → 1/6 … done → 1); `back from the lesson goes home without history`; `progress bar is visible on every phase` (`getByRole('progressbar')` in cards, questions, exercises, done).
  - `QuestionView.test.tsx`: existing behaviour tests updated; `Verifică pressed twice answers once` (`onAnswered` called once); `explanation and correct answers render in the content, verdict in the action bar` (`within(getByTestId('action-bar')).getByText('Nu chiar.')`, explanation not inside action bar); `long correct answer shows the short hint in the bar` (option text 80 chars → bar shows "Vezi răspunsul corect mai sus.").
  - `CardStepper.test.tsx`: existing tests with new labels; `back disabled on first card`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `pnpm --filter @prepio/mobile test` → PASS.
- [ ] **Step 5: Browser check** on seeded lessons and a local `[test]` lesson with long prompt/options/explanation (create via admin, delete after): cards, single, multiple, order (right + wrong), at 360 px and desktop, side by side with prototype B; with "Text lung" content the progress bar and action bar stay visible; console clean.
- [ ] **Step 6: Commit** `feat(mobile): lesson cards and questions in the new design`.

---

### Task 7: Writing exercise and lesson done

**Files:**
- Modify: `apps/mobile/src/components/WritingExercise.tsx`, `apps/mobile/src/screens/LessonScreen.tsx` (exercises + done phases)
- Test: `apps/mobile/src/components/WritingExercise.test.tsx`, `LessonScreen.test.tsx`

**Interfaces:**
- Consumes: Tasks 3–4, `evaluateEssay` (unchanged).
- Produces:
  - `WritingExercise({ exercise, frame, nextLabel: string, onNext: () => void })` — content: `Surface` with eyebrow "Exercițiu de scriere · evaluat cu AI", prompt (`question`), `TextArea` (label "Răspunsul tău", placeholder "Scrie răspunsul tău aici…"), counter row (left empty, right `{count} / {MAX_ESSAY_CHARS}`, `danger` when over), inline error (`danger` text on `dangerSubtle`, radius `md`, padding 12, `accessibilityRole="alert"`), loading → `Skeleton` (90/75/60 %) with "Se evaluează răspunsul…", result → `Surface` with `ScoreRing(value=grade, min=gradeMin, max=gradeMax)`, heading "Nota ta", `summary`, label "Ce poți îmbunătăți" (`eyebrow`, `textMuted`) and suggestion rows (`surfaceMuted`, radius `md`, "→" in `primary`) staggered. Loading and result scroll into view (only the content scroll view moves).
  - Action bar: `Button secondary nextLabel` ("Următorul exercițiu" / "Continuă", always enabled = skip allowed) + `Button primary` "Trimite pentru evaluare" → "Retrimite" after a result; `loading` while evaluating.
  - Done phase: `ScreenLayout` progress 1; content centred: 🎓 (56 px, pop), "Ai terminat lecția!" (`display`), lesson title (`textMuted`), score "{x} din {y} întrebări corecte" (`bodyStrong`, shown when the lesson has questions); action bar `Button "Înapoi la lecții"` → `router.replace('/')`; `Confetti` on enter.
- [ ] **Step 1: Update/write tests**: existing WritingExercise tests (submit, error, resubmit, counter over limit) with new structure; `submit pressed twice calls evaluateEssay once`; `result shows Nota ta, summary and ring label` (`Nota 8 din 10`); `continue is available before submitting`; LessonScreen `done shows the score and goes home`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Browser check** (local stack; admin `/api/evaluate` at :3000 needs the local OpenAI key setup from `apps/admin/.env.example` — if not available, verify loading/result/error with the request blocked or mocked in DevTools and say so): writing → loading → result → resubmit, error state, done screen, at 360 px and desktop vs prototype B; console clean.
- [ ] **Step 6: Commit** `feat(mobile): writing exercise and done screen in the new design`.

---

### Task 8: Admin theme

**Files:**
- Modify: `apps/admin/src/app/theme.ts`, `apps/admin/src/app/theme.css`, `apps/admin/src/app/layout.tsx`, `apps/admin/src/app/(admin)/AdminShell.tsx`, `apps/admin/src/app/login/page.tsx` (only if it uses the old navbar/brand classes)
- Test: `apps/admin/src/app/theme.test.ts` (create)

**Interfaces:**
- Consumes: `color`, `radius`, `typeScale` (Task 1).
- Produces: `themeVariablesCss` mapping: `--bs-primary` = primary, `--bs-success` = success, `--bs-danger` = danger, `--bs-warning` = accent, `--bs-body-bg` = bg, `--bs-body-color` = text, `--bs-secondary-color` = textMuted, `--bs-secondary-bg`/`--bs-tertiary-bg` = surfaceMuted, `--bs-border-color` = border, `--bs-link-color` = primaryStrong (links need AA on white), `--bs-border-radius` = `md` (14 px; admin is calmer), `--bs-border-radius-lg` = `lg`; plus `--prepio-*` custom properties for every semantic colour (`--prepio-primary`, …) replacing the bordeaux/gold/parchment ones.
- `layout.tsx`: `Nunito` (weights 800, 900) → `--font-head`, `Nunito_Sans` (400, 600, 700) → `--font-body`, subsets `latin`, `latin-ext`.
- `theme.css`: body font `--font-body`; headings + `.brand` `--font-head` weight 800; `.btn-primary` hover/active = primaryStrong, focus ring primary 25 %; inputs focus border primary + 4 px ring 18 %; `.card` white with 1 px border, no heavy shadow; navbar `.navbar-prepio` → white bg, bottom border, brand = 28 px rounded-square logo mark (`gradient.hero`, white "P") + "Prepio" in `text` + muted "admin"; sidebar active link `primarySubtle` bg + `primaryStrong` text; transitions 160 ms on hover/focus only (no springs, no 3D).
- Remove the unused `globals.css` dark-mode rule only if it conflicts (it's in the backlog; don't widen scope otherwise).

- [ ] **Step 1: Write failing test** `theme.test.ts`: `maps semantic tokens to bootstrap variables` — `themeVariablesCss` contains `--bs-primary:#0D9488`, `--bs-body-bg:#F3FAF7`, `--bs-link-color:#0A6E66`, and no `bordeaux`/`parchment`/`gold` substrings.
- [ ] **Step 2: Run** `pnpm --filter @prepio/admin test` → FAIL. **Step 3: Implement.** **Step 4: Run** unit + `pnpm --filter @prepio/admin exec playwright test` → PASS.
- [ ] **Step 5: Browser check** (admin :3000, local test admin from `apps/admin/.env.example`): login, content tree, lesson editor (cards, questions, exercises tabs, modals), settings — at desktop and 360 px; create/edit/delete a `[test]` item and remove it; console clean; seeded content intact.
- [ ] **Step 6: Commit** `feat(admin): variant B theme`.

---

### Task 9: Pixel-perfect pass against the prototype

**Files:** whatever the comparison shows needs adjusting (UI kit / screens only; tokens change only if the prototype value was transcribed wrong).

- [ ] **Step 1:** Locally create a `[test] Unirea Principatelor (1859)` lesson via admin with the prototype's sample content (3 cards with the prototype titles/bodies, the single-choice Cuza question 1848/1859/1866/1877 with 1859 correct, the Cuza reforms writing exercise) under a `[test]` node.
- [ ] **Step 2:** For each screen/state — home, card 1–3, question idle/selected/correct/wrong, writing idle/loading/result, done — open the prototype (variant B, "Telefon 360px") and the app at 360 px side by side in Chrome; screenshot both; compare positions, sizes, paddings, radii, colours (DevTools computed styles), font sizes/weights, shadows, and motion (timing, easing, direction). Repeat at desktop width (prototype "Desktop").
- [ ] **Step 3:** Repeat the question and writing screens with the prototype's "Text lung" content (edit the `[test]` lesson) — progress + action bar always visible.
- [ ] **Step 4:** Fix every difference not caused by text rendering (emoji glyph, sub-pixel hinting); re-run mobile tests.
- [ ] **Step 5:** Turn on OS "reduce motion" (Windows: Settings → Accessibility → Visual effects → Animation effects off) and walk the flow once: everything completes, no element stays hidden.
- [ ] **Step 6:** Delete the `[test]` lesson and node; confirm seeded lessons unchanged.
- [ ] **Step 7: Commit** `fix(mobile): align UI with the variant B prototype` (if anything changed).

---

### Task 10: Cleanup and documentation

**Files:**
- Modify: `apps/mobile/package.json` (remove `react-native-paper`, `@expo-google-fonts/lora`, `@expo-google-fonts/source-sans-3`), `apps/mobile/app/_layout.tsx` (drop `PaperProvider`), `apps/mobile/src/theme/fonts.ts` (drop old keys)
- Delete: `apps/mobile/src/theme/paperTheme.ts`, `paperTheme.test.ts`, `apps/mobile/src/components/Screen.tsx` (if unused)
- Modify: `packages/shared/src/theme.ts` (remove `legacy*` exports), tests importing `PaperProvider`
- Create: `docs/design-system.md`
- Modify: `docs/STATUS.md`, `README.md` (if it mentions Paper / fonts)

- [ ] **Step 1:** Remove the old code; `pnpm install`; `grep -rn "react-native-paper\|legacyColors\|Lora\|SourceSans\|bordeaux\|parchment" apps packages --include=*.ts --include=*.tsx --include=*.css` → no hits.
- [ ] **Step 2:** Run everything: `pnpm typecheck && pnpm test && pnpm db:test && pnpm --filter @prepio/admin exec playwright test`, `pnpm --filter @prepio/admin build`, `pnpm --filter @prepio/mobile exec npx expo export --platform web` → all green.
- [ ] **Step 3:** Write `docs/design-system.md`: principles (friendly but professional; layout rule; motion rule + reduce motion), token tables (palette, semantic colours with contrast ratios, gradients, space, radius, type roles, motion, elevation), component catalogue (props, when to use, screenshot-free description), how to add a token / a component / a screen (compose `ScreenLayout`), admin mapping, link to the prototype.
- [ ] **Step 4:** Update `docs/STATUS.md`: decisions (variant B, own UI kit instead of Paper, new native modules, admin mapping), backlog item "no back button on direct /lesson link" closed, and an **owner APK test list**: fonts + diacritics on device, Reanimated animations smoothness on Android, action bar above keyboard in the writing exercise, bottom safe area / gesture bar, hardware back button leaves the lesson, status bar dark icons on light background, score ring + gradients (new native modules), reduce-motion setting on the phone.
- [ ] **Step 5:** Final browser walk (home → lesson → all phases → done, admin main flows) at 360 px and desktop; console clean.
- [ ] **Step 6: Commit** `chore: remove Paper and legacy theme; document the design system`.
