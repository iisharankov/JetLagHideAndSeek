# Round 33, 2026-11-09: Runs B and C, the hider's phones in step, admin and creator codes

Model: Opus 5.5. Budget: "go", the session.

Asked: "Read /agentic_docs/plans/nov-game-fixes/RunB.md and RunC.md and execute."

Answers used:
- **Q56. How the admin codes work.** Suggested yes (run C). Answer: "I added my secret there, great, let's go". Read as: yes; `ADMIN_CODE` is already in the server's `deploy/.env`.
- Not answered, not built: Q48 (since 2026-10-17). Answered, for run F: Q55.

Did:
- **Run B, the station:** `server/src/rules/hider.ts assertStationOpen`: once the clock goes, another station is a 409 outside a Move (`hiderReady`, `setHiderStation`); the same station again is a no-op, so "the hider is in place" isn't repeated. `HiderPanel.tsx` shows the pick view only without a station (or changing during a Move); `useHiderTurn` (`JoinDialog.tsx`) sets `hiderChoosing` from the station and says "Your station is X". `leaveGame()` clears the station after the game is gone.
- **Run B, the pin:** `hider.pinDriver` (the player whose phone moved the pin last, `types.ts`, `gameOps.ts setHiderPin`); `pinDrivenElsewhere` and `followPin` in `src/lib/hiderSpot.ts`: the phone that turned GPS-follow on last drives, the other gives way after 30 s with a toast (`tracking.ts`); the Hider tab says which phone moves the pin (`pin-driver`).
- **Run C, codes:** `server/src/codes.ts` (creator codes as SHA-256 hashes, games per code per Zürich day), `app.ts`: `POST /games` needs `X-Creator-Code` (admin 20 a day, creator 5), `GET /codes/mine`, `/admin/codes` (make, list, revoke), `/admin/games`, `DELETE /games/:id` with the admin code; wrong codes through `guarded` (5 a minute); the old hider password now 6 characters and 5 tries a minute; `games.ts` keeps who made a game (`creator`, `created_by` columns, added on start). `index.ts` reads `ADMIN_CODE`.
- **Run C, phone:** `src/lib/game/codes.ts` (the typed code, kept), Menu → Game "Have a code?" and Start only with a code (`GamePanel.tsx`), Menu → Admin (`AdminPanel.tsx`, `OptionDrawers.tsx`), `startGame` sends the code and forgets one refused; the organiser tour points at the code field.
- **Deploy:** `ADMIN_CODE` in `deploy/.env.example` and passed to `api` in `deploy/docker-compose.yml`; `deploy/check.sh` checks it is set (length only) and that the API has it; `docs/deployment.md` "Who may make games"; `docs/architecture.md` (the station guard, the pin, who may make games).
- **Tests:** `server/src/codes.test.ts` (11), `server/src/rateLimit.test.ts` (2), station guard and pin driver in `gameOps.test.ts`, a regression guard in `gameEvents.test.ts`, the hand-over in `pinFollow.test.ts`; `e2e/admin.spec.ts` (new), a two-hider-phone test in `e2e/roles.spec.ts`, both at phone and desktop width; every e2e that makes a game now uses a creator code (`e2e/api.ts`).
- **Docs:** known-issues (two hider entries out; the old password entry and audit item 2 updated), plan.md (B, C built), 05 (built note), decisions, notes, questions (Q56 out, S1 rewritten, S7 new), CLAUDE.md (`codes.ts` flagged).

Not built: B5's removal of the old hider-password path, because S1 (deploying Run A) has no Done line yet; it stays in known-issues.

Changed from the brief: creator codes hashed with SHA-256, not scrypt (random codes; a lookup instead of a scan); the day is Zürich's, not UTC; an admin code under 12 characters works with a warning; `followPin` returns "taken" when it gives way; one code field for both kinds, with `GET /codes/mine` to tell which.

Found on the way: `tutorial.spec.ts` "skipping a tour halfway" failed 1 of 1 full runs and 0 of 5 alone (a Next clicked before the first step was drawn): fixed by waiting for the step. The tour test caught a bold label that wasn't the field's exact label: the field's label is now "Have a code?".

Checked: lint and types clean; vitest 478 passed; build and build:server; Playwright 63 passed, 17 skipped (the same 17 as before). Screenshots looked at, phone and desktop: Menu → Game without a code, Menu → Admin with a new code and a revoked one, Menu → Game with the admin code. Server tests seen failing first; the two new browser tests were written with the code. Not checked: a real phone, the server, the Docker build, `check.sh` on the server.
**Root-run and security files changed:** `deploy/docker-compose.yml` (**passes a secret, `ADMIN_CODE`, into the `api` container**), `deploy/check.sh` (reads `ADMIN_CODE` from `.env` and prints its length only), `server/src/app.ts` (new routes and limits), `server/src/codes.ts` (new).
Decisions: decisions.md, round 33. Steps created: S7. Questions added: none.
Commit message: Round 33: Runs B and C, the hider's station set for the round and one phone moving the pin, admin and creator codes to start games, 5 wrong tries a minute for every secret
