# Student UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the design inconsistencies, UX friction and gaps found in the 2026-11-12 browser audit of the student web, so the app reads as one consistent product at 360 px and on desktop.

**Architecture:** Student app only (`apps/mobile`, Expo Router + react-native-web), plus one helper in `packages/shared` and one in the admin evaluate route (AI diacritics). No migration is needed, except possibly in Task 4.1 (last test score) and Task 7.1 if the ledger→BAC title join needs a view or RPC change (see that task). The work ships as six PRs (batches A–F below), each on its own `feat/ux-<batch>` branch per CLAUDE.md, each with its own browser walk.

**Tech Stack:** Expo SDK 58, expo-router, react-native-web, Jest + @testing-library/react-native, Next.js (admin API), Supabase.

**Spec:** `docs/audits/2026-11-12-student-web-ux-audit.md`. Finding IDs (G1, H1, L5 …) refer to it.

## Global Constraints

- All copy in Romanian with comma-below diacritics (ș ț Ș Ț), never cedilla (ş ţ). Code, comments, commits and docs in English.
- Terminology, used everywhere a student reads it: **„acces”** (never „abonament”) for paid access; **„card” / „carduri”** (never „cartonaș”); **„întrebări”** for the test in Verificare; **„exerciții”** only for Consolidare.
- Touch targets ≥ 44×44 px. Text contrast AA.
- Colours, radii and spacing only from `@prepio/shared` tokens (`docs/design-system.md`); no new hex values.
- Each PR: `pnpm --filter @prepio/mobile typecheck`, `pnpm --filter @prepio/mobile test`, then a browser walk at 360 px touch and 1280 px with console clean (CLAUDE.md "Testing and validation"). Native-affecting changes are listed for the owner's phone check.
- Payment gaps (`provider='none'`, „Plata nu e încă activă”) are out of scope.

## Review Focus

1. **Trial / expired student** — the header pill (Task 1.3), the locked-lesson reason (Task 3.3) and the access wording (Task 1.4) must also be right when there is no access. Tests in 1.3 and 3.3 cover `trial` and `expired`.
2. **Brand-new student with no history** — empty credit history, no BAC attempts, a lesson never started. Progress in Task 4.1 and the attempt history in Task 6.2 must render nothing (not „0 din 14”, not an empty card). Tests in 4.1 and 6.2.
3. **Very long titles** (lesson, section breadcrumb, BAC subject) at 360 px — no truncation of the main information, no overflow. Covered in the 3.1, 6.5 and 7.2 tests and in every walk.
4. **AI text containing mixed diacritics or quotes** — normalisation must not touch other characters (e.g. „ş.a.” → „ș.a.”, but leave Latin letters and punctuation alone). Test in 5.1.
5. **Essay / multi-part requirement partly filled** — the completeness rule in Task 6.4 must treat the essay requirements and viewpoint + marks consistently with the grader. Tests in 6.4.

---

## Batch A — Web shell and global consistency (PR `feat/ux-web-shell`)

### Task 1.1: HTML shell — language, meta, share preview (G1, G3)

**Files:**
- Create: `apps/mobile/public/index.html` (Expo `web.output: "single"` uses it as the template)
- Create: `apps/mobile/public/og-image.png` (1200×630, logo + „Pregătește BAC-ul la istorie, pas cu pas.” on the brand gradient; export from the design tokens)
- Create: `apps/mobile/public/manifest.json`
- Test: `apps/mobile/scripts/check-web-shell.test.ts`

- [ ] **Step 1: Write the failing test.** It reads `public/index.html` and asserts: `<html lang="ro">`; `<meta name="description" content="Prepio te ajută să te pregătești pentru BAC-ul la istorie: lecții scurte, întrebări de verificare și exerciții după modelul subiectelor, cu feedback de la profesorul digital.">`; `og:title` = „Prepio — pregătire BAC la istorie”, `og:description` = the same text, `og:image` = `https://prepio.ro/og-image.png`, `og:url` = `https://prepio.ro`, `twitter:card` = `summary_large_image`; `<meta name="theme-color" content="{color.primary}">`; `<link rel="manifest" href="/manifest.json">`; the noscript text = „Prepio are nevoie de JavaScript ca să funcționeze.”; and it keeps Expo's `#root` reset styles.
- [ ] **Step 2:** Run `pnpm --filter @prepio/mobile test check-web-shell`. Expected: FAIL (no file).
- [ ] **Step 3:** Copy the template Expo currently emits (see `curl https://prepio.ro/`) to `public/index.html` and add the tags above. Add `manifest.json` (`name` „Prepio”, `short_name` „Prepio”, `lang` „ro”, `theme_color`, `background_color` = `color.background`, icons from `assets/images`).
- [ ] **Step 4:** Run the test (PASS), then `npx expo export --platform web` and check that `dist/index.html` contains `lang="ro"` and the OG tags.
- [ ] **Step 5: Commit** `feat(web): Romanian HTML shell with share preview and manifest`.

### Task 1.2: Per-page document titles (G2)

**Files:**
- Create: `apps/mobile/src/lib/pageTitle.ts`, test `pageTitle.test.ts`
- Modify: each route in `apps/mobile/app/**` (one `<PageTitle>` per screen)

**Interfaces:**
- Produces: `pageTitle(name?: string): string` returns `"<name> · Prepio"`, or `"Prepio"` without a name. `<PageTitle name>` sets `document.title` on web through `expo-router/head` (`<Head><title>`) and renders nothing on native.

- [ ] **Step 1:** Write the tests: `pageTitle('Creditele mele') === 'Creditele mele · Prepio'`; `pageTitle() === 'Prepio'`.
- [ ] **Step 2:** Run them (FAIL), implement, run them (PASS).
- [ ] **Step 3:** Add titles. Home „Prepio”; „Lecție · {title}”; „Consolidare · {title}”; „Subiecte BAC”; „{subject title}”; „Rezultat · {subject title}”; „Creditele mele”; „Accesul meu”; „Profilul tău”; „Invită colegi”; „Cum funcționează recomandările”; „Termeni de utilizare”; „Politica de confidențialitate”; „Ștergerea contului”; „Pagina nu există”; Welcome „Intră în cont”.
- [ ] **Step 4:** Commit `feat(web): per-page document titles`.

### Task 1.3: One header pill with a readable plan word, on every app screen (G4, G5)

**Files:**
- Modify: `apps/mobile/src/credits/CreditChip.tsx` and its test
- Modify: `apps/mobile/src/ui/TopBar.tsx` (a `right` slot showing the chip by default on (app) screens)
- Modify: the screens that build their own top bar: `AccessScreen`, `CreditsScreen`, `ProfileScreen`, `LessonScreen` start, `BacPaperScreen` (keep „Predă lucrarea” there, see Task 6.5)

- [ ] **Step 1: Failing tests in `CreditChip.test.tsx`.**
  - Full access: visible text „Acces” with ★, then 🪙 „405”.
  - Trial: visible text „Probă”.
  - Expired: visible text „Expirat”, in the warning tone.
  - The accessibility label stays as today („Acces complet, 405 credite, deschide abonamentul” → change „abonamentul” to „accesul”).
- [ ] **Step 2:** Run (FAIL), implement, run (PASS).
- [ ] **Step 3:** Show the chip on Credits, Profile, Lesson start, Consolidation and the BAC list. Hide it on Abonament itself, where it would link to the same screen. Hide it on the BAC hand-in summary, which replaces the paper and has the same header as the paper.
- [ ] **Step 4:** Commit `feat(ui): readable plan word in the header pill, shown consistently`.

### Task 1.4: Terminology sweep (G6)

**Files:** `grep -rn "abonament\|cartona[șs]\|exercițiile\b" apps/mobile/src apps/mobile/app`, excluding the legal texts in `src/screens/legal/*`. Change those only if the owner agrees: they are lawyer drafts.
- [ ] **Step 1:** Update the tests that assert the old strings first (they fail), then the copy.
  - „Primești 40 de credite pentru fiecare coleg care își cumpără acces”
  - „Până acum: 0 colegi cu acces”
  - „CARD 4 DIN 14”
  - Profile mode card: „Lecția următoare se deschide după ce răspunzi corect la toate întrebările.” and „Știi deja materia? Sari direct la verificare.”
  - The route title „Abonamentul meu” → „Accesul meu”, including the Profile row
  - /recomandari: „abonament” → „acces” throughout
- [ ] **Step 2:** Run the full mobile test suite (PASS). Commit `fix(copy): one term each for access, cards, questions and exercises`.

### Task 1.5: Shared chevrons, back buttons and „Cum rezolv” (G9, C6, C7)

**Files:**
- Modify: `apps/mobile/src/screens/bac/BacHint.tsx` (▲/▼ text → the chevron icon used by `LessonListItem`)
- Modify: `apps/mobile/src/screens/consolidation/ExerciseScreen.tsx` (action-bar back: icon-only „‹” → `Button variant="secondary" label="← Înapoi"`, same as BAC; the hint pill → the same accordion as `BacHint`, collapsed by default, under the prompt)
- Modify: `apps/mobile/src/screens/HomeScreen.tsx` (chevron on the „Subiecte BAC” card), `BacListScreen.tsx` (chevron on rows)
- [ ] **Step 1:** Update `ExerciseScreen.test.tsx` to find `getByRole('button', {name: '← Înapoi'})` and the hint as a collapsed accordion („Cum rezolv”, `expanded: false`). Run (FAIL).
- [ ] **Step 2:** Implement, run (PASS). Commit `fix(ui): same back button, hint accordion and chevrons across lesson, consolidation and BAC`.

### Task 1.6: Batch A verification and PR
- [ ] Typecheck and tests green. Browser walk at 360 and 1280: tab titles on 6 routes; the pill on every (app) screen for full access (and for trial with a local `[test]` student); `view-source` shows `lang="ro"`; paste a local `/invita/X` URL into an OG debugger, or `curl` the built `dist/index.html`. Console clean.
- [ ] Push, `gh pr create`, `gh pr checks --watch`, merge per CLAUDE.md.

---

## Batch B — Home (PR `feat/ux-home`)

### Task 3.1: Returning students see „Continuă” first (H1, H2)

**Files:**
- Modify: `apps/mobile/src/screens/HomeScreen.tsx`, `apps/mobile/src/ui/Hero.tsx`
- Create: `apps/mobile/src/screens/home/ContinueCard.tsx`
- Test: `HomeScreen.test.tsx`

**Interfaces:**
- Produces: `<ContinueCard lesson={…} where="Card 4 din 14" | "Verificare" | null onPress />`. `where` comes from the same `lesson_progress` read that Task 4.1 uses (`describeProgress`, defined in Task 4.1; build 4.1's helper first if executing out of order).

- [ ] **Step 1: Failing tests.**
  - A student with ≥ 1 started or finished lesson sees the compact hero: one line „Bine ai revenit, {name}!” and no long paragraph.
  - Above the sections there is a `ContinueCard` with the lesson title, „Card 4 din 14” and a primary button „Continuă”.
  - A student with no progress sees the full welcome hero (today's text) and a ContinueCard „Începe prima lecție”.
  - When every lesson is finished, no ContinueCard is shown.
- [ ] **Step 2:** Run (FAIL), implement, run (PASS).
- [ ] **Step 3:** Commit `feat(home): continue card and compact hero for returning students`.

### Task 3.2: Global lesson numbers and a balanced grid (H3, H4, H7)

**Files:** `HomeScreen.tsx`, `apps/mobile/src/ui/LessonListItem.tsx`
- [ ] **Step 1: Failing tests.**
  - Lesson numbers follow the Home order across sections (1, 2, 3, 4), not restarting per section; the demo lesson is numbered too.
  - The section header renders the part after „›” as the title and the part before as a small overline (`role="caption"`).
- [ ] **Step 2:** Implement. On desktop (≥ 900 px) a section with a single lesson renders it full width (`numColumns` only when the section has ≥ 2). Run (PASS). Commit `feat(home): global lesson numbers, lighter section headers, balanced grid`.

### Task 3.3: Say why a lesson is locked (H5)
**Files:** `LessonListItem.tsx`, `HomeScreen.tsx`
- [ ] **Step 1: Failing tests.**
  - Guided lock: the subtitle reads „Se deschide după lecția {n}” and the accessibility label is „{title}, blocată, se deschide după lecția {n}”.
  - Trial lock: „Disponibil cu acces complet”; tapping opens the PaywallSheet (today's behaviour).
  - Expired: the same as trial.
- [ ] **Step 2:** Implement, run (PASS), commit `feat(home): explain locked lessons`.

### Task 3.4: Invite banner with a real call to action (H6)
**Files:** `apps/mobile/src/components/InviteNote.tsx` and its test
- [ ] Failing test: the banner has 🎁, the text „Ai terminat prima lecție! Invită un coleg și primești credite.” and a secondary button „Invită” (role button), plus an icon-only close button labelled „Închide”. Implement, run (PASS), commit.

### Task 3.5: Batch B verification and PR
- [ ] Walk at 360 and 1280 with three students:
  - the owner-like account (in progress)
  - a new `[test]` student (no progress)
  - a `[test]` trial student
- [ ] Check that the ContinueCard is above the fold at 360×780, the numbering, the locked reasons, no horizontal scroll and a clean console. Then PR, CI and merge.

---

## Batch C — Lesson (PR `feat/ux-lesson`)

### Task 4.1: Progress on the lesson start screen (L1, L2, L3, L4)

**Files:**
- Create: `apps/mobile/src/lib/lessonProgressLabel.ts` + test
- Modify: `apps/mobile/src/screens/lesson/LessonStart.tsx`, `ZoneRow.tsx`, `LessonScreen.tsx`

**Interfaces:**
- Produces: `describeProgress(p: LessonProgress | null, counts: {cards: number; questions: number; exercises: number}): {learn?: string; check?: string; consolidate?: string; resume?: string}`. Examples: `learn: 'Card 4 din 14'`, `check: 'Ultima încercare: 7 din 9'`, `consolidate: '3 din 10 corecte'`, `resume: 'Continuă de la cardul 4'` or `'Continuă testul · întrebarea 3'`. With `null` it returns `{}`.

- [ ] **Step 1: Failing tests** for `describeProgress`: the five examples above, and `null` → `{}`.
- [ ] **Step 2:** Store the last test score. Check first whether `lesson_progress` already keeps the last attempt's answers (`answers` jsonb). If it does, derive the score from them. If it doesn't, the batch needs a migration adding `last_test_correct int, last_test_total int` to `lesson_progress`, following `docs/database-migrations.md`: a pgTAP test, and the RLS is unchanged because the table's policies already cover new columns. Decide this before writing code and note the choice in the PR.
- [ ] **Step 3:** LessonStart:
  - The rows show the strings from `describeProgress`.
  - The resume button label comes from `resume`.
  - After a failed test, the primary button is „Reia testul”, with „Revezi cardurile” as secondary.
  - A finished lesson hides „Dacă răspunzi corect la toate…” and „Știu deja — sari la verificare”, and shows „✓ Lecție terminată” with „Recitește cardurile” and „Consolidare”.
  - On ≥ 900 px the buttons sit directly under the card, not pinned to the bottom of the screen.
- [ ] **Step 4:** Run `LessonScreen.test.tsx` and the new tests (PASS). Commit `feat(lesson): progress on the start screen`.

### Task 4.2: Image cards fit the screen (L5, L6)
**Files:** `apps/mobile/src/components/cards/ImagesCard.tsx`, `CardView.tsx`
- [ ] **Step 1: Failing tests.**
  - The single image style has `maxHeight` = `Math.round(windowHeight * 0.45)` and `resizeMode="contain"` on a `surfaceMuted` background.
  - Tapping the image still opens `ImageViewer`.
  - The type badge („Text”, „Imagini”…) is no longer rendered in the student card header; only „CARD n DIN m” stays. The admin preview may keep the badge: pass `showType` from `PreviewScreen` only.
- [ ] **Step 2:** Implement, run (PASS), commit `fix(cards): images capped to the viewport, no type badge for students`.

### Task 4.3: Test feedback said once, neutral forward button (L10, L11, L12, L13, L14)
**Files:** `apps/mobile/src/components/QuestionView.tsx`, `OrderQuestion.tsx`, `ChoiceQuestion.tsx`, `apps/mobile/src/ui/ActionBar.tsx`
- [ ] **Step 1: Failing tests in `QuestionView.test.tsx`.**
  - After a correct answer, the explanation appears once: in the box under the options; the bar shows only „Corect, bravo!”.
  - After a wrong single-choice answer, the bar shows „Nu chiar.” and the box shows the explanation; the separate „Răspuns corect: …” box is not rendered, because the option is highlighted.
  - The forward button keeps the primary tone (not `danger`) in both cases.
  - A multi-select question shows the hint „Alege toate variantele corecte.” under the prompt.
- [ ] **Step 2: Failing tests in `OrderQuestion`.**
  - After a wrong check, each row in its correct position gets `accessibilityLabel` „…, poziție corectă” and the success style; the others get the error style.
  - The ↑/↓ buttons have `hitSlop` so their touch area is ≥ 44 px.
- [ ] **Step 3:** Implement, run (PASS), commit `fix(test): one explanation, neutral next button, multi hint, per-row order feedback`.

### Task 4.4: A failed test leads somewhere useful (L15)
**Files:** `apps/mobile/src/screens/lesson/GuidedResult.tsx`, `apps/mobile/src/ui/ScoreRing.tsx`
- [ ] **Step 1: Failing tests.**
  - The ring shows „7/9”.
  - The header title is „Rezultatul testului”.
  - Each wrong question is listed as a tappable row („Întrebarea 2 · Ce formă de guvernământ…”) that opens a sheet with the question, the student's answer, the correct answer and the explanation.
  - „Revezi cardurile” opens the cards at card 1. A card→question link doesn't exist today, so don't invent one; record it as a follow-up in STATUS.
- [ ] **Step 2:** Implement, run (PASS), commit `feat(lesson): reviewable mistakes on the failed-test screen`.

### Task 4.5: Desktop keyboard and small card fixes (L7, L8, L9)
**Files:** `CardStepper.tsx`, `QuestionView.tsx`, `SchemaCard.tsx`, `VideoCard.tsx`
- [ ] **Step 1: Failing tests (web only, `Platform.OS === 'web'`).**
  - `keydown` ArrowRight/ArrowLeft moves the card; it's ignored while focus is in an input.
  - Keys 1–4 / A–D pick option n; Enter presses the enabled primary action.
- [ ] **Step 2:** Schema: move the central node's „+” inside the bar (right padding, badge inset). Video: move „Atinge pentru sunet” to the bottom-left above the controls (`bottom: 48`).
- [ ] **Step 3:** Run (PASS), commit `feat(web): keyboard navigation for cards and questions; schema and video badge placement`.

### Task 4.6: Batch C verification and PR
- [ ] Walk all 14 cards of „Constituția din 1866” at 360 and 1280 (portrait image fits with its caption visible, schema, video, timeline). Fail the test once and pass it once; check the reviewable mistakes, the start-screen progress before and after, the keyboard on desktop and a clean console.
- [ ] Native: the image height and the hitSlop affect the phone, so add them to the owner's APK checklist. Then PR and merge.

---

## Batch D — Consolidation (PR `feat/ux-consolidation`)

### Task 5.1: Comma-below diacritics in AI feedback (C3)

**Files:**
- Create: `packages/shared/src/text/romanianDiacritics.ts` + test, exported from `packages/shared/src/index.ts`
- Modify: `apps/admin/src/lib/consolidation/schema.ts` (`normalizeAiOutput`) and the BAC grading output path (`apps/admin/src/app/api/bac/submit/*`, where the AI feedback strings are built)

**Interfaces:**
- Produces: `fixRomanianDiacritics(s: string): string`, which maps ş→ș, Ş→Ș, ţ→ț, Ţ→Ț and leaves everything else unchanged.

- [ ] **Step 1: Failing tests.**
  - `fixRomanianDiacritics('menţionat şi Ţara Ştefan') === 'menționat și Țara Ștefan'`
  - `'ş.a.'` → `'ș.a.'`
  - `'café — „x”'` is unchanged
  - In the admin, a `normalizeAiOutput` test whose AI output has cedillas in `title`, `good[]` and `improve[]` gets them back with comma-below.
- [ ] **Step 2:** Implement, run (PASS). Also add „Folosește diacriticele cu virgulă (ș, ț), nu cu sedilă (ş, ţ).” to the fixed output contract in code, next to the existing Romanian rule.
- [ ] **Step 3:** Run `pnpm --filter @prepio/shared test` and `pnpm --filter @prepio/admin test` (PASS). Commit `fix(ai): normalise Romanian diacritics in AI feedback`.

### Task 5.2: Explicit verdict and readable feedback (C2, C4)
**Files:** `apps/mobile/src/screens/consolidation/FeedbackView.tsx`, `ExerciseScreen.tsx`, `verdictTone.ts`
- [ ] **Step 1: Failing tests.**
  - The feedback card starts with the verdict chip („Corect” / „Aproape” / „Mai lucrează”); the AI title follows as a heading.
  - The body text uses `color.text` on the tinted background (not the verdict colour).
  - For an AI exercise, „Încearcă din nou” shows the coin pill with the exercise cost and its accessibility label „Încearcă din nou, costă {n} credite”.
  - On a „Corect” verdict, „Încearcă din nou” is a text button under the bar, not a full button.
- [ ] **Step 2:** Implement, run (PASS), commit `feat(consolidation): explicit verdict, readable feedback, cost on retry`.

### Task 5.3: Feedback visible after „Verifică” on the phone; one progress indicator (C1, C5)
**Files:** `ExerciseScreen.tsx`, `apps/mobile/src/components/consolidation/ExerciseMap.tsx`, `ConsolidationScreen.tsx`
- [ ] **Step 1: Failing tests.**
  - After a check, the screen calls `scrollTo` so the feedback card is in view, the same way `QuestionView` does today.
  - The header no longer shows „7/10”, and the progress bar is removed: the map is the one progress indicator.
  - Each map dot has an accessibility label „Exercițiul 3, Aproape” / „…, Corect” / „…, nerezolvat”.
  - A one-line legend under the map, „● corect  ● aproape  ○ nerezolvat”, is shown on first visit and collapsible.
- [ ] **Step 2:** Implement, run (PASS), commit `feat(consolidation): feedback scrolled into view, one progress indicator with legend`.

### Task 5.4: End screen that fits the result (C8)
**Files:** `apps/mobile/src/screens/consolidation/ConsolidationEnd.tsx`
- [ ] **Step 1: Failing tests.**
  - With every exercise correct: title „Consolidare încheiată 🎉”, primary „Mergi la lecția următoare”, secondary „Reia consolidarea”.
  - With some not correct: title „Mai ai {n} exerciții de lucrat”, primary „Reia doar ce nu a fost corect”, secondary „Mergi la lecția următoare”, and „Reia consolidarea” as a text button.
  - At most two full buttons in the bar.
- [ ] **Step 2:** Implement, run (PASS), commit `feat(consolidation): end screen actions follow the result`.

### Task 5.5: Batch D verification and PR
- [ ] Locally with the OpenAI mock (see the earlier walks in STATUS), at 360 and 1280: an AI check returning cedillas shows comma-below; the verdict chip; the retry cost; the feedback scrolled into view at 360; the end screen in both states; a clean console. Then PR and merge.

---

## Batch E — BAC (PR `feat/ux-bac`)

### Task 6.1: BAC list explains itself (B1)
**Files:** `apps/mobile/src/screens/bac/BacListScreen.tsx`
- [ ] Failing tests:
  - An intro card: „Lucrare completă ca la examen: Subiectul I, II și III. Lucrezi în ritmul tău, lucrarea se salvează automat, iar la final primești o notă orientativă și ce mai ai de lucrat.”
  - The cost reads „🪙 10 credite la predare”.
  - Rows have a chevron.
- [ ] Implement, run (PASS), commit.

### Task 6.2: Attempt history and best grade on the list (B2, B8 part)
**Files:** `BacListScreen.tsx`, `apps/mobile/src/lib/bac.ts` (the read already filters on the own user via `ownUser.ts`), `BacResultScreen.tsx`
**Interfaces:**
- Produces: `listAttempts(subjectId): Promise<{id, status, grade: number | null, submittedAt: string}[]>`, own user only, newest first.
- [ ] **Step 1: Failing tests.**
  - A subject with a graded attempt and a draft shows „În lucru · Subiectul II, cerința 5” and under it „Ultima notă: 1,30 · 10 nov.”, which opens the result of that attempt.
  - The result route takes an attempt id: `/bac/[id]/rezultat?attempt=<id>`, defaulting to the latest.
  - With no attempts nothing extra is shown.
  - The result screen hides „Reia subiectul” while a draft exists and shows „Continuă lucrarea” instead.
- [ ] **Step 2:** Implement, run (PASS), commit `feat(bac): attempt history on the list, result per attempt`.

### Task 6.3: Readable result (B8)
**Files:** `BacResultScreen.tsx`
- [ ] Failing tests:
  - Subtotals per Subiect („Subiectul I · 0 / 30 p”).
  - The date of the attempt.
  - The line „Include 10 puncte din oficiu.”
  - Each row expands to show the student's answer and the feedback line (the barem stays hidden: assert no barem text is rendered).
  - Rows below full marks are sorted first.
- [ ] Implement, run (PASS), commit.

### Task 6.4: Completeness matches the grader (B5, B6, B7)
**Files:** `apps/mobile/src/lib/bac.ts` (`answeredCount`), `BacSubmitView.tsx`, `BacPaperScreen.tsx`
**Interfaces:**
- Produces: `answeredCount(items, answers)` returns `{answered, total, empty: Item[], partial: Item[]}`. An item is `partial` when some but not all of its parts are filled (viewpoint: text without both marks, or marks without text; cause-effect: one role; essay: some requirements).
- [ ] **Step 1: Failing tests in `bac.test.ts`.**
  - A viewpoint with 2 marks and empty text is `partial`, not answered.
  - An essay with 2 of 4 requirements is `partial` and its missing requirements are named.
- [ ] **Step 2: Failing tests in the submit view.**
  - The summary reads „Ai răspuns complet la x din 14 cerințe”, then „Incomplete: II.5” and „Necompletate: …”.
  - Every listed item is a button that closes the summary and jumps to that requirement.
  - The list is grouped by Subiect.
- [ ] **Step 3: Failing test in the map.** The current dot keeps the done/partial colour and adds the ring: `dotHere` styles only the border. A partial item gets a half-filled (warning) dot.
- [ ] **Step 4:** Implement, run (PASS), commit `fix(bac): partial answers named in the summary and the map; jump to any item`.

### Task 6.5: Paper layout (B3, B4, B9, B10)
**Files:** `BacPaperScreen.tsx`, `BacItemView.tsx`, the paper's source panel
- [ ] **Step 1: Failing tests.**
  - When a requirement's prompt names a source („sursa B” / „sursele A și B”), the split view and the reader open on that source. Use a `sourcesNamedIn(prompt): ('A'|'B')[]` helper with tests for „sursa B”, „sursa dată”, „sursele A și B”, and no source.
  - The points tail is rendered with a non-breaking space, so it never wraps alone: „· 2 puncte”.
  - On the phone, only sources named by the requirement get a filled primary „Citește și marchează”; the others get a secondary button.
  - On the phone, the requirement's own input comes before the source cards when the requirement names no source.
- [ ] **Step 2:** On the phone, the header collapses to title + current „I.2” with the tabs and map in a sheet opened from it („I.2 ▾”). The full title shows in that sheet. On desktop the source pane hides the native scrollbar (`scrollbarWidth: 'thin'` on web).
- [ ] **Step 3:** Run (PASS), commit `feat(bac): paper opens the named source, compact phone header`.

### Task 6.6: Batch E verification and PR
- [ ] Locally (seed „Istorie 2026 · Varianta 3”, a `[test]` student, OpenAI mock) at 360 and 1280:
  - the intro, the history and the result per attempt
  - a partial II.5 named in the summary, with jumps from the summary
  - the source auto-select on I.1
  - the points tail never wrapping alone
  - the compact phone header
  - a real submit graded by the mock
  - a clean console
- [ ] Then PR and merge.

---

## Batch F — Account screens and public pages (PR `feat/ux-account`)

### Task 7.1: Credit history says what each row was (P1, P2)
**Files:** `apps/mobile/src/lib/credits.ts` (`label`, the `select` on line 75), `CreditsScreen.tsx`, `apps/mobile/src/credits/PackagePicker.tsx`
- [ ] **Step 1:** Find the BAC title for a ledger row. `bac_attempts.ledger_entry` points at the charge, so select through it: `bac_attempts!bac_attempts_ledger_entry_fkey(bac_subjects(title))`. If the FK or the RLS doesn't allow the embed, add it to the student-readable shape in a migration, with a pgTAP test showing a student reads only their own rows.
- [ ] **Step 2: Failing tests.**
  - The label is „Corectare subiect · Istorie 2026 · Varianta 3”.
  - The refund label is „Corectare nereușită · returnat · {title}”.
  - The old row without an exercise reads „Verificare cu profesorul digital”.
  - Rows are grouped under day headers („Azi”, „Ieri”, „10 noiembrie”).
  - Each row shows the balance after it („sold 405”).
  - The hero subline is „Ajunge pentru cel puțin 202 verificări”, using the most expensive check.
  - The featured badge reads „CEL MAI POPULAR”.
- [ ] **Step 3:** Implement, run (PASS), commit `feat(credits): named history rows, day groups, running balance`.

### Task 7.2: Profile as a settings list (P4, P5)
**Files:** `apps/mobile/src/screens/ProfileScreen.tsx`
- [ ] **Step 1: Failing tests.**
  - The header block shows the initial, the name and the signed-in email with its provider („Google”).
  - „Salvează” is disabled while the trimmed name equals the stored one.
  - The account rows (Accesul meu, Creditele mele, Invită colegi, Termeni, Confidențialitate) are list rows: left-aligned label, value on a second line („Acces până la 9 februarie 2027”, „405 credite”), chevron. No row label is truncated at 360 px, because the value wraps under the label.
  - „Ieși din cont” sits in its own group.
  - „Șterge contul” sits last, separated, with danger-coloured text.
- [ ] **Step 2:** Implement, run (PASS), commit `feat(profile): settings list with account info and a separated danger zone`.

### Task 7.3: Access screen in the same visual language (P3)
**Files:** `apps/mobile/src/screens/AccessScreen.tsx`
- [ ] Failing tests:
  - The status card uses the same hero style as the Credits balance card (gradient, „ACCES COMPLET”, „până la 9 februarie 2027”, „încă 89 de zile”).
  - The bar uses `color.primary`.
  - History rows use the Credits history row component.
  - The credits line becomes a row „Creditele mele · 405 ›”.
- [ ] Implement, run (PASS), commit.

### Task 7.4: Invite screen and the referrals explainer (P6, P7)
**Files:** `apps/mobile/src/screens/InviteScreen.tsx`, `ReferralsInfoScreen.tsx`
- [ ] **Step 1: Failing tests on the invite screen.**
  - A hero with 🎁, the reward line (copy from Task 1.4) and three steps: „1. Trimiți linkul · 2. Colegul își face cont cu el · 3. Primești recompensa când își cumpără acces”.
  - The free-access progress „{n} din 5 colegi pentru 3 luni gratuite” is shown only without active access.
  - After a copy, the „Copiat ✓” feedback is visible next to the button for `FEEDBACK_MS`. This exists today; assert it renders visibly, not only as a live region.
- [ ] **Step 2: Failing tests on /recomandari.**
  - A „Pe scurt” card stays at the top.
  - Every other section is a collapsible heading, collapsed by default, with „Întrebări frecvente” as an accordion.
  - The total text is unchanged: snapshot of the concatenated text.
- [ ] **Step 3:** Implement, run (PASS), commit `feat(referrals): invite hero with steps, collapsible explainer`.

### Task 7.5: Public pages (G8, P8)
**Files:** `apps/mobile/src/screens/legal/*`, `DeleteAccountInfoScreen.tsx`, `src/lib/legal.ts`
- [ ] Failing tests:
  - Every `CONTACT_EMAIL` occurrence renders as a link with `href="mailto:…"` on web and `Linking.openURL('mailto:…')` on native.
  - On /sterge-cont, „Mergi la profil” is full width.
  - „Ce se șterge” adds „Progresul la lecții, consolidare și subiectele BAC”, „Creditele și accesul rămase (nu se returnează)” and „Istoricul de credite și comenzi”. Wording to be checked against `/confidentialitate` before changing; the lawyer review is pending, so flag it in the PR.
- [ ] Implement, run (PASS), commit.

### Task 7.6: Batch F verification and PR
- [ ] Walk at 360 and 1280:
  - credits history labels and groups, with a local BAC charge row
  - the profile list, with no truncation at 360
  - the access screen
  - the invite hero for full access and for trial
  - /recomandari collapsed and expanded
  - mailto links
  - a clean console
- [ ] Update `docs/STATUS.md`, then PR and merge.

---

## Owner actions (not code)

- **H8:** Delete the card „card test / test madalinh” from „Constituția din 1866” (Admin → lesson → Învățare). Decide whether „[demo] Toate funcționalitățile” stays published at launch.
- **H9:** The referral flag looks ON in production (the invite banner, the footer link and /invita are live), while STATUS says it is OFF. Check Admin → Setări → Recomandări and update STATUS.
- After Batch A merges, check the share preview of `https://prepio.ro/invita/<CODE>` in WhatsApp.

## Not covered by this audit (walk them before calling the app "perfect")

Welcome / sign-in / email code, onboarding (terms, name, mode), the terms gate, the suspended screen, a trial student (paywall, banners), a brand-new student's empty states, `/invita/<CODE>` signed out, a real BAC grading, a real AI check, native behaviour on the phone. Suggested: a follow-up walk with local `[test]` accounts in each state, before Batch B.
