# Cause-effect marking clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On a cause-effect requirement (BAC papers and consolidation), the student always sees which role they are marking, what they marked as what, and whether the relation reads right.

**Architecture:** The marker reducer gains an idle state once both roles are marked and switches roles both ways. Three new presentational pieces in `apps/mobile/src/components/marker`: a step banner (and its compact reader-tray form), in-text role labels in `MarkableText`, and a relation view that replaces `MarkSlots`' cause-effect layout. `SourcePanel` / `SourceReader` show the banner instead of the pen buttons for cause-effect; a `clues` flag on `PanelMarker` turns the signal words on in consolidation only.

**Tech Stack:** Expo / React Native (+ web), TypeScript, jest + @testing-library/react-native (mobile), vitest (shared).

**Spec:** `docs/superpowers/specs/2026-11-10-cause-effect-marking-clarity-design.md` · mockup `docs/design/2026-11-10-cause-effect-marking-mockup.html` (the spec wins where they differ).

## Global Constraints

- Stored answer, grading, barem and marking gestures (drag / tap-tap / handles) unchanged; `source_info` and `viewpoint` UIs unchanged.
- Signal words only when `marker.clues` is true (consolidation); never in BAC; never in the reader tray.
- Copy in Romanian with comma diacritics (ș, ț), exactly as written in this plan.
- Colours only from theme tokens (`markerPen`, the new `markerInk` / `markerTint`); new tokens AA-tested.
- Commands run in WSL: `wsl -d Ubuntu-22.04 -- bash -ic "cd ~/projects/prepio_new && <cmd>"`.
- FE rule: browser walk at 360 px and desktop with a clean console before „done”; native-only items listed for the owner.

## Review Focus

1. A BAC draft restored with both marks opens idle (no role outlined, banner „✓ Gata”), not on „Cauza” — test in Task 2 (`initialMarker`).
2. A new mark overlapping the other role's mark deletes it and makes that role current — test in Task 2.
3. „⇅ Inversează” while idle keeps the marker idle and the labels follow the swap — tests in Task 2 and Task 6.
4. After checking (consolidation, `readOnly`) the banner is gone but the in-text labels and gap verdicts stay — tests in Task 4 and Task 7.
5. A very long mark doesn't blow up the reader tray (mini gap text is one line, ellipsised) — test in Task 5.

---

### Task 1: Theme tokens for role ink and tint

**Files:**
- Modify: `packages/shared/src/theme.ts` (next to `markerPen`, line ~59)
- Test: `packages/shared/src/theme.test.ts`

**Interfaces:**
- Produces: `markerInk: { cause: '#0A5C55'; effect: '#8A4B12' }` (label pill background, banner/gap borders, eyebrows) and `markerTint: { cause: '#E6FCF7'; effect: '#FFF3E8' }` (banner / filled-gap backgrounds), both `as const`, exported from `@prepio/shared`.

- [ ] **Step 1: Write the failing test** in `theme.test.ts`:

```ts
it('cause/effect ink and tint: white on ink and ink/text on tint stay AA', () => {
  expect(markerInk).toEqual({ cause: '#0A5C55', effect: '#8A4B12' });
  expect(markerTint).toEqual({ cause: '#E6FCF7', effect: '#FFF3E8' });
  for (const role of ['cause', 'effect'] as const) {
    expect(contrastRatio('#FFFFFF', markerInk[role])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(markerInk[role], markerTint[role])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(color.text, markerTint[role])).toBeGreaterThanOrEqual(4.5);
  }
});
```

- [ ] **Step 2: Run** `pnpm --filter @prepio/shared test -- theme` → FAIL (`markerInk` not exported).
- [ ] **Step 3: Add the two tokens** with a one-line comment in the file's style („Cause/effect role ink (labels, borders) and tints (banner, filled gaps); AA-checked.”).
- [ ] **Step 4: Run** the same command → PASS.
- [ ] **Step 5: Commit** `feat(shared): cause/effect role ink and tint tokens`.

---

### Task 2: Marker reducer — both-way switch and idle when done

**Files:**
- Modify: `apps/mobile/src/components/marker/markerReducer.ts`
- Modify: `apps/mobile/src/screens/consolidation/checking.ts:66` (`markerConfig` cause_effect)
- Modify: `apps/mobile/src/components/marker/SourceReader.tsx` (`HINT`, `hintFor`, `NO_MARKS` type)
- Test: `apps/mobile/src/components/marker/markerReducer.test.ts`, `apps/mobile/src/components/marker/SourcePanel.test.tsx` (hint cases)

**Interfaces:**
- Produces:
  - `MarkerState.pen: Pen | null` — `null` = no role current (only reachable with `idleWhenDone`).
  - `MarkerConfig.idleWhenDone?: boolean` — when every pen in `cfg.pens` has a mark, `pen` becomes `null`.
  - cause_effect config: `{ pens: ['cause', 'effect'], limits: { cause: 1, effect: 1 }, autoNext: { cause: 'effect', effect: 'cause' }, idleWhenDone: true }` (update the `ce` fixtures in the tests to match).
  - `HINT.pickGap = 'Atinge golul pe care vrei să-l schimbi.'`; `HINT.causeDone`, `HINT.effectDone`, `HINT.bothDone` removed.
  - `hintFor(cfg, s)`: `s.anchor` → `HINT.anchored`; `s.pen === null` → `HINT.pickGap`; else `HINT.start`.

Rules (`markerReducer`):
- `initialMarker(cfg, marks)`: `pen` = `null` if `cfg.idleWhenDone` and every pen has a mark, else `cfg.pens[0]`.
- `commit`: after `autoNext`, if `cfg.idleWhenDone` and every pen has a mark → `pen: null`.
- `tap` with `pen === null`: a tap on an existing mark toggles `active` as today; any other tap is ignored (no anchor).
- `dragStart` with `pen === null`: ignored (state unchanged), so `dragMove` / `dragEnd` are no-ops.
- `handleStart` unchanged (it uses the mark's own pen); a handle drag commits back without changing `pen` (still `null` when it was `null`).
- `remove`: `pen` becomes the removed mark's pen.
- `swapRoles`: `pen` unchanged.

- [ ] **Step 1: Write the failing tests** (`describe('cause-effect roles', …)` with the updated `ce`):
  - `effect first, then auto-switches to cause`: `setPen effect`, `tap(0)`, `tap(3)` → `pen === 'cause'`, marks `[{0..3, effect}]`.
  - `idle once both are marked`: `tap(0) tap(1)` then `tap(5) tap(6)` → `pen === null`.
  - `idle: a new drag or tap outside the marks is ignored`: from idle, `dragStart(9)`, `dragMove(10)`, `dragEnd` → `marks` unchanged, `drag === null`; `tap(9)` → `anchor === null`.
  - `idle: tapping a mark still selects it for handles`: from idle, `tap(0)` → `active === 0`.
  - `setPen from idle, then the next selection replaces that role`: `setPen cause`, `tap(9) tap(10)` → cause = `{9..10}`, effect kept, `pen === null`.
  - `remove makes that role current`: from idle, `remove` of the effect mark → `pen === 'effect'`.
  - `overlap: marking over the other role deletes it and switches to it`: cause `{0..3}`, then (pen effect) `tap(2) tap(5)` → marks `[{2..5, effect}]`, `pen === 'cause'`.
  - `swapRoles while idle stays idle`: → `pen === null`, pens swapped.
  - `initialMarker restores idle`: `initialMarker(ce, [cause, effect]).pen === null`; with one mark → `'cause'`.
  - Existing `info` / `support` tests unchanged and passing (no `idleWhenDone`).
- [ ] **Step 2: Run** `pnpm --filter @prepio/mobile test -- markerReducer` → the new tests FAIL.
- [ ] **Step 3: Implement** the rules above in `markerReducer.ts`; update `markerConfig` in `checking.ts`; update `HINT` / `hintFor`, and fix the type fallout (`NO_MARKS` keeps `pen: 'info'`; `PenBar`'s `state.pen === pen` still compiles).
- [ ] **Step 4: Update** the `SourcePanel.test.tsx` cases that assert the removed hints (`causeDone` / `bothDone`) to assert `HINT.start` / `HINT.pickGap`.
- [ ] **Step 5: Run** `pnpm --filter @prepio/mobile test -- markerReducer SourcePanel checking` and `pnpm --filter @prepio/mobile typecheck` → PASS / no errors.
- [ ] **Step 6: Commit** `feat(mobile): cause-effect marker switches both ways and idles when done`.

---

### Task 3: Role copy and the relation sentence

**Files:**
- Create: `apps/mobile/src/components/marker/causeEffect.ts`
- Test: `apps/mobile/src/components/marker/causeEffect.test.ts`

**Interfaces:**
- Produces:
  - `type Role = 'cause' | 'effect'`
  - `ROLE: Record<Role, { step: 1 | 2; eyebrow: string; question: string; gap: string; help: string; clues: string[]; label: 'CAUZĂ' | 'EFECT'; name: 'Cauza' | 'Efectul' }>` with exactly:
    - cause: `eyebrow 'Pasul 1 din 2 · marchezi cauza'`, `question 'De ce s-a întâmplat ceva?'`, `gap 'Cauza · de ce?'`, `help 'Caută motivul. Stă de obicei după:'`, `clues ['fiindcă', 'deoarece', 'pentru că', 'cu scopul de a']`.
    - effect: `eyebrow 'Pasul 2 din 2 · marchezi efectul'`, `question 'Ce s-a întâmplat din cauza asta?'`, `gap 'Efectul · ce a urmat?'`, `help 'Caută urmarea. Stă de obicei după:'`, `clues ['ca urmare', 'astfel', 'ceea ce', 'de aceea']`.
  - `DONE = '✓ Gata, ambele roluri marcate'`
  - `relationSentence(cause: string, effect: string): string` → `` `Pentru că ${trim(cause)}, ${trim(effect)}.` `` where `trim` drops surrounding whitespace and one trailing `.`, `,`, `;` or `:`; no case change.

- [ ] **Step 1: Write the failing tests**: `relationSentence('domnul era obligat să colaboreze cu două guverne,', 'Începuturile domniei lui Al. I. Cuza au fost anevoioase')` → `'Pentru că domnul era obligat să colaboreze cu două guverne, Începuturile domniei lui Al. I. Cuza au fost anevoioase.'`; `relationSentence(' Mihai Viteazul a intrat în Alba Iulia; ', 'unirea.')` → `'Pentru că Mihai Viteazul a intrat în Alba Iulia, unirea.'`; `ROLE.cause.step === 1`, `ROLE.effect.label === 'EFECT'`.
- [ ] **Step 2: Run** `pnpm --filter @prepio/mobile test -- causeEffect` → FAIL.
- [ ] **Step 3: Implement** `causeEffect.ts`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(mobile): cause-effect role copy and relation sentence`.

---

### Task 4: In-text role labels in MarkableText

**Files:**
- Modify: `apps/mobile/src/components/marker/MarkableText.tsx` (`paintOf`, `Word`, styles)
- Test: `apps/mobile/src/components/marker/MarkableText.test.tsx`

**Interfaces:**
- Consumes: `markerInk` (Task 1), `ROLE[role].label` (Task 3).
- Produces: a pill with testID `role-label-${i}` and text `CAUZĂ` / `EFECT`, rendered inside the first word's `word-box-${i}`, before `word-${i}` (so the inner word box used by handles is unchanged; the outer box used for hit-testing simply includes the pill).

Rules: shown for a committed mark (not the in-progress drag) whose pen is `cause` or `effect`, on its `from` word; shown in read-only too; not for `info` / `support`. Pill: `markerInk[pen]` background, white text, `typeScale` badge-sized bold, small radius, `marginRight` ~3; `accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"` (web: `aria-hidden`).

- [ ] **Step 1: Write the failing tests**: with marks `[{s,0..1,cause},{s,4..6,effect}]` → `role-label-0` has text `CAUZĂ`, `role-label-4` has `EFECT`, no `role-label-1`; with an `info` mark → no `role-label-*`; with `readOnly` → labels still present; during a drag (`state.drag` set, pen cause, a=8, b=9) → no `role-label-8`.
- [ ] **Step 2: Run** `pnpm --filter @prepio/mobile test -- MarkableText` → FAIL.
- [ ] **Step 3: Implement**: add `label: 'cause' | 'effect' | null` to `paintOf`'s result (only for a mark from `state.marks`, `i === m.from`) and to `WordProps`; render the pill in `Word`.
- [ ] **Step 4: Run** → PASS (existing MarkableText tests too).
- [ ] **Step 5: Commit** `feat(mobile): CAUZĂ / EFECT labels on marked text`.

---

### Task 5: Step banner and reader tray step

**Files:**
- Create: `apps/mobile/src/components/marker/CauseEffectBanner.tsx`
- Test: `apps/mobile/src/components/marker/CauseEffectBanner.test.tsx`

**Interfaces:**
- Consumes: `ROLE`, `DONE` (Task 3); `markerInk`, `markerTint`, `markerPen` (Task 1); `MarkerState` with `pen: Pen | null` (Task 2); `useMarkText` from `../consolidation/inputKit`.
- Produces:
  - `CauseEffectBanner({ state, clues }: { state: MarkerState; clues: boolean })` — testID `ce-banner`. Current role = `state.pen` when it is `cause`/`effect`; when `state.pen === null` → done form. Normal form: eyebrow `ROLE[r].eyebrow`, question `ROLE[r].question`, and when `clues`: `ROLE[r].help` + one chip per `ROLE[r].clues`; a two-segment progress (`ce-progress-cause` / `ce-progress-effect`, filled with `markerInk[role]` when that role has a mark). Done form: `DONE` + both segments filled. Border `markerInk[r]` (done: `color.success`), background `markerTint[r]` (done: `color.surface`). `accessibilityLiveRegion="polite"` on the eyebrow.
  - `CauseEffectTrayStep({ state, sources, dispatch }: { state: MarkerState; sources: Source[]; dispatch: (a: MarkerAction) => void })` — testID `ce-tray`. Compact line (eyebrow + question, or `DONE` + „Apasă „Gata” și citește relația.”; never clues), then two mini gaps `ce-mini-cause` / `ce-mini-effect`: role name (`ROLE[r].name`) and the mark's text in „…” with `numberOfLines={1}`, or `nemarcat`; the current role's mini gap outlined (`accessibilityState.selected`); press → `dispatch({ type: 'setPen', pen: r })`. Between them `→`.

- [ ] **Step 1: Write the failing tests**:
  - banner, `pen 'cause'`, no marks, `clues false` → shows `Pasul 1 din 2 · marchezi cauza`, `De ce s-a întâmplat ceva?`, no `fiindcă`.
  - same with `clues true` → shows `fiindcă` and `cu scopul de a`.
  - `pen 'effect'`, cause marked → `Pasul 2 din 2 · marchezi efectul`, `Ce s-a întâmplat din cauza asta?`.
  - `pen null`, both marked → `✓ Gata, ambele roluri marcate`.
  - tray: `pen 'cause'`, effect marked on a 60-word mark → `ce-mini-effect` contains the mark text with `numberOfLines` 1, `ce-mini-cause` shows `nemarcat` and is selected; pressing `ce-mini-effect` dispatches `{ type: 'setPen', pen: 'effect' }`; tray never shows `fiindcă` (render with any props).
- [ ] **Step 2: Run** `pnpm --filter @prepio/mobile test -- CauseEffectBanner` → FAIL.
- [ ] **Step 3: Implement** both components (layout per mockup tabs „★ Recomandat” / „★ Telefon · sursă lungă”; design-system `AppText` roles and `space` / `radius` tokens).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(mobile): cause-effect step banner and reader tray step`.

---

### Task 6: The relation (replaces MarkSlots' cause-effect layout)

**Files:**
- Create: `apps/mobile/src/components/marker/CauseEffectRelation.tsx`
- Modify: `apps/mobile/src/components/consolidation/CauseEffectInput.tsx` (render `CauseEffectRelation` instead of `MarkSlots`)
- Modify: `apps/mobile/src/components/marker/MarkSlots.tsx` (drop the `cause_effect` kind, the arrow and `onSwap`)
- Test: `apps/mobile/src/components/marker/CauseEffectRelation.test.tsx`; update `SourcePanel.test.tsx` (remove the MarkSlots cause-effect cases) and `ExerciseInputs.test.tsx` (cause-effect case)

**Interfaces:**
- Consumes: `ROLE`, `relationSentence` (Task 3); `useSourcePanel()` (existing; `open(pen, markIndex)` sets the pen and opens the reader/split); `slotVerdict` (existing).
- Produces: `CauseEffectRelation({ state, textOf, onRemove, onSwap, disabled, verdictOf }: { state: MarkerState; textOf: (m: MarkerMark) => string; onRemove: (index: number) => void; onSwap: () => void; disabled?: boolean; verdictOf?: (markIndex: number) => Verdict | null })`.

Behaviour:
- Gaps `ce-gap-cause`, the text `↓ a dus la`, `ce-gap-effect`. Each: caption `ROLE[r].gap` (uppercase eyebrow, `markerInk[r]`), then „‹text›” or `Atinge ca să marchezi`; border `markerInk[r]` (dashed when empty), filled background `markerTint[r]`; outlined (+ `accessibilityState.selected`) when `!disabled && state.pen === r`.
- Press a gap → `panel?.open(r, index of r's mark or null)`; when no panel (tests) nothing else.
- Filled + `!disabled` → ✕ (`accessibilityLabel` `Șterge cauza` / `Șterge efectul`) → `onRemove(index)`.
- Both filled + `!disabled` → testID `ce-check`: `Citește-o cu voce tare:` + `relationSentence(textOf(cause), textOf(effect))` + `Are sens?` `Dacă nu,` + button `⇅ Inversează` → `onSwap()`.
- `disabled` → no ✕, no `ce-check`, verdict badges as `MarkSlots` shows them today (reuse `VERDICT_TONE` / `VERDICT_LABELS`).

- [ ] **Step 1: Write the failing tests**:
  - empty state: both gaps show `Atinge ca să marchezi`; with `pen 'cause'` → `ce-gap-cause` selected, `ce-gap-effect` not.
  - both marked (`pen null`) → no gap selected; `ce-check` shows `Pentru că <cause text>, <effect text>.`; pressing `⇅ Inversează` calls `onSwap`.
  - ✕ on the effect gap calls `onRemove` with the effect's index.
  - `disabled` with `verdictOf` → no `ce-check`, no ✕, badges with `VERDICT_LABELS.ok` / `VERDICT_LABELS.no`.
  - `ExerciseInputs.test.tsx`: the cause-effect case asserts `↓ a dus la` and presses `⇅ Inversează` (renamed), still emitting swapped cause/effect.
- [ ] **Step 2: Run** `pnpm --filter @prepio/mobile test -- CauseEffectRelation ExerciseInputs` → FAIL.
- [ ] **Step 3: Implement** `CauseEffectRelation`; switch `CauseEffectInput` to it (keep `useMarksAnswer` as is; `onSwap` → `dispatch({ type: 'swapRoles' })`); remove the cause-effect branch from `MarkSlots` and its props type.
- [ ] **Step 4: Run** `pnpm --filter @prepio/mobile test -- CauseEffectRelation ExerciseInputs SourcePanel` and `typecheck` → PASS.
- [ ] **Step 5: Commit** `feat(mobile): cause-effect relation with the read-aloud check`.

---

### Task 7: Wire the banner into the source panel, the split and the reader

**Files:**
- Modify: `apps/mobile/src/components/marker/SourceReader.tsx` (`PanelMarker.clues?: boolean`; tray uses `CauseEffectTrayStep` instead of `PenBar` + hint for cause-effect)
- Modify: `apps/mobile/src/components/marker/SourcePanel.tsx` (banner after the prompt; no `PenBar` for cause-effect)
- Modify: `apps/mobile/src/screens/consolidation/ExerciseScreen.tsx:196` (`clues: true` on the marker built from `cfg`)
- Test: `apps/mobile/src/components/marker/SourcePanel.test.tsx`; `apps/mobile/src/screens/bac/BacPaperScreen.test.tsx` (one case)

**Interfaces:**
- Consumes: `CauseEffectBanner`, `CauseEffectTrayStep` (Task 5); `hintFor` (Task 2).
- Produces: `isCauseEffect(cfg: MarkerConfig): boolean` exported from `SourceReader.tsx` (`cfg.pens.includes('cause') && cfg.pens.includes('effect')`).

Rules:
- `SourcePanel`, cause-effect and `canMark(marker)`: render `<CauseEffectBanner state clues={!!marker.clues} />` right after the prompt in both layouts (column and split); the pens block becomes only the gesture hint line (`hintFor`) under the inline source(s), as today's position; no `PenBar`. Not `canMark` → no banner.
- `SourceReader` tray, cause-effect and `canMark`: `CauseEffectTrayStep` (sources = the reader's sources), then the gesture hint only when `state.anchor` or `state.pen === null`, then „Gata”. Other types: unchanged.
- `BacItemView` passes no `clues` (BAC never shows signal words).

- [ ] **Step 1: Write the failing tests** (`SourcePanel.test.tsx`, existing `ce` fixture and long/short sources):
  - short source, cause-effect, `clues: true` → `ce-banner` is rendered after the prompt text and shows `fiindcă`; no `pen-cause`.
  - same with `clues` absent → `ce-banner` without `fiindcă`.
  - `readOnly: true` → no `ce-banner`, `role-label-*` still rendered for the marks.
  - long source on a narrow window: open the reader → `ce-tray` present, no `pen-cause`, no `fiindcă` even with `clues: true`.
  - wide window (≥ 900, split) → `ce-banner` in the right column.
  - info exercise → `pen-info` still rendered, no `ce-banner` (unchanged).
  - `BacPaperScreen.test.tsx`: the cause-effect item shows `ce-banner` without `fiindcă`.
- [ ] **Step 2: Run** `pnpm --filter @prepio/mobile test -- SourcePanel BacPaperScreen` → FAIL.
- [ ] **Step 3: Implement** the wiring and `clues: true` in `ExerciseScreen`.
- [ ] **Step 4: Run** the full mobile suite and typecheck: `pnpm --filter @prepio/mobile test && pnpm --filter @prepio/mobile typecheck` and `pnpm --filter @prepio/shared test` → all PASS.
- [ ] **Step 5: Commit** `feat(mobile): cause-effect banner in the exercise, split and reader`.

---

### Task 8: Browser validation, status and hand-off

**Files:**
- Modify: `docs/STATUS.md`

- [ ] **Step 1: Run the stack** (detached): `pnpm db:start`, `pnpm --filter @prepio/mobile web` (:8081); a `[test]` student with full access and enough credits for the BAC paper (create, remove afterwards; seeded content intact).
- [ ] **Step 2: Walk at 360 px and at 1280 px**, console clean:
  - BAC „Istorie 2026 · Varianta 3”, requirement 5: banner without signal words; start with the effect (tap the „Efectul” gap) → reader opens on step 2; mark; tray switches to the cause; mark; „Gata” → relation shows „Pentru că …, ….”, ⇅ swaps and the CAUZĂ/EFECT labels follow; while idle a new drag is ignored and the hint says „Atinge golul pe care vrei să-l schimbi.”; ✕ makes the role current; leave and reopen the paper → restored idle with labels.
  - Desktop split: banner and relation on the right, labels on the left.
  - Consolidation cause-effect exercise: banner with signal words; „Verifică” → banner gone, labels and gap verdicts stay; the post-check „⇅ Inversează rolurile” (when roles are swapped) still works.
  - A source-info and a viewpoint exercise look exactly as before.
- [ ] **Step 3: Update `docs/STATUS.md`** (a dated line under „Where we are”: what changed, spec/plan paths, the browser check counts) and list for the owner's next APK: label pill and drag/handles on a real touch screen, the reader tray height with the mini gaps above the gesture bar, TalkBack reading of labels.
- [ ] **Step 4: Commit** `docs: status for cause-effect marking clarity`.
