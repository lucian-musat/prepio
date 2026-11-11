# Numbered marks in their own colours — design

Date: 2026-11-11 · Owner request · Mockup `docs/design/2026-11-11-multi-mark-colors-mockup.html` (variant B chosen)

## Why

On requirements that ask for several marks in the source — „Precizați două informații…” (`source_info`, `count` > 1)
and „Punct de vedere” with two or three supporting pieces (`viewpoint`, `count` > 1), in BAC papers and in
consolidation — every mark has the same colour and no number. The student can't tell which mark is which slot, and
once every slot is full a new selection silently replaces the oldest one (and the slot numbers shift). The owner
wants each mark to have its own colour and a pill like the CAUZĂ / EFECT ones, so it is very clear what the student
is marking.

## Goals

- Each mark of a numbered requirement has its own colour: 1 yellow, 2 blue, 3 pink.
- A pill before the mark in the text: „INFO 1”, „INFO 2”… for `source_info`, „SUPORT 1”… for `viewpoint`
  (owner chose variant B). Kept after checking, like the CAUZĂ / EFECT pills.
- The slot under the source shows the same colour on its bar and the same pill in its title
  („INFO 1 · Informația 1” style: pill + title).
- A step banner under the prompt replaces the single pen button: eyebrow „Informația 1 din 2” (or
  „Informația-suport 1 din 2”), headline „Marchezi prima informație” / „a doua” / „a treia”, the pill, and a
  progress bar with one segment per slot in the slot's colour once filled. All filled: „✓ Gata, toate informațiile
  marcate” + „Atinge un slot sau un marcaj ca să-l schimbi.” The reader tray on the phone shows a compact version.
- The student chooses what to redo:
  - the current slot is the first empty one;
  - pressing a slot (filled or empty) or tapping a mark in the text makes that slot current;
  - a new selection fills the current slot (replacing its mark), then the first empty slot becomes current;
  - when every slot is filled and none was chosen, a new selection is ignored and the hint says
    „Atinge informația pe care vrei s-o schimbi.”;
  - removing a mark (✕) leaves its slot empty and makes it current; other slots keep their number and colour.
- Colours: AA-checked like `markerPen` (text on the background ≥ 4.5; white on the ink ≥ 4.5; text on the tint ≥ 4.5).
  Turquoise and peach stay reserved for cause / effect.

## Non-goals

- Requirements with one mark (`count` = 1) stay exactly as today (yellow info / blue support, pen button, no pill).
- Cause-effect is unchanged.
- Grading, the stored answer shape and the API are unchanged. No migration, no new native module.

## Decisions

- Palette (`markerSlot` in `@prepio/shared` theme, documented exception like the pens):
  1 `#FFE38A` / ink `#7A5A00` / tint `#FFF8DC`; 2 `#C9D7FF` / `#2F4BA8` / `#EEF2FF`; 3 `#FBCFE8` / `#9D1F63` / `#FDF0F7`.
  The same sequence for info and support (my call: support 1 is yellow, not its single-mark blue).
- Slot identity lives on the marker's marks (`slot` index); the saved answer keeps the marks ordered by slot.
  An empty slot between filled ones is not stored, so after a reload the marks are compacted into slots 1..n
  (my call: rare and harmless).
- The numbered mode is on when the exercise has a single pen and `count` > 1 (`markerConfig` sets it).
- A selection overlapping another slot's mark removes that mark (as today, overlapping marks go).
- Dragging a handle keeps the mark's slot.

## Left to the builder

Component split, exact copy of the compact tray step, test layout.
