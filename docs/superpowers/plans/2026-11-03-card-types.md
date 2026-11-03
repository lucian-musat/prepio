# Typed Learning Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single POC card shape with six typed cards (Text, Images, Video, Timeline, Schema, Link), rendered on student web + Android, edited in admin with a live phone/desktop preview that runs the real student code.

**Architecture:** `cards` gets `type` + `content jsonb` (legacy `body`/`image_path`/`image_credit` copied in, then dropped). `@prepio/shared` owns the `Card` discriminated union, row mapping, validation, YouTube parsing and a small Markdown-subset parser. `apps/mobile` renders each type behind one `CardContentView` switch, and exposes a sign-in-free `/preview` route that renders a card posted to it by the admin's iframe. `apps/admin` gets a type-aware card editor with that iframe beside it.

**Tech Stack:** Supabase Postgres + pgTAP, TypeScript, Expo SDK 58 / expo-router / react-native-web 0.21, Next 16 + react-bootstrap, vitest, Jest (jest-expo), Playwright. New native deps: `react-native-webview`, `react-native-youtube-iframe`, `expo-web-browser`.

**Spec:** `docs/superpowers/specs/2026-11-03-card-types-design.md` (read it first; it carries the owner's decisions and the per-type table).

## Global Constraints

- Work directly on `main`; commit locally after each task; **do not `git push` until Task 17** (Vercel auto-deploys `main`).
- Run every command in WSL with nvm: `wsl -d Ubuntu-22.04 -- bash -ic "cd ~/projects/prepio_new && <cmd>"`.
- Database: follow `docs/database-migrations.md` — `pnpm db:new <name>`, pgTAP, `pnpm db:reset && pnpm seed && pnpm db:test`. Never edit an applied migration. Never touch production except via `pnpm db:cloud*` in Task 17; never read or print `~/.config/prepio/supabase.env`.
- Card types (exact strings): `text`, `images`, `video`, `timeline`, `schema`, `link`. Romanian labels: `Text`, `Imagini`, `Video`, `Axă cronologică`, `Schemă`, `Link`.
- `content` JSON keys are camelCase and never contain `type` (that is the column).
- UI copy Romanian; code, comments, docs, commits English. Diacritics ș/ț with comma below.
- Student UI uses semantic tokens from `@prepio/shared` theme and the `apps/mobile/src/ui` kit only; respect reduce motion; no Reanimated `Keyframe` entering (use `Enter`/`useEnter`).
- Rich text is never rendered as HTML anywhere (student or admin).
- Images: JPEG/PNG/WebP ≤ 5 MB, uploaded through the existing `uploadCardImage` action to `lessons/<lessonId>/<uuid>.<ext>`. Storage paths starting with `seed/` are never deleted by app code.
- Video: YouTube only; autoplay **muted**; stops when the card leaves.
- Between Task 1 and Task 15 the repo-wide `pnpm typecheck` is expected to fail in the package not yet migrated; each task verifies its own package. Task 16 requires everything green.
- Frontend changes are validated in Chrome (Task 16) at 360 px and desktop, console clean, `[test]`-prefixed data removed afterwards, seeded content intact.

## Review Focus

1. **Half-filled cards in the preview** (empty images list, timeline with 0 points, schema with empty central text, video without id, link without URL): renderers show what exists and never throw. → Task 5 test `renders every type from emptyCardContent without crashing`.
2. **YouTube URL variants** (`watch?v=…&t=42s`, `youtu.be/…?si=…`, `shorts/…`, `m.youtube.com`, `embed/…`, bare 11-char id, playlist-only URL, non-YouTube URL). → Task 1 `parseYouTubeId` table test.
3. **Leaving a playing video** with Continuă / Înapoi / closing the lesson: no sound continues, and the outgoing copy kept by `CardTransition` does not mount a second player. → Task 7 tests.
4. **Untrusted messages to `/preview`** (foreign origin, malformed payload, missing `card`): ignored, last good card stays. → Task 10 test.
5. **Long content at 360 px** (20-point timeline, 200-char schema box, unbroken 120-char URL, 10 images): wraps, no horizontal page scroll. → Task 16 browser walk with the `[test]` lesson built in Task 15's e2e fixture.

---

### Task 1: Shared card model, mapping, validation, YouTube parsing

**Files:**
- Create: `packages/shared/src/cards.ts`, `packages/shared/src/cards.test.ts`
- Modify: `packages/shared/src/types.ts:26-33` (replace `Card`), `packages/shared/src/validation.ts` (`validateLesson` uses `validateCard`), `packages/shared/src/validation.test.ts`, `packages/shared/src/index.ts` (export `./cards`)

**Interfaces:**
- Produces (in `types.ts`):
  ```ts
  export type CardType = 'text' | 'images' | 'video' | 'timeline' | 'schema' | 'link';
  export type CardImage = { path: string; alt: string; credit: string | null };
  export type TimelinePoint = { id: string; date: string; title: string; details: string | null; key: boolean; imagePath: string | null };
  export type SchemaBox = { id: string; text: string; detail: string | null };
  export type LinkImage = { kind: 'url'; url: string } | { kind: 'path'; path: string };
  export type CardContent =
    | { type: 'text'; text: string }
    | { type: 'images'; images: CardImage[]; display: 'single' | 'gallery'; text: string | null }
    | { type: 'video'; youtubeId: string; startSeconds: number | null; endSeconds: number | null; text: string | null }
    | { type: 'timeline'; points: TimelinePoint[] }
    | { type: 'schema'; causesLabel: string; consequencesLabel: string; causes: SchemaBox[]; central: SchemaBox; consequences: SchemaBox[] }
    | { type: 'link'; url: string; pageTitle: string; description: string | null; image: LinkImage | null; text: string | null };
  export type Card = { id: string; position: number; title: string | null } & CardContent;
  export type CardRow = { id: string; position: number; title: string | null; type: CardType; content: Record<string, unknown> };
  ```
- Produces (in `cards.ts`): `CARD_TYPES: readonly CardType[]`, `CARD_TYPE_LABELS: Record<CardType, string>`, `emptyCardContent(type: CardType, newId: () => string): CardContent`, `cardFromRow(row: CardRow): Card`, `cardToRow(card: DistributiveOmit<Card, 'id' | 'position'>): { title: string | null; type: CardType; content: Record<string, unknown> }`, `cardImagePaths(card: CardContent): string[]`, `parseYouTubeId(input: string): string | null`, `validateCard(card: CardContent & { title?: string | null }): string[]`.
- `display: 'single'` = every image shown large, stacked; `'gallery'` = one main image + thumbnails. A one-image card renders the same in both.

- [ ] **Step 1: Write failing tests in `cards.test.ts`**
  - `parseYouTubeId` table: `https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s`, `https://youtu.be/dQw4w9WgXcQ?si=x`, `https://www.youtube.com/shorts/dQw4w9WgXcQ`, `https://m.youtube.com/watch?v=dQw4w9WgXcQ`, `https://www.youtube.com/embed/dQw4w9WgXcQ`, `https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ`, `dQw4w9WgXcQ`, `  https://youtu.be/dQw4w9WgXcQ  ` → `'dQw4w9WgXcQ'`; `https://www.youtube.com/playlist?list=PL123`, `https://vimeo.com/123`, `https://evil.com/watch?v=dQw4w9WgXcQ`, `''`, `dQw4w9WgXc` (10 chars) → `null`.
  - `cardFromRow`/`cardToRow` round-trip for one card of each type; `cardFromRow` with `content: {}` of each type returns the type's `emptyCardContent` shape with defaults (never `undefined` arrays; schema labels default `'Cauze'`/`'Urmări'`).
  - `cardImagePaths`: images → all `path`s; timeline → non-null `imagePath`s; link with `{kind:'path'}` → that path, `{kind:'url'}` → `[]`; others `[]`.
  - `validateCard` exact messages (each test asserts `toContain`):
    - text blank → `'Textul nu poate fi gol.'`
    - images `[]` → `'Adaugă cel puțin o imagine.'`; image 2 alt blank → `'Imaginea 2: descrierea nu poate fi goală.'`
    - video id `''` → `'Linkul YouTube nu este valid.'`; start `-1` → `'Secundele nu pot fi negative.'`; start 30 end 30 → `'Secunda de final trebuie să fie după cea de start.'`
    - timeline 1 point → `'Axa cronologică are nevoie de cel puțin 2 puncte.'`; point 2 date blank → `'Punctul 2: data nu poate fi goală.'`; point 1 title blank → `'Punctul 1: titlul nu poate fi gol.'`
    - schema no causes → `'Schema are nevoie de cel puțin o cauză.'`; no consequences → `'Schema are nevoie de cel puțin o urmare.'`; central blank → `'Evenimentul central nu poate fi gol.'`; any blank box → `'Căsuțele schemei nu pot fi goale.'`
    - link `ftp://x` or `javascript:alert(1)` → `'Linkul trebuie să înceapă cu http:// sau https://.'`; pageTitle blank → `'Titlul linkului nu poate fi gol.'`
    - duplicate item ids (points/boxes) → `'Elementele trebuie să aibă identificatori unici.'`
    - a valid card of each type → `[]`.
  - `validation.test.ts`: `validateLesson` with an invalid text card at index 1 → contains `'Cartonașul 2: Textul nu poate fi gol.'`.

- [ ] **Step 2: Run** `pnpm --filter @prepio/shared test` — expect FAIL (module `./cards` not found).
- [ ] **Step 3: Implement** the types and `cards.ts`. `parseYouTubeId` accepts hosts `youtube.com`, `www.youtube.com`, `m.youtube.com`, `youtu.be`, `www.youtube-nocookie.com`; id regex `^[A-Za-z0-9_-]{11}$`. `cardFromRow` fills missing fields with `emptyCardContent` defaults and coerces wrong-typed fields to defaults (row content is untrusted JSON). `validateLesson` prefixes each `validateCard` error with `Cartonașul ${i + 1}: `.
- [ ] **Step 4: Run** `pnpm --filter @prepio/shared test` — PASS.
- [ ] **Step 5: Commit** `feat(shared): typed card model, validation and YouTube id parsing`.

### Task 2: Shared rich-text (Markdown subset) parser

**Files:**
- Create: `packages/shared/src/richText.ts`, `packages/shared/src/richText.test.ts`; Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Produces:
  ```ts
  export type RichSpan = { text: string; bold?: true; italic?: true };
  export type CalloutVariant = 'retine' | 'atentie' | 'exemplu';
  export type RichBlock =
    | { kind: 'paragraph'; spans: RichSpan[] }
    | { kind: 'heading'; spans: RichSpan[] }
    | { kind: 'list'; ordered: boolean; items: RichSpan[][] }
    | { kind: 'callout'; variant: CalloutVariant; blocks: RichBlock[] };
  export function parseRichText(src: string): RichBlock[];
  export const CALLOUT_LABELS: Record<CalloutVariant, string>; // 'De reținut' | 'Atenție' | 'Exemplu'
  ```

Grammar (line-based, `\r\n` normalised):
- A line exactly `:::retine`, `:::atentie` or `:::exemplu` (trimmed) opens a callout; a line `:::` closes it; an unclosed callout runs to the end. Callouts don't nest: inside a callout an opener line is plain text.
- `### ` + text → heading. `- ` + text → bullet item; `<digits>. ` + text → ordered item; consecutive items of the same kind form one list.
- Blank lines separate paragraphs; consecutive plain lines join into one paragraph with `\n` kept inside the span text.
- Inline: `**x**` → bold, `*x*` → italic (bold checked first); an unmatched marker stays literal text. Nothing else is special (no links, no HTML; `<b>` is plain text).

- [ ] **Step 1: Write failing tests:** plain two paragraphs; heading + bullet list + ordered list; `**Alba Iulia** a fost *decisivă*` spans; unmatched `2 * 3` literal; `<script>x</script>` returns one paragraph with that literal text; callout `:::retine\nText\n:::` → callout with paragraph; unclosed callout; `:::exemplu` inside a callout is text; `''` → `[]`.
- [ ] **Step 2: Run** `pnpm --filter @prepio/shared test` — FAIL.
- [ ] **Step 3: Implement** `parseRichText` per the grammar.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(shared): markdown-subset rich text parser`.

### Task 3: Database migration `card_types` + pgTAP

**Files:**
- Create: `supabase/migrations/<timestamp>_card_types.sql` (via `pnpm db:new card_types`), `supabase/tests/card_types.test.sql`
- Modify: `supabase/tests/rls.test.sql:13-15`, `supabase/tests/accounts.test.sql:17-19` (fixtures insert `content` instead of `body`)

**Interfaces:** Produces `cards(id, lesson_id, position, title, type text not null default 'text' check (type in ('text','images','video','timeline','schema','link')), content jsonb not null default '{}' check (jsonb_typeof(content) = 'object'))`. RLS policies unchanged.

Data copy (in the migration, before dropping columns):
- `image_path is not null` → `type='images'`, `content = {"images":[{"path":image_path,"alt":coalesce(title,'Ilustrație'),"credit":image_credit}],"display":"single","text":nullif(btrim(body),'')}`.
- otherwise → `type='text'`, `content = {"text": body}`.
- Then `drop column body, drop column image_path, drop column image_credit`.

- [ ] **Step 1: Write `card_types.test.sql`:** default type is `text`; insert `type='foo'` → `throws_ok(..., '23514')`; insert `content='[]'` → `23514`; student still reads cards of published lessons only (one assertion reusing the accounts fixture pattern); columns `body`, `image_path`, `image_credit` don't exist (`hasnt_column`).
- [ ] **Step 2: Update fixtures** in `rls.test.sql` and `accounts.test.sql` to insert `(lesson_id, content)` with `'{"text":"x"}'`.
- [ ] **Step 3: Write the migration** (columns, copy, drops).
- [ ] **Step 4: Verify the data copy on real old-shape data** (the seed still writes the old shape until Task 4): move the new migration file temporarily out of `supabase/migrations/`, run `pnpm db:reset && pnpm seed`, move the file back, run `pnpm exec supabase migration up` and check with `psql "$(pnpm exec supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '\"')" -c "select type, count(*), bool_and(content ? 'text' or content ? 'images') from cards group by type"` → `text` and `images` rows only, both `true`; spot-check one `images` row's `content` (path `seed/…`, credit copied).
- [ ] **Step 5: Run** `pnpm db:reset && pnpm db:test` — all pgTAP PASS (`pnpm seed` is fixed in Task 4).
- [ ] **Step 6: Commit** `feat(db): typed cards (type + content jsonb)`.

### Task 4: Seed content on the new model + demo cards

**Files:**
- Modify: `packages/content/src/types.ts:6` (`SeedCard`), `packages/content/src/lessons/01-unirea-principatelor.ts`, `02-constitutia-1866.ts`, `03-independenta.ts`, `packages/content/src/seed.ts:118-130`, `packages/content/src/content.test.ts:76,115-118,155`, `packages/content/src/seed.int.test.ts`

**Interfaces:**
- Consumes: `Card`, `cardToRow`, `cardImagePaths`, `validateCard` (Task 1).
- Produces: `export type SeedCard = DistributiveOmit<Card, 'id' | 'position'>` where image paths (`CardImage.path`, `TimelinePoint.imagePath`, `LinkImage.path`) are file names inside `packages/content/images/`; `seed.ts` uploads each referenced file once to `seed/<file>` and rewrites paths before `cardToRow`.

Demo cards (factually accurate, Romanian, keep each lesson at 6–10 cards):
- Lesson 1: one `timeline` card "Pașii Unirii (1857–1862)" with ≥ 4 points, key moments 5 and 24 ianuarie 1859.
- Lesson 2: one `schema` card for the 1866 Constitution (causes → "Constituția din 1866" → consequences).
- Lesson 3: one `video` card and one `link` card. The YouTube video must be real, embeddable and on topic: verify with `curl -s -o /dev/null -w '%{http_code}' 'https://www.youtube.com/oembed?url=https://youtu.be/<id>&format=json'` → `200`. Link: a Romanian Wikipedia or Wikisource page on the 1877–1878 war, verified with `curl -sI` → 200; fill title/description by hand.

- [ ] **Step 1: Update tests:** `content.test.ts` — every card passes `validateCard` → `[]`; each lesson has 6–10 cards and ≥ 2 cards with `cardImagePaths(card).length > 0`; across all lessons every one of the six types occurs; every image file referenced exists in `images/` and is credited in `CREDITS.md`. `seed.int.test.ts` — seeded cards read back via `cardFromRow` deep-equal the source (paths prefixed `seed/`).
- [ ] **Step 2: Run** `pnpm --filter @prepio/content test` — FAIL.
- [ ] **Step 3: Convert** the lessons (text cards → `{type:'text', text}`, image cards → `{type:'images', display:'single', images:[{path, alt, credit}], text}`), add the demo cards, update `seed.ts`.
- [ ] **Step 4: Run** `pnpm --filter @prepio/content test`, then `pnpm db:reset && pnpm seed && pnpm db:test && pnpm --filter @prepio/content test:int` (check the actual int script name in `packages/content/package.json`) — PASS.
- [ ] **Step 5: Commit** `feat(content): seed lessons on typed cards, demo of every type`.

### Task 5: Mobile card shell — mapping, eyebrow, rich text, Text card

**Files:**
- Create: `apps/mobile/src/components/cards/CardView.tsx`, `CardContentView.tsx`, `RichText.tsx`, `TextCard.tsx`, `CardView.test.tsx`, `RichText.test.tsx`
- Modify: `apps/mobile/src/lib/content.ts:105-112` (use `cardFromRow`), `apps/mobile/src/lib/content.test.ts:64-82`, `apps/mobile/src/components/CardStepper.tsx` (remove inline `CardView`, import the new one), `CardStepper.test.tsx` (fixture uses `{type:'text', text}`), `apps/mobile/src/ui/IconButton.tsx` (`paths`: add `text`, `images`, `video`, `timeline`, `schema`, `link` 24×24 stroke glyphs), `apps/mobile/src/ui/CardTransition.tsx` (leaving context)

**Interfaces:**
- Consumes: `Card`, `cardFromRow`, `CARD_TYPE_LABELS`, `parseRichText`, `CALLOUT_LABELS`.
- Produces:
  - `CardView({ card, eyebrow }: { card: Card; eyebrow: string })` — `Surface` with an eyebrow row (type chip: icon + `CARD_TYPE_LABELS[type]`, then `eyebrow` text e.g. `Cartonaș 2 din 7`), optional title, then `CardContentView`.
  - `CardContentView({ card }: { card: Card })` — switch on `card.type`; other types render a placeholder until Tasks 6–9.
  - `RichText({ source }: { source: string })` — renders `parseRichText` blocks with `AppText`; callouts: `retine` → `accentSubtle` bg + `accent` left border, `atentie` → `dangerSubtle` + `danger`, `exemplu` → `primarySubtle` + `primary`; each callout starts with its `CALLOUT_LABELS` label in bold.
  - `useCardLeaving(): boolean` exported from `apps/mobile/src/ui` — `true` inside `CardTransition`'s `Outgoing`, `false` elsewhere (React context set by `Outgoing`).

- [ ] **Step 1: Write failing tests:** `RichText.test.tsx` — bold/italic spans render, list items render, callout shows `De reținut` label, `<b>x</b>` renders as literal text. `CardView.test.tsx` — eyebrow shows `Axă cronologică` for a timeline card; text card shows title and formatted body; **`renders every type from emptyCardContent without crashing`** (loop over `CARD_TYPES`). `content.test.ts` — `fetchLesson` maps a row `{type:'images', content:{…}}` to the `Card` union. CardStepper tests keep passing with the new fixtures.
- [ ] **Step 2: Run** `pnpm --filter @prepio/mobile test` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(mobile): typed card shell, rich text and text cards`.

### Task 6: Mobile Images card + full-screen viewer

**Files:** Create `apps/mobile/src/components/cards/ImagesCard.tsx`, `ImageViewer.tsx`, `ImagesCard.test.tsx`; Modify `CardContentView.tsx`.

**Interfaces:** `ImagesCard({ content }: { content: Extract<CardContent, {type:'images'}> })`; `ImageViewer({ images, index, onClose }: { images: CardImage[]; index: number; onClose: () => void })` — RN `Modal`, dark backdrop, close button (`Icon close`, label `Închide`), previous/next for galleries, credit under the image, pinch-zoom + pan on native (gesture-handler + reanimated), tap toggles 2× zoom on web. Image URLs via `imageUrl(path)`. Images keep their aspect ratio (`Image.getSize`/`onLoad` dims; fallback 16:9); a failed image is hidden (as today). Optional `text` rendered with `RichText` below.

- [ ] **Step 1: Failing tests:** single display renders all images with `accessibilityLabel` = alt and credits; gallery shows main image + thumbnails, pressing thumbnail 2 changes the main image's alt; pressing the main image opens the viewer (`Închide` visible), close hides it; empty `images` renders nothing and doesn't throw.
- [ ] **Step 2: Run** mobile tests — FAIL. **Step 3: Implement. Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(mobile): images card with gallery and zoom viewer`.

### Task 7: Mobile Video card (YouTube)

**Files:** Create `apps/mobile/src/components/cards/VideoCard.tsx`, `YouTubePlayer.tsx` (native), `YouTubePlayer.web.tsx`, `VideoCard.test.tsx`; Modify `CardContentView.tsx`, `apps/mobile/package.json` (`pnpm --filter @prepio/mobile exec expo install react-native-webview react-native-youtube-iframe`), `apps/mobile/jest.setup` or test-local mocks for the player.

**Interfaces:**
- `YouTubePlayer({ videoId, start, end, muted, onError }: { videoId: string; start: number | null; end: number | null; muted: boolean; onError: () => void })` — autoplays on mount (muted while `muted`); unmount stops playback. Web: `<iframe src="https://www.youtube-nocookie.com/embed/<id>?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1&start=..&end=..">` with `allow="autoplay; encrypted-media; picture-in-picture; fullscreen"`, title `Video YouTube`; `muted` → false posts `{"event":"command","func":"unMute","args":[]}` to the iframe. Native: `react-native-youtube-iframe` with `play`, `mute={muted}`, `initialPlayerParams={{ start, end, rel: false }}`, `onError`.
- `VideoCard({ content })` — 16:9 box (width-driven), YouTube controls visible; while muted, a pill `🔇 Atinge pentru sunet` (accessibility label `Pornește sunetul`) overlays the top-left corner and sets `muted=false` on press, then disappears. If `useCardLeaving()` is true or `youtubeId` is empty, render the thumbnail `https://i.ytimg.com/vi/<id>/hqdefault.jpg` instead of a player. On `onError`: thumbnail + button `Deschide pe YouTube` (`WebBrowser.openBrowserAsync('https://www.youtube.com/watch?v=<id>')` — dependency added in Task 9; until then use `Linking.openURL`). Optional `text` via `RichText`.

- [ ] **Step 1: Failing tests (player mocked):** player mounted with `videoId`, `start`, `end`, `muted: true` for an active card; pressing `Pornește sunetul` re-renders the player with `muted: false` and hides the pill; inside a `CardTransition` key change the outgoing copy renders the thumbnail, not a second player (assert one player instance); unmounting the stepper's card (press Continuă) unmounts the player; `onError` shows `Deschide pe YouTube`; empty id renders no player.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement. Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(mobile): youtube video card with muted autoplay`.

### Task 8: Mobile Timeline and Schema cards

**Files:** Create `apps/mobile/src/components/cards/TimelineCard.tsx`, `SchemaCard.tsx`, `TimelineCard.test.tsx`, `SchemaCard.test.tsx`; Modify `CardContentView.tsx`.

**Interfaces:**
- `TimelineCard({ content })` — vertical gradient line (`expo-linear-gradient`, teal 300→700), points in stored order; date (Nunito 800, `primary`), title, ★ + yellow marker for `key`; a point with `details` is a `Pressable` with `accessibilityState={{ expanded }}` toggling the details box (`bg` tint); optional 48 px thumbnail from `imagePath`. Enter animation staggered with `Enter`.
- `SchemaCard({ content })` — zone label `causesLabel`, cause boxes (`primarySubtle` bg, teal border) wrapping in a row, arrow ▼, central box (`primary` bg, `onPrimary` text), arrow, zone label `consequencesLabel`, consequence boxes (`accentSubtle` bg, `accent` border, `onAccent` text). Boxes with `detail` toggle it on press with `accessibilityState.expanded`.

- [ ] **Step 1: Failing tests:** timeline renders dates/titles in order; key point exposes `moment cheie` in its accessibility label; pressing a point with details shows them and sets expanded; schema renders labels, central text and all boxes; pressing a box with detail reveals it; empty arrays render without crashing.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement. Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(mobile): timeline and schema cards`.

### Task 9: Mobile Link card

**Files:** Create `apps/mobile/src/components/cards/LinkCard.tsx`, `LinkCard.test.tsx`; Modify `CardContentView.tsx`, `VideoCard.tsx` (switch to `WebBrowser`), `apps/mobile/package.json` (`expo install expo-web-browser`).

**Interfaces:** `LinkCard({ content })` — optional `text` (RichText) above; bordered preview: image (`kind:'url'` → url, `kind:'path'` → `imageUrl(path)`, hidden on error/null), domain (uppercase caption, from `new URL(url).hostname` without `www.`), title, description, button `Deschide ↗` → `WebBrowser.openBrowserAsync(url)` (new tab on web, in-app browser on Android). Titles/URLs wrap (`flexShrink`, `wordBreak` on web via style).

- [ ] **Step 1: Failing tests (WebBrowser mocked):** domain `ro.wikipedia.org` shown for `https://ro.wikipedia.org/wiki/X`; pressing `Deschide` calls `openBrowserAsync` with the url; image hidden when `image` is null; invalid url string renders title without crashing (no domain).
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement. Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(mobile): link preview card`.

### Task 10: Student web `/preview` route

**Files:** Create `apps/mobile/app/preview.tsx` (re-exports the screen), `apps/mobile/src/screens/PreviewScreen.tsx`, `PreviewScreen.test.tsx`, `packages/shared/src/previewProtocol.ts` + `previewProtocol.test.ts` (exported from shared's `index.ts`, used by admin in Task 15); Modify `apps/mobile/app/_layout.tsx` (add `<Stack.Screen name="preview" />` outside every guard, next to the public pages), `apps/mobile/.env.example` (`EXPO_PUBLIC_ADMIN_ORIGIN=http://localhost:3000`).

**Interfaces:**
- `previewProtocol.ts` in `@prepio/shared` (types `AdminPreviewMessage`, `PreviewReadyMessage`, and the parser):
  - admin → preview: `{ source: 'prepio-admin'; kind: 'card'; card: Card; index: number; total: number }`
  - preview → admin: `{ source: 'prepio-preview'; kind: 'ready' }` posted to `window.parent` with target origin `EXPO_PUBLIC_ADMIN_ORIGIN` on mount.
  - `parsePreviewMessage(data: unknown): { card: Card; index: number; total: number } | null` — returns null unless shape matches; the card passes through `cardFromRow` coercion (`{...card, content}` re-shaped) so partial content can't crash renderers.
- `PreviewScreen` — web: listens to `message`, ignores events whose `origin !== process.env.EXPO_PUBLIC_ADMIN_ORIGIN` or that fail `parsePreviewMessage`; renders the lesson frame exactly like `CardStepper` (`ScreenLayout` title `Previzualizare`, progress `(index+1)/total`, action bar Înapoi/Continuă disabled-looking but inert) with `CardView` (eyebrow `Cartonaș ${index+1} din ${total}`); before the first message shows `Se așteaptă cardul…`. Native: shows `Previzualizarea este disponibilă doar pe web.` The page reads nothing from Supabase.

- [ ] **Step 1: Failing tests:** message from admin origin renders the card title; message from `https://evil.example` is ignored; malformed payloads (`{}`, `{source:'prepio-admin', kind:'card'}`, card with `type:'nope'`) are ignored and the last good card stays; posts `ready` on mount to the admin origin; route reachable while signed out (render `RootNavigator` with `status: 'signedOut'` and navigate to `/preview` — or assert the `_layout` registers `preview` outside guards if routing tests are impractical).
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement. Step 4: Run** `pnpm --filter @prepio/mobile test && pnpm --filter @prepio/mobile typecheck` — PASS.
- [ ] **Step 5: Commit** `feat(mobile): sign-in-free card preview route for the admin`.

### Task 11: Admin data layer for typed cards

**Files:** Modify `apps/admin/src/lib/data/lesson.ts` (`EditorCard`, `CardInput`, `getLessonForEdit`, `saveCard`, `deleteItem`), `apps/admin/src/lib/data/lesson.int.test.ts`, `apps/admin/src/app/(admin)/lessons/[id]/actions.ts` (types only).

**Interfaces:**
- Consumes: `Card`, `CardRow`, `cardFromRow`, `cardToRow`, `cardImagePaths`, `validateCard`.
- Produces: `EditorCard = Card`; `CardInput = DistributiveOmit<Card, 'id' | 'position'> & { id?: string }`; `getLessonForEdit` returns `cards: Card[]` (selects `id,position,title,type,content`); `saveCard(db, lessonId, input: CardInput): Promise<{ id: string }>` — rebuilds the content explicitly field by field (trim strings, `orNull`, drop unknown keys — closes the backlog item "saveCard accepts any image_path": every image path must start with `lessons/${lessonId}/` or `seed/`, else `UserError('Imagine invalidă.')`), runs `validateCard`, throws `UserError(errors.join(' '))`, upserts `cardToRow(...)`; after a successful update removes storage objects in `cardImagePaths(old) − cardImagePaths(new)` that start with `lessons/`. `deleteItem('cards', id)` removes that card's `lessons/` image objects after the row delete. Storage removal failures are logged, not thrown.

- [ ] **Step 1: Failing int tests:** save + read back one card of each type; invalid timeline (1 point) rejected with the Task 1 message; image path `lessons/<otherLesson>/x.png` rejected; unknown content keys dropped; replacing an image deletes the old object from storage (`list` no longer returns it); deleting an images card deletes its objects; a `seed/` path is never deleted.
- [ ] **Step 2: Run** `pnpm db:start` (if needed) then `pnpm --filter @prepio/admin test:int` — FAIL. **Step 3: Implement. Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(admin): typed card persistence with image cleanup`.

### Task 12: Admin link metadata fetch

**Files:** Create `apps/admin/src/lib/linkPreview.ts` (`import 'server-only'`), `apps/admin/src/lib/linkPreview.test.ts`; Modify `actions.ts` (add `fetchLinkMetadata`).

**Interfaces:**
- `parseLinkMetadata(html: string, pageUrl: string): { title: string | null; description: string | null; imageUrl: string | null }` — `og:title` ▸ `<title>`; `og:description` ▸ `meta[name=description]`; `og:image` resolved against `pageUrl`, kept only if http(s). Decode HTML entities; trim to 200/500 chars.
- `isPublicAddress(ip: string): boolean` — false for IPv4 `0/8, 10/8, 100.64/10, 127/8, 169.254/16, 172.16/12, 192.168/16, 224/4, 240/4` and IPv6 `::`, `::1`, `fc00::/7`, `fe80::/10`, IPv4-mapped forms of the above.
- `fetchLinkPreview(url: string, deps?: { lookup?: (host: string) => Promise<string[]>; fetch?: typeof fetch }): Promise<{ title; description; imageUrl }>` — http/https only; resolve host, every address must be public; `redirect: 'manual'`, follow ≤ 3 redirects re-checking each hop; 5 s total timeout (`AbortSignal.timeout(5000)`); read at most 1 MB of the body; only `text/html` parsed. Errors → `UserError('Nu am putut citi pagina. Completează câmpurile manual.')`.
- Action `fetchLinkMetadata(url: string): Promise<ActionResult<{ title: string | null; description: string | null; imageUrl: string | null }>>` (uses `run`, so admin-only by session + RLS-free; add an explicit `is_admin` RPC check here because it reaches the network — `UserError('Nu ai drepturi de administrator.')`).

- [ ] **Step 1: Failing unit tests:** metadata parsing (og vs fallback, relative og:image, `javascript:` image dropped, entities); `isPublicAddress` table; `fetchLinkPreview` rejects `ftp://`, `http://127.0.0.1`, `http://localhost` (lookup stub → `127.0.0.1`), a redirect to `http://10.0.0.1`, a 2 MB body is cut at 1 MB, non-HTML returns nulls — all with injected `lookup`/`fetch`.
- [ ] **Step 2: Run** `pnpm --filter @prepio/admin test` — FAIL. **Step 3: Implement. Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(admin): safe link metadata fetch`.

### Task 13: Admin card editor shell + Text and Images fields

**Files:**
- Create in `apps/admin/src/components/editor/cards/`: `CardForm.tsx`, `TypePicker.tsx`, `SortableList.tsx`, `RichTextInput.tsx`, `TextFields.tsx`, `ImagesFields.tsx`, `cardSummary.ts`, `CardForm.test.tsx`, `cardSummary.test.ts`
- Modify: `apps/admin/src/components/editor/CardsEditor.tsx` (list + uses `CardForm`; old inline form removed)

**Interfaces:**
- `CardForm({ lessonId, initial, onSave, onCancel, preview }: { lessonId: string; initial?: Card; onSave: (c: CardInput) => Promise<ActionResult<unknown>>; onCancel: () => void; preview?: (draft: CardInput) => ReactNode })` — layout: two columns ≥ lg (form left, `preview?.(draft)` right, filled in Task 15), stacked below lg. Holds `draft: CardInput` state; shows `validateCard` errors only after a save attempt; server errors in an `Alert`.
- `TypePicker({ value, onChange })` — six toggle buttons (icon + `CARD_TYPE_LABELS`), `role="radiogroup"`, labelled `Tipul cardului`. Changing type when the current type's fields are non-empty shows an inline confirm `Schimbi tipul? Conținutul specific tipului actual se va pierde.` with `Schimbă tipul` / `Anulează`; title is kept; new content = `emptyCardContent(type, crypto.randomUUID)`. New cards default to `text`.
- `SortableList<T extends { id: string }>({ items, onChange, render, addLabel, onAdd, itemName })` — each row: drag handle (HTML5 drag-and-drop), `Mută sus`/`Mută jos` buttons (`aria-label` `Mută sus ${itemName} ${i+1}`), `Șterge`. Used by images, timeline points, schema boxes.
- `RichTextInput({ id, label, value, onChange, required? })` — textarea + toolbar buttons `B`, `I`, `Listă`, `Listă numerotată`, `Subtitlu`, `De reținut`, `Atenție`, `Exemplu`, each wrapping the selection / current lines with the Task 2 syntax; help text `Formatare: **bold**, *italic*, „- ” listă, „### ” subtitlu.`
- `TextFields` (one `RichTextInput` labelled `Text`), `ImagesFields` (upload via `uploadCardImage`, per image `Descriere (alt)` required + `Sursa / creditul imaginii`, display radio `O imagine mare / imagini una sub alta` vs `Galerie`, optional `Text sub imagini` RichTextInput).
- `cardSummary(card: Card): string` — text: first 120 chars of the plain text; images: `${n} imagini` (`1 imagine`); video: `YouTube · ${id}` + ` · ${start}s–${end}s` when set; timeline: `${n} puncte`; schema: `${causes} cauze → ${central.text} → ${consequences} urmări`; link: hostname. List rows show type chip + title (or `Card ${i+1}`) + summary + thumbnail when the card has images.

- [ ] **Step 1: Failing tests** (`@testing-library/react`): type picker switches fields; confirm appears only when fields are non-empty and keeps the title; toolbar `B` wraps the selection in `**`; images: alt required error after save attempt with the Task 1 message; reorder buttons reorder; `cardSummary` table.
- [ ] **Step 2: Run** `pnpm --filter @prepio/admin test` — FAIL. **Step 3: Implement. Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(admin): typed card editor with text and images`.

### Task 14: Admin Video, Timeline, Schema and Link fields

**Files:** Create in `apps/admin/src/components/editor/cards/`: `VideoFields.tsx`, `TimelineFields.tsx`, `SchemaFields.tsx`, `LinkFields.tsx`, `Fields.test.tsx`; Modify `CardForm.tsx` (wire them).

**Interfaces:**
- `VideoFields` — input `Link YouTube` (stores `parseYouTubeId` result; shows `Video recunoscut ✓` with the thumbnail, or the Task 1 error inline as you type); `Start (secunde)`, `Final (secunde)` number inputs (optional); optional `Text sub video` RichTextInput.
- `TimelineFields` — `SortableList` of points (`itemName` `punctul`): `Data` (placeholder `ex. 1 decembrie 1918`), `Titlu`, `Detalii (opțional)` textarea, checkbox `Moment cheie ★`, optional small image (upload); `+ Adaugă punct`.
- `SchemaFields` — three sections: `Cauze` (label input defaulting `Cauze` + `SortableList` of boxes), `Eveniment central` (one box), `Urmări` (label input + list); box fields `Text` + `Detaliu (opțional)`.
- `LinkFields` — `URL`, button `Completează automat` (calls `fetchLinkMetadata`, fills empty fields only after confirmation if they're non-empty: overwrite `Titlu`/`Descriere`/image), `Titlu`, `Descriere`, preview image (from metadata URL, or `Încarcă altă imagine` → `{kind:'path'}`, `Elimină imaginea`), optional `Text deasupra` RichTextInput.

- [ ] **Step 1: Failing tests:** video URL → recognised id shown; `vimeo.com` → error; timeline add/move/remove points and key checkbox; schema label edit and boxes; link autofill fills fields from a mocked action, failure shows the action's message and keeps manual entry.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement. Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(admin): video, timeline, schema and link card fields`.

### Task 15: Live preview pane + e2e

**Files:**
- Create: `apps/admin/src/components/editor/cards/CardPreview.tsx`, `CardPreview.test.tsx`, `apps/admin/e2e/card-types.spec.ts`
- Modify: `CardsEditor.tsx` (pass `preview`), `apps/admin/.env.example` (`NEXT_PUBLIC_STUDENT_WEB_URL=http://localhost:8081`), `apps/admin/playwright.config.ts` (`webServer` becomes an array adding `{ command: 'pnpm --filter @prepio/mobile web', url: 'http://localhost:8081', reuseExistingServer: true, timeout: 180_000 }`), `apps/admin/e2e/lesson-editor.spec.ts:63-95` (card steps use the new form: type `Imagini`, alt text, etc.)

**Interfaces:**
- `CardPreview({ draft, index, total }: { draft: CardInput; index: number; total: number })` — toggle `📱 Telefon` / `🖥️ Desktop` (`ToggleButtonGroup`); iframe `src=${NEXT_PUBLIC_STUDENT_WEB_URL}/preview`, title `Previzualizare card`; Telefon: 360×740 frame; Desktop: iframe 1024×740 scaled with CSS `transform: scale(paneWidth/1024)` (ResizeObserver). Posts `{ source:'prepio-admin', kind:'card', card: {...draft, id: draft.id ?? 'preview', position: index}, index, total }` to `iframe.contentWindow` with target origin = `new URL(NEXT_PUBLIC_STUDENT_WEB_URL).origin`, debounced 150 ms on change and immediately on each `ready` message from that origin. If no `ready` within 8 s or env missing: `Alert` `Previzualizarea nu este disponibilă. Poți salva cardul în continuare.`

- [ ] **Step 1: Failing unit test:** with a fake iframe window, a draft change posts once after 150 ms with the right origin; a `ready` from another origin is ignored; missing env shows the unavailable alert.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement. Step 4: Run** — PASS.
- [ ] **Step 5: e2e `card-types.spec.ts`** (local Supabase, `[test]` node/lesson created in `beforeAll`, removed in `afterAll` with its uploaded images): create one card of each type through the UI (video `https://youtu.be/dQw4w9WgXcQ`; link autofill not used — fill manually since external network may be unavailable); after typing the timeline title, `page.frameLocator('iframe[title="Previzualizare card"]').getByText('<title>')` is visible; switch to Desktop and the text is still visible; save; list shows six rows with the expected summaries; reload keeps them. Add a long-content card set for Review Focus 5 (20 points, 200-char box, 120-char URL) **only in a separate `test.describe` that leaves the lesson in place when `KEEP_TEST_LESSON=1`** so Task 16 can walk it in the student app.
- [ ] **Step 6: Run** `pnpm --filter @prepio/admin e2e` — PASS (both spec files).
- [ ] **Step 7: Commit** `feat(admin): live student preview for card editing`.

### Task 16: Browser validation, docs, whole-repo green

**Files:** Modify `docs/STATUS.md`, `docs/deploy.md` (new env vars per Vercel project + "new APK needed" note), `README.md` (card types, preview route), `docs/design-system.md` (card-type components section: callout colours, timeline/schema tokens).

- [ ] **Step 1:** `pnpm typecheck && pnpm test && pnpm db:reset && pnpm seed && pnpm db:test` plus every package's `test:int` and admin `e2e` — all PASS; `pnpm --filter @prepio/admin build` and `pnpm --filter @prepio/mobile exec expo export -p web` succeed.
- [ ] **Step 2: Chrome walk (local stack, detached dev servers):** student web at 360 px and desktop — seeded lessons 1–3 (every type, gallery + zoom viewer, video autoplays muted and stops on Continuă/Înapoi/close, timeline/schema expand, link opens a new tab), the long-content `[test]` lesson (no horizontal scroll); admin — create/edit/reorder/delete each type, type-change confirm, validation messages, link autofill against a real page, preview Telefon/Desktop matches the student page; console clean on both apps. Then delete the `[test]` lesson and its images; seed lessons intact.
- [ ] **Step 3:** Update docs; in `STATUS.md` add the owner phone-test list: YouTube playback muted autoplay + unmute + stops on leaving, fullscreen video, pinch-zoom viewer, timeline/schema taps and TalkBack expanded state, in-app browser for links, WebView memory with several video cards.
- [ ] **Step 4: Commit** `docs: typed cards status, deploy and design notes`.
- [ ] **Step 5:** `superpowers:requesting-code-review` on the whole change set; fix findings; re-run Step 1.

### Task 17: Release (ask the owner for a go before starting)

- [ ] **Step 1:** Owner go-ahead in chat.
- [ ] **Step 2:** Set env vars: `prepio-admin` → `NEXT_PUBLIC_STUDENT_WEB_URL=https://prepio-web.vercel.app`; `prepio-web` → `EXPO_PUBLIC_ADMIN_ORIGIN=https://prepio-admin.vercel.app` (Vercel CLI if logged in, otherwise the owner sets them in the dashboard).
- [ ] **Step 3:** `pnpm db:cloud:push:dry` — shows only `<timestamp>_card_types`; then `pnpm db:cloud:push`.
- [ ] **Step 4:** `git push` (both Vercel projects deploy from `main`; admin first per `docs/deploy.md`); wait for both deployments `Ready`.
- [ ] **Step 5:** Production Chrome walk: existing lessons render (converted text/image cards); create a `[test]` draft lesson in admin with one card per type, preview works against production web, delete it afterwards; console clean.
- [ ] **Step 6:** Start the EAS `preview` Android build; record the build id in `STATUS.md`; commit + push `docs: typed cards release`.
