# Numbered marks in their own colours — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On `source_info` / `viewpoint` requirements with `count` > 1, every mark gets its own colour, an „INFO n” / „SUPORT n” pill, a step banner, and the student chooses which slot a new selection fills.

**Architecture:** A `numbered` flag on `MarkerConfig` turns on slot-aware marking in `markerReducer` (marks carry `slot`, the state carries the current `slot`). Painting (text, minimap, slots, banner) reads colour and pill from one helper module `numbered.ts`. Single-mark and cause-effect paths are untouched.

**Tech Stack:** React Native + Expo (web), Jest + RNTL, `@prepio/shared` theme.

**Spec:** `docs/superpowers/specs/2026-11-11-multi-mark-colors-design.md`

## Global Constraints

- Palette: 1 `#FFE38A` / ink `#7A5A00` / tint `#FFF8DC`; 2 `#C9D7FF` / `#2F4BA8` / `#EEF2FF`; 3 `#FBCFE8` / `#9D1F63` / `#FDF0F7`; AA: `color.text` on bg and tint ≥ 4.5, white on ink ≥ 4.5, ink on tint ≥ 4.5.
- Pills: „INFO 1”… (info), „SUPORT 1”… (support).
- Copy: eyebrow „Informația 1 din 2” / „Informația-suport 1 din 2”; headline „Marchezi prima informație” / „a doua informație” / „a treia informație”; done „✓ Gata, toate informațiile marcate” + „Atinge un slot sau un marcaj ca să-l schimbi.”; idle hint „Atinge informația pe care vrei s-o schimbi.”
- `count` = 1 and cause-effect: no visible change. Stored answer shape, grading, API: unchanged.

## Review Focus

- Saved answer with 2 marks reloads (BAC autosave, consolidation restore) → marks in slots 1, 2 in saved order, no current slot (idle) → Task 2 test `initialMarker assigns slots in order`.
- Remove slot 1 while slot 2 is filled → slot 2 keeps „INFO 2” and blue; saved answer lists only that mark → Task 2 + Task 4 tests.
- Handle drag of mark 2 → it stays slot 2 after the drop; cancel puts it back with its slot → Task 2 test.
- After checking (read-only) the pills and colours stay, slots show verdicts on the right slot → Task 4 test with `verdictOf`.
- A selection overlapping slot 1 while filling slot 2 → slot 1 emptied, the new mark is slot 2 → Task 2 test.

---

### Task 1: Palette `markerSlot`

**Files:** Modify `packages/shared/src/theme.ts` (next to `markerPen`), `packages/shared/src/theme.test.ts`.

**Produces:** `export const markerSlot: readonly { bg: string; ink: string; tint: string }[]` (3 entries, values above), exported from `@prepio/shared`.

- [ ] Test `markerSlot: three AA-checked numbered colours` — exact values, plus the four contrast checks per entry.
- [ ] Run `pnpm --filter @prepio/shared test theme` → FAIL; implement; → PASS; commit.

### Task 2: Numbered marker (reducer + config + answer order)

**Files:** Modify `apps/mobile/src/components/marker/markerReducer.ts`, `markerReducer.test.ts`, `apps/mobile/src/screens/consolidation/checking.ts` (+ its test), `apps/mobile/src/components/consolidation/inputKit.ts`.

**Produces:**
- `MarkerConfig.numbered?: boolean`; `MarkerMark.slot?: number` (0-based); `MarkerState.slot?: number | null` (current slot, only in numbered mode).
- Action `{ type: 'setSlot'; slot: number }`.
- `markerConfig()` sets `numbered: true` for `source_info` / `viewpoint` when `count > 1`.

Behaviour (numbered only):
- `initialMarker`: marks without `slot` get their index among the pen's marks; `slot` = first empty slot in `0..limit-1` or null; `pen` = null when slot is null.
- commit: overlapping marks go (any slot), the mark with the same slot goes, push `{…, slot}`; next `slot` = first empty or null (then `pen` null). A lifted handle drag commits into the lifted mark's slot.
- `tap` on an existing mark with no anchor: as today (toggles `active`) and also `slot` = that mark's slot, `pen` = cfg.pens[0].
- `setSlot`: `slot`, `pen` = cfg.pens[0], `anchor` null.
- `setPen` with `slot` null: only clears the anchor (stays idle).
- `remove`: `slot` = removed mark's slot, `pen` = its pen.
- `useMarksAnswer`'s `of(pen)` returns the pen's marks sorted by `slot ?? index`.

- [ ] Tests (`describe('numbered')`, cfg `{ pens: ['info'], limits: { info: 2 }, numbered: true }`): fills slot 0 then 1 then goes idle (`pen` null, `slot` null); a third selection when idle is ignored; `setSlot(0)` then a selection replaces slot 0 only and goes idle again; `remove` of slot 0 keeps slot 1's mark with `slot: 1` and makes slot 0 current; overlap with slot 0 while filling slot 1 → only the new mark, `slot: 1`, then current slot 0; tapping mark of slot 1 makes slot 1 current; handle drag of slot 1 drop → `slot: 1`; `cancel` mid-drag → restored with `slot: 1`; `initialMarker assigns slots in order` and starts idle when full, at slot 1 when one mark; non-numbered `support` limit 2 still drops the oldest (existing test stays).
- [ ] `checking.test`: `markerConfig` numbered for count 2, not for count 1.
- [ ] Run `pnpm --filter @prepio/mobile test markerReducer checking` → FAIL; implement; → PASS; commit.

### Task 3: Colour and pill in the text and the minimap

**Files:** Create `apps/mobile/src/components/marker/numbered.ts`; modify `MarkableText.tsx` (+ test), `SourceReader.tsx` (minimap).

**Produces (`numbered.ts`):**
- `markBg(m: { pen: Pen; slot?: number }): string` — `markerSlot[slot].bg` when `slot` set, else `markerPen[pen]`.
- `slotPill(pen: Pen, slot: number): { label: string; ink: string }` — „INFO n” / „SUPORT n”, `markerSlot[slot].ink`.
- `SLOT_NOUN: Record<'info' | 'support', string>` = „Informația” / „Informația-suport”; `ORDINAL = ['prima', 'a doua', 'a treia']`.

MarkableText: the word background uses `markBg`; the pill map becomes `{ label, ink }` for role marks (existing CAUZĂ/EFECT) and for marks with `slot`; a drag paints with the dragged slot's colour (`drag.lifted?.mark.slot` or `state.slot`). Accessibility label: „…, marcat INFO 1”.

- [ ] Tests: a numbered state with two marks renders `role-label-<from>` texts „INFO 1” / „INFO 2” and word backgrounds `#FFE38A` / `#C9D7FF`; support → „SUPORT 2”; a non-numbered info mark has no label (existing tests keep passing).
- [ ] Run, implement, pass, commit.

### Task 4: Slots

**Files:** Modify `MarkSlots.tsx` (+ new `MarkSlots.test.tsx` or extend `SourcePanel.test.tsx` pattern), `SourceInfoInput.tsx`, `ViewpointInput.tsx`.

- `MarkSlots` finds slot k's mark by `m.slot === k` when the marks carry slots (else the k-th as today); the bar uses `markBg`; a numbered filled slot's title row shows the pill then „Informația k”; the empty one shows pill + „Informația k: marchează în text”; the current slot (`state.slot === k`, not disabled) has a 2 px border in the slot ink.
- `onOpen(pen, markIndex, slot)`: the inputs dispatch `setSlot` when `marker.cfg.numbered`.

- [ ] Tests: slot 2 filled and slot 1 empty after a remove → slot 1 empty with „INFO 1”, slot 2 shows its text with „INFO 2”; pressing the empty slot dispatches `setSlot` 0; verdict lands on the slot of the matching mark; count 1 renders as today (no pill).
- [ ] Run, implement, pass, commit.

### Task 5: Step banner and reader tray

**Files:** Create `apps/mobile/src/components/marker/NumberedBanner.tsx` (+ test); modify `SourcePanel.tsx`, `SourceReader.tsx` (`hintFor`, tray).

**Produces:** `NumberedBanner({ cfg, state })` (testID `num-banner`) and `NumberedTrayStep({ cfg, state })` (compact: eyebrow + pill + headline + progress); `isNumbered(cfg) = !!cfg.numbered`.

- Banner tone: current slot → border ink, background tint; idle → done style like `CauseEffectBanner`. Progress: one segment per slot (testID `num-progress-k`), filled with the slot's ink. When the current slot is filled: eyebrow suffix „ · o refaci”.
- `SourcePanel`: numbered → the banner under the prompt (both layouts) and no `PenBar`, like cause-effect. Reader tray: `NumberedTrayStep` instead of `PenBar`.
- `hintFor`: numbered and idle → „Atinge informația pe care vrei s-o schimbi.”

- [ ] Tests: copy for slot 0 of 2, slot 1 of 3 („a doua”), idle done copy, support eyebrow, progress colours; SourcePanel with numbered cfg shows `num-banner` and no `pen-info`.
- [ ] Run, implement, pass, commit.

### Task 6: Verify, document, ship

- [ ] `pnpm typecheck`, `pnpm test` (mobile + shared), lint.
- [ ] Browser walk (headless Chromium, local stack, `[test]` student), 360 touch and 1280: BAC Varianta 3 requirement with two informations (reader on phone, split on desktop), a consolidation `source_info` count 2 with „Verifică”, a viewpoint count 2; remove / redo / idle hint; reload keeps marks; single-mark and cause-effect unchanged; console clean.
- [ ] `docs/STATUS.md` entry; native checks for the owner (pills and colours on the phone).
- [ ] PR, CI green, merge per CLAUDE.md.
