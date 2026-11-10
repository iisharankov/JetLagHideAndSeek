# Round 45, 2026-11-10: The question card redrawn; the clock on top, Ask at the foot; no pins for answered questions

Model: Opus 5.5. Budget: a fix.

Asked (pasted): comments on the card in the app: "Hide from the map" can say "Hide"; "Send to the hider" can say "Send", at the bottom between Hide and Delete, the most prominent; "×2" beside the "2/1"; the Draft strip can go ("it's always a draft until it's sent"); "Asked from" → "Location"; distance and location side by side, smaller, so the controls can go to the bottom with a map to see and move the pin; "Show the map as if the answer is" worded better, the Inside/Outside pills smaller. Then: "04-option-d has the idea, defo move things to the bottom… offer the map to be larger. I'm conflicted doing it as is, or using option a, option b, or option c variants. Remake all the photos with the comments above and ideas and let's see." And: "Pins should not show for questions already answered i think. In questions tab, ask a question should be on bottom, and time at top."

Read as: draw the card again, every option (A, B, C, D) in D's frame (the map on top, the controls at the bottom), each with all the comments, to choose from (Q59), not built yet; build the two plain changes (no pins once answered; the Questions tab with the clock on top and Ask at the bottom).

Answers used: none (Q59 still open; this redraws it).

Did:
- **Pictures** (`plans/question-card/mockups/png/10–18`, from `screens.html`; the README says what each shows): D (one row: distance and Location ⟳, What if as one row), A (labelled sections folded into two rows), B (the sentence, What if they say Yes | No), C (a summary with Edit, What if as a chip on the map), the guess four ways with the words, Location's pop-up, a thermometer, matching, and the card after Send. Every one has: the map on top and large with the pin to drag and ⤢ for the big map; Hide · **Send** · Delete at the foot; 2/1 ×2 in the header; no Draft strip (who made it under the title); "Location"; "What if". Drawn with the app's icons (lucide) and colours; the map is drawn, not tiles. Round 40's drawings (02–06) removed: 10–18 replace them (git has them).
- **No pins for answered or vetoed questions** (`pinOnMap` in `lib/game/sync.ts`, used by `DraggableMarkers.tsx`): their answer stays drawn; drafts and waiting questions keep their pin; playing alone, every pin stays.
- **The clock at the top, Ask at the foot** (`QuestionSidebar.tsx`): the hiding clock moved from the foot of the sidebar to the top of every tab (under the title and the location note); Ask a question moved from above the list to the foot of the Questions tab, just over the tab bar on phones, a little taller (48 px). The hider's "The seekers ask; you answer" note stays above the list.
- **Tests, seen failing first:** `tests/gameSync.test.ts` (`pinOnMap`: answered and vetoed false, asked and draft true, alone true), `e2e/shell.spec.ts` (a game with an answered and a waiting radar: the clock above the list, Ask under it and within 40 px of the tab bar on the phone; one question pin on the map, not two).

Changed from the ask: the clock is at the top of every tab, not only Questions, so it stays put when switching tabs. Vetoed questions lose their pin too (as finished as answered ones).

Found on the way: nothing.

Checked: lint and types clean; vitest 553 passed (76 files); build and build:server; Playwright full run 94 passed, 8 skipped. Screenshots looked at: the nine pictures (fixed a squashed What if in A, a wrapped thermometer button, a label over a station name, a doubled waiting line); the app at phone width (Questions: clock on top, Ask at the foot; the map: the answered radar without a pin, the waiting and draft ones with; Cards: the clock on top) and desktop width (Questions). Test-first. Not checked: on a real phone.
Root-run files changed: none. Also flagged: none.
Decisions: decisions.md, round 45. Steps changed: S1 (rounds 32–45). Questions added: none (Q59 reworded for the new pictures).
Commit message: Round 45: the question card redrawn (A–D with the map on top, Send between Hide and Delete, What if), the clock at the top, Ask at the foot, no pins for answered questions
