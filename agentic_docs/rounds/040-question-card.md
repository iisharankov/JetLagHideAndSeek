# Round 40, 2026-11-10: The question card on phones, no Ask button over the map, an even tab bar; mock-ups of card layouts

Model: Opus 5.5. Budget: "go", overnight ("in the morning I'll discuss them").

Asked: "Don't have "+ Ask a question" button tere, there's a questions tab. Make the icons on the bottom equal distance, it's weird with the middle gap. Image 2 + 3 Restrucutre and rething this whole layout, the questions are still artifacts of the original design. Buttons are too small for phone layout, some settings could be combined and made to toggle between or cycle or something, like the gps options, inside outside maybe a toggle switch, idk, but all of it could be restrucutred. Tr fixing it and also make a few (at least 3) pngs of different ideas and options and in the morning i'll discuss them. over all good but the quesoitns tab questoins and settings on them need work, but it's getting better!" (with three screenshots: the map with the Ask button over the tab bar; a radar draft's open card, full and half height)

Read as: three changes built (no Ask button over the map; the tab bar evenly spaced; the open question card rebuilt for phones), plus at least three mock-ups of other card layouts in a plan folder, with a question for the morning.

Answers used: none. Not answered, not built: Q48.

Did:
- **No "Ask a question" over the map:** `AskButton` gone (`TabBar.tsx`, `islands/TabBar.tsx`, `index.astro`); the map's bottom controls sit just above the tab bar again (`globals.css`).
- **An even tab bar:** the sections take one share each, like Map and Menu (`TabBar.tsx`), so four or five items are evenly spaced.
- **The question card (option A, "sections")**, for all five kinds through shared parts:
  - `cards/parts.tsx` (new): `CardSection` (a small label over a control), 44 px `CHIP`s, `AnswerToggle` (the answer as one big two- or three-way toggle: Inside/Outside, Hotter/Colder, Same/Different, Shorter/Same/Longer, Closer/Further, Lower/Higher), labelled "Show the map as if the answer is" in a game and "Answer" alone.
  - `cards/base.tsx`: the header is ‹, the cost badge, the title, the **i** (the title isn't cut off any more); Hide from the map, Lock (alone) and Delete at the card's foot, with words.
  - `LatLngPicker.tsx`: "Asked from" is one 56 px row (the pin's colour, the coordinates, **Change ›**); Change opens Use my location, the search and the coordinates (six decimals now), Paste, Copy. The three small icon buttons are gone.
  - `radius.tsx`, `thermometer.tsx`: Distance chips in a section, Custom beside them; `matching.tsx`, `measuring.tsx`, `tentacles.tsx`: the type dropdown under "Type"; the dropdown is 48 px on phones (`ui/select.tsx`). The thermometer's "Warmer" is "Hotter", as the rulebook says.
- **Mock-ups:** `agentic_docs/plans/question-card/` with `README.md` (the options, good and less good, a suggestion) and `mockups/png/`: 01–01d option A as built (screenshots of the app), 02 option B (the question as a sentence), 03 option C (a summary; Edit reopens the ask screens), 04 option D (a short card over the map), 05 toggles per kind and "from where" as one cycling control, 06 the hiding clock as a pill in the header. Q59 asks which.
- **Tests:** `e2e/shell.spec.ts` (nothing over the map; the tab bar's items within 1 px of each other's width), seen failing first; `e2e/ask.ts` opens the Questions tab on a phone before asking.
- **Docs:** `docs/architecture.md` (the card, asking from the Questions tab), decisions, known-issues (the title and "Change" items gone), questions (Q59, the plan, S1 now rounds 32–40), `agentic_docs/README.md`.

Changed from the ask: the "toggle switch" idea is a big segmented toggle in what's built (both words visible); a true switch is shown in picture 05 for yes/no wording. The hiding clock bar is unchanged (picture 06 shows it as a pill).

Found on the way: the coordinate editor showed 14 decimals ("47.37062590077475"); the thermometer card said "Distance (medium game):" over its new Distance label. Both fixed. The matching card's second dropdown (the zone level) has no section label of its own.

Checked: lint and types clean; vitest 518 passed (71 files); build and build:server; Playwright 87 passed, 7 skipped (the six two-phone tests on the phone, the tab-bar test on the desktop). Screenshots looked at, phone 390×844: the radar draft in a game (your case), its Change sheet, a matching and a thermometer draft; the mock-ups 02–06 rendered and looked at. Test-first for the two quick fixes; the card rebuild was checked by the existing browser tests (the radio roles and button names kept) and the screenshots, no new test of its own. Not checked: a real phone.
No root-run file changed.
Decisions: decisions.md, round 40. Questions added: Q59.
Commit message: Round 40: the question card rebuilt for phones (sections, big chips, one Asked-from row, a big answer toggle, actions at the foot), no Ask button over the map, an even tab bar, mock-ups of three other card layouts
