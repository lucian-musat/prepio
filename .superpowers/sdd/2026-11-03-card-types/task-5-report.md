# Task 5 report
Built CardView (type chip + eyebrow + title + CardContentView), CardContentView switch (text only; other types render null until Tasks 6-9), RichText (bold/italic spans, headings, lists, callouts with CALLOUT_LABELS, no HTML), TextCard, 6 new 24x24 icon paths, `useCardLeaving` (context set by Outgoing, exported from ui/index), fetchLesson via cardFromRow, CardStepper uses the new CardView.
TDD: RED = RichText.test/CardView.test failed "Cannot find module ./RichText" (suites failed). GREEN: `pnpm --filter @prepio/mobile test` 41 suites / 321 tests pass; typecheck clean.
Test changes: CardStepper.test (text fixture, image tests replaced by chip/eyebrow test), LessonScreen.test fixtures, content.test (images + text rows).
Concerns: no browser validation done (shell only; Tasks 6-10 will have visible UI); no dedicated test for useCardLeaving yet; scripts/supabase-cloud.sh shows a mode-only diff from UNC checkout, not committed.

## Fix round 1
RichText `Spans` now renders nested plain `Text` (only bold family / italic style), so spans inherit the parent's role typography and colour; headings skip the bold family (already Nunito-Black). Added test: heading has Nunito-Black/18, span in callout has no own color/fontSize. Result: 41 suites / 322 tests pass, typecheck clean.
