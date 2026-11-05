# Lesson zones and BAC consolidation exercises: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split a lesson into Învățare / Verificare / Consolidare, and add ten BAC-shaped consolidation exercise types with a free-selection marker on sources, a solution-template library, deterministic checking and AI feedback with an admin-written context. The current writing exercises are migrated into the new model.

**Architecture:**
- **`@prepio/shared`** holds every rule:
  - exercise types and their row parsing;
  - validators;
  - answer normalisation;
  - the source tokenizer and sentence detection;
  - span and pair matching;
  - the connector detection;
  - a deterministic `checkExercise`.
- **Admin (Next.js):**
  - CRUD for sources, templates and exercises;
  - answer-span marking with the browser's native selection;
  - a new AI endpoint that loads the context server-side and returns structured, ungraded feedback.
- **Student app (Expo, incl. web):**
  - a separate consolidation route;
  - a pure marker reducer driven by a gesture layer;
  - a full-screen reader on phones and a split view on desktop;
  - attempts and runs saved to the account.

**Tech Stack:** TypeScript, Supabase Postgres + RLS + pgTAP, Next.js 16 + react-bootstrap (admin), Expo 58 / expo-router / react-native-gesture-handler 3 / Reanimated 4 (student), OpenAI Responses API with zod structured output, Vitest / Jest / Playwright.

**Spec:** `docs/superpowers/specs/2026-11-05-consolidation-exercises-design.md` (approved 2026-11-05). Mockups: `docs/design/2026-11-05-consolidation-types-mockup.html`, `docs/design/2026-11-05-consolidation-long-sources-mockup.html`. Read both mockups before any UI task. They are the reference for layout and Romanian copy.

## Global Constraints

- Code, comments, commits and docs are in English. All user-facing copy is in Romanian with comma diacritics (ș, ț), taken from the mockups and spec where they fix it.
- Verdict labels, exactly: `ok` → „Corect”, `almost` → „Aproape”, `no` → „Mai lucrează”.
- Type keys, exactly: `short_answer`, `multi_answer`, `source_info`, `source_letter`, `cause_effect`, `facts`, `comparison`, `viewpoint`, `argument`, `essay`.
- AI types: `facts`, `comparison`, `viewpoint`, `argument`, `essay`. Each needs a non-blank AI context (essay: one per requirement).
- An exercise has at most 2 sources (labels `A`, `B`). The DB label CHECK allows `A`–`D`.
- Essay: 1–6 requirements.
- Short sources: under 70 words are shown inline. Longer ones get the preview card plus the reader. The desktop split starts at a window width ≥ 900 px.
- Marker: touch long-press 280 ms, then drag. A mouse drag starts immediately. Tap-tap selects a range.
- Typo tolerance: Levenshtein ≤ max(1, ⌊len/8⌋), only for accepted answers of ≥ 5 letters with no digits and not a Roman-numeral token.
- AI per-student limit: 30 per hour (`USER_RATE_LIMIT`). The global cap stays at 300 per day.
- DB changes follow `docs/database-migrations.md`: a new migration, RLS on every new table, a pgTAP test, `pnpm db:reset && pnpm seed && pnpm db:test`. Never edit an applied migration.
- Run commands in WSL with nvm: `wsl -d Ubuntu-22.04 -- bash -ic "cd ~/projects/prepio_new && <cmd>"`. Playwright needs `LD_LIBRARY_PATH=~/.local/pwlibs/root/usr/lib/x86_64-linux-gnu`.
- Frontend changes are not done until they are walked in a browser at 360 px and at desktop width, with a clean console (`CLAUDE.md`).

## Review Focus

1. **A source edited after spans were marked.** Re-anchorable spans move with the text. Others make the exercise invalid in the admin and invisible to students, never wrongly „Corect”. Tests: Task 3 (`reanchorSpan`), Task 6 (`saveSource` impact), Task 10 (loader drops invalid).
2. **Abbreviations and initials** („Al. I. Cuza”, „sec. XIV”, „D. Berindei”) must not split sentences. If they did, the default limit would turn a correct mark into „long”. Test: Task 3.
3. **Century and number answers never pass through typo tolerance:** „XV” vs „XIV”, „1859” vs „1858” are „Mai lucrează”. Test: Task 2.
4. **The marker on touch must not fight scrolling:** a quick vertical swipe over the text scrolls and creates no anchor or mark. The reducer test covers the gesture contract (Task 11), and the browser walk with touch emulation covers the rest (Task 17).
5. **A stale run or attempt after an exercise is deleted or becomes invalid** must be skipped without crashing, and n/N counts only valid exercises. Tests: Task 13 (`resolveRun`).

---

## File structure

**Shared (`packages/shared/src/`)**
- `consolidation/types.ts`: exercise, source, template, answer and feedback types (exported from `types.ts` through `index.ts`).
- `consolidation/exercises.ts`: `CONSOLIDATION_TYPES`, labels, `AI_TYPES`, `emptyExerciseContent`, `exerciseFromRow`, `exerciseToRow`, `validateExercise`, `templateFromRow`, `validateTemplate`, `sourceFromRow`.
- `consolidation/normalize.ts`: `normalizeAnswer`, `parseCentury`, `levenshtein`, `matchVariants`, `matchGroups`.
- `consolidation/sourceText.ts`: `tokenizeSource`, `paragraphs`, `sentenceRange`, `spanToWords`, `reanchorSpan`, `isShortSource`, `readingMinutes`.
- `consolidation/marks.ts`: `judgeMark`, `judgeMarks`, `judgePair`.
- `consolidation/connectors.ts`: `CAUSAL_CONNECTORS`, `CONCLUSION_CONNECTORS`, `detectConnectors`.
- `consolidation/check.ts`: `checkExercise` (deterministic types and the deterministic parts of mixed types).
- Removed: `WritingExercise`, `EvaluateRequest`, `EvaluateResponse`, and `Lesson.exercises`.

**DB:** `supabase/migrations/<ts>_consolidation.sql`, `supabase/tests/consolidation.test.sql`. Update `supabase/tests/rls.test.sql` and `supabase/tests/accounts.test.sql` where they use `writing_exercises`.

**Admin (`apps/admin/src/`)**
- `lib/data/consolidation.ts`: sources, exercises and AI context data functions.
- `lib/data/templates.ts`: template data functions.
- `app/(admin)/templates/page.tsx`, `TemplatesEditor.tsx`, `actions.ts`: the library page. The nav link goes in `AdminShell.tsx`.
- `components/editor/consolidation/`:
  - `ConsolidationEditor.tsx` (the tab);
  - `SourcesEditor.tsx`, `SourceForm.tsx`;
  - `ExerciseList.tsx`, `ExerciseForm.tsx`, `exerciseModel.ts`;
  - `SpanMarker.tsx`, `selection.ts`;
  - per-type fields: `ShortAnswerFields.tsx`, `MultiAnswerFields.tsx`, `SpansFields.tsx` (source_info, viewpoint), `LetterFields.tsx`, `PairsFields.tsx`, `AiFields.tsx` (facts, comparison, argument), `EssayFields.tsx`.
- `lib/consolidation/` (AI): `handler.ts`, `prompt.ts`, `schema.ts`. The route is `app/api/consolidation/evaluate/route.ts`. It reuses `lib/evaluate/{cors,openai,rateLimit}.ts`.
- Removed:
  - `components/editor/ExercisesEditor.tsx`;
  - `app/api/evaluate/`;
  - `lib/evaluate/handler.ts`, `lib/evaluate/prompt.ts` and their tests;
  - the `saveExercise` action and data function;
  - the grade fields in `SettingsForm.tsx`.

**Student (`apps/mobile/`)**
- `app/(app)/lesson/[id].tsx` moves to `app/(app)/lesson/[id]/index.tsx`. New: `app/(app)/lesson/[id]/consolidare.tsx`.
- `src/lib/consolidation.ts`: fetch the consolidation data, attempts and runs, and resolve the run.
- `src/lib/api.ts`: `evaluateConsolidation` replaces `evaluateEssay`.
- `src/lib/lessonFlow.ts`, `src/lib/progress.ts`: the `exercises` phase is removed.
- `src/screens/LessonScreen.tsx`, `src/screens/lesson/LessonStart.tsx`, `src/screens/lesson/GuidedResult.tsx`: the zones and the consolidation call to action.
- `src/screens/ConsolidationScreen.tsx`, `src/screens/consolidation/` (`ConsolidationEnd.tsx`, `ExerciseScreen.tsx`, `FeedbackView.tsx`, `TemplateSheet.tsx`).
- `src/components/marker/`: `markerReducer.ts`, `wordHit.ts`, `MarkableText.tsx`, `SourceCard.tsx`, `SourceReader.tsx`, `SourceSplit.tsx`, `MarkSlots.tsx`.
- `src/components/consolidation/`: one input component per type (`ShortAnswerInput.tsx`, `MultiAnswerInput.tsx`, `LetterInput.tsx`, `FactsInput.tsx`, `ComparisonInput.tsx`, `ViewpointInput.tsx`, `ArgumentInput.tsx`, `ConnectorChips.tsx`, `EssayInput.tsx`).
- `src/theme/fonts.ts`: the reading serif.
- Removed: `src/components/WritingExercise.tsx` and its test.

**Content (`packages/content/src/`)**
- `types.ts`: `SeedSource`, `SeedConsolidation`, `SeedTemplate`. `SeedLesson.exercises` is removed.
- `templates.ts`: the ten seed templates.
- `consolidation.ts`: converts seed text spans into offsets.
- `seed.ts`, `lessons/0*.ts`, `demoLesson.ts`, `removeTestLessons.ts`.
- `addConsolidation.ts`: the production content script. Add the `pnpm content:cloud:add-consolidation` script plus a `scripts/content-cloud.sh` subcommand.

---

### Task 1: Database: consolidation schema, RLS, writing-exercise migration

**Files:**
- Create: `supabase/migrations/<timestamp>_consolidation.sql` (via `pnpm db:new consolidation`)
- Create: `supabase/tests/consolidation.test.sql`
- Modify: `supabase/tests/rls.test.sql`, `supabase/tests/accounts.test.sql` (drop the `writing_exercises` assertions and adjust the `plan(n)` counts)

**Interfaces:**
- Produces these tables, with the columns exactly as listed:
  - `sources(id uuid pk default gen_random_uuid(), lesson_id uuid not null → lessons on delete cascade, title text, author text not null default '', work text not null default '', body text not null, position int not null default 0, created_at timestamptz default now())`
  - `solution_templates(id uuid pk, title text not null, exercise_type text null check (in the 10 keys), points text not null default '', body text not null default '', created_at, updated_at)`, with the `set_updated_at` trigger.
  - `consolidation_exercises(id uuid pk, lesson_id → lessons cascade, position int not null default 0, type text not null check (in the 10 keys), prompt text not null, content jsonb not null default '{}' check (jsonb_typeof(content)='object'), template_id uuid null → solution_templates on delete restrict, created_at)`
  - `consolidation_exercise_sources(exercise_id → consolidation_exercises cascade, source_id → sources on delete restrict, label text not null check (label in ('A','B','C','D')), position int not null default 0, primary key (exercise_id, label))`
  - `consolidation_ai_context(exercise_id uuid pk → consolidation_exercises cascade, context jsonb not null check (jsonb_typeof(context)='object'))`
  - `consolidation_attempts(user_id uuid not null default auth.uid() → auth.users cascade, exercise_id → consolidation_exercises cascade, answer jsonb not null, verdict text null check (verdict in ('ok','almost','no')), feedback jsonb, updated_at timestamptz not null default now(), primary key (user_id, exercise_id))`, with the `set_updated_at` trigger.
  - `consolidation_runs(user_id default auth.uid() → auth.users cascade, lesson_id → lessons cascade, exercise_ids uuid[] not null, index int not null default 0 check (index >= 0), finished_at timestamptz, updated_at, primary key (user_id, lesson_id))`, with the `set_updated_at` trigger.
- AI context JSON shape: `{"main": string, "requirements": {"<requirementId>": string}}`.

- [ ] **Step 1: Write `supabase/tests/consolidation.test.sql`**

  Follow the fixture style of `learning_modes.test.sql`: users `d1` and `d3`, admin row in `public.admins` for an admin user, a published lesson `e1` and a draft lesson `e2`.

  The migration has already run when the tests run, so the conversion lives in a kept helper that can be tested: `public.essay_from_writing_exercise(p_lesson uuid, p_prompt text, p_criteria text) returns uuid`. It is `security definer`, and execution is revoked from `public`, `anon`, `authenticated` and `service_role`. The migration loops over `writing_exercises` and calls it. As `postgres`, the test calls it on lesson `e1` with prompt `'Explicați importanța Unirii din 1859 pentru formarea statului român modern, folosind cel puțin două argumente'` and criteria `'C'`. It asserts:
  - the exercise has `type='essay'`;
  - its prompt is cut at a word boundary to ≤ 81 characters and ends in `…`;
  - its position is the previous max + 1;
  - `content->'requirements'->0->>'text'` is the full prompt;
  - `consolidation_ai_context.context->'requirements'->>'r1'` = `'C'`.

  Further assertions:
  - `hasnt_table('public','writing_exercises')`;
  - `has_table` for all 7 new tables;
  - anon can't select from any of them (`42501`);
  - student `d1`:
    - sees the sources, exercises, exercise_sources and templates of published `e1`, and none of draft `e2`;
    - **can't** select `consolidation_ai_context` (0 rows or `42501`; pick one and assert it);
    - can't insert, update or delete content tables;
    - inserts and updates their own attempt and run;
    - can't see `d3`'s attempt;
    - an invalid verdict is rejected with `23514`;
  - admin: full CRUD on the content tables and `consolidation_ai_context`;
  - deleting a source used by an exercise fails with `23503`;
  - deleting a template used by an exercise fails with `23503`;
  - deleting a lesson cascades to its sources, exercises, joins, context, attempts and runs.

- [ ] **Step 2: Run it and check it fails**

  Run: `pnpm db:test`
  Expected: `consolidation.test.sql` fails, because the tables don't exist.

- [ ] **Step 3: Write the migration**

  - Create the tables above and enable RLS on each.
  - Policies, following `student_accounts`:
    - `*_admin_all` on every content table and on `consolidation_ai_context`, with `is_admin()`;
    - student select on `sources` and `consolidation_exercises` where the lesson is published;
    - student select on `consolidation_exercise_sources` through the exercise's lesson;
    - student select on all `solution_templates`;
    - own-row select, insert and update on attempts and runs.
  - Grants: `revoke all … from anon, authenticated`, then grant exactly what the policies need. Attempts: insert and update of `exercise_id, answer, verdict, feedback`. Runs: `lesson_id, exercise_ids, index, finished_at`.
  - Convert the writing exercises inside the migration with `essay_from_writing_exercise`. The migration calls it for each `writing_exercises` row, ordered by `lesson_id`, `position`. The helper:
    - inserts a `consolidation_exercises` row with `type='essay'`, `prompt` = the first 80 characters of the old prompt (cut at a word boundary, `…` when cut), and `position` = the lesson's current max position + 1;
    - set `content` to `{"requirements":[{"id":"r1","text":<old prompt>,"modelAnswer":null,"templateId":null,"argument":false}],"modelAnswer":null,"explanation":null}`;
    - insert `consolidation_ai_context(exercise_id, {"main":"","requirements":{"r1":<old criteria>}})`.
  - Then drop `writing_exercises`, including its policies.

- [ ] **Step 4: Run the DB suite**

  Run: `pnpm db:reset && pnpm db:test`
  Expected: all files pass.

- [ ] **Step 4b: Keep the seed working**

  In `packages/content/src/seed.ts`, replace the `writing_exercises` insert with calls to `essay_from_writing_exercise`. Use an RPC wrapper only if the helper must be reachable, otherwise insert the same rows directly: the essay exercise plus its `consolidation_ai_context`, with the shapes above. Also update `removeTestLessons.ts` and `demoLesson.ts` where they touch `writing_exercises`. Task 16 replaces this with the full content model.

  Run: `pnpm db:reset && pnpm seed && pnpm db:test`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add supabase/ packages/content/ && git commit -m "feat(db): consolidation schema, RLS and writing-exercise migration"
  ```

---

### Task 2: Shared: consolidation types and answer normalisation

**Files:**
- Create: `packages/shared/src/consolidation/types.ts`, `normalize.ts`, `normalize.test.ts`
- Modify: `packages/shared/src/types.ts` (remove `WritingExercise`, `EvaluateRequest`, `EvaluateResponse`, `Lesson.exercises`; re-export the consolidation types), `packages/shared/src/index.ts`, `packages/shared/src/validation.ts` + test (drop the exercise rules from `validateLesson`)

**Interfaces (produces):**

```ts
export type ConsolidationType = 'short_answer' | 'multi_answer' | 'source_info' | 'source_letter' | 'cause_effect'
  | 'facts' | 'comparison' | 'viewpoint' | 'argument' | 'essay';
export type Verdict = 'ok' | 'almost' | 'no';
export type SourceLabel = 'A' | 'B';
export type Source = { id: string; position: number; title: string | null; author: string; work: string; body: string };
/** Char offsets [start, end) into the source body; `text` = body.slice(start, end) when anchored. Limit null = the sentence. */
export type AnswerSpan = { id: string; sourceId: string; start: number; end: number; text: string; limitStart: number | null; limitEnd: number | null };
export type SourceRef = { sourceId: string; label: SourceLabel };
export type EssayRequirement = { id: string; text: string; modelAnswer: string | null; templateId: string | null; argument: boolean };
export type ConsolidationContent =
  | { type: 'short_answer'; accepted: string[]; mistakes: { answer: string; message: string }[] }
  | { type: 'multi_answer'; count: number; groups: { id: string; variants: string[] }[] }
  | { type: 'source_info'; count: number; spans: AnswerSpan[] }
  | { type: 'source_letter'; correct: SourceLabel; evidence: AnswerSpan | null }
  | { type: 'cause_effect'; pairs: { id: string; cause: AnswerSpan; effect: AnswerSpan; explanation: string | null }[] }
  | { type: 'facts'; count: number }
  | { type: 'comparison'; variant: 'similarity' | 'difference' }
  | { type: 'viewpoint'; count: number; spans: AnswerSpan[] }
  | { type: 'argument' }
  | { type: 'essay'; requirements: EssayRequirement[] };
export type ConsolidationExercise = {
  id: string; position: number; prompt: string; templateId: string | null; sources: SourceRef[];
  modelAnswer: string | null; explanation: string | null;
} & ConsolidationContent;
export type AiContext = { main: string; requirements: Record<string, string> };
export type SolutionTemplate = { id: string; title: string; exerciseType: ConsolidationType | null; points: string; body: string };
/** Word-index range [from, to] (inclusive) of `tokenizeSource(body).words` of one source. */
export type Mark = { sourceId: string; from: number; to: number };
export type ExerciseAnswer =
  | { type: 'short_answer'; text: string }
  | { type: 'multi_answer'; texts: string[] }
  | { type: 'source_info'; marks: Mark[] }
  | { type: 'source_letter'; letter: SourceLabel | null }
  | { type: 'cause_effect'; cause: Mark | null; effect: Mark | null }
  | { type: 'facts'; texts: string[] }
  | { type: 'comparison'; text: string }
  | { type: 'viewpoint'; text: string; marks: Mark[] }
  | { type: 'argument'; text: string }
  | { type: 'essay'; parts: Record<string, string> };
/** One feedback block; `key` identifies it (e.g. 'answer', 'field-0', 'mark-1', 'fact-0', 'viewpoint', 'support-0', 'whole', a requirement id). */
export type FeedbackItem = { key: string; verdict: Verdict; title: string; good: string[]; improve: string[]; ai: boolean };
export type ExerciseFeedback = {
  verdict: Verdict | null;
  items: FeedbackItem[];
  fields?: Verdict[];                                        // per input field (multi_answer, facts)
  marks?: Array<{ sourceId: string; from: number; to: number; verdict: Verdict }>; // underline colours
  swapped?: boolean;                                         // cause_effect roles inverted
  reveal?: string[];                                         // lines for „Vezi răspunsul / toate informațiile / relațiile”
};
export type ConsolidationRow = { id: string; position: number; type: ConsolidationType; prompt: string; content: Record<string, unknown>; template_id: string | null };
export type Lesson = LessonSummary & { status: LessonStatus; cards: Card[]; questions: Question[] };
```

Also produced (in `normalize.ts`):

```ts
export function normalizeAnswer(s: string): string;
export function parseCentury(s: string): number | null;
export function levenshtein(a: string, b: string): number;
export type VariantMatch = { kind: 'exact' | 'typo'; accepted: string } | { kind: 'mistake'; message: string } | { kind: 'none' };
export function matchVariants(answer: string, accepted: string[], mistakes?: { answer: string; message: string }[]): VariantMatch;
export function matchGroups(answers: string[], groups: { id: string; variants: string[] }[]): Array<{ groupId: string | null; duplicate: boolean }>;
```

- [ ] **Step 1: Write `normalize.test.ts`**

  - `normalizeAnswer('  Țara  Românească! ')` is `'tara romaneasca'`. `normalizeAnswer('Ţara Româneasca')` gives the same (cedilla).
  - `parseCentury` returns `14` for each of: `'XIV'`, `'14'`, `'al XIV-lea'`, `'secolul al XIV-lea'`, `'sec. XIV'`, `'Secolul 14'`. It returns `null` for `'Moldova'` and for `'XIV și XV'`.
  - `matchVariants('statutul dezvoltator', ['Statutul Dezvoltător'])` is exact.
  - `matchVariants('Statutul Dezvoltatr', ['Statutul Dezvoltător'])` is a typo.
  - `matchVariants('XV', ['XIV'])` is none. `matchVariants('1859', ['1858'])` is none.
  - `matchVariants('secolul al XIV-lea', ['XIV'])` is exact.
  - `matchVariants('Carol', ['Cuza'])` is none (4 letters, no tolerance).
  - Mistake: `matchVariants('Constituția din 1866', ['Statutul Dezvoltător'], [{answer:'Constituția din 1866', message:'M'}])` gives `{kind:'mistake', message:'M'}`.
  - `matchGroups(['Muntenia','Valahia'], [{id:'g1',variants:['Moldova']},{id:'g2',variants:['Țara Românească','Muntenia','Valahia']}])` gives `[{groupId:'g2',duplicate:false},{groupId:'g2',duplicate:true}]`.
  - `matchGroups(['', 'Moldova'], …)` gives `[{groupId:null,duplicate:false},{groupId:'g1',duplicate:false}]`.

- [ ] **Step 2: Run it and check it fails**

  Run: `pnpm --filter @prepio/shared test normalize`
  Expected: FAIL, the module is not found.

- [ ] **Step 3: Implement**

  - Normalisation: NFD, strip combining marks, lowercase, turn every non-`[a-z0-9]` character into a space, collapse spaces, trim.
  - `parseCentury`: normalise, drop the tokens `secolul`, `sec`, `al`, `lea`. If exactly one token remains and it is an integer 1–21 or a valid Roman numeral I–XXI, return its value.
  - `matchVariants` order: mistakes, then exact (both sides normalised, or both parse to the same century), then typo (only when the Global Constraints rule allows), then none.

- [ ] **Step 4: Run it and check it passes**

  Run: `pnpm --filter @prepio/shared test`
  Expected: PASS. Run `pnpm -r typecheck` too: failures in apps that still use the removed types are expected and fixed in later tasks. Note them, don't fix them here.

- [ ] **Step 5: Commit**

  `feat(shared): consolidation types and answer normalisation`

---

### Task 3: Shared: source text, sentence detection and span re-anchoring

**Files:**
- Create: `packages/shared/src/consolidation/sourceText.ts`, `sourceText.test.ts`

**Interfaces (produces):**

```ts
export type SourceWord = { i: number; text: string; start: number; end: number; paragraph: number; omission: boolean };
export type TokenizedSource = { words: SourceWord[]; paragraphCount: number };
export function tokenizeSource(body: string): TokenizedSource;          // words = maximal non-whitespace runs; blank line(s) start a new paragraph; omission = token is/starts with "[...]"
export function sentenceRange(t: TokenizedSource, from: number, to: number): [number, number]; // word range of the sentence(s) containing [from,to]
export function spanToWords(t: TokenizedSource, span: Pick<AnswerSpan, 'start' | 'end'>): [number, number] | null;
export function limitWords(t: TokenizedSource, span: AnswerSpan): [number, number]; // explicit limit or sentenceRange of the core
export function reanchorSpan(body: string, span: AnswerSpan): AnswerSpan | null;  // null = detached
export function isShortSource(body: string): boolean;                   // < 70 words
export function readingMinutes(body: string): number;                   // max(1, round(words / 200))
```

- [ ] **Step 1: Write the tests**

  - Tokenizing `'Ana are.\n\nMere multe [...] azi.'` gives 6 words. Paragraphs are `[0,0,1,1,1,1]`. `omission` is set on index 4. `start`/`end` slice back to each token.
  - Sentence end rule: a word ends a sentence when it ends in `.`, `!` or `?` (optionally followed by `"”»)`), and it is not an initial or abbreviation (`/^[A-ZĂÂÎȘȚ][a-zăâîșț]{0,2}\.$/`, or `sec.`, `cca.`, `nr.`).
  - On source B of the mockup (copy `SRC_B` into a fixture), `sentenceRange` around „domnul era obligat” spans from „Începuturile” to „Bucureşti.” and does not stop at „Al.” or „I.”.
  - Same check on „D. Berindei a scris. Apoi…”: the first sentence includes „D.”.
  - `spanToWords` for a span inside one word returns that word. For the span of „toate averile mănăstirești“ it returns the right indices.
  - `reanchorSpan`:
    - unchanged body: the same span;
    - text inserted before the span: the shifted offsets;
    - text occurring twice: the occurrence nearest the old `start`;
    - text deleted: `null`;
    - when the limit can't be re-anchored, the limit is reset to `null` and the core is kept.
  - `isShortSource`: a 69-word string is true, a 70-word string is false.

- [ ] **Step 2: Run them and check they fail**

  Run: `pnpm --filter @prepio/shared test sourceText`

- [ ] **Step 3: Implement to the signatures**

- [ ] **Step 4: Run them and check they pass**

- [ ] **Step 5: Commit**

  `feat(shared): source tokenizer, sentences and span re-anchoring`

---

### Task 4: Shared: mark and pair matching, connectors

**Files:**
- Create: `packages/shared/src/consolidation/marks.ts`, `marks.test.ts`, `connectors.ts`, `connectors.test.ts`

**Interfaces (produces):**

```ts
export type MarkJudgement = 'ok' | 'long' | 'short' | 'none';
/** Leading/trailing punctuation-only or omission words are trimmed from the mark first. */
export function judgeMark(t: TokenizedSource, mark: Mark, span: AnswerSpan): MarkJudgement;
export function judgeMarks(t: TokenizedSource, marks: Mark[], spans: AnswerSpan[], count: number):
  { perMark: Array<{ judgement: MarkJudgement; spanId: string | null; duplicate: boolean }>; verdict: Verdict };
export type PairJudgement = { kind: 'exact' | 'near' | 'swapped' | 'partial' | 'unrelated' | 'none'; pairId: string | null; cause: MarkJudgement; effect: MarkJudgement };
export function judgePair(t: TokenizedSource, cause: Mark, effect: Mark, pairs: { id: string; cause: AnswerSpan; effect: AnswerSpan }[]): PairJudgement;
export const CAUSAL_CONNECTORS: readonly string[];      // deoarece, pentru că, întrucât, fiindcă, din cauza, datorită, ca urmare
export const CONCLUSION_CONNECTORS: readonly string[];  // așadar, prin urmare, în concluzie, deci, astfel, în consecință
export function detectConnectors(text: string): { causal: boolean; conclusion: boolean };
```

Rules (from the spec):
- `judgeMark`: no overlap with the core is `none`. The core fully inside the mark and the mark inside the limit is `ok`. The core fully inside but the mark beyond the limit is `long`. Otherwise `short`. The best judgement wins, in the order ok > long > short > none.
- `judgeMarks`: count distinct `ok` spans. When it reaches `count`, the verdict is `ok`. When any mark is ok, long or short, it is `almost`. Otherwise `no`. A second mark on an already-used span is `duplicate`.
- `judgePair`:
  - `exact`: both ok on the same pair.
  - `near`: both ok or long on the same pair, at least one long.
  - `swapped`: cause ok or long on a pair's effect and effect ok or long on its cause.
  - `partial`: both overlap the same pair (not none) but don't qualify above.
  - `unrelated`: each is ok or long on some pair, but not the same pair.
  - `none`: anything else.
  - Same-sentence pairs: when computing the default limit of one side, the other side's core is excluded. The limit becomes the sentence range clipped so it doesn't include the other core.
- `detectConnectors`: diacritic-insensitive, whole-word or whole-phrase matching on `normalizeAnswer(text)`.

- [ ] **Step 1: Write the tests**

  Use the mockup's source B and the four pairs in `consolidare-tipuri.html` (`renderCause`) as fixtures. Cover:
  - each `MarkJudgement`;
  - the `count`/duplicate logic;
  - every `PairJudgement` kind, including the same-sentence pair („aproximativ un sfert…” → „a mărit suprafața…”), where marking the whole sentence as the effect is `long`, not `ok`;
  - connectors: „Așadar” at the start of a sentence, „pentru ca” without diacritics, and „deciziile” must **not** count as „deci”.

- [ ] **Step 2: Run them and check they fail**

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run them and check they pass**

- [ ] **Step 5: Commit**

  `feat(shared): mark/pair matching and connector detection`

---

### Task 5: Shared: exercise parsing, validation and deterministic check

**Files:**
- Create: `packages/shared/src/consolidation/exercises.ts`, `exercises.test.ts`, `check.ts`, `check.test.ts`

**Interfaces (produces):**

```ts
export const CONSOLIDATION_TYPES: readonly ConsolidationType[];
export const CONSOLIDATION_TYPE_LABELS: Record<ConsolidationType, string>; // 'Răspuns scurt','Răspunsuri multiple','Informație din sursă','Litera sursei','Cauză-efect','Prezentare fapte','Asemănare / deosebire','Punct de vedere','Argumentare','Eseu pe cerințe'
export const AI_TYPES: ReadonlySet<ConsolidationType>;
export const VERDICT_LABELS: Record<Verdict, string>;
export function emptyExerciseContent(type: ConsolidationType, newId: () => string): ConsolidationContent;
export function exerciseFromRow(row: ConsolidationRow, sources: SourceRef[]): ConsolidationExercise; // untrusted JSON → typed, unique ids (like cardFromRow)
export function exerciseToRow(ex: DistributiveOmit<ConsolidationExercise, 'id' | 'position' | 'sources'>): { type: ConsolidationType; prompt: string; content: Record<string, unknown>; template_id: string | null };
export function sourceFromRow(row: Record<string, unknown>): Source;
export function templateFromRow(row: Record<string, unknown>): SolutionTemplate;
export function validateTemplate(t: Omit<SolutionTemplate, 'id'>): string[];
/** Romanian messages; `sources` = the exercise's resolved sources; `ai` required for AI types. */
export function validateExercise(ex: ConsolidationExercise, sources: Source[], ai: AiContext | null): string[];
export function checkExercise(ex: ConsolidationExercise, sources: Source[], answer: ExerciseAnswer): ExerciseFeedback;
```

`validateExercise` rules, with Romanian messages:
- the prompt is not blank;
- source count per type:
  - `source_info`, `cause_effect` and `viewpoint`: exactly 1;
  - `source_letter`: exactly 2;
  - `short_answer` and `multi_answer`: 0–2;
  - AI types other than `viewpoint`: 0–1;
- at most 2 sources overall;
- `short_answer`: at least one accepted variant;
- `multi_answer`: `1 ≤ count ≤ groups.length`, every group has ≥ 1 variant;
- `source_info` and `viewpoint`: `1 ≤ count ≤ spans.length`;
- `cause_effect`: ≥ 1 pair;
- `facts`: 1 ≤ count ≤ 4;
- `essay`: 1–6 requirements, none blank;
- every span is anchored: `source.body.slice(start, end) === text` and `sourceId` is one of the exercise's sources. Otherwise: „Răspunsul marcat „<text>” nu mai există în sursă.”;
- AI types: `ai.main` is non-blank for `facts`, `comparison`, `viewpoint` and `argument`; essay: every requirement id has non-blank `ai.requirements[id]`. Otherwise: „Contextul pentru AI este obligatoriu.” (essay: „…pentru cerința n.”).
- When `ai` is `null` (the student loader), the AI rule is skipped.

`checkExercise` produces the mockup's copy and verdicts:
- `short_answer`:
  - exact: `ok` „Corect!”;
  - typo: `ok` „Corect, atenție la scriere” with `improve: ['Forma corectă: <accepted>.']`;
  - mistake: `no`, with its message;
  - none: `no`, with `explanation` (or „Nu am găsit răspunsul în sursă.”).
  - `reveal` = `[accepted[0]]`.
- `multi_answer`: `fields` per input (`ok`, or `almost` for a duplicate, or `no`). The overall verdict follows the spec. Duplicate copy: „Ai scris de două ori același răspuns. Mai caută unul.”
- `source_info`: `judgeMarks`, with these messages:
  - ok: „Ai găsit o informație completă.”;
  - long: „Informația e acolo, dar ai selectat și text în plus…”;
  - short: „Ai prins doar o parte…”;
  - none: „Fragmentul ales nu conține informația cerută.”
  - `marks` underlines; `reveal` = all span texts.
- `source_letter`: `ok`/`no`. `reveal` = the evidence text when set.
- `cause_effect`: `judgePair` maps to verdicts and copy exactly as in the mockup's `renderCause`. `swapped: true` for swapped. `reveal` = „Cauză: … / Efect: …” per pair.
- `viewpoint`: only the mark items (`support-0..n`). The verdict stays `null` (the AI completes it).
- `argument`: no items. `null` verdict.
- `facts`: instant checks only. An empty field or one under 15 characters, and two identical normalised fields, make `no` items. Otherwise the verdict is `null`.
- `comparison` and `essay`: an empty answer gives a `no` item. Otherwise `null`.

- [ ] **Step 1: Write `exercises.test.ts`**

  - `exerciseFromRow` coerces garbage to defaults and makes duplicate span or pair ids unique.
  - The round trip `exerciseToRow` → `exerciseFromRow` is stable.
  - One failing and one passing case for each validator rule above.
  - The detached-span message.
  - The AI context is required for each AI type, and skipped with `ai=null`.

- [ ] **Step 2: Write `check.test.ts`**

  - One test per type and verdict branch above, asserting `verdict`, the item `title`, `fields`/`marks`/`swapped` and `reveal`.

- [ ] **Step 3: Run the tests and check they fail; implement; run them and check they pass**

  Run: `pnpm --filter @prepio/shared test`
  Expected: PASS.

- [ ] **Step 4: Commit**

  `feat(shared): consolidation exercise model, validation and deterministic check`

---

### Task 6: Admin data layer: sources, templates, exercises, AI context

**Files:**
- Create: `apps/admin/src/lib/data/consolidation.ts`, `consolidation.int.test.ts`, `templates.ts`, `templates.int.test.ts`
- Modify: `apps/admin/src/lib/data/lesson.ts` (remove `writing_exercises`, `EditorExercise`, `ExerciseInput` and `saveExercise`; `ItemTable` becomes `'cards' | 'questions' | 'consolidation_exercises' | 'sources'`; `LessonForEdit` gains `consolidation`), `lesson.int.test.ts`, `apps/admin/src/lib/data/settings.ts` (stop reading and writing the grade fields), `settings.int.test.ts`

**Interfaces:**
- Consumes: Task 5 (`exerciseFromRow`, `exerciseToRow`, `validateExercise`, `sourceFromRow`, `templateFromRow`, `validateTemplate`) and Task 3 (`reanchorSpan`).
- Produces:

```ts
export type EditorConsolidation = {
  sources: Source[];
  exercises: Array<{ exercise: ConsolidationExercise; ai: AiContext; errors: string[] }>; // errors = validateExercise result (shows detached spans)
  templates: SolutionTemplate[];
};
// LessonForEdit gains: consolidation: EditorConsolidation
export type SourceInput = { id?: string; title: string | null; author: string; work: string; body: string };
export type SourceImpact = Array<{ exerciseId: string; prompt: string; detached: string[] }>; // span texts that would detach
export async function getConsolidation(db: SupabaseClient, lessonId: string): Promise<EditorConsolidation>;
export async function sourceImpact(db: SupabaseClient, sourceId: string, newBody: string): Promise<SourceImpact>;
/** Saves the source and re-anchors every span of the lesson's exercises that point at it (updates their content). */
export async function saveSource(db: SupabaseClient, lessonId: string, input: SourceInput): Promise<{ id: string }>;
export async function deleteSource(db: SupabaseClient, id: string): Promise<void>; // UserError 'Sursa este folosită de un exercițiu.' when referenced
export type ExerciseInput = DistributiveOmit<ConsolidationExercise, 'id' | 'position'> & { id?: string; ai: AiContext };
export async function saveConsolidationExercise(db: SupabaseClient, lessonId: string, input: ExerciseInput): Promise<{ id: string }>;
// templates.ts
export type TemplateWithUsage = SolutionTemplate & { usage: number };
export async function listTemplates(db: SupabaseClient): Promise<TemplateWithUsage[]>;
export async function saveTemplate(db: SupabaseClient, input: Omit<SolutionTemplate, 'id'> & { id?: string }): Promise<{ id: string }>;
export async function deleteTemplate(db: SupabaseClient, id: string): Promise<void>; // UserError 'Șablonul este folosit de n exerciții.'
```

- `saveConsolidationExercise`:
  - rebuild through `exerciseFromRow` (untrusted input), trim, and run `validateExercise` against the lesson's sources (throw `UserError` with the joined messages);
  - verify that every referenced `sourceId` belongs to the lesson and that the template exists;
  - upsert the exercise (using `upsert` from `lesson.ts`, exported for this);
  - replace its `consolidation_exercise_sources` rows;
  - upsert `consolidation_ai_context` (AI types only, `{main:'',requirements:{}}` otherwise).
- `deleteItem` / `moveItem` already work per `ItemTable`. A `sources` delete goes through `deleteSource`, so the friendly in-use error replaces the FK error.

- [ ] **Step 1: Write the integration tests**

  Pattern of `lesson.int.test.ts`: local Supabase and an admin session. Cover:
  - the source CRUD;
  - saving a source that shifts a span updates the exercise's span offsets;
  - saving one that deletes the span text leaves the exercise with a detached-span error in `getConsolidation`, and `sourceImpact` lists that text;
  - deleting a used source → `UserError`;
  - saving each of the 10 types (minimal valid input) and reading it back equal;
  - an AI type without context is rejected;
  - a foreign-lesson `sourceId` is rejected;
  - a template that doesn't exist is rejected;
  - the template CRUD and usage counts;
  - deleting a used template → `UserError` with the count;
  - `getLessonForEdit` returns `consolidation`.

- [ ] **Step 2: Run them and check they fail**

  Run: `pnpm --filter @prepio/admin test:int` (or the existing int script name from `apps/admin/package.json`)

- [ ] **Step 3: Implement; run them and check they pass**

- [ ] **Step 4: Commit**

  `feat(admin): consolidation and template data layer`

---

### Task 7: Admin: solution-template library page

**Files:**
- Create: `apps/admin/src/app/(admin)/templates/page.tsx`, `TemplatesEditor.tsx`, `TemplatesEditor.test.tsx`, `actions.ts`
- Modify: `apps/admin/src/app/(admin)/AdminShell.tsx` (nav item `{ href: '/templates', label: 'Șabloane de rezolvare' }` between Conținut and Setări)

**Interfaces:**
- Consumes: Task 6 `listTemplates`, `saveTemplate`, `deleteTemplate`.
- Produces: server actions `saveTemplateAction(input)` and `deleteTemplateAction(id)`, returning `ActionResult`, following the `run()` pattern of `lessons/[id]/actions.ts`.

Behaviour:
- A list (title, type label or „Orice tip”, „Folosit în n exerciții”) with Adaugă / Editează / Șterge.
- The form: Titlu, Tip (select with an empty option), Punctaj la BAC (text), Conținut (`RichTextInput` from `components/editor/cards/RichTextInput.tsx`, reused as is).
- A failed delete shows the action's error.

- [ ] **Step 1: Write `TemplatesEditor.test.tsx`**

  RTL with mocked actions: it renders rows with usage counts, adding calls `saveTemplateAction` with the trimmed fields, and a delete error is displayed.

- [ ] **Step 2: Run it and check it fails; implement; run it and check it passes**

  Run: `pnpm --filter @prepio/admin test TemplatesEditor`

- [ ] **Step 3: Commit**

  `feat(admin): solution template library`

---

### Task 8: Admin: Consolidare tab: sources, exercise list, deterministic types, span marking

**Files:**
- Create in `apps/admin/src/components/editor/consolidation/`:
  - `ConsolidationEditor.tsx`, `SourcesEditor.tsx`, `SourceForm.tsx`;
  - `ExerciseList.tsx`, `ExerciseForm.tsx`, `exerciseModel.ts`, `exerciseModel.test.ts`;
  - `SpanMarker.tsx`, `selection.ts`, `selection.test.ts`;
  - `ShortAnswerFields.tsx`, `MultiAnswerFields.tsx`, `SpansFields.tsx`, `LetterFields.tsx`, `PairsFields.tsx`;
  - `ExerciseForm.test.tsx`
- Modify:
  - `apps/admin/src/app/(admin)/lessons/[id]/actions.ts`: add `saveSource`, `previewSourceImpact`, `deleteSource` and `saveConsolidationExercise`; `TABLES` gets `consolidation_exercises` and `sources`; remove `saveExercise`;
  - `apps/admin/src/components/editor/LessonEditor.tsx`: tabs „Carduri (n)”, „Verificare (n)”, „Consolidare (n)”; remove the exercises tab;
  - delete `ExercisesEditor.tsx`.

**Interfaces:**
- Consumes: Task 6 types and functions, Task 5 `CONSOLIDATION_TYPE_LABELS` and `emptyExerciseContent`, Task 3 `tokenizeSource`.
- Produces:

```ts
// selection.ts — char offsets of the current DOM selection inside `container`, whose text content equals the source body
export function selectionOffsets(container: HTMLElement, selection: Selection | null): { start: number; end: number } | null;
// snaps to whole words of tokenizeSource(body); null for an empty/whitespace selection
export function snapToWords(body: string, start: number, end: number): { start: number; end: number } | null;
// exerciseModel.ts — form draft <-> ExerciseInput
export type ExerciseDraft = ExerciseInput; // plus UI-only fields if needed
export function draftFor(type: ConsolidationType, newId: () => string): ExerciseDraft;
export function changeType(draft: ExerciseDraft, type: ConsolidationType, newId: () => string): ExerciseDraft; // keeps prompt, sources, template, model answer
```

Behaviour:
- **`SourcesEditor`:** the list (title or the first words, author, word count, „folosită în n exerciții”), add, edit and delete.
- **`SourceForm` save:** first call `previewSourceImpact`. If any exercise would get detached spans, show a confirm listing the exercise prompts and the span texts („Aceste răspunsuri marcate nu se mai găsesc în textul nou: …”), then call `saveSource`.
- **`ExerciseList`:** the rows show the type label, the prompt and a red „Invalid” badge with the errors when `errors.length`. Reordering uses the cards' `SortableList` / ↑↓ pattern; „Adaugă exercițiu” opens a type picker (pattern of `cards/TypePicker.tsx`).
- **`ExerciseForm`:**
  - Enunț;
  - Surse: up to 2 selects, labelled A and B, from the lesson's sources;
  - Șablon de rezolvare: a select with templates whose `exerciseType` matches listed first, and an inline warning „Exercițiul nu are șablon de rezolvare.” when empty;
  - the per-type fields;
  - Răspuns model / explicație;
  - validation errors from the action shown above the Save button.
- **`SpanMarker`** (props `{ source: Source; spans: AnswerSpan[]; onAdd(span): void; onChange(span): void; onRemove(id): void; actions: Array<{ label: string; onClick: (sel: {start;end}) => void }> }`):
  - renders the body with `white-space: pre-wrap`, the spans highlighted;
  - the action buttons are enabled while a snapped selection exists;
  - clicking a highlight selects it and shows „Șterge” and „Extinde limita: propoziția anterioară / următoare” / „Limită implicită”.
- **Per type:**
  - `ShortAnswerFields`: accepted variants (textarea, one per line) and the common mistakes (rows answer + message).
  - `MultiAnswerFields`: N plus the groups (each a textarea of variants).
  - `SpansFields`: N plus the `SpanMarker` with the action „Marchează ca răspuns corect”. It is reused by `viewpoint` in Task 9.
  - `LetterFields`: the correct letter (A/B radio) and the evidence marked in the correct source with a `SpanMarker`.
  - `PairsFields`:
    - a list of pairs;
    - „Adaugă pereche” enters a two-step mode: the `SpanMarker` actions „Marchează cauza”, then „Marchează efectul”;
    - each pair shows cause → effect plus an explanation field;
    - delete.

- [ ] **Step 1: Write `selection.test.ts`** (jsdom)

  - A selection across two highlight spans gives the right offsets.
  - Partial words snap outwards to the whole words.
  - A whitespace-only selection gives `null`.

- [ ] **Step 2: Write `exerciseModel.test.ts`**

  - `draftFor` for each of the 5 types here equals `emptyExerciseContent` plus the defaults.
  - `changeType` keeps the prompt, sources and template.

- [ ] **Step 3: Write `ExerciseForm.test.tsx`**

  Cover:
  - the type picker shows all 10 labels;
  - saving a `short_answer` calls the action with the variants split by line and trimmed;
  - the template warning appears when none is chosen;
  - action errors are rendered;
  - an exercise with `errors` shows the „Invalid” badge in `ExerciseList`.

- [ ] **Step 4: Run them and check they fail; implement; run them and check they pass**

  Run: `pnpm --filter @prepio/admin test`

- [ ] **Step 5: Commit**

  `feat(admin): consolidation tab with sources, deterministic exercise types and span marking`

---

### Task 9: Admin: AI exercise types, essay editor, settings clean-up

**Files:**
- Create: `apps/admin/src/components/editor/consolidation/AiFields.tsx`, `EssayFields.tsx`, `AiFields.test.tsx`
- Modify: `ExerciseForm.tsx` (wire `facts`, `comparison`, `viewpoint`, `argument`, `essay`), `apps/admin/src/app/(admin)/settings/SettingsForm.tsx` + `actions.ts` (remove the grade min/max fields)

Behaviour:
- **„Context pentru AI”:** a required textarea for `facts`, `comparison`, `viewpoint` and `argument`. Helper text: „Ce trebuie să știe AI-ul ca să dea feedback corect: perioada, tema, faptele/argumentele acceptate, greșeli frecvente. Elevul nu vede acest text.”
- **`facts`:** N (1–4).
- **`comparison`:** a radio, Asemănare / Deosebire.
- **`viewpoint`:** N plus `SpansFields` plus the context.
- **`argument`:** the context only. The statement to argue is the prompt.
- **`EssayFields`:** a list of 1–6 requirement cards (↑↓, delete, add). Each has its text, its own required „Context pentru AI”, an optional model answer, an optional template select and a checkbox „Cerință de argumentare (verifică conectorii)”.

- [ ] **Step 1: Write `AiFields.test.tsx`**

  - Saving a `facts` exercise without context shows the shared validator message, and saving with context calls the action with `ai.main` set.
  - The essay add, remove and reorder results in the right `requirements` order and `ai.requirements` keys.
  - A 7th requirement can't be added.

- [ ] **Step 2: Run it and check it fails; implement; run it and check it passes**

- [ ] **Step 3: Update `lesson-editor.spec.ts`**

  Replace the writing-exercise steps with: create a `[test]` source, create a `short_answer` and a `cause_effect` (mark the pair with a mouse selection), attach a template, check the list. Clean up at the end.

  Run: `LD_LIBRARY_PATH=… pnpm --filter @prepio/admin e2e`
  Expected: PASS.

- [ ] **Step 4: Commit**

  `feat(admin): AI consolidation types, essay requirements, settings clean-up`

---

### Task 10: AI evaluation endpoint

**Files:**
- Create:
  - `apps/admin/src/lib/consolidation/schema.ts`, `prompt.ts`, `prompt.test.ts`, `handler.ts`, `handler.test.ts`, `handler.int.test.ts`;
  - `apps/admin/src/app/api/consolidation/evaluate/route.ts`, `route.test.ts` (adapt from the old route test)
- Modify: `apps/admin/src/lib/evaluate/rateLimit.ts` (`USER_RATE_LIMIT = 30`), `packages/shared/src/consolidation/types.ts` (add the API types below)
- Delete: `apps/admin/src/app/api/evaluate/`, `apps/admin/src/lib/evaluate/handler*.ts`, `prompt*.ts`

**Interfaces (produces, in shared):**

```ts
export type ConsolidationEvaluateRequest = { exerciseId: string; target: 'exercise' | 'whole' | { requirementId: string }; answer: ExerciseAnswer };
export type ConsolidationEvaluateResponse = { items: FeedbackItem[] }; // ai: true on every item
export type ConsolidationEvaluateErrorCode = 'empty' | 'too_long' | 'not_found' | 'rate_limited' | 'ai_failed' | 'bad_request' | 'unauthorized';
export type ConsolidationEvaluateError = { error: ConsolidationEvaluateErrorCode; message: string };
export const MAX_ANSWER_CHARS = 3000; // per text field; essay "whole" = sum ≤ 6 × 3000
```

Admin (`schema.ts`): a zod `aiOutputSchema = z.object({ items: z.array(z.object({ key: z.string(), verdict: z.enum(['ok','almost','no']), title: z.string().max(120), good: z.array(z.string().max(400)).max(5), improve: z.array(z.string().max(400)).max(5) })).max(8) })`.

- `handleConsolidationEvaluate(body, userId, deps)`:
  1. **Validate the shape.** The `answer.type` must equal the exercise type. Text fields must be non-empty (`empty`) and ≤ `MAX_ANSWER_CHARS` (`too_long`).
  2. **Load the data with the service-role db:** the exercise (its lesson must be published), its sources, `consolidation_ai_context` and `ai_settings` (`rules`, `model`). Return `not_found` for a non-AI type, an unknown requirement, or `whole` on a non-essay.
  3. **Rate-limit** with the existing keys.
  4. **Recompute the deterministic facts.** `viewpoint`: `checkExercise` for the support marks, sending the marked **texts** and their judgements. `argument` and essay requirements with `argument: true`: `detectConnectors`.
  5. **Build the prompt** per target (below).
  6. **Call the evaluator, then parse with zod** (failure → `ai_failed`).
  7. **Keep only the expected keys.** Item keys outside the expected set for the target are dropped, and missing ones become `ai_failed`.
  8. **Return `{ items }`**, each item with `ai: true`.
- `prompt.ts`: `buildConsolidationPrompt({ rules, exercise, sources, context, target, answer, deterministic, nonce? }): { instructions: string; input: string }`.
  - **Shared instructions:**
    - „Ești profesor de istorie… elev de clasa a XII-a… pregătire pentru bacalaureat”;
    - Romanian with comma diacritics;
    - **no grade**: verdict `ok` / `almost` / `no` with the meanings „corect”, „se mai poate îmbunătăți” and „mai lucrează”;
    - `good` = what is right, `improve` = concrete next steps;
    - judge **only** against the teacher's context and general BAC criteria;
    - the nonce-delimited student text, with the same stripping loop as the old `prompt.ts`;
    - the owner's rules.
  - **Per-type part:** the requirement and the source text when present, the teacher's context, and the expected item keys with their meaning:
    - `facts`: `fact-0..n-1`;
    - `comparison`: `answer`;
    - `viewpoint`: `viewpoint` plus `support-i` only for the marks the deterministic check accepted;
    - `argument`: `fact`;
    - essay requirement: `<requirementId>`;
    - `whole`: `whole`, with the BAC writing criteria from the spec listed.
  - The deterministic results go in as facts („Conectori detectați automat: cauzalitate da/nu, concluzie da/nu. Nu contrazice acest rezultat.”).

- [ ] **Step 1: Write `prompt.test.ts`**

  - Each target includes the teacher's context and the expected keys.
  - The student text sits between nonce markers, and the markers are stripped from the student text.
  - The source text is included for `viewpoint`.
  - The connector facts are included for `argument`.
  - `whole` includes every requirement text and part in order.
  - No grade wording.

- [ ] **Step 2: Write `handler.test.ts`** (fake db / evaluator / rateLimit)

  Cover:
  - a non-AI type → `not_found`;
  - an empty or too-long answer;
  - an unpublished lesson → `not_found`;
  - the context comes from the DB even when the client sends extra fields;
  - the rate limit;
  - invalid model output → `ai_failed`;
  - an unexpected key is dropped, a missing key → `ai_failed`;
  - viewpoint marks rejected deterministically are not sent as `support-i`.

- [ ] **Step 3: Write `handler.int.test.ts`**

  Against the local DB with a fake evaluator, using an essay with 2 requirements: a requirement target and the whole target.

- [ ] **Step 4: Run them and check they fail; implement; run them and check they pass**

  Run: `pnpm --filter @prepio/admin test && pnpm --filter @prepio/admin test:int`

- [ ] **Step 5: Commit**

  `feat(api): consolidation AI evaluation endpoint; remove /api/evaluate`

---

### Task 11: Student: marker logic (pure) and markable text

**Files:**
- Create in `apps/mobile/src/components/marker/`: `markerReducer.ts`, `markerReducer.test.ts`, `wordHit.ts`, `wordHit.test.ts`, `MarkableText.tsx`, `MarkableText.test.tsx`
- Modify: `apps/mobile/src/theme/fonts.ts` (add `reading: 'Literata'` and `readingMedium: 'Literata-Medium'` from `@expo-google-fonts/literata`, added with `npx expo install @expo-google-fonts/literata`), `fonts.test.ts`

**Interfaces (produces):**

```ts
export type Pen = 'info' | 'cause' | 'effect' | 'support';
export type MarkerMark = Mark & { pen: Pen };
export type MarkerState = { pen: Pen; marks: MarkerMark[]; anchor: { sourceId: string; i: number } | null;
  drag: { sourceId: string; pen: Pen; a: number; b: number } | null; active: number | null /* index in marks */ };
export type MarkerConfig = { pens: Pen[]; limits: Partial<Record<Pen, number>>; autoNext?: Partial<Record<Pen, Pen>> };
export type MarkerAction =
  | { type: 'tap'; sourceId: string; i: number }                // tap on word i
  | { type: 'dragStart'; sourceId: string; i: number }          // after long-press (touch) or immediately (mouse)
  | { type: 'dragMove'; i: number }
  | { type: 'dragEnd' }
  | { type: 'handleStart'; end: 'start' | 'end' }               // drag a handle of the active mark
  | { type: 'setPen'; pen: Pen } | { type: 'remove'; index: number } | { type: 'swapRoles' } | { type: 'cancel' };
export function initialMarker(cfg: MarkerConfig, marks?: MarkerMark[]): MarkerState;
export function markerReducer(cfg: MarkerConfig): (s: MarkerState, a: MarkerAction) => MarkerState;
// wordHit.ts — layouts are word boxes in the MarkableText coordinate space
export type WordBox = { i: number; x: number; y: number; width: number; height: number };
export function wordAt(boxes: WordBox[], x: number, y: number): number | null; // nearest word on the touched line; null outside text
```

Reducer rules (mockup behaviour):
- **First tap on a word** sets the anchor. A second tap on the same source commits the range. A tap on an existing mark when there is no anchor toggles it as active. A tap with an anchor on another source moves the anchor.
- **Committing** removes the marks overlapping the new one. If the pen is at its limit, it removes that pen's oldest mark. The new mark becomes active. `autoNext` switches the pen when the next pen has no mark.
- **`handleStart`** lifts the active mark into `drag` with its other end fixed.
- **`setPen`** clears the anchor.
- **`swapRoles`** swaps the cause and effect pens.

`MarkableText` props: `{ source: Source; state: MarkerState; dispatch: (a: MarkerAction) => void; verdicts?: ExerciseFeedback['marks']; readOnly?: boolean; reading?: boolean }`.
- **Layout:** paragraphs are flex-wrap `View`s of per-word `Text` items. Spaces are a trailing space inside each word's text, with the mark background extended when the next word is in the same mark. Omission words are muted.
- **Measuring:** `onLayout` per word builds `WordBox[]`.
- **Gesture:** one RNGH `Gesture.Pan()`:
  - touch: `activateAfterLongPress(280)`;
  - web with a mouse: manual activation, starting on the first move beyond 6 px;
  - `dragMove` uses `wordAt`;
  - `Gesture.Tap()` composed with `Gesture.Exclusive`.
- **Scrolling:** a vertical swipe before activation must let the parent `ScrollView` scroll (`simultaneousWithExternalGesture` / `blocksExternalGesture` set accordingly).
- **Haptics:** a light haptic on activation through `expo-haptics` if it is already a dependency; otherwise skip it (no new native module).
- **Styling:** the handles are 13 px dark circles at the ends of the active mark, a separate pressable each with `hitSlop` ≥ 12, firing `handleStart`. The verdict underlines are 3 px, in the success, accent or danger colour. Pen colours: info `#FFE38A`, cause `#99F6E4`, effect `#FFD0A8`, support `#C9D7FF`. Add these to `docs/design-system.md` as documented exceptions, with the token values in `packages/shared/src/theme.ts` (`markerPen`).
- **Accessibility:** each word is reachable. An `accessibilityHint` on the text tells the student to „atinge primul și ultimul cuvânt”.

- [ ] **Step 1: Write `markerReducer.test.ts`**

  Cover every rule above:
  - tap-tap commits `{from:min,to:max}`;
  - reversed order;
  - an overlap replaces;
  - a limit replaces the oldest;
  - `autoNext` cause → effect, but not when an effect already exists;
  - a handle drag adjusts one end;
  - `setPen` clears the anchor;
  - remove;
  - `swapRoles`;
  - a `dragEnd` without a `drag` is a no-op.

- [ ] **Step 2: Write `wordHit.test.ts`**

  - A point inside a box returns that word.
  - A point in the gap between two words on one line returns the nearest.
  - A point beyond the end of a line returns the last word of that line.
  - A point above the first line or below the last returns `null`.

- [ ] **Step 3: Write `MarkableText.test.tsx`**

  - It renders every word.
  - Pressing word 2 then word 5 (through the tap handler, with the gesture mocked as in the existing tests) dispatches two `tap`s.
  - Marks get the pen background style.
  - Verdict underlines render.

- [ ] **Step 4: Run them and check they fail; implement; run them and check they pass**

  Run: `pnpm --filter @prepio/mobile test marker`

- [ ] **Step 5: Commit**

  `feat(mobile): marker reducer, hit-testing and markable source text`

---

### Task 12: Student: source card, reader, desktop split, mark slots

**Files:**
- Create in `apps/mobile/src/components/marker/`: `SourceCard.tsx`, `SourceReader.tsx`, `SourceSplit.tsx`, `MarkSlots.tsx`, `SourcePanel.tsx`, `SourcePanel.test.tsx`

**Interfaces:**
- Consumes: Task 11, Task 3 (`isShortSource`, `readingMinutes`, `tokenizeSource`).
- Produces:

```ts
/** Chooses the presentation: inline (short source), card + reader (phone), split (width ≥ 900). Renders slots/answer via children. */
export function SourcePanel(props: {
  sources: Array<{ source: Source; label: SourceLabel }>; prompt: string;
  marker?: { cfg: MarkerConfig; state: MarkerState; dispatch: (a: MarkerAction) => void; verdicts?: ExerciseFeedback['marks'] };
  children: React.ReactNode;           // the answer area (slots / fields)
}): JSX.Element;
export function MarkSlots(props: { kind: 'info' | 'support' | 'cause_effect'; count: number; state: MarkerState;
  textOf: (m: Mark) => string; onOpen: (pen: Pen, markIndex: number | null) => void; onRemove: (index: number) => void;
  onSwap?: () => void }): JSX.Element;
```

Behaviour, following the long-sources mockup exactly:
- **`SourceCard`:** a letter tile, „Sursa A”, „<author> · n paragrafe · ~m min”, the first ~4 lines faded, and „📖 Citește și marchează” (or „📖 Citește sursa” without a marker).
- **`SourceReader`:** a full-screen `Modal`, slide up, with `onRequestClose` (Android back closes it). It has:
  - the top bar: ✕, the source title, the citation;
  - the requirement on one line (tap to expand);
  - A/B tabs when there are 2 sources;
  - `MarkableText` with `reading` (serif, 17 px, line height ~1.85);
  - the minimap (marks as coloured bars proportional to the word index);
  - the bottom tray with the pen buttons (✓ when used), the hint line and „Gata”.

  The hint lines:
  - „Trage peste text (ține apăsat, apoi trage) sau atinge primul și ultimul cuvânt.”;
  - „Atinge ultimul cuvânt al informației.” while anchored;
  - „Cauza e marcată. Acum marchează efectul.”;
  - „Ambele marcate. Apasă „Gata” sau ajustează capetele.”

  Opening from a slot sets the pen and scrolls to the mark.
- **`SourceSplit`:** at a width ≥ 900, the left column holds the source (its own `ScrollView`, max ~62 characters ≈ 640 px, A/B tabs) and the right column the prompt area plus the children.
- **`MarkSlots`:** the slots as in the mockups. Cause-effect shows „↓ a dus la” and „⇅ Inversează rolurile” when both are set. Empty slots show „<Pen>: marchează în text”.

- [ ] **Step 1: Write `SourcePanel.test.tsx`**

  - A short source (< 70 words) renders inline with no card.
  - A long source renders the card, and pressing it shows the reader with the prompt line.
  - With `useWindowDimensions` mocked to 1000 wide, it renders the split and no card.
  - „Gata” closes the reader.
  - A cause-effect slot press opens the reader with the effect pen.

- [ ] **Step 2: Run it and check it fails; implement; run it and check it passes**

- [ ] **Step 3: Commit**

  `feat(mobile): source card, full-screen reader and desktop split`

---

### Task 13: Student: consolidation data, runs and API client

**Files:**
- Create: `apps/mobile/src/lib/consolidation.ts`, `consolidation.test.ts`
- Modify: `apps/mobile/src/lib/api.ts` (replace `evaluateEssay` with `evaluateConsolidation`) and `api.test.ts`, `apps/mobile/src/lib/content.ts` (drop `writing_exercises`) and `content.test.ts`

**Interfaces (produces):**

```ts
export type ConsolidationData = { lessonId: string; exercises: ConsolidationExercise[]; sources: Map<string, Source>; templates: Map<string, SolutionTemplate> };
export async function fetchConsolidation(lessonId: string, client?: SupabaseClient): Promise<ConsolidationData>; // drops exercises failing validateExercise(ex, srcs, null) and logs console.warn
export async function countConsolidation(lessonId: string, client?: SupabaseClient): Promise<number>; // valid exercises (start screen / end screens)
export type Attempt = { exerciseId: string; answer: ExerciseAnswer; verdict: Verdict | null; feedback: ExerciseFeedback };
export async function fetchAttempts(exerciseIds: string[], client?): Promise<Map<string, Attempt>>;
export async function saveAttempt(a: Attempt, client?): Promise<void>;          // upsert on (user_id, exercise_id)
export type Run = { exerciseIds: string[]; index: number; finished: boolean };
export async function fetchRun(lessonId: string, client?): Promise<Run | null>;
export async function saveRun(lessonId: string, run: Run, client?): Promise<void>;
export type RunStart = { kind: 'resume'; run: Run } | { kind: 'end' } | { kind: 'new'; run: Run };
/** Pure: what opening consolidation shows (spec "Runs"). Unknown/invalid ids are dropped; an emptied run is finished. */
export function resolveRun(valid: string[], run: Run | null, attempts: Map<string, Attempt>): RunStart;
export function newRun(valid: string[], attempts: Map<string, Attempt>, onlyNotCorrect: boolean): Run;
// api.ts
export async function evaluateConsolidation(req: ConsolidationEvaluateRequest): Promise<ConsolidationEvaluateResponse>; // same error handling, timeout and messages as evaluateEssay, path /api/consolidation/evaluate
```

- [ ] **Step 1: Write the tests**

  - `resolveRun`:
    - no run and no attempts → `new` over all;
    - no run and every exercise attempted → `end`;
    - an unfinished run → `resume` at its index, with the ids filtered to valid ones and the index clamped;
    - a run whose ids are all gone → `end` when attempts exist, otherwise `new`;
    - a finished run → `end`.
  - `newRun(…, true)` keeps only the exercises whose latest verdict isn't `ok`.
  - `fetchConsolidation` with a mocked client drops an exercise with a detached span and keeps the rest in position order.
  - `evaluateConsolidation`: the success path, a 429 message, the timeout, a missing `apiUrl`. Adapt the old `evaluateEssay` tests.

- [ ] **Step 2: Run them and check they fail; implement; run them and check they pass**

  Run: `pnpm --filter @prepio/mobile test consolidation api content`

- [ ] **Step 3: Commit**

  `feat(mobile): consolidation data, attempts, runs and API client`

---

### Task 14: Student: lesson zones and end screens

**Files:**
- Modify:
  - `apps/mobile/src/lib/lessonFlow.ts` + test: remove the exercises from `resumePoint`; `phase:'exercises'` → `null`;
  - `apps/mobile/src/lib/progress.ts` + test: `PHASES` = cards, questions; a stored `exercises` position parses to `null`;
  - `apps/mobile/src/screens/LessonScreen.tsx` + test: remove the `exercises` phase and `WritingExercise`; load `countConsolidation` with the lesson;
  - `apps/mobile/src/screens/lesson/LessonStart.tsx`: the three zones;
  - `apps/mobile/src/screens/lesson/GuidedResult.tsx`: the consolidation CTA;
  - `CardStepper.tsx` (the label „La exerciții” → „La verificare”).
- Move: `apps/mobile/app/(app)/lesson/[id].tsx` → `apps/mobile/app/(app)/lesson/[id]/index.tsx`. Create `apps/mobile/app/(app)/lesson/[id]/consolidare.tsx` (renders `ConsolidationScreen` from Task 15; a placeholder until then is acceptable inside this task's commit only if Task 15 follows directly).
- Delete: `apps/mobile/src/components/WritingExercise.tsx` + test.

Behaviour (flow mockup, screens 1–2):
- **`LessonStart`:** under the title, three zone rows: „📖 Învățare · n carduri”, „✅ Verificare · n întrebări”, „🎯 Consolidare · n exerciții tip BAC”.
  - A finished lesson's zones show ✓ (pass `finished: boolean`).
  - Consolidare: when the lesson isn't finished, it is dimmed with „Se deschide după ce termini verificarea”. When finished, the row is pressable and navigates to `/lesson/<id>/consolidare`. It is hidden when n = 0.
  - Wording: „Știu deja — sari la verificare”. The skip dialog title is „Sari la verificare?”. In `SKIP_MESSAGE`, „exercițiile” becomes „verificarea”.
- **`GuidedPassed` and the free `LessonDone`:** when n > 0, a card „🎯 Consolidare deblocată — Exersează cerințele de BAC pe lecția asta”, a primary „Începe consolidarea” and a secondary „Mergi la lecția următoare” (guided with `nextId`), otherwise „Înapoi la lecții”.

- [ ] **Step 1: Update the tests first**

  - `lessonFlow.test.ts`: a position with phase `exercises` → `null`; all questions answered stays on the last question.
  - `progress.test.ts`: `positionFromJson({phase:'exercises',…})` → `null`.
  - `LessonScreen.test.tsx`:
    - the start screen lists 3 zones;
    - consolidation is locked on an unfinished lesson and opens on a finished one (router push asserted);
    - the guided pass shows „Începe consolidarea” when there are consolidation exercises and not when there are none;
    - no writing exercise is ever shown.

- [ ] **Step 2: Run them and check they fail; implement; run them and check they pass**

  Run: `pnpm --filter @prepio/mobile test`

- [ ] **Step 3: Commit**

  `feat(mobile): lesson zones, consolidation entry points, writing exercises removed`

---

### Task 15: Student: consolidation screen and every exercise type

**Files:**
- Create:
  - `apps/mobile/src/screens/ConsolidationScreen.tsx`, `ConsolidationScreen.test.tsx`;
  - `apps/mobile/src/screens/consolidation/ExerciseScreen.tsx`, `FeedbackView.tsx`, `TemplateSheet.tsx`, `ConsolidationEnd.tsx`;
  - `apps/mobile/src/components/consolidation/*Input.tsx`, `ConnectorChips.tsx`, `EssayInput.tsx`, with tests `ExerciseInputs.test.tsx` and `EssayInput.test.tsx`

**Interfaces:**
- Consumes: Tasks 5, 11, 12, 13.
- Produces: `ConsolidationScreen` (default export, reads `id` from `useLocalSearchParams`). Each input has the props `{ exercise: ConsolidationExercise; sources: Source[]; value: ExerciseAnswer; onChange(v: ExerciseAnswer): void; feedback: ExerciseFeedback | null; disabled: boolean }`.

Behaviour (types mockup, every tab):
- **Loading:** consolidation is only reachable when the lesson is finished. If it isn't (a direct URL), show the message „Consolidarea se deschide după ce termini lecția.” with „Înapoi la lecție”.
- **Opening:** load the data, attempts and run, then apply `resolveRun`. `new` saves the run.
- **`ExerciseScreen`:** a `ScreenLayout` with the progress (index+1)/N, the type chip, „💡 Cum rezolv” (only with a template), the prompt, `SourcePanel` (when the exercise has sources) and the type's input.
  - The action bar has „Verifică”. It is disabled until the answer is complete: all fields non-empty, the required marks set.
  - After checking: „Continuă” and „Încearcă din nou”.
  - The last exercise's „Continuă” marks the run finished and shows `ConsolidationEnd`.
- **Checking:**
  1. Run `checkExercise`.
  2. For AI types, if the deterministic feedback has no blocking `no` items for empty inputs, call `evaluateConsolidation` with the loading row „Se analizează răspunsul…” and merge the items (viewpoint: deterministic `support-*` plus AI `viewpoint` / `support-*`).
  3. Set the final verdict. AI single item: its verdict. Several: `ok` if all ok, `no` if all no, otherwise `almost`.
  4. Save the attempt. Its failure only logs, as position saves do.
  5. Advance the run index on „Continuă” and save the run.
- **AI errors:** an AI error shows the API message inline with „Reîncearcă”. Nothing is saved.
- **`FeedbackView`:**
  - the verdict boxes with an icon and a title;
  - „Bine:” / „Ce poți îmbunătăți” lists;
  - the „Vezi răspunsul” / „Vezi toate informațiile corecte” / „Vezi relațiile posibile din sursă” / „Vezi un răspuns model” disclosure from `reveal` / `modelAnswer`;
  - the AI note under AI items: „Feedback generat cu AI pe baza indicațiilor profesorului. Poate greși.” (mixed types: „…informațiile sunt verificate exact.”);
  - the swapped cause-effect shows „⇅ Inversează rolurile”, which dispatches `swapRoles` and clears the feedback.
- **Inputs:**
  - `ShortAnswerInput`: a `TextField` with a green, amber or red border from the feedback.
  - `MultiAnswerInput`: N numbered fields, each coloured from `fields`.
  - `LetterInput`: the `OptionRow`s A/B (the existing UI kit), after checking the correct one is green and the picked wrong one red. The evidence is highlighted in the source through `verdicts`.
  - `FactsInput`: N `TextArea`s „Faptul istoric i”. The feedback is grouped per fact under a „FAPTUL i” caption.
  - `ComparisonInput`: one `TextArea` with a 600-character counter.
  - `ViewpointInput`: „1 · Punctul tău de vedere” `TextArea` and „2 · Marchează în sursă două informații care îl susțin” `MarkSlots` (support).
  - `ArgumentInput`: a `TextArea` plus `ConnectorChips` (live `detectConnectors`), with the „○ / ✓ Conector de cauzalitate / de concluzie” chips.
  - `EssayInput`:
    - collapsible requirement cards, each with a number tile, the text, the state chip (Necompletat / Corect / Aproape / Mai lucrează) and a `TextArea` with a character count;
    - `ConnectorChips` when `argument`;
    - „Verifică cerința” calls the API with `{requirementId}`, then saves the attempt with the merged per-part feedback;
    - the action bar „Verifică eseul întreg” is enabled when every part has text and calls `target:'whole'`;
    - the essay verdict is the whole-essay verdict, otherwise `null`.
- **`TemplateSheet`:** a `Modal` bottom sheet (on a width ≥ 900, a centred dialog of max 560 px) with the type label (accent), the title, „La BAC: <points>”, the body through the existing `RichText` component and „Am înțeles”. `onRequestClose` closes it.
- **`ConsolidationEnd`:** „Consolidare parcursă”, „Fără note, doar unde mai ai de lucrat.”, then a row per exercise (dot plus type label plus verdict chip; essay: „n din N” when there is no whole verdict), and three buttons:
  - „Reia consolidarea” (`newRun` all);
  - „Reia doar ce nu a fost corect” (hidden when all are ok);
  - „Mergi la lecția următoare” (guided: the next current lesson; free: the next in order; last lesson: „Înapoi acasă”).

- [ ] **Step 1: Write `ExerciseInputs.test.tsx`**

  One test per input: it renders, `onChange` emits the right `ExerciseAnswer`, and the feedback colouring follows `fields`/`marks`. Plus `ConnectorChips` lighting up for „deoarece” and „Așadar”.

- [ ] **Step 2: Write `EssayInput.test.tsx`**

  - Per-requirement check calls the API with `requirementId`.
  - The state chip updates.
  - The whole check is disabled until every part has text.

- [ ] **Step 3: Write `ConsolidationScreen.test.tsx`**

  Mocked data, attempts, run and API. Cover:
  - a not-finished lesson shows the lock message;
  - a new run starts at 1/N and saves the run;
  - a short-answer check gives „Corect!” and saves the attempt;
  - an AI type calls `evaluateConsolidation` and shows the AI note;
  - an AI error shows „Reîncearcă” and saves nothing;
  - the last „Continuă” shows the end screen with verdict chips;
  - „Reia doar ce nu a fost corect” builds a run of the non-ok exercises;
  - reopening with a finished run lands on the end screen;
  - the template button opens the sheet, and it is absent without a template.

- [ ] **Step 4: Run them and check they fail; implement; run them and check they pass**

  Run: `pnpm --filter @prepio/mobile test && pnpm --filter @prepio/mobile typecheck`

- [ ] **Step 5: Commit**

  `feat(mobile): consolidation run, exercise screens for all ten types, templates and summary`

---

### Task 16: Content: seed, templates, sample exercises, production script

**Files:**
- Modify:
  - `packages/content/src/types.ts`: `SeedLesson` drops `exercises` and adds `sources: SeedSource[]` and `consolidation: SeedConsolidation[]`;
  - `seed.ts`, `seed.int.test.ts`, `content.test.ts`;
  - `lessons/01-unirea-principatelor.ts`, `02-constitutia-1866.ts`, `03-independenta.ts`;
  - `demoLesson.ts` + tests, `removeTestLessons.ts` + tests (`writing_exercises` → consolidation tables);
  - `defaults.ts` (drop the grade defaults from `AiDefaults` writes);
  - `scripts/content-cloud.sh`, the root `package.json`.
- Create: `packages/content/src/templates.ts`, `consolidation.ts` (+ `consolidation.test.ts`), `addConsolidation.ts`, `addConsolidation.int.test.ts`

**Interfaces (produces):**

```ts
export type SeedSource = { key: string; title: string | null; author: string; work: string; body: string };
/** Spans are authored as exact quotes from the source body; `toExercise` turns them into offsets (throws if a quote is not found). */
export type SeedSpan = { source: string; quote: string };
export type SeedConsolidation = { prompt: string; template: string /* SeedTemplate key */ | null; sources: string[];
  modelAnswer?: string; explanation?: string; ai?: AiContext } & SeedConsolidationContent; // content mirrors ConsolidationContent with SeedSpan instead of AnswerSpan
export type SeedTemplate = { key: string; title: string; exerciseType: ConsolidationType | null; points: string; body: string };
export const TEMPLATES: SeedTemplate[];                         // templates.ts — one per type, copy adapted from HINTS in the types mockup
export function toExercise(c: SeedConsolidation, sourceIds: Map<string, string>, bodies: Map<string, string>, templateIds: Map<string, string>, newId: () => string): { exercise: ConsolidationExercise; ai: AiContext };
export async function addConsolidation(client: SupabaseClient, opts: { apply: boolean }): Promise<{ planned: string[] }>; // idempotent production upsert
```

Content to write (Claude authors it; the owner reviews it, as with the existing lessons):
- **Templates:** the ten mockup hint texts, written as rich-text Markdown: `### Pașii`, an ordered list, `### Exemplu` in a callout, `### Atenție` in a warning callout.
- **Each seed lesson:**
  - 1–2 sources, written from the lesson's own material in the style of a historian's quotation, with an attributed generic citation („Manual de istorie, clasa a XII-a”). Exact quotations from copyrighted books are not used.
  - At least the deterministic types: `short_answer`, `multi_answer`, `source_info`, `source_letter` (lesson 1 has 2 sources), `cause_effect`.
  - Across the three lessons, every AI type appears at least once, with its context.
  - The existing seed writing exercises become `essay` exercises with one requirement, their old criteria as the context, the same as the migration.
- **`addConsolidation`:**
  - inserts the missing templates (by title);
  - for each published production lesson that matches a seed lesson by title and has no non-essay consolidation exercise, inserts its sources and the non-essay seed exercises after the existing ones;
  - prints the plan in dry run;
  - a re-run plans 0.
  - The `scripts/content-cloud.sh add-consolidation` subcommand follows `add-cards`, and the root script is `"content:cloud:add-consolidation": "bash scripts/content-cloud.sh add-consolidation"`.

- [ ] **Step 1: Write `consolidation.test.ts`**

  - `toExercise` converts the quotes to offsets equal to `body.indexOf(quote)`.
  - A missing quote throws with the exercise prompt in the message.
  - Every seed lesson's exercises pass `validateExercise` with their AI context (iterate over all lessons).

- [ ] **Step 2: Update `seed.int.test.ts`**

  - Seeding creates the templates, sources and exercises with joins and contexts.
  - Each seed lesson has ≥ 5 exercises.
  - The migrated essays exist.

  Write `addConsolidation.int.test.ts`: a dry run plans the inserts, apply inserts them, and a re-run plans 0.

- [ ] **Step 3: Run them and check they fail; implement; run them and check they pass**

  Run: `pnpm --filter @prepio/content test && pnpm db:reset && pnpm seed && pnpm --filter @prepio/content test:int && pnpm db:test`

- [ ] **Step 4: Commit**

  `feat(content): templates, sources and consolidation exercises for the seed lessons; production script`

---

### Task 17: Verification, browser walk, docs, release

**Files:**
- Modify: `docs/STATUS.md`, `docs/deploy.md` (a „Consolidation rollout” section), `docs/design-system.md` (marker pens, reading serif), `README.md` (if commands changed)

- [ ] **Step 1: Run every automated suite**

  Run: `pnpm typecheck && pnpm test && pnpm db:reset && pnpm seed && pnpm db:test && pnpm --filter @prepio/admin test:int && pnpm --filter @prepio/content test:int && LD_LIBRARY_PATH=~/.local/pwlibs/root/usr/lib/x86_64-linux-gnu pnpm --filter @prepio/admin e2e && pnpm --filter @prepio/mobile exec expo export --platform web && pnpm --filter @prepio/admin build`
  Expected: everything passes. Record the counts per suite for STATUS.

- [ ] **Step 2: Browser walk (owner's rule)**

  Local stack, dev servers detached. Use Claude in Chrome if available, otherwise headless Playwright Chromium. Every check runs at 360×800 and 1280×800, with touch emulation for the marker at 360:
  - **Lesson zones:**
    - the start screen with 3 zones;
    - locked consolidation, then unlocked after a guided pass (CTA) and a free finish;
    - the old `exercises` position doesn't break resume.
  - **Each of the 10 types:** the happy path plus every verdict branch in the mockup's „Încearcă” notes.
  - **The marker:** drag (mouse), long-press drag and tap-tap (touch), handles, replace, remove, auto-switch to effect, swap roles.
  - **Sources:** the reader for a long source, the inline short source, the desktop split, A/B tabs.
  - **The template sheet.**
  - **AI exercises:** at least one real AI call per AI target type (facts, comparison, viewpoint, argument, one essay requirement, the whole essay) against the local admin with the dev OpenAI key, if one is configured. If not, say so in the report.
  - **The end screen,** „Reia doar ce nu a fost corect”, and resume after a reload mid-run.
  - **Admin with `[test]` data:**
    - the template CRUD and the in-use delete guard;
    - the source CRUD, plus an edit that detaches a span: confirm dialog, „Invalid” badge, the exercise hidden from the student;
    - every exercise form;
    - the AI context required.
  - Remove the `[test]` data afterwards and check that the seed content is unchanged.
  - The console is clean.

  Record the walk in `docs/STATUS.md` like the learning-modes walk.

- [ ] **Step 3: Code review**

  Use `superpowers:requesting-code-review` on the whole branch and fix the findings. Re-run Step 1 for the affected suites.

- [ ] **Step 4: Update the docs**

  - `STATUS.md`:
    - the „Where we are” entry;
    - the decisions (copy the spec's „Decisions made by Claude”, plus any taken during implementation);
    - the backlog: the admin preview of consolidation, the connector lists in Settings, the teacher review of AI feedback, attempt history;
    - the native phone checks from the spec under Owner actions.
  - `deploy.md`: the rollout steps.
  - Commit: `docs: consolidation exercises status and rollout`.

- [ ] **Step 5: Release (the owner asked for deploy when done)**

  Per `docs/deploy.md`:
  1. `pnpm db:cloud:push:dry`: it must list only the consolidation migration. Then `pnpm db:cloud:push`.
  2. `pnpm content:cloud:add-consolidation` (dry run), then with `--apply`. A re-run plans 0.
  3. Push to `main` (or merge the branch).
  4. Check that the prepio-web and prepio-admin Vercel deployments are Ready.
  5. Production checks:
     - anon REST on the new tables is refused or empty;
     - the student REST can't read `consolidation_ai_context`;
     - `/api/consolidation/evaluate` returns 401 without a token and 403 for a foreign Origin;
     - `/api/evaluate` returns 404;
     - `/`, admin `/login` and `/templates` (logged out → redirect) load with a clean console.
  6. Start an EAS `preview` build (new font asset; no new native module unless `expo-haptics` was added).
  7. Update `STATUS.md` with the commit, the deployments and the build id.
