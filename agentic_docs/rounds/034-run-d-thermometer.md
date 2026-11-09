# Round 34, 2026-11-09: Run D, the thermometer as the rulebook plays it

Model: Opus 5.5. Budget: "go", the session.

Asked: "Read /agentic_docs/plans/nov-game-fixes/RunD.md and execute."

Answers used (from round 30, binding in the brief): Q51 (the large distance is 75 km), Q52 ("Allow other questions" while a thermometer is armed). Not answered, not built: Q48 (since 2026-10-17).

Did:
- **Rules, shared and server:** `src/lib/game/thermometer.ts` (`coveredKm`, `canAsk`, `remainingKm`, `kmText`, 2 % slack for the server); `server/src/rules/thermometer.ts` with `armThermometer`, `askThermometer`, `cancelThermometer` (seekers only; curses, rest and a Move apply) and `keepThermometerGeometry` (an armed one's start and distance are fixed); `gameOps.ts`: `sendQuestion` refuses a thermometer draft, `answerQuestion` refuses an armed one, seekers delete an armed one as a draft; `opSchema.ts` for the three ops.
- **Data:** `QuestionState` gains `armed`; the schema's `latB/lngB` nullable, `distanceKm` (default 5), `armedAt`; `GameSettings.thermometerKm` (1/5, 1/5/15, 1/5/15/75 by size) with chips on setup screen 1 and a line in the settings summary; `questionIdentity` per distance (asked again at the same distance costs double).
- **Phone:** the card (`cards/thermometer.tsx`): distance chips with Custom… and "Start: here" in a shared game, the two pins once asked or alone; the game bar (`game/ThermometerBar.tsx`): Start the thermometer, then covered/progress/Ask (lit at the full distance)/Cancel, the hider's "nothing to answer yet"; the list tag "Travelling" / "Started · travelling"; the travel line (`game/ThermometerTravel.tsx`); the armed outline is the dashed circle of its distance (`thermometerPlanningPolygon` without an end); the start pin fixed once armed (`sync.ts`); the hider's news "Thermometer started" and a tip (`events.ts`, `tourSteps.ts`); `newThermometerQuestion` in `gameSettings.ts` for both ways of adding (the Add dialog had the start and end longitudes swapped and used miles; the map's menu used miles).
- **Tests:** `tests/thermometer.test.ts` (7), five thermometer tests in `server/src/gameOps.test.ts`, three in `tests/gameEvents.test.ts`, `e2e/thermometer.spec.ts` (phone and desktop: arm at Zürich HB, the hider told, move 1.2 km north, Ask, answer Colder, the map changes).
- **Docs:** `docs/architecture.md` (Changes, the map, the thermometer), known-issues (the thermometer entry out), plan.md (D built), decisions, notes, questions (S1 now A–D, S8 new).

Changed from the brief: the circle is the question's outline rather than a new layer; Ask lights at the full distance on the phone (the server keeps the 2 % slack); without a position Start uses the question's pin.

Found on the way: the Add dialog's swapped thermometer pins and the miles (both ways of adding), fixed. At desktop width the game bar's long button labels overflowed the narrow sidebar: they wrap now. Not fixed: on a phone the half-open sheet shows the Start button above the distance chips, which sit below the fold (the existing card layout; run E's phone shell).

Checked: lint and types clean; vitest 491 passed; build and build:server; Playwright 65 passed, 17 skipped (the same 17). Screenshots looked at, phone and desktop: the draft card, the armed card at 0.45 of 1 km, the hider's list with "Started · travelling" and the toast. Unit and server tests seen failing first; the browser test was written with the code. Not checked: a real phone walking a real kilometre (S8), the server.
No root-run file changed. `server/src/app.ts` not changed.
Decisions: decisions.md, round 34. Steps created: S8. Questions added: none.
Commit message: Round 34: Run D, the thermometer started where the seekers are and asked once they've travelled its distance, 1/5/15/75 km chips, the hider told, the swapped pins fixed
