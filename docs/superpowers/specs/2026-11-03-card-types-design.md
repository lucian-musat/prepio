# Typed learning cards — design

Date: 2026-11-03 · Status: awaiting owner approval

## Intent

In the POC a lesson card is one shape: optional title, plain-text body, at most one image. For the real product the owner wants six card types — **Text, Images, Video, Timeline, Schema, Link** — each rendered excellently on the student web app and on the Android app, and an admin editor where every type has clear but rich options. The admin must see, while editing, exactly how the student will see the card (phone and desktop).

The why: lessons are the core learning content; richer, well-presented cards (a real timeline, a cause/effect diagram, a short video) teach history better than paragraphs, and the content author needs confidence that what they build looks right for the student without publishing to check.

## What the owner decided

- The student flow stays the same: a lesson is a sequence of cards, one at a time; the page frame (top bar + progress bar, card surface, Înapoi / Continuă action bar, slide transition, dots) does not change. **Each card has exactly one type**; only the card content differs per type.
- Student look per type as in the approved mockup (`.superpowers/brainstorm/2397940-1793706426/content/card-types.html`, "este chiar perfect"):
  - **Text** — formatted text with a "De reținut" callout.
  - **Images** — one image or a gallery, zoom, credit under the image.
  - **Video** — the player **auto-plays when the student arrives on the card**.
  - **Timeline** — the admin sets several points in chronological order, each with information; the app renders a vertical line with dated points, key moments highlighted (★), details opened by tapping.
  - **Schema** — causes → central event → consequences, boxes with arrows.
  - **Link** — a preview card (domain, title, image) that opens the page.
- **Video comes from YouTube only** (for now). No video upload.
- Admin editor: pick the type, then the type's fields appear. **Preview is variant A: live preview next to the form, updating as you type, with a Telefon / Desktop toggle.**
- The per-type option list below was played back and accepted by the owner ("nu, continuă").
- **One release** with all six types (one migration push, one admin + web deploy, one new APK and one phone-test round).
- No real users yet: **production content may be deleted and recreated**; existing cards don't need to be preserved pixel-perfect.
- **Work directly on `main`.**

## Goals

1. Six card types, stored, validated, editable in admin and rendered on student web + Android.
2. Each type looks and behaves well at 360 px phone width and on desktop, in the "Mentă Prietenoasă" design system (`docs/design-system.md`, tokens in `packages/shared/src/theme.ts`).
3. Live admin preview that is pixel-faithful to the student app, phone and desktop.
4. Existing cards (3 seeded lessons + whatever the owner has in production) keep working, converted to the new model without manual work.

## Non-goals

- Mixed-block cards (several types inside one card). One card = one type.
- Uploaded/self-hosted video, Vimeo or other providers.
- Interactive/quiz behaviour inside cards (questions and writing exercises stay as they are).
- Student progress saving, offline caching of media.
- A free-form diagram editor (arbitrary nodes/edges). Schema is the fixed 3-zone shape.
- Changes to the questions/exercises editors.

## Anti-goals (failure even if it "works")

- The admin preview drifts from what the student sees (a separate re-implementation in Bootstrap would do this).
- A type that is fine on web but broken/ugly on Android, or vice versa.
- Video autoplay that blasts sound, or keeps playing after the student moved to the next card.
- Admin options that are so many/unclear that creating a card is slow; every type must be quick to fill with sensible defaults, with extra options available but not in the way.
- Losing or corrupting existing card content in the migration.

## Per-type content (accepted by the owner)

All types have an optional **title** (shown as now) and the type eyebrow (icon + type name, as in the mockup).

| Type | Admin fields | Student rendering |
|---|---|---|
| **Text** | Formatted text: bold, italic, bullet/numbered lists, small headings, callout boxes "De reținut" / "Atenție" / "Exemplu". Required. | Formatted body; callouts as tinted boxes (accent for De reținut, danger-subtle for Atenție, primary-subtle for Exemplu). |
| **Images** | 1..N images (upload as now: JPEG/PNG/WebP ≤ 5 MB), reorderable; per image: alt text (description, required) and credit (optional). Display mode: *single large* / *gallery*. Optional text under the images (same formatting as Text). | Single: large image. Gallery: main image + thumbnails / swipe. Tap → full-screen viewer with zoom (pinch on native, zoom on web), credit under each image. |
| **Video** | YouTube URL (any common form: watch, youtu.be, shorts, embed) → video id extracted and validated; optional start and end seconds (play a fragment); optional text below. | YouTube player 16:9; **starts muted automatically when the card becomes active**, with a visible "atinge pentru sunet" affordance; pauses when the student leaves the card (next/back/close lesson). Fallback if the embed fails: thumbnail + "Deschide pe YouTube". |
| **Timeline** | Unlimited points, drag to reorder; per point: date (free text, e.g. "27 martie 1918", "1919–1920"), title (required), details (optional, plain text), key moment flag, optional small image. ≥ 2 points. | Vertical line with dated points (as mockup); key moments with yellow ★ marker; points with details expand/collapse on tap; optional thumbnail. |
| **Schema** | Three zones: causes (≥ 1 box), central event (exactly 1 box), consequences (≥ 1 box). Each box: short text (required), optional detail. Zone labels default to "Cauze" / "Urmări" and are editable. | Causes boxes (mint) → arrow → central (teal, white text) → arrow → consequences (yellow), as mockup; boxes wrap at 360 px; boxes with detail open it on tap. |
| **Link** | URL (http/https), then "Completează automat" fetches title, description and preview image from the page (Open Graph); all three editable; preview image can be replaced by an upload. Optional text above. | Link preview card (image, domain, title, description, "Deschide ↗"). Web: new tab. Android: in-app browser. |

## Decisions made by Claude (owner can override at review)

1. **Storage model.** Add `cards.type text not null default 'text'` with a CHECK on the six values, and `cards.content jsonb not null default '{}'` holding the type-specific fields. `title` and `position` stay columns. The legacy `body`, `image_path`, `image_credit` columns are copied into `content` and **dropped in the same migration**. The owner confirmed (2026-11-03) there are no real users yet and all production content may be deleted and recreated, so there is no transition period and no old-APK compatibility to keep. Content shapes are TypeScript discriminated unions in `@prepio/shared` with a hand-written validator `validateCard(card): string[]` (Romanian messages), in the style of `validateQuestion`. The DB adds a light CHECK that `content` is a JSON object; full validation lives in shared and is enforced by the admin save action.
2. **Migration of existing cards.** A plain copy, no transformation: if an existing body happens to contain Markdown-subset syntax and renders differently, that is acceptable (owner: production content is disposable). A card with `image_path` → `images` (single mode, one image with credit, alt = title or "Ilustrație", body → text under the image). Others → `text` with the body as text. Plain text is valid formatted text, so nothing changes visually beyond the new eyebrow. `packages/content` seed lessons are converted the same way (and may gain one example of each new type — see "Left to the builder").
3. **Formatted text = a small Markdown subset**, stored as a string: `**bold**`, `*italic*`, `- ` / `1. ` lists, `### ` small heading, and callout blocks `:::retine … :::`, `:::atentie … :::`, `:::exemplu … :::`. Rendered by an own small parser + renderer in the student app (no Markdown library; anything not in the subset is shown as plain text, never as HTML). The admin edits it in a textarea with a toolbar that inserts the syntax; the live preview shows the result. Chosen over a WYSIWYG editor: much less code, safe (no HTML), and the preview removes the need for WYSIWYG.
4. **Preview fidelity = the real student code.** The student web app gets a `/preview` route that renders a single card inside the normal lesson frame (top bar, progress, action bar) from data it receives via `postMessage`. The admin form embeds it in an `<iframe>` (360 px wide for Telefon, ~1024 px scaled down for Desktop), posting the unsaved card on every change (debounced). The preview route reads nothing from the database and requires no login; it only accepts messages from the configured admin origin and only renders the card data it was given. New env vars: admin `NEXT_PUBLIC_STUDENT_WEB_URL`, student web `EXPO_PUBLIC_ADMIN_ORIGIN`. If the iframe can't load, the admin shows a clear "previzualizarea nu este disponibilă" note; saving still works. `/preview` is exempt from the student app's signed-in redirect (it shows only data posted to it). Admin Playwright runs need the student web dev server (:8081) running too; the Playwright config starts it.
5. **Video on Android** via a WebView-based YouTube player (e.g. `react-native-youtube-iframe` on `react-native-webview`); on web a YouTube iframe (IFrame Player API, `mute=1`, `playsinline=1`, `start`/`end`). The card stepper tells each card whether it is active, so video starts/pauses on activation.
6. **Link metadata fetch** is an admin server action: http/https only, rejects private/loopback/link-local addresses (including after redirects), 5 s timeout, reads at most ~1 MB, parses `og:*` / `<title>` / `meta description`. The preview image is stored as its external URL (or an uploaded image path if the admin replaces it); if it fails to load, the student card shows without image.
7. **Links on Android** open with `expo-web-browser` (in-app browser tab).
8. **Changing a card's type** in the editor keeps the title; type-specific fields of the old type are discarded on save (with a confirm prompt if they weren't empty).
9. **Image storage** stays the public `images` bucket, path `lessons/<lessonId>/<uuid>.<ext>`; images removed from a card in the editor are deleted from storage on save (addresses part of the existing orphaned-objects backlog item for cards).
10. **Admin card list** shows per card: type icon + name, title (or first words), and a type-specific summary (e.g. "4 puncte", "YouTube · 3:10", domain for links), plus the existing move/edit/delete controls.

## Constraints

- Monorepo as is: `packages/shared` (raw TS consumed by both apps), `apps/mobile` (Expo SDK 58, RN 0.88, react-native-web 0.21, expo-router, own UI kit `src/ui`, Jest), `apps/admin` (Next 16, react-bootstrap, server actions returning `ActionResult`, data layer in `src/lib/data`, vitest + int tests + Playwright).
- Database changes follow `docs/database-migrations.md`: new migration, RLS unchanged in shape (cards stay admin-all / student-read-published), pgTAP updated (fixtures insert `(lesson_id, body)` today and must move to `type`/`content`), `db:reset && seed && db:test`, then cloud dry-run and push. Never edit applied migrations.
- Design system: semantic tokens only; motion rules from `docs/design-system.md` (reduce-motion respected; `Enter`/`useEnter` rather than Keyframe entering).
- Accessibility: images need alt text; timeline/schema expandable items announce expanded state; video has an accessible label; contrast AA.
- Romanian UI copy; code/comments/docs in English.
- Owner rule: every frontend change validated in Chrome (admin + student web, 360 px and desktop, console clean). Native-only parts listed for the owner's phone test.
- **Native:** `react-native-webview` (and `expo-web-browser` if not already transitively present) are new native modules → a new APK build is required; the currently installed APK will not render the new cards correctly after the migration. Deploy order: migration + admin + web together, then the APK.
- **Release on `main`:** Vercel auto-deploys `main`, so commits stay local during the work; at release time run `pnpm db:cloud:push:dry` → `pnpm db:cloud:push`, then `git push` (both Vercel projects deploy), then walk production in Chrome and start the EAS preview build.

## Left to the builder

- Exact component structure (e.g. one `CardContent` switch with a component per type, shared between `CardStepper` and `/preview`).
- Gallery interaction details (swipe vs thumbnails on web), zoom implementation (gesture-handler + reanimated on native).
- Exact Markdown-subset grammar edge cases, as long as unsupported syntax degrades to plain text.
- How the toolbar inserts syntax; whether the admin form uses drag-and-drop or up/down buttons for reordering points/images (drag preferred, buttons acceptable as keyboard fallback).
- Adding one demo card of each new type to the seed content (recommended, so the local stack and e2e have every type; must keep `content.test.ts` rules meaningful — e.g. "≥ 2 image cards" becomes "≥ 2 cards with images").
- Test split: shared validators + parser unit tests; mobile Jest per type renderer and active/inactive video behaviour; admin unit tests for forms, int tests for save/convert/delete-images and link fetch (with a local test server), Playwright for creating one card of each type and the preview iframe.

## Success criteria

- An admin can create, edit, reorder and delete cards of all six types; validation errors are clear and in Romanian.
- While editing, the preview shows the card exactly as the student web app renders it, in phone and desktop modes, without saving.
- A student sees each type correctly on web at 360 px and desktop; on Android after installing the new APK (owner-verified list).
- Video starts muted when its card becomes active and stops when leaving it.
- Existing lessons look the same as before after the migration (text and single-image cards), in production too.
- All suites green; production migration applied via `pnpm db:cloud:push`.
