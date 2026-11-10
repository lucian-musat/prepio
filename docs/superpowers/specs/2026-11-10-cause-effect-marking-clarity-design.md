# Cause-effect marking clarity — design

Date: 2026-11-10 · Status: draft for the owner's review
Mockup: `docs/design/2026-11-10-cause-effect-marking-mockup.html` (tabs „★ Recomandat”, „★ Telefon · sursă lungă”, „★ Web · desktop”; the other tabs are the explored alternatives and „Acum”).
The mockup is a throwaway prototype and a style guide; **where it differs from this document, this document wins.**

## Why

Owner feedback: in BAC subjects the text-selection part of the cause-effect requirement is ambiguous — the student
doesn't realise whether they are marking the cause or the effect. Analysis of today's UI (`MarkSlots`,
`SourceReader`, `markerReducer`):

1. The „Cauză” pen is active from the start, shown only by a border; the student drags without knowing they mark the cause.
2. The hint describes the gesture („Trage peste text…”), not the role.
3. After the cause, the pen switches to „Efect” silently (one grey line of text).
4. In the text, the role is only a colour (teal / peach), with no label.
5. „Cauză” / „Efect” are names, not criteria; the student isn't told how to decide („de ce?” / „ce a urmat?”).
6. The order is fixed: a student who finds the effect first marks it as the cause.
7. On the phone with a long source, the answer slots („↓ a dus la”) are hidden while marking in the full-screen reader.

## Goal

At every moment of a cause-effect requirement the student knows **which role they are marking now**, **what they
already marked as what**, and **whether the relation makes sense** — on the phone and on the web, in BAC papers and
in consolidation exercises (they share the components).

Non-goals: changing grading, the stored answer (`{ type: 'cause_effect', cause, effect }`), the barem, or the
marking gestures (drag / tap-tap / handles). Other marking types (source info, viewpoint support) keep their UI;
the in-text labels may be reused there later, not now.

Anti-goals: more taps to mark than today; giving away the answer in BAC mode.

## The design (owner chose A + B + C, phone and web)

Three pieces, each covering one moment:

### A — Step banner (before marking: „what am I marking now?”)

Under the prompt, above the source/answer, in the colour of the current role:

- eyebrow: „Pasul 1 din 2 · marchezi cauza” / „Pasul 2 din 2 · marchezi efectul”;
- the role as a question: cause „De ce s-a întâmplat ceva?”, effect „Ce s-a întâmplat din cauza asta?”;
- a two-segment progress bar (filled in the role's colour once marked);
- when both are marked: „✓ Gata, ambele roluri marcate”.

The banner doesn't repeat the marked texts (the relation below shows them; the mockup's „✓ Cauza: „…” schimbă”
lines are dropped). It shows only while the student can mark: hidden after checking and in read-only views.

**Signal words** („Caută motivul… stă de obicei după: fiindcă, deoarece, pentru că, cu scopul de a” / for the
effect „ca urmare, astfel, ceea ce, de aceea”) are shown **only in consolidation exercises, never in BAC papers**
(owner's decision). In consolidation they show in the banner on every layout (inline, long-source exercise view,
desktop), but not in the reader's tray. In BAC the banner shows only the eyebrow, the question and the progress. („💡 Cum rezolv”, which
the student opens on purpose, is unchanged.)

The banner replaces today's pen buttons („Cauză” / „Efect”) and the hint line for cause-effect. The gesture hint
(„Atinge ultimul cuvânt.” after a first tap) still shows when relevant.

### B — Labels in the text (while/after marking: „what did I mark as what?”)

Each cause/effect mark shows a small label pill **„CAUZĂ”** / **„EFECT”** (white on the role's dark ink) right
before its first word, in the inline source, the reader and the desktop split. The in-progress selection is
drawn in the current role's colour. The labels stay visible after checking (consolidation feedback) and in
read-only views. Accessibility: a marked word's label already says „marcat Cauză/Efect”; the pill itself is
hidden from screen readers.

### C — The relation (after marking: „does it make sense?”)

Replaces today's `MarkSlots` cause-effect layout:

- two gaps in a column: „CAUZA · DE CE?” ↓ a dus la ↓ „EFECTUL · CE A URMAT?”; each shows the marked text in quotes
  or „Atinge ca să marchezi”; the gap of the current role is outlined;
- **tapping a gap selects that role** (and on the phone with a long source opens the reader on it), so the student
  can start with the effect;
- a filled gap keeps its ✕ (remove) and opens the source at its mark, as today;
- when both are filled: „Citește-o cu voce tare: „Pentru că ‹cauza›, ‹efectul›.” **Are sens?** Dacă nu, ⇅ inversează”
  (both marks in full, as written in the source — no case change, since marks often start with a proper noun;
  only a trailing `.,;:` is dropped). „⇅ Inversează” replaces today's „⇅ Inversează rolurile” button in the answer
  area;
- after checking (consolidation) the gaps show their verdict badges, as the slots do today; no ✕, no swap. The
  post-check „⇅ Inversează rolurile” in `FeedbackView` (shown when `feedback.swapped`) stays as it is — out of scope.

### Order and auto-switch

The student may mark in either order. After a mark is committed the role switches to the other one while that
one is empty, **both ways** (today only cause → effect: `autoNext: { cause: 'effect', effect: 'cause' }`). The
banner and the outlined gap follow the current role.

**Once both are marked, no role is current** (no gap outlined, banner „✓ Gata”). A new selection then doesn't
silently replace a mark: it is dropped and the hint says „Atinge golul pe care vrei să-l schimbi.” Tapping a gap
(or a mini gap in the reader) makes that role current again, and the next selection replaces it. Adjusting a mark
with its handles and removing it with ✕ work as today (✕ makes that role current).

### Layouts

- **Phone, short source** (inline): prompt, banner, source with labels, relation (mockup „★ Recomandat”).
- **Phone, long source**: in the exercise — prompt, banner, the source card, the relation; tapping a gap or the
  card opens the reader. **In the reader's tray**, instead of the pen buttons: a compact step line (eyebrow +
  question; no signal words, even in consolidation — no room) and two mini gaps „Cauza → Efectul” (role name + the
  start of the marked text or „nemarcat”; tapping one selects that role), then „Gata”. The reader's minimap and
  the rest stay (mockup „★ Telefon · sursă lungă”).
- **Desktop ≥ 900 px** (split): source with labels on the left; on the right the prompt, the banner and
  the relation (mockup „★ Web · desktop”).

## Calls made without the owner (check these)

- The prompt stays first, the banner under it (as in the app today).
- Once both roles are marked, a new selection is ignored until a gap is tapped (instead of silently replacing the last role).
- „Pentru că X, Y.” keeps the source's capitalisation and the full marks.
- The banner hides after checking / in read-only views; it doesn't repeat the marked texts.
- `FeedbackView`'s post-check swap stays unchanged.
- Auto-switch goes both ways (effect → cause too).

## Constraints

- Mobile app (Expo / React Native, also the student web build); shared components in `apps/mobile/src/components/marker`
  and `components/consolidation`. Colours from `markerPen` plus dark ink tones for labels/borders (add them to the
  theme, AA-checked like the pens).
- Copy in Romanian; diacritics with commas.
- Owner's testing rule: browser walk at 360 px and desktop, console clean; native-only behaviour (reader on device,
  gestures around the label pills) listed for the owner to check on the next APK.

## Left to the builder

- How the label pill sits in `MarkableText`'s measured word flow without breaking hit-testing, handles and
  scroll-to-mark.
- How the BAC / consolidation context reaches the banner (e.g. a flag on the panel marker).
- Component boundaries (a new `CauseEffectBanner` / `CauseEffectRelation`, or extending `MarkSlots`), test layout,
  exact spacing and type roles (follow the mockup and the design system).
