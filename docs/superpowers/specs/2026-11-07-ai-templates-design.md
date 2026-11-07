# AI instruction templates („Șabloane AI”) — design

Date: 2026-11-07. Status: draft, awaiting owner approval.

## Intent

Today every AI-checked consolidation exercise builds its prompt from two admin-written places: the single
„Reguli de evaluare” text in Settings and the exercise's own „Context pentru AI”. The type-specific instructions —
what the AI must look for in the student's text, which keywords matter, how the feedback is phrased — end up mixed
into both, and partly hard-coded in `apps/admin/src/lib/consolidation/prompt.ts`. The same exercise types recur in
many lessons, so the owner keeps rewriting the same type instructions in every exercise context.

The owner wants three layers, each written once where it belongs:

1. **Settings → general rules**: rules that don't depend on the exercise type (role, Romanian with diacritics, tone,
   no grades, don't rewrite the student's text, judge only against the given context…).
2. **AI templates library** (new, managed like the „💡 Cum rezolv” solution templates): reusable instructions per
   exercise type. Each AI exercise selects one.
3. **Exercise → AI context**: only the lesson-specific facts used to validate the answer (period, years, accepted
   facts/arguments, common factual mistakes).

## Current state (as found in the code)

- `ai_settings.rules` (one text, default in `packages/content/src/defaults.ts`) mixes general rules with type rules
  (rule 2 „o prezentare nu este o simplă menționare… un punct de vedere este o apreciere”, rule 4 connectors).
- `prompt.ts` hard-codes type instructions: the six whole-essay criteria (`WHOLE_CRITERIA`), „faptul istoric:
  relevant, din perioadă, prezentat și nu doar numit” (argument), „este o apreciere reală, pe tema și perioada
  cerute?” (viewpoint), „susține informația selectată punctul de vedere?”, plus the technical parts (expected keys,
  nonce delimiters, injection guard, deterministic connector/support results).
- `consolidation_ai_context.context = { main, requirements: { [requirementId]: text } }` (admin-only table). The seed
  contexts (`packages/content/src/lessons/*.ts`, demo lesson) repeat type instructions, e.g. „Faptul trebuie prezentat,
  nu doar numit”, „Cele două fapte trebuie să fie diferite”, „Răspunsul trebuie să numească ambele acte și să spună
  explicit prin ce diferă”.
- AI types: `facts`, `comparison`, `viewpoint`, `argument`, `essay` (per requirement + „Verifică eseul întreg”).
- Solution templates: table `solution_templates` (title, optional `exercise_type`, points, body), admin page
  `/templates`, chosen per exercise (`template_id`, FK `on delete restrict`) and per essay requirement
  (`requirements[].templateId` inside `content` jsonb); delete refused with „Șablonul este folosit de un exercițiu.”

## Goals

- A new admin library **„Șabloane AI”**, built like `/templates`: list, add, edit, delete; several templates allowed
  per type; deleting a template in use is refused (incl. use by an essay requirement).
- An AI template has these fields (owner decision: separate fields, as he listed them):
  - **Titlu**
  - **Tip**: one of Prezentare fapte (`facts`), Asemănare / deosebire (`comparison`), Punct de vedere (`viewpoint`),
    Argumentare (`argument`), Cerință de eseu (`essay_requirement`).
  - **Ce urmărește AI-ul în răspuns** (criteria to check).
  - **Cuvinte cheie** (signals the AI looks for, e.g. connectors „deoarece, pentru că, așadar”, „spre deosebire de, în
    timp ce”; guidance for the AI, not a mandatory list the student must use).
  - **Cum formulează răspunsul** (tone, length, what goes in „ce e bine” / „ce poți îmbunătăți”).
- Each AI exercise (`facts`, `comparison`, `viewpoint`, `argument`) selects one AI template of its type, next to
  „Context pentru AI”.
- Essay (owner decision): **each requirement selects its own AI template** (type `essay_requirement`).
- **The whole-essay check is removed completely** (owner decision, 2026-11-07): no „Verifică eseul întreg” button in
  the student app, no `target: 'whole'` in `/api/consolidation/evaluate`, no `WHOLE_CRITERIA`, no `essay_whole`
  template type, no whole-essay credit cost (`checkCost(…, 'whole')` goes). The essay is checked only requirement by
  requirement, as today's per-requirement check.
- Prompt assembly order: general rules (Settings) → the selected AI template → the exercise / requirement context →
  the student's text. The technical parts (expected keys, delimiters, injection guard, deterministic results, model
  answer as reference) stay in code.
- Settings: the „Reguli de evaluare” field becomes **„Reguli generale”**, its help text updated; the model field stays.
- Content split: the existing type instructions move out of the default rules, out of `prompt.ts` (argument / viewpoint
  criteria) and out of the seed contexts into seed AI templates; the seed contexts keep
  only facts.

## Non-goals

- No other change for students than the removed whole-essay check: same screens otherwise, same verdicts / feedback
  shape, same per-requirement credits and rate limits.
- No change to the five deterministic types (no AI) or to the „💡 Cum rezolv” solution templates.
- No AI template versioning or history; no per-lesson override of the general rules.
- No automatic link between a solution template and an AI template.

## Anti-goals

- Students must never be able to read AI templates or contexts (they guide the evaluation; same rule as
  `consolidation_ai_context`).
- The technical guardrails must not become editable: an admin edit of a template must not be able to remove the
  delimiter / injection rules or the expected-keys contract.
- No silent breakage: an AI exercise without a valid AI template must not be evaluated with half a prompt.

## Constraints

- Database changes per `docs/database-migrations.md`: new migration, RLS (admin-only, like
  `consolidation_ai_context`), pgTAP tests, local reset/seed/test, then cloud dry run → push. Never edit applied
  migrations.
- Production is test-only (no real students), so the production content may be rewritten by a content script, as with
  `pnpm content:cloud:sync-consolidation`.
- Frontend changes (admin) must be validated in the browser per CLAUDE.md, with `[test]` data cleaned up afterwards.
- Admin UI in Romanian; code, comments, docs in English.

## Decisions taken by Claude (owner to check)

- **„Required” works like the AI context today**: saving an AI exercise without an AI template of the right type is
  refused („Alege un șablon AI.”), and per essay requirement. A stored exercise whose template is
  missing counts as **invalid**, exactly like a missing AI context today: it gets the „Invalid” badge in
  the admin and the evaluate endpoint answers `not_found` before charging any credits (no
  refund path, no new student-visible message). Students still see the exercise (they cannot read the admin-only AI
  data), so the production content step must run in the same release.
- **Essay verdict without the whole check**: the essay counts as checked once every requirement has a verdict; its
  verdict is the combination of the requirement verdicts with the existing `combineVerdict` rule. The essay screen
  never locks: requirements stay editable and re-checkable; the action bar keeps „←” and „Continuă” (primary once every
  requirement has a verdict) or „Sari peste” while nothing is checked. The summary's „n din N” row keeps working
  while requirements are missing. Saved attempts that still hold an old `whole` item are read without error (the item
  is ignored). The exercise-level model answer of the essay stays in the admin and the data (no longer sent to the AI). Mobile change is
  JS-only (no native module): validated on web; the phone check with the next APK covers the essay screen.
- **What stays fixed in code vs. what moves to „Reguli generale”**: the output contract stays in code and is not
  editable: what „ok” / „almost” / „no” mean, what goes in „title” / „good” / „improve”, no grades or points, „judge
  only against the given context, don't invent facts”, plus the technical parts (keys, delimiters, injection guard,
  deterministic results, model answer as reference). The teacher role, the language (Romanian with diacritics) and the
  tone / addressing rules move to the editable general rules (they are removed from the fixed lines, so they aren't said
  twice).
- **AI exercises outside the seed lessons** (created by hand, locally or in production): the content step gives each
  one the seed template of its type (matched by title) and lists them in its dry run, so none stays hidden. Their
  contexts are left as written (they may still repeat type instructions; the owner can trim them).
- **Storage**: a new admin-only table (e.g. `ai_templates`: id, title, type, criteria, keywords, response_format,
  timestamps). The selection is admin-only data too, so it lives with the AI context (e.g. a column / fields next to
  `consolidation_ai_context`: the exercise's template id, and the per-requirement ids for essays). The
  builder picks the exact shape; the delete-in-use check must cover every place a template id can appear.
- **Template type only filters the dropdown**: the exercise form lists templates whose type matches; mismatched types
  are refused on save.
- **Navigation**: „Șabloane AI” is a separate entry next to „Șabloane” (the owner said „la nivel de setări”; it sits in
  the admin menu with Settings and the solution templates, as its own page, not inside the Settings form).
- **Prompt labels**: the template is rendered with headings, e.g. „Ce urmărești în răspuns:”, „Cuvinte cheie:”, „Cum
  formulezi răspunsul:”; empty fields are omitted. Only „Ce urmărește AI-ul” is required in a template.
- **Seed content**: one AI template per type (5), written by Claude from the instructions now spread across the rules,
  `prompt.ts` and the contexts; every seed / demo exercise points to the template of its type; the seed contexts are
  trimmed to facts. The default general rules are trimmed to type-independent rules.
- **Production rollout**: the migration creates the table and the selection fields (no data). A content step (extend
  `sync-consolidation` / `update-ai-settings` or a new `content:cloud:*` script, dry run then `--apply`) inserts the
  five templates by title, links the seed lessons' exercises, replaces the contexts and the general rules. Until it
  runs, production AI exercises are refused as „no template” — acceptable because production is test-only; release
  migration + content step + deploy together.

## Left to the builder

- Exact table / column names and whether the selection lives in `consolidation_ai_context.context` jsonb or in
  dedicated columns (prefer real FKs with `on delete restrict` where possible).
- Wording of the five seed templates and the trimmed rules/contexts, keeping the BAC logic now in the code.
- Admin list layout (mirror `/templates`, grouped or filtered by type), usage count per template.
- Test coverage: shared validation, prompt builder (order, omitted empty fields, guardrails still present), endpoint
  (missing template), admin forms and library, pgTAP (students can't read the new table), content scripts.
