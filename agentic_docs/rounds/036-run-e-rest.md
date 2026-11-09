# Round 36, 2026-11-09: Run E part 2, rules behind an i, toasts, targets, the mini-tour, the tests on the phone

Model: Opus 5.5. Budget: "go", overnight.

Asked: "Continue on Round E and also do all of Round F. Once you finish all of those and everything is in place, continue onto G. I will set a timer to continue you overnight if credits run out. If they do, continue, if you were done, make a quick audit and retun results"

Read as: three rounds in one working tree, one per run: 36 (the rest of E), 37 (F), 38 (G); each green before the next. The owner commits them together.

Answers used: Q57 (from round 31). Not answered, not built: Q48 (since 2026-10-17).

Did:
- **E3, rules behind an i:** `src/components/RuleInfo.tsx` (the round **i** and what it unfolds in place: the rulebook's text for the type or the kind's first paragraph, "In this app", Full rules, All questions), on each kind's choices and on the open card (replacing `cards/QuestionInfoButton.tsx`, deleted); the card's draw is the `3/1` badge left of the title now, the "Hider draws 3, keeps 1" line gone.
- **E3, toasts:** `src/components/Toasts.tsx` (the `ToastContainer` with a full-height × 44 px wide on the right; `Layout.astro`, CSS in `globals.css`).
- **E3, targets:** every button at least 44 px tall on phones (`ui/button.tsx`, the sidebar's rows and menu buttons in `ui/sidebar-l.tsx`, the coordinate buttons in `LatLngPicker.tsx`); the card's icon buttons 44 px on phones.
- **E4, the mini-tour:** the **?** on "Ask a question" runs `ASK_TOUR` (`lib/tourSteps.ts`, four notes: the kinds, the cost badge, ×2, the **i**).
- **E5, tours and tests:** the seeker tour's Photos step opens the types and points at the Photo tile (`TourStep.screen`, arranged by `CoachMark.tsx`); the 11 browser tests that skipped the phone "sidebar open on desktop" run on both projects (`sharedGame`, `playArea`, `twoTabs`, `reference`).
- **Also from the design:** a tentacle kind with no places in the play area is dimmed, "none in the play area" (`lib/game/placeCounts.ts`, counted once per play area); a 30 ms buzz on Ask (`tap()` in `lib/game/alerts.ts`); the type tiles wrap at 120 % text.
- **Tests:** `tests/placeCounts.test.ts` (2, seen failing first), `tests/tour.test.ts` (the ask tour), `e2e/shell.spec.ts` (the **?** tour, the radar's **i**, the toast's ×), `e2e/reference.spec.ts` (the **i** unfolds in place and folds again).
- **Docs:** `docs/architecture.md` (the i, the targets, the toasts, the mini-tour), known-issues (what's left of the phone layout), decisions.

Changed from the brief: 44 px set once in the button and row primitives rather than class by class; the tentacle tile is dimmed but can still be picked; the photos tour step points at the Photo tile only inside a game (outside one, the kinds).

Found on the way: at 120 % text "Thermometer" touched its tile's edge (the title row wraps now). A `beforeEach(() => mock.mockReset())` returns the mock, which vitest then runs as the teardown (a trap now).

Checked: lint and types clean; vitest 500 passed (69 files); build and build:server; Playwright 81 passed, 7 skipped (the six two-phone tests on the phone project, the tab-bar test on the desktop). Screenshots looked at, 390×844 and desktop: the **?** tour's notes, the measuring choices with the **i** open, the open card with the **i** open, the undo toast with its ×, the types and radar at 120 % text. Test-first only for the place counts; the rest was tested right after the code (the tests passed once their own mistakes were fixed: the clipboard toast that Firefox never shows, the tour's last button "Finish"). Not checked: a real phone.
No root-run file changed.
Decisions: decisions.md, round 36. Questions added: none.
Commit message: Round 36: Run E part 2, rules behind an i, toasts with a full-height ×, 44 px buttons on phones, the ? mini-tour, the game tests on the phone
