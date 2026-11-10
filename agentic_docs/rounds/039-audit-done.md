# Round 39, 2026-11-10: Audit of runs A–G against the plan's "What done means"

Model: Opus 5.5. Budget: an ask ("what's left?"), answered; no code changed.

Asked: "what's left? Is everything done? Use the plan "What "done" means, per run" to double check everyhting and make sure it's all done"

Read as: a check, item by item, of `history/plans/nov-game-fixes/plan.md` "What done means, per run", with the evidence for each; gaps written down, not built (an ask gets an answer).

Answers used: none.

Result: every "done" item of runs A–G is built. Five are built without a test of their own, two were changed by your answers, and the plan's last step (the game-night check on real phones) is yours.

| Run | "Done" item | Status | Evidence |
|---|---|---|---|
| A | Reload, closed browser, new tab: same player, no join dialog | done | `e2e/identity.spec.ts` "a restarted browser…" (new context, same storage), `e2e/twoTabs.spec.ts` |
| A | The player code moves a player; the old phone says so and can rejoin | done (worded "You continued on another phone. Rejoin here with your code…") | `e2e/identity.spec.ts` "the player code moves a player…", `server/src/players.test.ts` |
| A | Teams and positions by player id; renaming keeps them | done | `server/src/players.test.ts` ("one per player whatever their name") |
| A | Teams: the hider team's members are all hiders; a team needs its password | done | `e2e/identity.spec.ts` "teams: …", "a wrong team password…" |
| A | Without teams "the hider password works as today" | changed by Q54/Q58: no password, the first to claim hides; the old password path stays one release (known-issues) | `players.test.ts` "the hider without teams" |
| A | After a new round the claimed team's phones are hiders, nothing typed | done | `players.test.ts` "a new round hands the hider's role…" |
| A | Stale players: faded at 10 min, gone from positions at 60, removable | done; the fading has no test | `SeekerMarkers.tsx` (`QUIET_MS`), `server/src/positions.ts` (`KEPT_MS`), `players.test.ts` "removing a player" |
| B | A phone becoming the hider sees the set station; picking only without one (or during a Move) | done | `JoinDialog.tsx` (`hiderChoosing.set(!station)`), `e2e/roles.spec.ts` "a second phone of the hiding team gets the station…" |
| B | A second `hiderReady` refused once the clock runs (unless Move); the same station again makes no news | done | `gameOps.test.ts` "is set for the round once the clock goes…" |
| B | One hider phone follows GPS at a time; the Hider tab says which | done | `gameOps.test.ts` "knows which phone moved the pin last", `roles.spec.ts`, `pinFollow.test.ts` |
| B | `leaveGame` clears `chosenStation` | done; no test | `session.ts` `leaveGame` |
| C | Everything in 08's "Tests to write first" | done | `server/src/codes.test.ts`, `app.test.ts`, `e2e/admin.spec.ts` |
| D | Draft → armed → asked → answered; Cancel at no cost; Ask refused before the distance; no second Arm | done ("ready" is the phone lighting Ask, not a server state) | `gameOps.test.ts` "starts where the seekers are…", "can be called off… at no cost" |
| D | The hider sees "started from the Start pin, 5 km", nothing to answer | done | `ThermometerBar.tsx`, `events.ts`, `e2e/thermometer.spec.ts` ("Thermometer started", "Started · travelling") |
| D | Other questions may be asked meanwhile (Q52) | done (nothing blocks them); no test of its own | `gameOps.ts` |
| D | Chips 1/5/15/75 by size plus Custom; the half-plane unchanged | done | `tests/thermometer.test.ts`, `QuestionSubtype.tsx` |
| D | Playwright walks one with faked GPS | done | `e2e/thermometer.spec.ts` (both projects) |
| E | Tab bar, Back, Map/Questions keeps state, types, choices, i, ?, ×2 and x/y, Custom, toasts with ×, 44 px | done | `e2e/shell.spec.ts`, `e2e/reference.spec.ts`, `tests/askFlow.test.ts`, `tests/tabBadges.test.ts` |
| E | Desktop still works; the seeker tour points at the new places | done | the desktop project; `e2e/tutorial.spec.ts`, `tests/tour.test.ts` |
| F | Hider tab rows; the end game confirmed, then 5 s with Undo, the seekers told only after | done; the browser test is a two-phone one, so desktop only | `e2e/roles.spec.ts` (Undo: nothing reaches Ana), `tests/delayed.test.ts` |
| F | The hider's answer screen; photo detail with the gallery behind the setting | done | `e2e/sharedGame.spec.ts`, `e2e/thermometer.spec.ts`, `e2e/photos.spec.ts` |
| F | Cards and Menu as tabs; the hider tour re-pointed | done | `e2e/menu.spec.ts`, `e2e/tutorial.spec.ts` |
| F | No phone-project skips except two-phone layouts | done: the six left are all two-phone (roles ×2, location ×3, tutorial ×1) | `grep test.skip e2e` |
| G | Every row of 03 applied; `tests/metric.test.ts` passes | done | round 38's table |
| G | The reference page's distances match `RADAR_KM`, the thermometer list, the tentacle distances | done: `/reference/` renders those same rules pages; the unit test checks the lists; the browser test reads the rulebook page, not `/reference/` | `tests/metric.test.ts`, `e2e/reference.spec.ts` |

Not done, and yours: the plan's "Before the next game night" (deploy, then two phones at one table): S1, S6, S8 in questions.md.

Left from the briefs beyond the "done" lists (already in known-issues, "Phone layout, left after runs E and F"): a card's title truncated on phones; tapping the current tab doesn't scroll to the top; no "Change" for where a radar is asked from; the six two-phone tests on desktop only; the rules pictures in miles; `vaul` unused.

Found on the way: the trap in notes.md "`hiderChoosing.set(true)` on becoming the hider" described the bug run B fixed; removed.

Checked: read only (greps of the code and tests listed above); no checks run, nothing changed but docs.
No root-run file changed.
Decisions: none. Questions added: none.
Commit message: Round 39: audit of runs A–G against the plan's "done" list, the stale hider-pick trap removed
