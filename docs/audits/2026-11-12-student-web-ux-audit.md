# Student web UX audit — 2026-11-12

Walk of production `https://prepio.ro` in Claude in Chrome, signed in as the owner's account (full access, guided mode, 405 credits). First at desktop width (viewport 1646×894 CSS px), then at phone width (360×780, the app loaded in a same-origin 360 px iframe because the Chrome window was maximized and could not be resized; layout only, no touch emulation). Known payment gaps (`provider='none'`, "Plata nu e încă activă") are out of scope.

Implementation plan: `docs/superpowers/plans/2026-11-12-student-ux-polish.md`.

## What was walked

| Area | Desktop | 360 px |
|---|---|---|
| Home (hero, mode chip, invite banner, BAC card, sections, locked lessons, footer link) | ✓ | ✓ |
| Header plan/credits pill → Abonamentul meu | ✓ | ✓ |
| Creditele mele (balance, packages, history) | ✓ | ✓ |
| Profil (name, mode, rows, delete, legal links) | ✓ | ✓ |
| Invită colegi, Cum funcționează recomandările | ✓ | ✓ |
| Subiecte BAC list, paper (Subiectul I/II, split view, reader on phone, marking, Cum rezolv), hand-in summary („Mai lucrez”, nothing submitted), result | ✓ | ✓ (paper, reader, result) |
| Lesson: start screen, all 14 cards (text, images, schema, timeline, video, link), test of 9 questions (single, multi, ordering; right and wrong answers), failed-test result | ✓ | start + cards 1–2 |
| Consolidation (demo lesson): exercise map, source info marking + check, comparison and essay feedback, end screen | ✓ | ✓ |
| 404, /termeni, /sterge-cont, /confidentialitate, /recomandari | ✓ | ✓ (overflow check) |
| Console errors | none on any page walked | none |
| Horizontal scroll at 360 | — | none on 11 routes |

**Not walked (needs a separate account or would sign the owner out):** Welcome / sign-in / email code, onboarding (terms, name, mode), the terms gate, the suspended screen, a trial student (paywall, locked lessons, trial / expiring / expired banners), a brand-new student (empty states: no credits history, no BAC attempts, no progress), /invita/<CODE> signed out, a real BAC submission and grading, AI checks (none were run, to avoid spending credits). Native-only behaviour.

## Findings

Severity: **H** hurts understanding or trust, **M** visible inconsistency or friction, **L** polish.

### Global
- G1 **H** — `<html lang="en">` on every page (Romanian content): wrong screen-reader voice, wrong hyphenation, Chrome offers to translate. The `<noscript>` text is English.
- G2 **M** — The document title is always „Prepio”; no per-page titles (tabs, history and bookmarks all read „Prepio”).
- G3 **M** — No `meta description`, no Open Graph / Twitter tags, no `theme-color`, no web manifest (`/manifest.json` 404). An invite link `https://prepio.ro/invita/<CODE>` shared on WhatsApp/Instagram shows a bare „Prepio” with no image or text. This matters for referrals.
- G4 **M** — The header pill reads „★ · 🪙 405”: the plan is a lone star with no word, and the trial/expired variants have to be checked too. The accessible label is good („Acces complet, 405 credite, deschide abonamentul”), but sighted users get no text.
- G5 **M** — Inconsistent header: Home, BAC list and Consolidation show the pill; Abonament, Credits, Profile, Lesson and the BAC paper don't. The BAC hand-in summary shows it while the paper itself shows „Predă lucrarea” in its place.
- G6 **M** — Mixed terminology: „abonament” (Invite, Recomandări) vs „acces” / „Acces complet” (Abonamentul meu, pill, paywall); „carduri” (lesson start) vs „cartonaș” (card header); „exerciții” for the test questions (Profile mode card: „răspunzi corect la toate exercițiile”, „Sari direct la exerciții”) vs „Verificare” / „întrebări” everywhere else, while „exerciții” also names the Consolidare exercises.
- G7 **L** — Routes mix English and Romanian (`/credits`, `/profile`, `/lesson` vs `/abonament`, `/invita`, `/termeni`).
- G8 **L** — Contact emails in the legal pages, /sterge-cont and /recomandari are plain text, not `mailto:` links (the address itself is a known placeholder).
- G9 **L** — Chevrons are inconsistent: lesson rows have ›, the BAC card and BAC subject rows have none; „Cum rezolv” uses ▲/▼ text triangles while the rest of the app uses icon chevrons.

### Home
- H1 **H (phone)** — At 360 px the hero (a 9-line paragraph) fills the whole first screen; the current lesson („Continuă”) is below the fold. On every visit after the first, a returning student has to scroll to reach the one thing they came for.
- H2 **M** — There is no "continue" call to action: the current lesson is marked only by a thin outline and a small teal „Continuă” caption.
- H3 **M (desktop)** — The lesson grid is two columns but each section has one lesson, so cards fill half the width next to a full-width BAC card and invite banner; the page looks unbalanced.
- H4 **M** — Numbering restarts at 1 in every section, while guided mode is one global order („1 din 4 terminate”). Students can't tell which lesson comes next after the current one.
- H5 **M** — Locked lessons show only a faded 🔒; nothing says why („Termină lecția anterioară” in guided mode vs. trial).
- H6 **M** — The invite banner „Ai terminat prima lecție. Invită un coleg” has no visual call to action (no icon, no button). It looks like plain text next to a „Închide” that looks the same.
- H7 **L** — The section headers are long breadcrumbs („B. Oamenii, societatea și lumea ideilor › Constituțiile din România”): three lines at 360 px, heavier than the cards under them.
- H8 **Content** — Production shows the lesson „[demo] Toate funcționalitățile” and a published card „card test / test madalinh” (card 1 of „Constituția din 1866”).
- H9 **Config** — The invite banner, the footer link and /invita are live. STATUS says the referral flag is OFF in production; either the flag was switched on or the status is out of date. To check in Admin → Setări → Recomandări.

### Lesson
- L1 **M** — Lesson start: the zone rows (Învățare / Verificare / Consolidare) show no progress („Card 4 din 14”, „7/9 la ultima încercare”, „Consolidare 3/10”). „Continuă de unde ai rămas” doesn't say where.
- L2 **M** — After a failed test, the start screen loses any trace of it: no „Ultima încercare: 7 din 9”, and no direct „Reia testul”.
- L3 **M** — A finished lesson still says „Dacă răspunzi corect la toate, treci la lecția următoare.” and offers „Știu deja — sari la verificare”.
- L4 **M (desktop)** — The start-screen buttons sit at the bottom of a 900 px viewport, far from the card above them.
- L5 **H** — Image cards: the image is shown full width at its natural ratio. A portrait photo fills the whole screen (desktop and phone), so the caption and the card's text are entirely below the fold (card 2 „Aducerea prințului străin”: the explanation is hidden under the photo).
- L6 **L** — The card-type badge („Text”, „Imagini”, „Schemă”) is an authoring concept; students don't need it.
- L7 **L** — No keyboard navigation on desktop: ←/→ don't change cards; A–D / 1–4 don't pick options; Enter doesn't check.
- L8 **L** — Schema card: the „+” badge on the central bar is half outside the bar's right edge.
- L9 **L** — Video card: the „Atinge pentru sunet” pill sits on top of YouTube's title bar.
- L10 **M** — Test feedback repeats the explanation: once in a box under the options and again in the bottom bar. On a wrong answer the correct answer appears three times (highlighted option, a „Răspuns corect: …” box, and the bar).
- L11 **M** — A wrong answer turns the „Următoarea întrebare” button red, so the main forward action looks like an error.
- L12 **M** — Multi-select questions only say „ALEGERE MULTIPLĂ”; there is no „Alege toate variantele corecte” hint.
- L13 **M** — A wrong ordering colours all four rows red even when some are in the right place; nothing shows which positions were right.
- L14 **L** — The ordering ↑/↓ buttons are about 28 px, below the 44 px touch target. „Verifică” is enabled before any move.
- L15 **M** — Failed-test result: „Ai greșit la: întrebarea 2, întrebarea 7” doesn't show the questions and isn't tappable. „Revezi cardurile” goes back to card 1 of 14 rather than the cards related to the mistakes. The ring shows „7” without „/9”. Both the lesson test result and the BAC result are titled just „Rezultat”.

### Consolidation
- C1 **M** — Three progress indicators at once: the header „7/10”, a progress bar, and the numbered dot map. The dot colours (grey / yellow / green ring) have no legend.
- C2 **M** — The feedback card has no explicit verdict word for AI types: its title is the AI's summary („Amândouă sunt reforme…”), so „Corect / Aproape / Mai lucrează” is only implied by colour. Green text on a green background also reads poorly.
- C3 **H** — AI feedback mixes cedilla diacritics („menţionat”, „şi”, „conţinutul”) with the app's comma-below ones („ș”, „ț”). It looks sloppy and inconsistent.
- C4 **M** — „Încearcă din nou” on an AI exercise doesn't show that the next check costs credits again (the first check shows 🪙 2), and it's offered even on a „Corect” verdict.
- C5 **M (phone)** — After „Verifică” the verdict sits under the fixed action bar (Încearcă din nou + Continuă take about 25% of the screen). The student sees the colours change but has to scroll to read the feedback.
- C6 **M** — „Cum rezolv” is a pill at top right in Consolidation, but a full-width accordion in BAC.
- C7 **M** — The back button in the action bar is an icon-only „‹” in Consolidation, but „← Înapoi” in BAC and „Înapoi” in the lesson.
- C8 **M** — End screen: „Consolidare parcursă” even with 4 of 10 unsolved. The primary button is „Reia consolidarea”; for most students the better primary action is „Reia doar ce nu a fost corect” or „Mergi la lecția următoare”. Three stacked full-width buttons cover the list at 360 px.

### BAC
- B1 **M** — BAC list: no explanation of what a subject is, how long it takes, or what the 🪙 10 pays for. The cost shows without the word „credite”, and rows have no chevron.
- B2 **M** — When a new attempt is in progress, the previous graded attempt (1,30) is only reachable by URL: the list shows just „În lucru”. There's no attempt history and no best grade.
- B3 **M** — The paper opens on Sursa A even when the requirement names Sursa B (I.1 „…precizată în sursa B”).
- B4 **M** — The points tail wraps alone onto a new line („· 2 / puncte”) on desktop and phone.
- B5 **M** — The hand-in summary lists the empty items („I.1, I.2, …”) as plain text that can't be tapped. There's no per-subject breakdown, and it replaces the paper instead of opening as a sheet.
- B6 **M** — A partly answered requirement counts as answered. II.5 had both marks but no viewpoint text, and the summary said „1 din 14” with II.5 not listed as missing (the grader then gave 0/10: „Nu ai formulat un punct de vedere…”).
- B7 **L** — Map dots: the current dot's style replaces the done style, so the current item never shows whether it's complete.
- B8 **M** — Result: rows can't be opened to see the answer and the hints; there are no subtotals per Subiect, no date and no mention of the 10 ex officio points. „Reia subiectul” is shown while another attempt is already in progress.
- B9 **M (phone)** — Paper: the sticky header (title + tabs + map) takes about 30% of the height. Both source cards come before the requirement's input, each with a filled primary „Citește și marchează” button, so three primary buttons compete with „Următorul”. The title truncates to „Istorie 2026 · Varia…”.
- B10 **L (desktop)** — The split source pane has its own scroll and shows the browser's default scrollbar.

### Credits, access, profile, invite
- P1 **M** — Credit history: BAC rows say only „Corectare subiect” (the admin gets the title); an old row says only „Verificare”. There's no running balance and no grouping by day.
- P2 **L** — „≈ 202–405 verificări” is a confusing range; „CEL MAI ALES” reads oddly (better „Cel mai popular”).
- P3 **M** — The Abonamentul meu card style (white, green outline, green bar) differs from the Credits balance card (teal gradient). The history is bare text, and „405 credite” is unstyled.
- P4 **M** — Profile: the rows are full-width secondary buttons with centred text. „Invită colegi” alone is left-aligned and has no shadow. At 360 px „Abonamentul meu · Acces până la 9 f…” is truncated. „Șterge contul” sits right under „Ieși din cont”, with no separation as a danger action.
- P5 **M** — Profile doesn't show which account is signed in (no email or sign-in provider), and „Salvează” is enabled while the name is unchanged.
- P6 **M** — Invite: „Primești 40 de credite pentru fiecare coleg care își ia abonament” and „Până acum: 0 abonați” use „abonament” (see G6). There's no visual hero or how-it-works summary on the screen itself, and the free-access progress („x din 5”) only matters with no active access.
- P7 **M** — /recomandari is a very long wall of text (≈ 60 bullets). It needs a summary card, a table of contents or collapsible sections, and the FAQ as an accordion.
- P8 **L** — /sterge-cont: „Mergi la profil” is a small left-aligned button, unlike the full-width ones elsewhere. „Ce se șterge” doesn't mention progress, credits, access or BAC attempts.
