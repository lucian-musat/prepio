# Lesson zones and BAC consolidation exercises — design

Date: 2026-11-05
Status: builder check done, waiting for the owner's approval

## Intent

A lesson becomes three zones, in this order:

1. **Învățare** (learning): the cards, unchanged.
2. **Verificare** (check): the existing questions (single choice, multiple choice, chronological order). Passing it finishes the lesson, exactly as the test does today in both learning modes.
3. **Consolidare** (consolidation): a new zone that opens once the lesson is finished. It contains only exercises modelled on the written BAC history exam (reference: `E_c_istorie_2026_var_03_LRO`, Subiectele I–III). Each exercise has a "Cum rezolv" button that opens a **solution template** (șablon de rezolvare): how to solve this kind of requirement to get full marks. Templates live in a separate admin library because many exercises share one, and only the statement differs.

Why: the owner wants students to learn, check what they learnt, and then practise exactly what the BAC asks, with clear guidance instead of grades. Today the AI-graded writing exercises sit inside the lesson test and always count as correct (a temporary workaround, `docs/STATUS.md`). This feature gives them, and a whole family of BAC-shaped requirements, a proper home.

Answers in consolidation are **not scored**. The student gets guidance only: one of three verdicts, „Corect”, „Aproape” or „Mai lucrează”, plus what was good and what to improve. The answers are checked **without AI wherever possible**. AI is used only where a free text has to be judged, and every AI-checked exercise **must** carry a context written by the admin, which the AI evaluates against.

For now every consolidation exercise stands alone, with its own statement and sources. A later feature will build whole BAC subjects (one or two sources plus several requirements). The pieces built now (sources, requirement types, checkers, the marker, the reader, the AI evaluation) must be reusable for that without rework.

## Approved mockups

Approved by the owner, 2026-11-05 („e perfect”). They are interactive and the behaviour and copy in them are part of this spec. The visual style comes from `docs/design-system.md`.

- `docs/design/2026-11-05-consolidation-types-mockup.html`: the lesson flow (zones, end screens) and one screen per exercise type, with the side notes „Cum se verifică” and „Ce completezi în admin”. The marker interaction ("perfect" per the owner) is defined here.
- `docs/design/2026-11-05-consolidation-long-sources-mockup.html`: how long sources are shown (a preview card plus a full-screen reader on the phone, side by side on desktop). It supersedes the inline sources of the first mockup for long texts.

## Goals

1. Lessons show the three zones. Consolidation is locked until the lesson is finished, and it never blocks the next lesson.
2. Ten consolidation exercise types (below), each with an admin editor and a student screen matching the mockups.
3. A solution-template library in the admin. Templates are attached to exercises (and to individual essay requirements).
4. Text selection on sources with the **marker**: free, word-level selection on the real text. The text is never pre-split into visible chunks.
5. Deterministic checking for short answers, source letters, information selected from a source and cause-effect relations. AI checking for presented facts, comparisons, points of view, arguments and the essay, always against the admin's context.
6. The essay is split per requirement: one input and one feedback per requirement, then a whole-essay feedback on the writing criteria.
7. The existing writing exercises move out of the lesson test, so passing a lesson depends only on the Verificare questions.

## Non-goals

- Scores, points or grades in consolidation (the BAC points appear only as information inside templates).
- Whole BAC subjects (several requirements sharing sources): a later feature, which reuses this one's pieces.
- Showing student answers or progress in the admin (user-management topic).
- AI credits per account (separate roadmap item).
- Teacher review of AI feedback.
- History of attempts: only the latest attempt per exercise is kept.

## Anti-goals

- A marker that is fiddly on a phone: accidental marks while scrolling, or not being able to adjust a mark once made.
- Pre-chunked source text that gives the answer away.
- An AI verdict produced without the admin's context, or AI used where a deterministic check would do.
- "Corect" for a wrong answer because the matching is too loose (for example typo tolerance turning „XV” into „XIV”).
- Losing existing content: the current writing exercises are migrated, not deleted.
- A long source turning the exercise screen into a wall of text.

## Lesson flow

### Zones and completion

- The lesson start screen lists the three zones (first screen of the flow mockup): Învățare (n carduri), Verificare (n întrebări), Consolidare (n exerciții tip BAC), each with its state. The existing buttons stay: „Începe învățarea”, „Știu deja — sari la exerciții” (now „…sari la verificare”, Claude may polish the wording) and „Continuă de unde ai rămas”.
- The lesson phases become `start → cards → questions → done`. The `exercises` phase disappears. A saved position with phase `exercises` is treated as invalid by `resumePoint` (the lesson starts at the start screen).
- Finishing a lesson is unchanged in both modes: in guided mode, all questions correct; in free mode, reaching the end of Verificare.
- **Consolidation is locked until the lesson is finished** (`lesson_progress.finished_at` set), in both modes. A locked Consolidare zone is dimmed with the hint „Se deschide după ce termini verificarea”. A lesson without consolidation exercises doesn't show the zone.
- The end screens (guided pass, free done) gain the „Consolidare deblocată” card and two buttons, „Începe consolidarea” (primary) and „Mergi la lecția următoare” (or „Înapoi acasă” on the last lesson), as in the second flow screen. The guided failure screen is unchanged.
- Consolidation never affects locks or finished state.

### Consolidation run

- Consolidation has its own route (for example `/lesson/[id]/consolidare`) and a progress bar „n/N”. Exercises come in the admin's order.
- Each exercise screen has the type chip, the „💡 Cum rezolv” button (only if a template is attached), the statement, the sources, the answer inputs and „Verifică”. After feedback: „Continuă” and „Încearcă din nou” (which clears the inputs and the feedback of that exercise).
- The verdict and feedback appear inline under the answer. For AI types, a loading state („Se analizează răspunsul…”) runs, followed by a note „Feedback generat cu AI pe baza indicațiilor profesorului. Poate greși.”
- After the student has checked an answer, a „Vezi răspunsul” or „Vezi un răspuns model” disclosure appears whenever the exercise has one.
- The end screen („Consolidare parcursă”) lists every exercise with its latest verdict and offers three buttons: „Reia consolidarea” (starts at exercise 1 with empty inputs), „Reia doar ce nu a fost corect” (cycles through the exercises whose latest verdict isn't „Corect”, hidden when all are correct) and „Mergi la lecția următoare”.
- **Persistence:** the latest attempt of each exercise is saved to the account (answer, verdict, feedback), so the end-screen summary works on any device. A finished AI feedback is never re-requested just to be shown again.
- **Runs (Claude's call):** a run is the ordered list of exercise ids being worked through plus the current index. It is stored per student and lesson in `consolidation_runs`.
  - „Începe consolidarea” and „Reia consolidarea” start a run over all exercises.
  - „Reia doar ce nu a fost corect” starts a run over the exercises whose latest verdict isn't „Corect”.
  - Starting a run never deletes attempts. Inside a run, an exercise opens with empty inputs, and its new check overwrites the stored attempt.
  - Opening consolidation with an unfinished run resumes it at its index. With a finished run, or no run but attempts for every exercise, it opens on the end screen. Otherwise it starts a new full run.
  - Exercise ids in a run that no longer exist, or are no longer valid, are skipped.

## Sources

- A **source** is a text with a citation (author, work). Sources belong to a lesson and are managed in the lesson's Consolidare tab. One source can be used by several exercises of the lesson.
- An exercise uses zero, one or two sources. With two, they are labelled A and B. In the future a BAC subject will reference sources the same way.
- The text keeps paragraphs (blank line between them). „[...]” omission marks are rendered muted.
- **Short sources** (under ~70 words, measured automatically) are shown inline in the exercise, in a card.
- **Long sources** on the phone (long-sources mockup):
  - The exercise screen shows a preview card: an icon with the letter, „Sursa B”, the author, the paragraph count and an estimated reading time, the first lines faded out, and „📖 Citește și marchează”.
  - The card opens a full-screen reader that slides up. It has:
    - a top bar with ✕, the source title and the citation;
    - the requirement pinned on one line below it, which expands on tap;
    - the text in a reading typeface (serif, ~17 px, generous line height);
    - a bottom tray with the markers (✓ when used), a one-line hint for the next step and „Gata”;
    - a thin minimap on the right showing where marks are.
  - Tapping an answer slot opens the reader with that marker selected and scrolls to the existing mark.
  - With two sources the reader shows A / B tabs.
  - Exercises that only need reading (short answer, letter) use the same card and reader, without the tray's markers.
- **Desktop (≥ ~900 px):** the source fills a left column (its own scroll, ~62 characters per line, A / B tabs). The statement, markers, answer and „Verifică” sit on the right. There is no separate reader.
- **Reading typeface:** the mockup uses Literata. Adding one serif family (regular and medium) to the app's fonts is the builder's call, as long as Romanian diacritics are covered.

## The marker

This is the interaction approved in both mockups:

- The student marks words directly in the text:
  - **Drag:** with a mouse, drag immediately. On touch, press and hold ~280 ms (haptic tick), then drag; a normal swipe keeps scrolling.
  - **Tap-tap:** tap the first word (it gets a blinking dashed outline and the hint „Atinge ultimul cuvânt al informației.”), then tap the last word.
- Marks always snap to whole words. When a mark is checked, any leading or trailing punctuation and quotation marks are ignored.
- Tapping a mark selects it and shows round handles at its two ends. Dragging a handle adjusts that end.
- A mark can be removed from its answer slot (✕).
- Pens: „Informație” (yellow), „Cauză” (teal), „Efect” (peach), „Informație-suport” (blue). Only the pens the exercise needs are shown.
- A new mark that overlaps an existing one replaces it. Once a pen reaches its limit, a new mark from that pen replaces that pen's oldest mark.
- In cause-effect, after the cause is marked, the selected pen switches to „Efect” automatically.
- The answer slots under the source show each mark's text in quotation marks, in the pen's colour. Cause-effect shows „Cauză ↓ a dus la ↓ Efect” plus „⇅ Inversează rolurile”.
- After checking, every mark gets a coloured underline for its verdict: green, amber or red.
- **Native:** text can't be hit-tested inside one `Text` on Android. Words are rendered as individual measured elements, and the gesture (react-native-gesture-handler, already a dependency) hit-tests against their layout. This is native behaviour that can't be fully validated on web; the owner tests it on the phone.

### How marks are matched (no AI)

- In the admin, the correct information is marked on the same source text. Each marked piece is an **answer span**:
  - a **core**: the words that must be included;
  - a **limit**: the furthest the student's mark may extend. It defaults to the sentence containing the core. The admin can widen it, for example when the information runs into the next sentence.
- Sentence detection must not split on abbreviations or initials („Al. I. Cuza”).
- A student mark against an answer span gets one of these verdicts:
  - **ok**: it contains the whole core and stays within the limit;
  - **long**: it contains the whole core but exceeds the limit („Ai selectat și o informație în plus”);
  - **short**: it overlaps the core but misses part of it („Ai prins doar o parte…”);
  - **none**: no overlap.
- A mark takes its best verdict across all answer spans. When an exercise asks for N marks, two marks matching the same answer span count once.
- **Storage:** answer spans are stored as character offsets into the source plus the quoted text. If a source is edited after spans were marked, the spans are re-anchored by their quoted text. A span that can't be re-anchored is flagged in the admin, and the exercise fails validation until it is fixed. It must never silently go wrong for students.
- **Saving a source that detaches spans (Claude's call):** the save is allowed, after a confirmation that lists the affected exercises. The detached spans are flagged in those exercises' forms. Students never see an invalid exercise: the student loader drops exercises that fail validation (and logs it), and n/N and the summary count only the valid ones. A lesson whose exercises are all invalid shows no Consolidare zone.

## Exercise types

Every type has: a statement (required); sources (per type); a solution template (optional, but the admin warns when it is missing); and an optional model answer or explanation that is shown after the student checks.

„AI context” means a required text field written by the admin. It goes to the AI with the student's answer (see "AI evaluation").

| # | Type (UI name) | BAC requirement | Student input | Check |
|---|---|---|---|---|
| 1 | Răspuns scurt | „Numiți…”, „Precizați secolul…”, „Menționați conducătorul…” | one short field | no AI: accepted variants |
| 2 | Răspunsuri multiple | „Menționați două spații / informații…” | N short fields | no AI: groups of variants |
| 3 | Informație din sursă | „Precizați, din sursa A, o informație…”, „Menționați două informații…” | 1–N marks („Informație”) | no AI: answer spans |
| 4 | Litera sursei | „Scrieți litera sursei care susține că…” | choice A / B | no AI |
| 5 | Cauză-efect | „Scrieți o relație cauză-efect… precizând rolul fiecăreia” | one „Cauză” mark and one „Efect” mark | no AI: valid pairs |
| 6 | Prezentare fapte | „Prezentați două fapte istorice din perioada…” | N text fields (one per fact) | AI, per fact |
| 7 | Asemănare / deosebire | „Menționați o asemănare / deosebire între…” | one text field | AI |
| 8 | Punct de vedere | „Formulați un punct de vedere…, susținându-l cu două informații selectate din sursă” | text plus N marks („Informație-suport”) | mixed: marks without AI, the point of view and the support with AI |
| 9 | Argumentare | „Argumentați, printr-un fapt istoric relevant, afirmația…” | one text field | mixed: connectors without AI (live), the fact with AI |
| 10 | Eseu pe cerințe | Subiectul III | one text field per requirement | AI per requirement, then the whole essay |

Per type:

1. **Răspuns scurt.**
   - **Admin sets:** the accepted variants (one per line), and optionally common wrong answers, each with its own message.
   - **Matching:** the comparison ignores case, diacritics (both the comma and the cedilla forms ș/ş, ț/ţ), punctuation and repeated spaces.
   - **Centuries and years:** they are normalised: „XIV”, „14”, „al XIV-lea” and „secolul al XIV-lea” are equal.
   - **Typo tolerance:** a Levenshtein distance ≤ max(1, ⌊length/8⌋) is accepted as „Corect, atenție la scriere: <forma corectă>”. It applies only to answers of 5 or more letters that contain no digits or Roman numerals.
   - **Verdicts:** a common wrong answer shows its own message as „Mai lucrează”. Anything else is also „Mai lucrează”, with a generic nudge („Caută în sursa B cuvântul…” comes from the explanation field).
2. **Răspunsuri multiple.**
   - **Admin sets:** N (how many answers are asked for) and the accepted **groups**. Each group is one answer with its synonyms (Țara Românească / Muntenia / Valahia). There can be more groups than N.
   - **Matching:** each field is matched like type 1. Two fields in the same group count once („Ai scris același … de două ori”).
   - **Verdict:** each field gets its own colour. The overall verdict is „Corect” when N distinct groups are hit, „Aproape” when some are, and „Mai lucrează” when none are.
3. **Informație din sursă.**
   - **Admin sets:** N and the answer spans (as many as wanted).
   - **Verdict:** N distinct ok marks is „Corect”. Any ok, long or short among them is „Aproape”, with the specific message. Otherwise „Mai lucrează”.
   - The disclosure lists all the correct information.
4. **Litera sursei.**
   - Reuses the existing single-choice option UI, with the sources as tabs.
   - **Admin sets:** the correct letter, and optionally an evidence span in the correct source, which is highlighted after checking.
5. **Cauză-efect.**
   - **Admin sets:** the valid **pairs** (the "set of variations"). Each pair has a cause span and an effect span, plus an optional explanation.
   - **Same-sentence pairs:** when the cause and the effect sit in the same sentence, the limit of each excludes the other's core.
   - **Verdicts:**
     - Both match the same pair, both ok: „Corect”.
     - Both match the same pair but one is long or short: „Aproape” (incomplete or too much).
     - The cause matches a pair's effect and the effect matches its cause: „Aproape: ai inversat rolurile”, with an „⇅ Inversează rolurile” button.
     - Each mark is valid on its own, but they come from different pairs: „Mai lucrează”, „…dar nu sunt legate între ele”.
     - Otherwise: „Mai lucrează”, with the connector hint („fiindcă”, „ca urmare”, „cu scopul de a”).
   - The disclosure lists the valid pairs.
6. **Prezentare fapte.**
   - **Admin sets:** N, the AI context (period, topic, reference facts, notes such as „menționarea simplă nu e prezentare”) and a model answer.
   - **AI output:** one verdict and feedback per fact.
   - **Instant checks without AI:** an empty or very short field, and the same text twice.
7. **Asemănare / deosebire.**
   - **Admin sets:** the variant (asemănare / deosebire), the AI context (the actions and the accepted similarities or differences) and a model answer.
8. **Punct de vedere.**
   - **Admin sets:** the source, N, the answer spans for the support (matched as in type 3), the AI context (topic, period, examples of good and bad points of view) and a model answer.
   - **AI input:** the point of view plus the marked texts. The AI judges whether it is a real appreciation on the right topic and period, and whether each mark supports it.
   - **Feedback:** three blocks: the point of view, information 1, information 2. A mark that fails the deterministic check is reported as such; the AI isn't asked about it.
9. **Argumentare.**
   - **Admin sets:** the statement to argue and the AI context (period, relevant facts).
   - **Connectors:** two chips under the field, „Conector de cauzalitate” and „Conector de concluzie”, light up live as the student types. The detection is deterministic and diacritic-insensitive. The connector lists are global, defined in code (`deoarece`, `pentru că`, `întrucât`, `fiindcă`, `din cauza`, `datorită`, `ca urmare` / `așadar`, `prin urmare`, `în concluzie`, `deci`, `astfel`, `în consecință`).
   - **Fact:** the AI judges the historical fact (relevant, in the period, presented rather than only named) and receives the connector result so it doesn't contradict it.
10. **Eseu pe cerințe.**
    - **Admin sets:** the essay topic and a list of 1–6 requirements (1 is allowed so the migrated writing exercises stay valid). Each requirement has its text, its AI context, an optional model answer, an optional solution template and an optional „argument” flag. The flag turns on the connector chips for that requirement.
    - **Student screen:** collapsible cards, one per requirement, each with a state chip (Necompletat / Corect / Aproape / Mai lucrează), a field, a character count and „Verifică cerința”. A requirement can be checked on its own, at any time.
    - „Verifică eseul întreg” is enabled once every requirement has text. It sends all the parts in order and returns feedback on the writing criteria from the BAC note: historical language, structure, cause-effect relation, the argument, chronological or logical order, and length.
    - The exercise's verdict for the summary is the whole-essay verdict if it exists. Otherwise it is „n din N” requirements correct.
    - **My call (owner to check):** there are no separate introduction or conclusion fields. The whole-essay check judges structure from the parts.

## Solution templates (admin library)

- New admin page „Șabloane de rezolvare”, reached from the main navigation. It has a list (title, type, number of exercises using it), create, edit and delete.
- A template has:
  - a **title** („Cum construiești o relație cauză-efect”);
  - an optional **type** filter, so the exercise form suggests the matching templates first;
  - a **BAC points line** („7 puncte: 2 + 2 informații, 3 relația”);
  - a **body** in the existing formatted-text Markdown subset with callouts, edited with the existing toolbar. The mockup's „Pașii / Exemplu / Atenție” sections are written as headings, a list and callouts.
- **Student side:** a bottom sheet (on desktop a side panel or a modal, builder's call) with the type label, the title, the points line, the rendered body and „Am înțeles”.
- A template in use can't be deleted. The admin says how many exercises use it.

## AI evaluation

- **Endpoint:** a new authenticated endpoint on the admin app (for example `/api/consolidation/evaluate`). It reuses the existing pieces:
  - bearer auth, CORS / Origin checks and the per-request nonce delimiters;
  - the OpenAI client and the model from `ai_settings`;
  - the owner's rules from `ai_settings.rules`;
  - the rate limits.
- **Request:** the exercise id, the essay requirement id (or „whole essay”) and the student's answer. The **server** loads the exercise, the sources, the admin context and the model answer. The client never sends the context.
- **Deterministic parts:** the connector check and the marker results are recomputed on the server from the stored answer spans, so the AI prompt gets trustworthy facts.
- **Structured output:**
  - per evaluated item: `verdict: 'ok' | 'almost' | 'no'`, `good: string[]`, `improve: string[]`;
  - optionally a short `model` hint.
  - The output is in Romanian with comma diacritics and has no grade. The prompt builder keeps one function per type, all sharing the common instructions.
- **Context is mandatory:** an AI-checked exercise or essay requirement can't be saved, let alone published, without its context.
- **Rate limits:** the essay alone can take 5 calls, so the per-student limit rises from 10 to 30 evaluations per hour (constant, owner may tune). The global cap of 300 per day stays.
- **Existing grade settings:** `ai_settings.grade_min` / `grade_max` are no longer used by anything. They are hidden from admin Settings and the columns stay (no destructive change). `/api/evaluate` is removed together with the writing exercises it served.

## Admin

- **Lesson editor tabs:** Carduri · Întrebări (renamed „Verificare”, content unchanged) · **Consolidare** (new). „Exerciții de redactare” goes away after the migration.
- **Consolidare tab:**
  - **Surse:** a list of the lesson's sources, with add, edit and delete. A source used by an exercise can't be deleted.
  - **Exerciții:** a list with reordering (drag / ↑↓, as with cards) and a form per type, picked through a type picker as with cards.
- **Exercise form:**
  - a statement, a source picker (0–2, labelled A / B) and the type's fields;
  - a template picker (suggested templates first, with a warning when none is chosen);
  - a model answer or explanation;
  - for AI types, the required „Context pentru AI”, with helper text explaining what to write.
- **Marking answer spans:** the admin is a desktop tool, so it uses the browser's native text selection on the rendered source. The admin selects text and presses „Marchează ca răspuns corect” (or „Cauză” / „Efect” for the pair being built). Marks are shown as highlights. Clicking one lets the admin delete it or widen its limit to the next or previous sentence.
- **Validation:** shared validators (as `validateCard`) run in the admin and on load. They enforce:
  - a required statement;
  - required sources per type;
  - at least N groups or spans;
  - at least one valid pair;
  - the AI context;
  - 1–6 essay requirements;
  - no detached spans.
- **Preview:** a live student preview, as for cards, is **not** part of this feature (see Out of scope).

## Data model

All new tables get RLS (admins full access through `is_admin()`; students read published content only; own rows only for attempts), pgTAP tests and a migration per `docs/database-migrations.md`.

- **`sources`:** `id`, `lesson_id` (cascade), `title` (optional, e.g. a label used in admin lists), `author`, `work`, `body text`, `position`, `created_at`.
- **`solution_templates`:** `id`, `title`, `exercise_type` (nullable), `points text`, `body text` (rich-text Markdown), `created_at`, `updated_at`.
- **`consolidation_exercises`:**
  - `id`, `lesson_id` (cascade), `position`;
  - `type` (text with CHECK over the ten type keys);
  - `prompt`;
  - `content jsonb`: per-type data such as variants, groups, spans, pairs, N, essay requirements and model answer. The deterministic checks run on the client, so this is readable by students. It holds **no AI context**;
  - `template_id` (nullable, FK restrict);
  - `created_at`.
  - `content` is typed with discriminated unions and validated in `@prepio/shared`, as cards are, with a `…FromRow` function as the only way stored JSON becomes a typed exercise.
- **`consolidation_ai_context`:** `exercise_id` (PK, cascade), `context jsonb` (the exercise's AI context, and for essays the context per requirement id). Admin-only through RLS. The AI endpoint reads it server-side. Students can't read the context, so the reference facts can't be looked up before answering (Claude's call).
- **`consolidation_exercise_sources`:** `exercise_id` (cascade), `source_id` (restrict), `label` (CHECK `A`–`D`, so a future BAC subject fits; this feature uses at most two, A and B), `position`. It is a join table so a future BAC subject can reference sources the same way.
- **`consolidation_attempts`:** `user_id`, `exercise_id` (both cascade), `answer jsonb`, `verdict` (`ok` | `almost` | `no`, or `null` while incomplete for the essay), `feedback jsonb`, `updated_at`; primary key `(user_id, exercise_id)`. Plain own-row RLS. The client writes the whole row, including the AI feedback the endpoint returned. *Claude's call:* attempts are private, ungraded and shown to nobody else, so a student editing their own feedback harms only themselves (the same reasoning as `lesson_progress`). There is no server-side write path.
- **`consolidation_runs`:** `user_id`, `lesson_id` (both cascade), `exercise_ids uuid[]`, `index int`, `finished_at`, `updated_at`; primary key `(user_id, lesson_id)`. Own-row RLS.
- **Migration of the writing exercises:**
  - Each `writing_exercises` row becomes an `essay` consolidation exercise with one requirement:
    - the requirement text is the old `prompt`;
    - the AI context is the old `criteria`, stored in `consolidation_ai_context`. It is good enough as a start; the owner reviews it with the content;
    - the exercise prompt is a short title derived from the old prompt.
  - It is created in the same lesson, after the existing ones (in order).
  - Then `writing_exercises` is dropped.
  - The pgTAP test checks the conversion on a fixture.
- **Seed:** the seed content in `packages/content` is updated the same way. Each seed lesson also gets a handful of consolidation exercises covering the deterministic types (sources taken from the lesson's material), and the template library gets one template per type. The owner reviews them for accuracy, as with the existing content.

## Out of scope / later

- Whole BAC subjects (several requirements on shared sources, the exam timer).
- A live admin preview of consolidation exercises through the student `/preview` route (backlog).
- Consolidation states on the Home rows (only the lesson start screen and the end screens show them).
- Moving the connector lists into admin Settings.

## Decisions made by Claude (owner to check)

- Consolidation opens when the lesson is finished, in **both** learning modes, and never gates anything.
- The latest attempt per exercise is stored in the account (needed for the summary, „Reia doar ce nu a fost corect” and cross-device resume). There is no attempt history.
- The essay has no separate introduction or conclusion fields. It allows 1–6 requirements.
- Consolidation runs („Reia…”) are tracked in `consolidation_runs`. Restarting never deletes attempts. Returning to a completed consolidation opens its end screen.
- Exercises that fail validation are hidden from students. Saving a source that detaches spans needs a confirmation.
- The AI context lives in an admin-only table. Answers for the deterministic checks are readable by the client, which is needed to check them.
- Attempts use plain own-row RLS. The client stores the AI feedback; there is no anti-forgery work.
- An exercise has at most two sources (A, B).
- Existing writing exercises are converted into one-requirement essays, not deleted. `/api/evaluate` and the grade settings go away.
- Typo tolerance is never applied to numbers, years or centuries.
- The per-student AI limit rises to 30 per hour.
- The admin marks spans with native browser selection rather than the student marker (desktop tool, much simpler).
- The reading typeface for sources is a serif (Literata in the mockup).
- Short-source threshold: ~70 words.
- The verdict labels are exactly „Corect”, „Aproape” and „Mai lucrează”.

## Verification

- **Unit tests in shared:**
  - normalisation (diacritics including cedillas, centuries / Roman numerals, typo tolerance limits);
  - sentence detection with abbreviations;
  - span matching (ok / long / short / none, N distinct, duplicates);
  - pair matching (exact, swapped, mixed pairs, same-sentence pairs);
  - span re-anchoring after a source edit;
  - connector detection;
  - validators and `…FromRow`.
- **Admin:** unit tests for each form model, and e2e for creating each type, marking spans and pairs, attaching a template, and the in-use delete guards.
- **AI endpoint:** handler tests with a fake evaluator (context loaded server-side, missing context, deterministic facts in the prompt, rate limit, output validation, attempt write).
- **pgTAP:** RLS on all new tables, the restrict and cascade behaviour, and the writing-exercise migration.
- **Browser (owner's rule):**
  - every type at 360 px and desktop: happy path and each verdict;
  - the marker with the mouse and with touch emulation: drag, tap-tap, handles, replace, remove;
  - the reader and the desktop split;
  - the zones, locks and end screens in both modes;
  - the admin flows with `[test]` data, removed afterwards;
  - a clean console.
- **Phone (native, owner):** see below.

## Native-only checks for the owner (next APK)

- The marker:
  - long-press-then-drag versus scrolling;
  - tap-tap;
  - handle dragging;
  - haptic tick;
  - no accidental marks while scrolling the reader.
- The reader:
  - slide-up and the ✕ close;
  - Android back closes it before leaving the exercise.
- The serif font with diacritics.
- The keyboard over the text fields (essay cards, short answers).
- The template bottom sheet: Android back closes it.
