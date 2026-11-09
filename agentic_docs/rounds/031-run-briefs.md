# Round 31, 2026-11-09: the run briefs A–G from a code dive

Model: Fable 5.1. Budget: the rest of the session.

Asked: "make a deep dive of the code and describe in detail for a new agent what it should do when it tackles each run … Make a RunA.md to RunG.md … with code items to change/fix/update etc. and everything, tests, so on. You are auditing and making the plan and opus will execute on it."

Answers used:
- **Q54. Team passwords.** Suggested yes. Answer: "kinda, no hider password needed, just joining any team has a password needed, so if you join a different team you need their password. Maybe a game setup optoin for teams or not, but if solo hiders then they don't need a passowrd as their ID counts as one, right?" Read as: a Teams setting; with teams, team passwords and no hider password; without teams, the first to claim is the hider by player id, no password. Restated as Q58.
- **Q57. My reading of your answers.** Answer: "Yes, only comment is the '3/1' on the top should be on the left beside the title like 'radar' or 'measuring', and the right side should have just the icon 'i' as usual." Built into RunE and the mock-ups.
- Not answered, not built: Q48 (since 2026-10-17), Q55, Q56 (since 2026-11-09). RunC says to build nothing for Q56 while it is blank; RunF the same for Q55's gallery button.

Did:
- **`plans/nov-game-fixes/RunA.md`–`RunG.md`:** one brief per run, from reading `server/src/app.ts`, `games.ts`, `gameOps.ts`, `rules/*`, `opSchema.ts`, `positions.ts`, `push.ts`; `src/lib/game/session.ts`, `knownGames.ts`, `api.ts`, `types.ts`, `sync.ts`, `questionIdentity.ts`, `events.ts`; `JoinDialog.tsx`, `TeamPicker.tsx`, `GamePanel.tsx`, `HiderPanel.tsx`, `QuestionSidebar.tsx`, `sidebar-l.tsx`, `bottom-sheet.tsx`, `AddQuestionDialog.tsx`, `cards/thermometer.tsx`, `maps/questions/thermometer.ts`, `schema.ts`, `PhotosPanel.tsx`, `GamePopups.tsx`, the units code paths, nginx and env files. Each brief: binding answers, the code today with file and line, the changes in build order, tests to write first, acceptance, pitfalls.
- **Found while reading** (in the briefs): `AddQuestionDialog.runAddThermometer` swaps the start and end longitudes (`lngB: center.lng, lngA: destination…`); `games.ts addPhoto` never applies the late-answer rule to photos; `positions.ts` keys by name; `joinedGames` is per tab (sessionStorage); the x/y badge placement from Q57.
- **Mock-ups:** the x/y badge moved left of the title (Q57); 16 PNGs re-rendered.
- **plan.md, README.md, questions.md** updated; Q58 asked.

Checked: `npm run lint:check` (exit 0); links in `agentic_docs/` resolve. Not run: build and tests (no code changed).
No root-run file changed.
Decisions: decisions.md, round 31. Questions added: Q58.
Commit message: Round 31: the run briefs A–G from a code dive; team passwords read from Q54; badge left of the title
