# Round 32, 2026-11-09: Run A, player ids, player codes, team passwords

Model: Opus 5.5. Budget: "go", the session.

Asked: "Read /agentic_docs/plans/nov-game-fixes/RunA.md and execute."

Answers used:
- **Q58. My reading of your Q54 answer.** Suggested yes (four lines). Answer: "yup, looks good. make it so even solo players need to make their own team in teams mode, no players outside team can join game". Read as: with Teams on, joining needs a team (a new one for someone alone), and nobody leaves a team, they switch.
- **S5. Choose the admin code.** Done line: "Set" (and in Q56: "I added my secret there"). Removed from questions.md.
- Answered, not used this round: Q55 (run F), Q56 (run C). Not answered, not built: Q48 (since 2026-10-17).

Did:
- **Players** (`src/lib/game/players.ts` shared; `server/src/rules/players.ts`): a random key per phone (`src/lib/game/playerKey.ts`), sent as `X-Player-Key` on every request and the stream (`api.ts`); the game's `players` keyed by a public id hashed from the key; `POST /games/:id/join` (name, team with password, "I hide"); `POST /games/:id/rejoin` with the six-character code; `DELETE /games/:id/players/:player` (organiser, or anyone after 60 min). Last seen stamped in memory, written with the next change or every 5 min (`games.ts touch`).
- **Teams setting** (`GameSettings.teams`, setup screen 1): with teams everyone is in one (Q58), passwords 6–64 characters hashed with scrypt (`rules/passwords.ts`, moved out of `games.ts`), members by id (`rules/teams.ts`), 5 wrong passwords or codes a minute per game (`server/src/rateLimit.ts`); without teams the first "I'm the hider" is the hider.
- **The role follows the player** (`roleOfPlayer`): the server computes it per request and sends it with every answer and stream event (`app.ts`); the phone applies it (`session.ts applyRole`): a new round with a claimed team swaps roles with nothing to type. The old hider password stays one release as a fallback.
- **Positions** by player id, kept 60 min (was 12 h), faded at 10 min; a hider's refused.
- **Phone:** `JoinDialog.tsx` (mock-up 15: team buttons, password, "We hide this round", or seeker/hider; Rejoin with the code), `TeamPicker.tsx`, Menu → Game `GamePanel.tsx` (mock-up 16: you, your code, Share the code, Switch team…, players with last seen and Remove; "I'm the hider" without teams), `NextHiderDialog.tsx` and `SeekerMarkers.tsx` by id; `joinedGames`/`markJoined` gone from `knownGames.ts`; `claimHider`/`forgetHider`/`postHiderPassword` gone from the phone; new-round notice reworded (`events.ts`).
- **Tests:** new `server/src/players.test.ts` (12), `tests/players.test.ts` (6), `e2e/identity.spec.ts` (4, desktop and phone); team tests in `gameOps.test.ts` rewritten for ids and passwords; `seekerPositions.test.ts` by id; every e2e hider join lost its password lines; `twoTabs.spec.ts` now checks two tabs are one player; the two-team flow in `sharedGame.spec.ts` turns Teams on and swaps roles with no dialog.
- **Docs:** `docs/architecture.md` (players, the role, joining, teams), known-issues (two entries out, one debt in), plan.md (A built), decisions, notes, questions (S1 rewritten, S6 new).

Changed from the brief: the header is `X-Player-Key` and the store `playerKey`, and the game uses a hashed public id, because the brief's id would have been both the secret and the key of `players`, which every phone receives. `formatCode`/`roleOfPlayer` live in `src/lib/game/players.ts` (one shared file instead of `roles.ts`).

Found on the way: switching team kept the old password typed (fixed: cleared); push subscriptions kept the old role after a role swap (fixed: re-sent on a role change, no test because the test browsers have no push service); the "not heard from" count counted you.

Checked: lint and types clean; vitest 459 passed; build and build:server; Playwright 59 passed, 17 skipped (the same 17 as before). Screenshots looked at, phone and desktop: join with teams (hiding and seeking), join without teams, Menu → Game (fresh and with stale players), setup with the Teams switch. The server tests were seen failing first; the e2e identity tests were written with the code, not seen failing on the old code. Not checked: a real phone, the server, the Docker build.
No root-run file changed. `server/src/app.ts` changed (flagged in CLAUDE.md): new endpoints join, rejoin, remove player; the role from the player; a rate limit on team passwords and codes.
Decisions: decisions.md, round 32. Steps created: S6. Steps removed: S5 (done). Questions added: none.
Commit message: Round 32: Run A, a player per phone with a player code, a Teams setting with team passwords, the role follows the team, positions by player
