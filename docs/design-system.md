# Prepio design system ("Mentă Prietenoasă")

Variant B of the design prototype: `docs/design/2026-10-31-design-directions-prototype.html` (open it, select **B · Mentă Prietenoasă**; toggles for 360 px / desktop and normal / long text). It is the source of truth for look and motion. Spec: `docs/superpowers/specs/2026-10-31-design-system-design.md`.

Code locations:

| What | Where |
|---|---|
| Tokens (single source) | `packages/shared/src/theme.ts` |
| Fonts (family keys, files) | `apps/mobile/src/theme/fonts.ts` |
| Student UI kit | `apps/mobile/src/ui/` (barrel: `ui/index.ts`) |
| Admin mapping (Bootstrap variables) | `apps/admin/src/app/theme.ts`, `theme.css` |

## Principles

- **Friendly but professional.** Fresh teal, sunny yellow accents, rounded Nunito type, tactile "3D" buttons. Never childish: no cartoon decoration, calm copy.
- **Layout rule.** The header (back, title, progress) is fixed at the top, the primary action is fixed at the bottom in the thumb zone, only the content between them scrolls. Edge shadows appear only while content scrolls under a bar. The action bar respects the bottom safe area and is never covered by the keyboard. Answer feedback (correct / wrong + one line) lives inside the action bar, tinted green/red. Touch targets are at least 48 px. Content is max 720 px wide, side padding 16 px (phone) / 32 px (>= 768 px).
- **Motion rule.** Springy but short: nothing on a critical path longer than about 500 ms, buttons respond immediately. Every animation honours the OS reduce-motion setting (`ReduceMotion.System` through `timing()`, or `useReducedMotion()`); with it on, content appears at rest and confetti does not render.
- **Tokens only.** Components use semantic tokens and scales from `@prepio/shared`; no hex, font family or magic size literals in component files. Values that exist only in the prototype (e.g. press scale .92) are named constants next to their use.
- **Accessibility over pixel match** where they conflict (primary colour, text tones; see Deviations).

## Tokens

### Palette (primitives; components never use these directly)

Each hue has a 50-900 scale (`palette.teal[700]` ...): `teal`, `yellow`, `green`, `red`, `neutral` (mint-tinted, white to dark text). Anchors: teal 600/500/300/400 feed the gradients, teal 700 is `primary`, teal 800 `primaryStrong`; yellow 400 `accent`, yellow 700 accent text; green 500 `success`, green 600 good feedback text; red 500 `danger`, red 700 wrong feedback text.

### Semantic colours

| Token | Value | Use |
|---|---|---|
| `bg` | `#F3FAF7` | Screen background |
| `surface` | `#FFFFFF` | Cards, bars |
| `surfaceMuted` | `#E6F4EF` | Tracks, skeletons |
| `text` | `#0F2E28` | Body text |
| `textMuted` | `#4C6A63` | Secondary text |
| `border` | `#D8EAE3` | Borders, solid card shadows |
| `primary` | `#0F766E` | Primary buttons, links, ring arc |
| `primaryStrong` | `#0A5C55` | Button bottom edge, admin links |
| `primarySubtle` | `#E0F5F1` | Selected tint, tiles |
| `onPrimary` | `#FFFFFF` | Text on primary |
| `accent` / `accentSubtle` / `onAccent` | `#FFC93C` / `#FFF6D9` / `#3A2C00` | Highlights, confetti |
| `success` / `successSubtle` | `#22A55B` / `#E5F7EC` | Correct state |
| `danger` / `dangerSubtle` | `#E5484D` / `#FDECEC` | Wrong state, errors |
| `feedbackText.good` / `.almost` / `.wrong` | `#1A7C49` / `#8A6A00` / `#A54042` | Verdict text (AA on successSubtle / accentSubtle / dangerSubtle); `.almost` is the consolidation „Aproape” |
| `consolidationColor.paper` | `#FFFDF8` | Warm paper behind long source texts: the source card, the reader, the desktop split's source column (mockup `--paper`) |
| `consolidationColor.tint` | `#EEE8FF` | Lilac of the consolidation zone and its „Consolidare deblocată” card (mockup) |
| `difficultyTone` | easy: success on successSubtle; medium: `#8A6A00` on accentSubtle; hard: danger on dangerSubtle | Difficulty badge |

Contrast (WCAG 2.x, `contrastRatio()` in the theme, covered by tests):

| Pair | Ratio |
|---|---|
| `text` on `bg` / `surface` | 13.75 / 14.57 |
| `textMuted` on `bg` / `surface` | 5.59 / 5.92 |
| `onPrimary` on `primary` | 5.47 |
| `onPrimary` on `primaryStrong` | 7.85 |
| `primaryStrong` on `bg` | 7.41 |
| `primary` on `primarySubtle` | 4.82 |
| `onAccent` on `accent` | 8.88 |
| medium tone `#8A6A00` on `accentSubtle` | 4.69 |
| `feedbackText.good` on `successSubtle` | 4.68 |
| `feedbackText.wrong` on `dangerSubtle` | 5.39 |

`danger` on `dangerSubtle` (3.43) and `success` on `successSubtle` (2.86) are only for non-text elements (borders, icons) and large shapes; text uses `feedbackText`.

### Deviations from the prototype

`primary #0F766E` / `primaryStrong #0A5C55` instead of `#0D9488` / `#0A6E66` (white label 5.47:1 instead of 3.74:1); accent/medium text `#8A6A00`; `feedbackText` tones above. Gradients keep the prototype colours (decorative, large bold text only).

### Gradients

| Token | Definition |
|---|---|
| `gradient.hero` | 135deg, `#0D9488` 0% -> `#14B8A6` 55% -> `#5EEAD4` 100% (Home hero) |
| `gradient.progress` | 90deg, `#0D9488` -> `#2DD4BF` (progress bar fill) |

Both are readonly tuples: spread/cast them for `expo-linear-gradient`.

### Space, radius, layout

| Scale | Values (px) |
|---|---|
| `space` (key = step) | 1: 4, 1.5: 6, 2: 8, 2.5: 10, 3: 12, 3.5: 14, 4: 16, 4.5: 18, 5: 20, 5.5: 22, 6: 24, 8: 32, 10: 40, 12: 48 |
| `radius` | xs 9, sm 12, md 14, lg 20, xl 26, pill 999 |
| `layout` | maxContentWidth 720, maxWideContentWidth 1180 (`ScreenLayout wide`: the consolidation source split), gutter 16, gutterWide 32, wideBreakpoint 768, minTouch 48 |

### Type roles

Headings Nunito 900 (Black) / 800 (ExtraBold); text Nunito Sans 400 / 600 / 700. Use roles through `AppText role=...` or `type(role)`; never set `fontFamily` directly (family keys in `fonts.ts` are CSS-safe because react-native-web writes them unquoted).

| Role | Size / line | Weight |
|---|---|---|
| `logo` / `logoMark` | 22 / 30, 15 / 20.5 | head black |
| `display` | 24 / 28.8 | head black |
| `celebrate` | 24 / 32.7 | head black |
| `title` | 22 / 27.5 | head black |
| `question` | 20 / 26 | head black |
| `section` | 18 / 24.5 | head black |
| `bar` | 17 / 23.2 | head black |
| `body` | 17 / 27.2 | body 400 |
| `bodyStrong`, `verdict`, `button` | 16 / 20.8, 16 / 24, 16 / 21.8 | body 700 |
| `option`, `lead` | 16 / 21.8 | body 400 |
| `input` | 16 / 24.8 | body 400 |
| `small` | 15 / 22.5 | body 400 |
| `list` | 15 / 21.75 | body 400 |
| `note` | 14 / 20.3 | body 400 |
| `label` | 14 / 19.1 | body 600 |
| `caption` | 13 / 17.7 | body 400 |
| `eyebrow` | 12 / 16, uppercase, +0.96 tracking | body 700 |
| `chip`, `badge` | 12 / 15, 11 / 15 | body 700 |

Line heights are the prototype's computed values (the prototype's `normal` is 1.364 x size for Nunito). Fractional values render exactly on web; Android rounds them.

### Motion

| Token | Value |
|---|---|
| `motion.duration` | fast 160, base 320, slow 420, shake 420 ms |
| `motion.easing` | `standard` cubic-bezier(.34, 1.4, .64, 1); `pop` (.34, 1.56, .64, 1); `shake` (.36, .07, .19, .97); `out` (.22, 1, .36, 1) |
| `motion.stagger` | 50 ms per list index (first item delayed 40 ms) |

Helpers in `ui/motion.ts`: `easing.*` (Reanimated beziers), `timing(duration, curve)` (withTiming config with reduce-motion), config factories `staggerConfig`, `screenConfig`, `feedbackConfig`, `cardInConfig`, `cardOutConfig`, `useEnter`, and `webTransition(props)` (CSS transition on web for state-driven style changes; instant on native).

**Do not use Reanimated `Keyframe` `entering`/`exiting` on in-flow elements.** On react-native-web, Reanimated 4.7 pins Keyframe-entering elements to `position: absolute` with a frozen size a few seconds later, which breaks layout. Use `Enter` / `useEnter` (shared values + `withTiming`), which behave the same on web and native. Custom worklet entering functions do not run on web at all.

### Elevation

| Token | Value |
|---|---|
| `elevation.card` | 2 px solid `border` (blur 0) |
| `elevation.button` / `buttonPressed` | 4 px solid `primaryStrong`; pressed 1 px |
| `elevation.optionRest` | 3 px solid `border` |
| `elevation.raised` | soft edge shadow (-10 y, blur 24, spread -16, 25%) under/over a bar while content scrolls |

### Border, stroke, opacity and press tokens

| Token | Value / use |
|---|---|
| `border.hairline` / `border.thick` | 1 px / 2 px border widths (e.g. the correct-answer box uses `thick`) |
| `stroke.icon` / `iconBold` / `ring` | 2.2 / 3 icon stroke widths; 8 for the score ring |
| `opacity.disabled` / `disabledIcon` | Disabled control / disabled icon opacity |
| `pressScale.row` / `icon` | Scale while pressed for rows and icon buttons |
| `shadowColor` | Colour of the soft shadows |
| `elevation.progressInset` | Inset shadow of the progress track |

Helpers: `solidShadow`, `raisedShadow`, `withAlpha`, `mixColors` in `ui/elevation.ts`.

## Component catalogue (`apps/mobile/src/ui/`)

Compose screens from these; reach for raw `View`/`Text` styles only for layout glue.

### Structure

| Component | Props | Use |
|---|---|---|
| `ScreenLayout` | `title`, `logo`, `progress`, `onBack`, `actions`, `feedback`, `tone`, `contentKey`, `scrollRef`, `wide` | Frame of every screen: fixed `TopBar`, scrolling content (max 720, enters with a slide; `wide`: max 1180 on desktop), fixed `ActionBar` when `actions` is set. Changing `contentKey` remounts and replays the enter. `useScreenViewport()` gives children the height the content can use without scrolling (the desktop source column fills it). testIDs `top-bar`, `screen-scroll`, `action-bar`. |
| `TopBar` | `title`, `logo`, `progress`, `onBack`, `raised` | Used by `ScreenLayout`. `goBackOrHome()` goes back, or to `/` when there is no history (direct `/lesson/<id>` links). |
| `ActionBar` | `tone` (neutral / good / wrong), feedback slot, children | Bottom bar (padding 14 + safe-area inset); good/wrong tint with the verdict slot above the buttons. |
| `Surface` | `padding` (space key), `radius` (lg / xl) | White card with the solid card shadow. |
| `Hero` | `welcomeMessage`, `lessonCount` | Home hero with gradient, floating circle, count chip. |
| `LessonListItem` | `index`, `title`, `onPress` | Home lesson row (hover lift on web, press scale). |

### Controls

| Component | Props | Use |
|---|---|---|
| `Button` | `label`, `onPress`, `variant` (primary / secondary), `tone` (primary / success / danger), `disabled`, `loading`, `flex`, `accessibilityLabel` (defaults to `label`; set it when the visible text isn't enough for screen readers) | Every action. 3D press, 48 px minimum, `loading` shows a spinner and sets busy. |
| `IconButton` / `Icon` | icons: back, chevron-right, check, close, up, down, card types (text, images, video, timeline, schema, link), plus, info | 48 px hit area, 40 px visual; `Icon` draws the svg glyphs. |
| `OptionRow` | `label`, `marker` ('A'... or 'checkbox'), `state` (idle / selected / correct / wrong), `checked`, `onPress`, `disabled`, `accessibilityLabel` (defaults to `label`; the caller adds any verdict suffix) | Answer options: press scale, pop on correct, shake on wrong; radio/checkbox semantics. |
| `TextArea` | `value`, `onChangeText`, `accessibilityLabel`, `placeholder`, `invalid`, `status`, `editable`, `maxLength`, `minHeight` | Multiline input with focus ring; `invalid` turns border and ring to danger. `status` (`ok` / `almost` / `no`, also on `TextField`) colours the border of a checked answer success / accent / danger. |

### Feedback and status

| Component | Props | Use |
|---|---|---|
| `ProgressBar` | value 0..1 | Gradient pill bar, animated width, progressbar semantics. |
| `ScoreRing` | `value`, `min`, `max`, `size` | Grade ring: arc fills and the number counts up. |
| `Confetti` | `trigger` | Burst of 28 pieces per positive trigger; renders nothing with reduce motion. |
| `Skeleton` | `lines` (widths in %) | Shimmer placeholder + "thinking" dots (AI evaluation). |
| `Spinner` | `tint`, `accessibilityLabel` | Loading indicator. |
| `Chip` | `label`, `fg`, `bg`, `size` (chip / badge) | Small pill label; `DifficultyBadge` is built on it. |
| `AppText` | `role`, `color` (semantic key), Text props | All text. `role` is a typography role; ARIA role stays `accessibilityRole`. |

### Motion wrappers

| Component | Props | Use |
|---|---|---|
| `Enter` | `config` / `index`, `style`, `testID` | Fade + rise on mount; `index` staggers list items (40 + i x 50 ms). Remount (new `key`) to replay. |
| `CardTransition` | `contentKey`, `direction` (next / prev), `exit` (default true), `style` | Card stepper: previous card slides out as an overlay, new card tilts in; container height eases between cards. `exit={false}` skips the overlay when the old card already left (swiped away). |
| `Reveal` | `open`, `style`, `testID` | Expands to its content height with a fade (base, `out` curve) once the content has been measured, and collapses back; closing hides the content from screen readers at once and unmounts it at the end. Instant with reduce motion. |

### Card types (`apps/mobile/src/components/cards/`)

Lesson cards are rendered by `CardView` (eyebrow + title + `CardContentView`, one component per type), shared by the card stepper and the `/preview` route. In the stepper (`CardStepper`) a touch swipe also moves between cards: the card follows the finger with up to 3° tilt; past 25 % of the width or a flick over 500 px/s it flies off (left = next, right = previous) and the next card tilts in as after a button press; otherwise it springs back, with rubber-band resistance at the first and last card (swiping never finishes the lesson). It starts only on a clearly horizontal move (±15 px, fails after ±12 px vertical), is on for native and for touch-first web screens (`(pointer: coarse)`, mouse pointers ignored), and with reduce motion a committed swipe just changes the card. Thresholds live in `components/swipeMath.ts`. They follow the rules above; the type-specific choices:

| Piece | Tokens / behaviour |
|---|---|
| `RichText` callouts | De reținut: `accentSubtle` background, `accent` left edge. Atenție: `dangerSubtle` / `danger`. Exemplu: `primarySubtle` / `primary`. Label (`bodyStrong`) and body in `text`, 4 px left edge, `radius.md`. Map: `CALLOUT` in `RichText.tsx`. |
| `ImagesCard` | Images at their natural aspect ratio (16:9 until loaded) on `surfaceMuted`, `radius.md`; credit as `caption` / `textMuted`. Gallery thumbnails 64 px, `border` edge, `primary` edge when selected (`aria-selected`). Tapping opens `ImageViewer`: `text` backdrop, `surface` text, pinch on native, tap-to-zoom 2x and drag on web, translation clamped. |
| `VideoCard` | 16:9 frame, `radius.md`, `surfaceMuted` while loading; the "Atinge pentru sunet" pill is a `text` pill with `surface` caption. |
| `TimelineCard` | Vertical line gradient teal 300 → 700; dots `surface` with a `primary` ring; key moments: `accent` dot with a yellow 600 ring and a ★ after the date; date `caption` / `primary` in the extra-bold head family; rows share an 8/10 px padding so dates line up. Points with details are tappable rows: `primarySubtle` tint (`radius.sm`, a darker tint on web hover, pointer cursor), a `primary` `down` chevron on the right that turns 180° when open, press scale `pressScale.row`; the details open with `Reveal` under a teal 300 hairline. A caption hint with the `info` icon ("Atinge un punct pentru detalii") sits above the list only when some point has details. Buttons have `aria-expanded`, the hint "Atinge pentru detalii", and the expanded label includes the details. |
| `SchemaCard` | Causes: `primarySubtle` boxes with a teal 300 edge; central: `primary` box, `onPrimary` text; consequences: `accentSubtle` boxes with an `accent` edge; `▼` arrows in `primary`. Boxes wrap below ~120 px. Boxes with a detail are buttons with a 22 px "+" badge over the top-right corner in the box tone (`primary` / `onPrimary` / `accent`) that turns 45° into "×" when open; the detail opens inside the box (`Reveal`) under a hairline in the box edge colour; press scale, hover tint and pointer cursor on web. The hint "Atinge căsuțele cu + pentru detalii" appears above the diagram only when some box has a detail. Buttons have `aria-expanded`, the hint "Atinge pentru detalii", and the expanded label includes the detail. |
| `LinkCard` | Bordered `surface` preview (`border`, `radius.md`), image 16:9, domain `caption` / `textMuted` uppercase, title `label`; long URLs and titles wrap (`wordBreak` on web). "Deschide ↗" opens a new tab on web (`noopener`) and the in-app browser on native. |

**Documented palette exceptions** (the only `palette.*` uses in the student app; there is no semantic token for these decorative strokes yet): `palette.teal[300]` / `palette.teal[700]` for the timeline line gradient, `palette.yellow[600]` for the key-moment dot ring, `palette.teal[300]` for the schema cause-box edge. If another component needs them, promote them to semantic tokens (e.g. `timelineLineStart/End`, `keyMarkerBorder`, `schemaCauseBorder`) in `theme.ts` instead of adding more exceptions.

**Documented exception: marker pens.** The consolidation marker (`apps/mobile/src/components/marker/`) highlights source words with fixed highlighter colours from the approved mockups, kept as the `markerPen` token in `theme.ts` (not palette steps): `info` (Informație) `#FFE38A`, `cause` (Cauză) `#99F6E4`, `effect` (Efect) `#FFD0A8`, `support` (Informație-suport) `#C9D7FF`. `text` stays AA on each (tested). Likewise `consolidationColor` (`paper`, `tint`) is a fixed pair from the mockups, not palette steps; `text` and `textMuted` stay AA on both (tested). Marks have 5 px rounded ends; the active mark has two 13 px `text` handle dots with a 2 px `surface` ring (touch area: dot + 12 px each side); the tap-tap anchor is a blinking 2 px dashed `primary` outline; verdict underlines are 3 px `success` / `accent` / `danger` (ok / almost / no); „[...]” omissions are `textMuted`.

**Reading typeface.** Source texts in the reader use Literata (family keys `reading` = 400, `readingMedium` = 500 in `fonts.ts`; covers ș ț ă â î and „ ”), 17 px, line height 24 plus a 3.5 px gap per line (~1.8 pitch). It is not a type role: only `MarkableText` (with `reading`) and the reader use it.

**Source layouts** (`SourcePanel`, long-sources mockup). A short source (< ~70 words) sits inline in a `Surface` card: „SURSA A” eyebrow, the text in the body face, the citation as an italic `caption`. A long source is a `paper` preview card (letter icon, „Sursa B”, author · paragraphs · reading time, faded first lines, „📖 Citește și marchează”) that opens the full-screen reader (top bar with ✕ and the citation, the requirement pinned on one line, `reading` text, a bottom tray with the pens, the next-step hint and „Gata”, a thin minimap). From 900 px the long sources sit in the left column of a split (`ScreenLayout wide`, `paper`, ~62 characters per line, own scroll) with A / B tabs when there are two, or a „Sursa B” eyebrow when there is one; short sources stay inline in the right column with the prompt and the answer.

**Accessibility on web.** react-native-web 0.21 ignores `accessibilityState`; expanded / selected / checked states are set with `aria-expanded` / `aria-selected` / `aria-checked`, which react-native 0.88 also maps on native. `accessibilityRole="imagebutton"` has no web role, so tappable images use `button`.

## How to add things

**A token.** Add it to `packages/shared/src/theme.ts` (a semantic colour points at a palette step; a scale gets a named key). Add or extend the test in `packages/shared/src/theme.test.ts` (and a contrast assertion for any new text/background pair). If admin needs it, map it in `apps/admin/src/app/theme.ts` and its test. Update the tables above.

**A component.** Create `apps/mobile/src/ui/<Name>.tsx` using only tokens (`color`, `space`, `radius`, `type()` / `AppText`, `timing()`); animations through `Enter`/`useEnter` or shared values with `timing()`, never Keyframe on in-flow elements; touch targets >= 48 px; accessibility roles and labels. Add a behaviour test (states, disabled, callbacks, reduce-motion final state; not pixels), export it from `ui/index.ts` and list it in the catalogue above.

**A screen.** Wrap content in `ScreenLayout` (title, `onBack={goBackOrHome}`, `actions` for the primary action, `contentKey` if the content changes in place). Build the body from `Surface`, `AppText`, `Button`, `OptionRow`, and stagger sections with `Enter index={n}`. Never reproduce the top bar/action bar yourself. Walk it in the browser at 360 px and desktop, console clean, and list native-only behaviour in `docs/STATUS.md`.

`Pop` (`ui/Pop.tsx`): scale-pop wrapper (.6 to 1.18 to 1) for the lesson cap and the verdict icon; static at rest with reduce motion. `ScreenLayout`, `TopBar` and `ProgressBar` accept `progressLabel` (accessible name of the progress bar).

## Admin mapping

Admin keeps Bootstrap 5 / react-bootstrap but a calmer take of the same system: `themeVariablesCss` (generated from the tokens in `apps/admin/src/app/theme.ts`) overrides the Bootstrap variables: `--bs-primary` = `primary`, `--bs-body-bg` = `bg`, `--bs-body-color` = `text`, `--bs-secondary-color` = `textMuted`, `--bs-border-color` = `border`, `--bs-link-color` = `primaryStrong`, `--bs-border-radius` = `radius.md` (14), `--bs-border-radius-lg` = `radius.lg`, success/danger/warning from `success`/`danger`/`accent`. The Bootstrap subtle variants are mapped too: `--bs-{primary,success,danger,warning}-bg-subtle` (the subtle tokens), `-border-subtle` (the colour at 25 % over white) and `-text-emphasis` (AA text colours: `primaryStrong`, `feedbackText.good/wrong`, `#8A6A00` for warning). `.text-success` / `.text-danger` keep `!important` because Bootstrap's own utilities use it and `--bs-success-rgb` must stay the brand colour for backgrounds. The content tree's action groups wrap at 360 px. It also exposes `--prepio-*` variables for every semantic token and the hero gradient stops. Fonts: Nunito (headings) and Nunito Sans (text) through `next/font/google`. White top navbar with the teal logo mark. No confetti, no 3D press, no springy motion: only subtle hover/focus transitions.

## Removed

React Native Paper, Lora / Source Sans 3 and the legacy "archive" tokens (parchment, bordeaux, gold) are gone; do not reintroduce them.
