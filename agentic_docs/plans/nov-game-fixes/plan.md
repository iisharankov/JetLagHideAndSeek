# The run plan

Revised 2026-11-09 (round 31) with the owner's answers (Q47, Q49, Q50, Q52, Q53) and comments on the mock-ups. For an Opus-only run, in sessions a context window can hold. Each session ends with the full check (`npm run lint:check && npm run typecheck && npx vitest run`, then `npm run build && npm run build:server && npx playwright test`), a round file in `agentic_docs/rounds/` and a proposed commit message; the owner commits and deploys.

## The runs

Each run has its own brief with the code to change, the tests to write first and the acceptance checks: [RunA.md](RunA.md), [RunB.md](RunB.md), [RunC.md](RunC.md), [RunD.md](RunD.md), [RunE.md](RunE.md), [RunF.md](RunF.md), [RunG.md](RunG.md). The agent that runs one reads `CLAUDE.md`, `agentic_docs/agents/notes.md`, then that file. Blank questions (Q48, Q55, Q56 as of 2026-11-09) are built around, not guessed.

| Run | Points | What it delivers | Size | What you do |
|---|---|---|---|---|
| **A** (built, round 32) | 4, 6 | **Who you are.** A player id per phone (silent) and a player code (the spare key); a **Teams** setting; with teams, team passwords and no hider password at all, the hider team's members are the hiders; without teams, the first to claim is the hider by id, no password (Q54); positions and teams by id; stale players fade at 10 min and can be removed at 60. [04](04-identity-and-rejoin.md), [06](06-teams-and-roles.md) | a session | Deploy; then on two phones at one table: join, reload one, swap one with the code. [RunA.md](RunA.md). |
| **B** (built, round 33) | 5 | **The hider's phones in step.** A joining hider sees the picked station (no "pick your station", no re-announcement); the server refuses a second `hiderReady`; one phone at a time drives the pin by GPS; the audit table worked through. [05](05-hider-sync-audit.md) | half a session; merges into A if the context allows | Deploy; a second hider phone joins mid-game and sees the station. |
| **C** (built, round 33) | Q47, Q49, Q50 | **Who may make games.** Admin code from `.env`; creator codes made and revoked in Menu → Admin; Start a shared game only with a code; 5 games a day per code; hider (and team) password at least 6 characters, 5 tries a minute. [08](08-admin-and-gates.md) | half a session | Put `ADMIN_CODE` in `deploy/.env` before deploying; make a creator code per friend. Q56 before the run. |
| **D** (built, round 34) | 2 | **The thermometer as the rulebook plays it.** Start where you are (the hider is told), travel the distance as the crow flies with a ring and a progress bar, then Ask; Custom distance; other questions allowed meanwhile (Q52). [02](02-thermometer.md) | a session | Deploy; walk one 1 km thermometer for real. Q51 settles the chips (75 km large). |
| **E** | 1 (i) | **The phone shell.** Bottom tab bar with Back; Map tab shows the map and Questions returns to where you were; the question-type picker with x/y badges and the **?** mini-tour; the sub-type screens (chips with Custom and ×2 corner badges, tentacle tiles, photo rows that unfold); the **i** for rules; toasts with a full-height ×. [01](01-mobile-design.md) | a session, maybe two | Deploy; play with it on your phone and send a numbered list. |
| **F** | 1 (ii), 7 | **The rest in the new shell.** Hider tab as rows with the end game last (confirm, then 5 s to undo); hider's answer screen with Veto and Randomize as separate greyed-when-unavailable buttons; photo request detail with the rule text, the randomized badge, **Take a photo / From the gallery** (setting, Q55); Cards and Menu as tabs; tours re-pointed; Playwright's phone project runs every flow. [01](01-mobile-design.md), [07](07-photo-questions.md) | a session | Deploy; same. |
| **G** | 3 | **Metric everywhere.** The table in [03](03-metric-conversion.md) applied to the rules pages and the app; the unit toggle gone; a test that no rules page says "mile" or "feet"; the converted doc confirmed. | half a session | Read the final table once. |

Order: **A, B, C** first (they broke the game and gate who plays), then **D** (the thermometer is a rules error every game hits), then **E, F** (the layout), then **G**. A, B and D before the next game night at the least.

## What "done" means, per run

### A — identity and teams
- Reload, closed browser or new tab: still the same player, no join dialog. Playwright: a new context with the same localStorage.
- The player code moves a player to another phone; the old phone says "Taken over on another phone" and can rejoin.
- Team membership and positions are keyed by player id; renaming keeps them.
- With teams, every member of the hider team is a hider (view, tab bar, no position sent, may answer and pick the station); joining a team needs its password; the hider team's password is the hider password. Without teams, the hider password works as today.
- After `newRound` with a claimed next team, both phones of that team are hiders at once, no password typed.
- Stale players: faded on the map after 10 minutes, dropped from positions after 60, removable from Menu → Game by the organiser or by anyone after an hour.

### B — hider sync
- A phone becoming the hider in a game with a station set sees that station; `hiderChoosing` is set only when there is none (or a Move is on).
- `hiderReady` with a station set and the clock going is a 409 unless a Move is on; a repeated `hiderReady` with the same station makes no news.
- Only one hider phone follows GPS at a time; the Hider tab says which.
- `leaveGame` clears `chosenStation`.

### C — admin and gates
- As in [08](08-admin-and-gates.md) "Tests to write first".

### D — thermometer
- States draft → armed → ready → asked → answered, with Cancel back to draft at no cost; the server refuses Ask before the distance is covered and a second Arm.
- The hider sees "started from here, 5 km" with the start pin and nothing to answer; other questions may be asked meanwhile.
- Chips 1 / 5 / 15 / 75 km by size plus Custom; the engine's hotter/colder half-plane unchanged.
- Playwright with faked GPS walks one through.

### E — the shell and the ask flow
- Tab bar, Back on every pushed screen, Map/Questions keeps state, the type picker, the sub-type screens, the **i**, the **?** mini-tour, ×2 and x/y badges, Custom chips, toasts with ×, 44 px targets.
- Desktop still works. The seeker tour points at the new places.

### F — the rest
- Hider tab rows; end game confirm then 5 s undo (the seekers are told only after); hider answer screen; photo detail with gallery option behind the setting; Cards and Menu as tabs; hider tour re-pointed; no phone-project skips except two-phone layouts.

### G — metric
- Every row of [03](03-metric-conversion.md) applied; `tests/metric.test.ts` passes; the reference page's chips match `RADAR_KM`, the thermometer list and the tentacle distances.

## Before the next game night

A, B, C, D deployed, then two phones at one table: join both, reload one, swap one with the code, make one phone the hider mid-game, arm and ask one thermometer. Then the real game.
