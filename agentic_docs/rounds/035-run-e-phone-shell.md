# Round 35, 2026-11-09: Run E part 1, the tab bar, Back and the ask flow

Model: Opus 5.5. Budget: "go", the session.

Asked: "Read /agentic_docs/plans/nov-game-fixes/RunE.md and execute."

Answers used: Q57 (the draw badge left of the title, the "i" on the right; from round 31). Not answered, not built: Q48 (since 2026-10-17).

Scope: the brief's first checkpoint, E1 + E2, all green (the brief: "may take two sessions; stop at a clean checkpoint"). E3–E5 are next; what's left is listed in known-issues.

Did:
- **E1, the shell:** `src/components/TabBar.tsx` (the phone's tab bar: Map, the sections with counts, Menu; the "Ask a question" button over the map), `src/lib/game/tabBadges.ts` (the sections and counts, pure, tested), `src/lib/screens.ts` (`askFlow`, `screenDepth`, `back()`, the phone's Back through the history), the sheet above the bar and full height for the ask flow (`ui/bottom-sheet.tsx` `sheetSnap`, `ui/sidebar-l.tsx`, `mapBottomInset`), the gear and the sidebar button hidden on phones (`index.astro`, `OptionDrawers.tsx`), the map's bottom controls above the bar (`globals.css`); the desktop keeps its tabs (`QuestionSidebar.tsx` through the same sections).
- **E2, the ask flow:** `components/ask/QuestionTypes.tsx` (six tiles with the 2/1 badge, refusals from curses), `components/ask/QuestionSubtype.tsx` (radar and thermometer chips with Custom and ×2, matching and measuring type tiles, tentacles in two groups, photo rows that unfold their rule, the game size's time; Ask, or Add as a draft), `src/lib/game/newQuestion.ts` (builders, ×2); `AddQuestionDialog.tsx` deleted (its paste-from-clipboard is a link on the types screen when playing alone); the seeker tour's ask step points at the new button.
- **Tests:** `tests/askFlow.test.ts` (4), `tests/tabBadges.test.ts` (2), `e2e/shell.spec.ts` (2: the tab bar, Map and back to the same question, Back and the phone's Back, the radar ask ending on its card; ×2 on an answered distance, a photo row's rule); every e2e that added questions goes through `e2e/ask.ts`; the phone tests open the sheet from the tab bar.
- **Docs:** `docs/architecture.md` (the shell, screens and Back, the ask flow), known-issues (the rest of E), plan.md, decisions, notes, questions.

Changed from the brief: Photos stays a tab until run F; the ask flow keeps drafts ("Add as a draft (plan first)"); two atoms (`openQuestion`, `askFlow`) instead of one stack; tentacle tiles not dimmed by place counts yet; no "Change" for where a question is asked from.

Found on the way: at half height the phone's sheet left the ask screens no room: the flow opens it full height.

A slip: I ran `git rm --cached src/components/AddQuestionDialog.tsx`, which staged the deletion (the standard forbids `git rm`). Undone at once with `git restore --staged`; nothing is staged now and the file is an ordinary unstaged deletion for your `git add -A`. Added to the traps.

Checked: lint and types clean; vitest 497 passed; build and build:server; Playwright 68 passed, 18 skipped (the 17 before, plus the tab-bar test on desktop, where there's no tab bar). Screenshots looked at, 390×844 and desktop: the map with the tab bar, the types, radar (×2 on 5 km), tentacles, photo with a rule unfolded. Not test-first this round: the unit and browser tests were written right after the code, and passed on their first run. Not checked: a real phone, the phone's own Back button on Android (Playwright's `goBack` stands in).
No root-run file changed.
Decisions: decisions.md, round 35. Steps: S1 now covers rounds 32–35. Questions added: none.
Commit message: Round 35: Run E part 1, the phone's tab bar, Back on every screen and the phone's Back, the ask flow (types, choices, ×2, Ask or draft)
