# AI Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the AI evaluation prompt into general rules (Settings), reusable per-type AI templates (new admin library, selected per exercise / per essay requirement) and per-exercise facts, and remove the whole-essay check.

**Architecture:** A new admin-only table `ai_templates` holds the library; a second admin-only table `consolidation_ai_template_links` links an exercise (requirement_id `''`) or an essay requirement to one template, with `on delete restrict`. The admin loads/saves the links together with the AI context (`AiContext` grows `templateId` and `requirementTemplates`); the evaluate handler loads the template for the target and the prompt builder inserts it between the general rules and the fixed output contract. Seed content ships one template per type; a new content script rolls it out to production.

**Tech Stack:** Supabase Postgres + pgTAP, Next.js admin (react-bootstrap, server actions), Expo / React Native Web student app, TypeScript shared package, Vitest / Jest.

**Spec:** `docs/superpowers/specs/2026-11-07-ai-templates-design.md`

## Global Constraints

- Commands run in WSL with nvm: `wsl -d Ubuntu-22.04 -- bash -ic "cd ~/projects/prepio_new && <cmd>"`.
- DB changes per `docs/database-migrations.md`: `pnpm db:new ai_templates`, RLS on every new table, pgTAP test, `pnpm db:reset && pnpm seed && pnpm db:test`. Never edit an applied migration. Cloud push only in Task 9, with the owner's approval.
- AI template types (exact strings): `facts`, `comparison`, `viewpoint`, `argument`, `essay_requirement`. Romanian labels: „Prezentare fapte”, „Asemănare / deosebire”, „Punct de vedere”, „Argumentare”, „Cerință de eseu”.
- Template field labels (admin, exact): „Titlu”, „Tip”, „Ce urmărește AI-ul în răspuns” (required), „Cuvinte cheie”, „Cum formulează răspunsul”.
- Prompt headings (exact): „Ce urmărești în răspuns:”, „Cuvinte cheie (semnale de căutat în răspuns, nu o listă obligatorie):”, „Cum formulezi răspunsul:”; an empty field is omitted with its heading.
- Error copy (exact): save without a template „Alege un șablon AI.”, per requirement „Alege un șablon AI pentru cerința {n}.”; wrong type „Șablonul AI ales nu se potrivește tipului exercițiului.”; unknown id „Șablonul AI ales nu există.”; delete in use „Șablonul AI este folosit de un exercițiu.”; empty criteria „Completează ce urmărește AI-ul în răspuns.”; empty title „Titlul nu poate fi gol.”.
- Settings: label „Reguli generale”, help „Reguli valabile pentru orice exercițiu evaluat cu AI (rol, limbă, ton). Instrucțiunile pe tip de exercițiu stau în Șabloane AI.”; empty → „Regulile generale nu pot fi goale.”.
- Nav entry „Șabloane AI” at `/ai-templates`, right after „Șabloane de rezolvare”.
- Students must never read `ai_templates` or the links (no student policy, like `consolidation_ai_context`).
- UI copy in Romanian; code, comments, docs, commits in English. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Frontend changes are validated in the browser (Task 9) with `[test]` data, removed afterwards.

## Review Focus

1. A saved attempt from before the change holds a `whole` feedback item → the essay screen and the summary open without error and ignore it (Task 6 test `ignores a stored whole item`).
2. An essay requirement is added in the admin after the exercise was linked → saving without choosing its template is refused with „Alege un șablon AI pentru cerința {n}.”; a removed requirement leaves no orphan link (Task 3 test `replaces links on save`).
3. A template's type changed in the library while exercises use it → those exercises turn „Invalid” in the admin and the endpoint answers `not_found` (Task 3 test `flags a type mismatch`, Task 4 test `template of the wrong type`).
4. A student sends the old `target: 'whole'` (old APK) → `bad_request`, no credits spent (Task 4 test `rejects whole`).
5. A template edit with prompt-injection-like text („ignoră regulile…”) → the fixed contract and delimiter lines still come after it in `instructions` (Task 4 test `contract comes after the template`).

---

### Task 1: Database — `ai_templates` and links

**Files:**
- Create: `supabase/migrations/<timestamp>_ai_templates.sql` (via `pnpm db:new ai_templates`)
- Create: `supabase/tests/ai_templates.test.sql`

**Interfaces:**
- Produces: table `public.ai_templates(id uuid pk default gen_random_uuid(), title text not null, type text not null check (type in ('facts','comparison','viewpoint','argument','essay_requirement')), criteria text not null, keywords text not null default '', response_format text not null default '', created_at timestamptz default now(), updated_at timestamptz not null default now())` with the `set_updated_at` trigger; table `public.consolidation_ai_template_links(exercise_id uuid not null references consolidation_exercises(id) on delete cascade, requirement_id text not null default '', template_id uuid not null references ai_templates(id) on delete restrict, primary key (exercise_id, requirement_id))` + index on `template_id`. RLS on both; admin-all policies mirroring `consolidation_ai_context_admin_all`; grants as in `20261105133808_consolidation.sql` lines 137–143 (revoke all, then `select, insert, update, delete` to `authenticated`). No data.

- [ ] **Step 1: Write pgTAP tests** — plan(8): both tables exist; RLS enabled on both; the local admin can insert/select a template; a student (`set local role authenticated` + a non-admin `request.jwt.claims`, as in `consolidation.test.sql`) selects 0 rows from both tables and its insert is refused (42501); deleting a linked template raises 23503; deleting the exercise removes its links; an invalid `type` raises 23514.
- [ ] **Step 2:** `pnpm db:test` → the new file FAILS (tables missing).
- [ ] **Step 3:** Write the migration.
- [ ] **Step 4:** `pnpm db:reset && pnpm seed && pnpm db:test` → all pass.
- [ ] **Step 5:** Commit `feat(db): ai_templates library and exercise links`.

### Task 2: Shared model — AI templates, required template, no whole target

**Files:**
- Modify: `packages/shared/src/consolidation/types.ts`, `packages/shared/src/consolidation/exercises.ts` (validateExercise, ~311–386), `packages/shared/src/credits.ts`, the shared index exports
- Test: `packages/shared/src/consolidation/exercises.test.ts`, `packages/shared/src/credits.test.ts`

**Interfaces:**
- Produces:
  - `type AiTemplateType = 'facts' | 'comparison' | 'viewpoint' | 'argument' | 'essay_requirement'`; `AI_TEMPLATE_TYPES: AiTemplateType[]`; `AI_TEMPLATE_TYPE_LABELS: Record<AiTemplateType, string>` (labels from Global Constraints).
  - `type AiTemplate = { id: string; title: string; type: AiTemplateType; criteria: string; keywords: string; responseFormat: string }`; `aiTemplateFromRow(row: Record<string, unknown>): AiTemplate` (snake → camel).
  - `AiContext = { main: string; requirements: Record<string, string>; templateId: string | null; requirementTemplates: Record<string, string> }`.
  - `aiTemplateTypeFor(type: ConsolidationType): AiTemplateType | null` (`essay` → `essay_requirement`, the 4 AI types → themselves, others → null).
  - `ConsolidationEvaluateRequest['target']` becomes `'exercise' | { requirementId: string }`; `checkCost(ex, target)` and `targetKey(target)` lose the `'whole'` branch.
- `validateExercise(ex, sources, ai)`: when `ai` is given, an AI type without `ai.templateId` → „Alege un șablon AI.”; each essay requirement without `ai.requirementTemplates[r.id]` → „Alege un șablon AI pentru cerința {i+1}.”. `null` ai (student app) keeps skipping these checks.

- [ ] **Step 1: Tests** — `validateExercise` with `{ main: 'ctx', requirements: {}, templateId: null, requirementTemplates: {} }` on an `argument` returns `['Alege un șablon AI.']`; an essay with two requirements and a template only for the first returns `['Alege un șablon AI pentru cerința 2.']`; with `ai = null` neither message appears; `aiTemplateTypeFor('essay') === 'essay_requirement'`, `aiTemplateTypeFor('short_answer') === null`; `checkCost` for an essay requirement equals `creditCost`. Update the existing tests/fixtures that build `AiContext` (add the two new fields) and remove the `'whole'` cases.
- [ ] **Step 2:** `pnpm --filter @prepio/shared test` → new tests FAIL.
- [ ] **Step 3:** Implement. `pnpm typecheck` will now fail in admin/mobile/content where `AiContext` literals or `'whole'` remain: fix only literals (add `templateId: null, requirementTemplates: {}`) here; behaviour changes belong to Tasks 3–7, so leave a compiling, minimal edit (e.g. remove the `'whole'` call sites' type-only use) and note them for those tasks.
- [ ] **Step 4:** `pnpm --filter @prepio/shared test` passes; `pnpm typecheck` passes.
- [ ] **Step 5:** Commit `feat(shared): AI template model and required template`.

### Task 3: Admin data — library and links

**Files:**
- Create: `apps/admin/src/lib/data/aiTemplates.ts`, `apps/admin/src/lib/data/aiTemplates.int.test.ts`
- Modify: `apps/admin/src/lib/data/consolidation.ts` (`aiFromJson`, `loadExercises`, `getConsolidation`, `saveConsolidationExercise` ~228–240), `apps/admin/src/lib/data/consolidation.int.test.ts`

**Interfaces:**
- Consumes: Task 1 tables, Task 2 types.
- Produces:
  - `type AiTemplateWithUsage = AiTemplate & { usage: number }` (usage = number of distinct exercises linking it).
  - `listAiTemplates(db): Promise<AiTemplateWithUsage[]>` ordered by type (in `AI_TEMPLATE_TYPES` order), then title.
  - `saveAiTemplate(db, input: Omit<AiTemplate, 'id'> & { id?: string }): Promise<{ id: string }>` — trims, validates title / criteria / type (copy from Global Constraints).
  - `deleteAiTemplate(db, id): Promise<void>` — refuses with „Șablonul AI este folosit de un exercițiu.” when linked.
  - `EditorConsolidation` gains `aiTemplates: AiTemplate[]`; each exercise's `ai` carries `templateId` / `requirementTemplates` from the links (`requirement_id ''` → `templateId`).
  - `saveConsolidationExercise` writes `consolidation_ai_context.context = { main, requirements }` (template ids are NOT stored in the jsonb) and replaces the exercise's links (delete all for the exercise, insert the current ones; only requirement ids that exist in the exercise). Before writing: every chosen id exists („Șablonul AI ales nu există.”) and its type equals `aiTemplateTypeFor(ex.type)` („Șablonul AI ales nu se potrivește tipului exercițiului.”). Deterministic types store no links.
  - `getConsolidation` adds to an exercise's `errors` „Șablonul AI ales nu se potrivește tipului exercițiului.” when a linked template's type no longer matches.

- [ ] **Step 1: Int tests** (`pnpm --filter @prepio/admin test:int`, `[test]` titles, cleaned in `afterAll`): create / edit / list (usage 0 → 1 after linking); delete in use refused with the exact message, delete unused works; save an `argument` exercise with a `facts` template → type error; save an essay with templates for r1 and r2, then remove r2 and save → one link left (`replaces links on save`); change the linked template's type to `facts` → `getConsolidation` errors contain the mismatch message (`flags a type mismatch`); save without template → „Alege un șablon AI.” (via `validateExercise`).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** int + unit tests pass.
- [ ] **Step 5:** Commit `feat(admin): AI templates data and exercise links`.

### Task 4: Prompt and evaluate handler

**Files:**
- Modify: `apps/admin/src/lib/consolidation/prompt.ts`, `apps/admin/src/lib/consolidation/handler.ts`
- Test: `apps/admin/src/lib/consolidation/prompt.test.ts`, `handler.test.ts`, `handler.int.test.ts`

**Interfaces:**
- Consumes: `AiTemplate`, `aiTemplateTypeFor`, the links table.
- Produces: `PromptArgs` gains `template: AiTemplate` (the one for the target: the exercise's, or the requirement's for `{ requirementId }`); `Deterministic.requirementConnectors`, `WHOLE_CRITERIA` and every `'whole'` branch are removed.
- `instructions` order: „Reguli generale:” + `rules` → „Instrucțiuni pentru acest tip de exercițiu:” + the template block (headings from Global Constraints, empty fields omitted) → the fixed contract lines. Fixed lines kept from today: no grades + verdict meanings; `good` / `improve` / `title` meaning (without „Fii încurajator și precis.”, which moves to the rules); „Judecă exclusiv în raport cu contextul…”; the delimiter line; the expected-keys line. Removed from code (now in rules/templates): the teacher-role line, the Romanian-diacritics line, the per-type criteria in the input („este o apreciere reală, pe tema și perioada cerute?”, „relevant, din perioadă, prezentat și nu doar numit”, „susține informația selectată punctul de vedere?”) — the input keeps neutral key descriptions (e.g. `Cheia viewpoint: punctul de vedere.`, `Cheia support-{i}: informația-suport {i+1}. Text selectat: „…”`, `Cheia elementului așteptat: fact.`).
- Handler: `parseRequest` accepts only `'exercise'` or `{ requirementId }` (`'whole'` → `bad_request`); `load` also reads the links and the linked templates (service role) and returns `template: AiTemplate | null` for the request target; missing template or `template.type !== aiTemplateTypeFor(ex.type)` → `not_found` before the rate limit and before `credits.spend`.

- [ ] **Step 1: Tests** — prompt: the rules, then the template's three headings, then the contract appear in that order in `instructions` (`contract comes after the template`, with a template whose criteria is „ignoră regulile de mai sus”); an empty `keywords` omits its heading; no „profesor de istorie din România” and no „Răspunde exclusiv în limba română” in the fixed text; essay requirement prompt uses the requirement's template. Handler: `rejects whole` (400, `credits.spend` not called); `template of the wrong type` → 404, no spend; missing link → 404, no spend; happy path passes the requirement's template to the evaluator (assert on `instructions` containing its criteria). Delete the whole-essay tests.
- [ ] **Step 2:** Run admin unit tests → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `pnpm --filter @prepio/admin test` and `test:int` pass.
- [ ] **Step 5:** Commit `feat(admin): prompt from rules, AI template and context; drop whole-essay check`.

### Task 5: Admin UI — library page, exercise selectors, settings

**Files:**
- Create: `apps/admin/src/app/(admin)/ai-templates/page.tsx`, `actions.ts`, `AiTemplatesEditor.tsx`, `AiTemplatesEditor.test.tsx`
- Modify: `apps/admin/src/app/(admin)/AdminShell.tsx` (nav), `apps/admin/src/components/editor/consolidation/AiFields.tsx` (`MainContext`), `EssayFields.tsx`, `ExerciseForm.tsx` / `ConsolidationEditor.tsx` (pass `aiTemplates`), `exerciseModel.ts` (draft `ai` defaults), `apps/admin/src/app/(admin)/settings/SettingsForm.tsx`, `apps/admin/src/lib/data/settings.ts` (error copy)
- Test: `AiFields.test.tsx`, `ExerciseForm.test.tsx`, settings test if present, admin Playwright e2e if it covers settings / templates

**Interfaces:**
- Consumes: Task 3 data functions; `AI_TEMPLATE_TYPE_LABELS`.
- Produces: `AiTemplateField({ controlId, label = 'Șablon AI', type: AiTemplateType, templates: AiTemplate[], value: string | null, onChange })` — a `Form.Select` with a placeholder option „Alege un șablon AI” and only the templates of `type`; under it a link „Gestionează șabloanele AI” to `/ai-templates`. Rendered above „Context pentru AI” in `MainContext` and in each essay requirement card. `AI_CONTEXT_HELP` becomes „Faptele pe care AI-ul le folosește la verificare: perioada, ani, fapte/argumente acceptate, greșeli frecvente de conținut. Instrucțiunile de tip stau în șablonul AI. Elevul nu vede acest text.”
- The library page mirrors `/templates` (`TemplatesEditor` pattern: list with usage count, add / edit form, delete with confirmation, in-use delete shows the server error). The list is grouped by type with the Romanian label as group heading.

- [ ] **Step 1: Tests** — editor: creates a template (fields by the exact labels), shows the server's in-use error on delete, groups by type; `AiTemplateField` lists only matching-type templates and calls `onChange` with the id; essay card renders its own selector; settings shows „Reguli generale”.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `pnpm --filter @prepio/admin test` passes; `pnpm typecheck`.
- [ ] **Step 5:** Commit `feat(admin): AI templates page and per-exercise template choice`.

### Task 6: Student app — essay without the whole check

**Files:**
- Modify: `apps/mobile/src/screens/consolidation/ExerciseScreen.tsx` (~143–186, ~300–312), `FeedbackView.tsx` (~150–156), `apps/mobile/src/components/consolidation/EssayInput.tsx` (intro note, „Eseul întreg” block ~183–193), `apps/mobile/src/lib/credits.ts:122`, `apps/mobile/src/screens/consolidation/status.ts`, `checking.ts` (comments)
- Test: `ExerciseScreen.test.tsx`, `FeedbackView.test.tsx`, `EssayInput` / status / credits tests

**Interfaces:**
- Consumes: `combineVerdict(items)` and `mergeItems` from `checking.ts`.
- Behaviour: on each requirement result, `ExerciseScreen` calls `onChecked` with `verdict = every requirement has an item ? combineVerdict(requirement items) : null` (items whose key is not a requirement id, e.g. an old `whole`, are ignored). The essay never sets `checked` (`checked = essay ? false : feedback !== null`), inputs stay enabled. Action bar for the essay: `←` + „Continuă” (primary when every requirement has a verdict, secondary when some do) or „Sari peste” when none do. The „Verifică eseul întreg” button, `check`'s essay branch and `FeedbackView`'s essay rendering (it renders nothing for an essay) go. EssayInput intro becomes „Scrie fiecare cerință în câmpul ei și verifică-le pe rând.”; the „Eseul întreg” block becomes one caption „{ok} din {N} cerințe corecte”. `credits.ts` drops the „eseul întreg” label branch.

- [ ] **Step 1: Tests** — no „Verifică eseul întreg” text in the essay screen; after both requirement checks (mocked `evaluateConsolidation`), `onChecked` receives `verdict: 'almost'` for ok + no, `'ok'` for ok + ok; after one of two, `verdict: null`; inputs stay editable after all are checked; `ignores a stored whole item` (restored feedback with `whole` + one requirement → caption „1 din 2 cerințe corecte” or matching ok count, no crash, `onChecked` verdict ignores `whole`).
- [ ] **Step 2:** `pnpm --filter @prepio/mobile test` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Tests pass; `pnpm typecheck`.
- [ ] **Step 5:** Commit `feat(mobile): essay checked per requirement only`.

### Task 7: Seed content — templates, trimmed rules and contexts

**Files:**
- Create: `packages/content/src/aiTemplates.ts`
- Modify: `packages/content/src/types.ts` (`SeedAiTemplate`), `defaults.ts` (rules), `consolidation.ts` (`toExercise`, `writeConsolidation`, `insertConsolidation`, new `ensureAiTemplates`), `seed.ts`, `lessons/*.ts`, `demoLesson.ts`, `addConsolidation.ts` / `syncConsolidation.ts` (pass AI template ids through)
- Test: `content.test.ts`, `consolidation.test.ts`, `seed.int.test.ts`, `addConsolidation.int.test.ts`, `syncConsolidation.int.test.ts`, `demoLesson.*.test.ts`

**Interfaces:**
- Produces: `type SeedAiTemplate = { key: AiTemplateType; title: string; criteria: string; keywords: string; responseFormat: string }`; `AI_TEMPLATES: SeedAiTemplate[]` (exactly one per type, key = type); `ensureAiTemplates(client, apply, templates = AI_TEMPLATES): Promise<{ ids: Map<AiTemplateType, string>; missing: SeedAiTemplate[] }>` (by title, like `ensureTemplates`). `toExercise(c, sourceIds, bodies, templateIds, aiTemplateIds: Map<AiTemplateType, string>, newId)` fills `ai.templateId` / `ai.requirementTemplates` from the exercise type (seed exercises never name an AI template); `writeConsolidation(…, templateIds, aiTemplateIds, newId)` inserts the links after the contexts (rollback unchanged: links cascade with the exercises).
- Content (written by the implementer, Romanian):
  - Templates: move into them every type instruction now in the rules (rule 2, rule 4), in `prompt.ts` (argument, viewpoint, support criteria; the removed whole-essay criteria may inform the `essay_requirement` template only where they apply to one requirement) and in the seed contexts (e.g. „Faptul trebuie prezentat, nu doar numit”, „Cele două fapte trebuie să fie diferite…”, „Răspunsul trebuie să numească ambele acte și să spună explicit prin ce diferă…”, „Nu se acceptă o asemănare…”, „Nu este punct de vedere: o simplă informație…”). Keywords: causal and conclusion connectors for argument / essay_requirement; „spre deosebire de, în timp ce, la fel ca, ambele” for comparison.
  - Rules (`aiDefaults.rules`): only type-independent rules — role (history teacher, BAC E.c, clasa a XII-a), Romanian with diacritics, factual accuracy, period/theme fit, BAC weighting, off-topic answer handling, feedback rules (tu, short, concrete suggestions, no rewriting, encouraging, clear and precise tone).
  - Contexts: only facts — period, theme, accepted facts / arguments / differences / viewpoints as content, common factual mistakes. Every AI exercise in the 3 lessons and the demo.

- [ ] **Step 1: Tests** — `AI_TEMPLATES` has one entry per `AI_TEMPLATE_TYPES`, non-empty criteria, unique titles; `aiDefaults.rules` does not match `/simplă menționare|punct de vedere este o apreciere|deoarece/`; no seed AI context matches `/trebuie (să fie )?prezentat|nu doar numit|Nu este punct de vedere|Nu se acceptă/i`; after `pnpm seed`, every AI exercise has the right links (`seed.int.test.ts`: count of links = AI non-essay exercises + essay requirements; types match); seed count of `ai_templates` = 5. Existing content tests updated for the new `toExercise` / `writeConsolidation` signatures.
- [ ] **Step 2:** `pnpm --filter @prepio/content test` and `test:int` → FAIL.
- [ ] **Step 3:** Write templates, trim rules and contexts, wire the links.
- [ ] **Step 4:** `pnpm db:reset && pnpm seed`; content `test` and `test:int` pass; `pnpm test` passes.
- [ ] **Step 5:** Commit `feat(content): seed AI templates, general rules and fact-only contexts`.

### Task 8: Production content script `ai-templates`

**Files:**
- Create: `packages/content/src/syncAiTemplates.ts`, `packages/content/src/syncAiTemplates.int.test.ts`
- Modify: `scripts/content-cloud.sh` (command list, header comment), root `package.json` (`"content:cloud:ai-templates": "bash scripts/content-cloud.sh ai-templates"`), `packages/content/package.json` (script entry like the others), `docs/deploy.md` (new section „AI templates rollout”)

**Interfaces:**
- Consumes: `ensureAiTemplates`, `AI_TEMPLATES`, seed lessons, `aiTemplateTypeFor`.
- Produces: `syncAiTemplates(client, { apply }): Promise<AiTemplatesSyncResult>` with `{ applied, templatesToAdd: string[], contextsToReplace: Array<{ lesson: string; prompt: string }>, linksToAdd: Array<{ lesson: string; prompt: string; requirementId: string; templateTitle: string }>, problems: string[] }` and `formatAiTemplatesSync(r): string`. Steps: (1) insert missing seed templates by title; (2) for each seed lesson matched to one published lesson by title, each AI exercise matched by type + prompt: replace `consolidation_ai_context.context` with the seed's `{ main, requirements }` when it differs (requirement ids matched by the seed ids; a mismatch is a problem, skipped); (3) every AI exercise in any lesson missing a link (exercise-level or per current requirement) gets the seed template of its type; never changes an existing link. Dry run by default; a re-run after `--apply` plans nothing. The general rules are rolled out by the existing `update-ai-settings` (its defaults change in Task 7).

- [ ] **Step 1: Int test** against the local DB: strip links and put an old-style context on a seed exercise, add a hand-made `[test]` argument exercise without links in a `[test]` lesson → dry run lists 1 context and the missing links and writes nothing; `--apply` fixes them; second run plans 0; an existing link to another template is kept. Clean up `[test]` rows.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement + wire the scripts + `docs/deploy.md` (order: `db:cloud:push:dry` → `db:cloud:push` → `content:cloud:update-ai-settings` (dry, then `--apply`) → `content:cloud:ai-templates` (dry, then `--apply`) → `content:cloud:demo` → push `main` (Vercel deploys web + admin) → EAS preview build).
- [ ] **Step 4:** Int test passes; `bash scripts/content-cloud.sh bogus` still errors.
- [ ] **Step 5:** Commit `feat(content): ai-templates production rollout script`.

### Task 9: Verification, browser walk, status, release

**Files:**
- Modify: `docs/STATUS.md`, `README.md` if it lists content scripts

- [ ] **Step 1:** Full local checks: `pnpm typecheck`; `pnpm test`; `pnpm db:reset && pnpm seed && pnpm db:test`; admin and content `test:int`; admin Playwright e2e; `expo export --platform web`; admin `next build`. All pass.
- [ ] **Step 2: Browser walk** (local stack; admin :3000 with the local test admin, student web :8081 at 360 px and desktop; console checked). Admin: „Șabloane AI” list grouped by type with the 5 seed templates and usage counts; create / edit / delete a `[test]` template; delete of a used template refused with the exact message; exercise form shows the selector with only matching types; save without template refused; essay requirement selectors; settings shows „Reguli generale”. Student (against a local OpenAI mock via `OPENAI_BASE_URL`, as in the consolidation walk): a facts / argument check still works; essay has no „Verifică eseul întreg”, two requirement checks give the combined verdict in the summary; old `whole` attempt row (inserted with psql) opens fine. Remove `[test]` data; seed intact.
- [ ] **Step 3:** `superpowers:requesting-code-review`; fix findings.
- [ ] **Step 4:** Update `docs/STATUS.md` (where we are, decisions taken by Claude from the spec, owner actions: rollout steps, phone check of the essay screen with the next APK, one real AI evaluation in production). Commit.
- [ ] **Step 5:** Release only with the owner's explicit approval: the order in `docs/deploy.md` „AI templates rollout”, dry runs shown to the owner before each `--apply`.
