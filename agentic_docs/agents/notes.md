# Agent notes

## The owner, here

Only what differs from `../standard/profile.md`.

- Feedback arrives as a numbered list after a real game, often with screenshots, and a budget ("I have 10% and want it all used", "my last runs with Fable"). Work through every point; questions at the end.
- Hand-backs here have always mapped each numbered point to what changed, with file links, then the git lines, then the questions. Keep that shape inside the standard's hand-back.
- Rules come from the rulebook embedded in `src/content/rules/`. The owner has the source's permission; the project never names or links the site the texts came from.
- The owner plays with friends who are new to the game and the app; copy and tutorials are for them, on phones, mid-game.

## State on 2026-11-09 (round 32)

- **Code:** Run A built (round 32), not committed yet. Checks: lint and types clean, 459 unit tests, Playwright 59 passed and 17 skipped.
- **Deployed:** unknown from the laptop; S1 asks the owner to deploy and run `check.sh`; S6 is the two-phone check of Run A.
- **What the app does now:** shared games by link; a player per phone (a random key in localStorage, a public id in the game) with a six-character player code to move to another phone; a **Teams** setting: with teams everyone is in one, each team has a password, the hiding team's members are the hiders; without, the first to say "I'm the hider" is; the hider's station and pin shared between hider phones and hidden from seekers; the pin may follow GPS; seekers' positions on the hider's map, by player; questions as a list of rows; cards picked on the tiles with a pinned bar; play area picked on the map; tours by role. Reference: `../../docs/architecture.md`.
- **Invariants a change must keep:** hiding zones decided by the station's own position; questions replaced, never mutated (`updateQuestion`); `hiderPhone` is the one "is this the hider's phone" source; the role is the server's (`roleOfPlayer` in `src/lib/game/players.ts`, sent with every answer), never worked out on the phone alone; the player key never appears in the game state (only the hashed public id); `viewFor` strips every team password and every code but the viewer's; `persistentAtom` from `@/lib/persist`; rule texts are the rulebook's; metric only.
- **Next:** run B (hider sync); remove the old hider-password path there or in C (known-issues). Then C (admin codes; Q56 now answered), D, E, F (Q55 now answered), G. The owner starts a run with "go B" in a new Opus session.
- **Waiting on the owner:** Q48; S1–S4, S6.

## Traps

- **Two tabs of one browser shared state** through `@nanostores/persistent`'s cross-tab sync, which made a seeker's tab the hider. Fix: `src/lib/persist.ts` wraps `persistentAtom` with `listen: false`; always import from there; keep the hider token store mounted.
- **The e2e API runs from `server/dist`**: `npm run build:server` before `npx playwright test`, or the shared-game tests fail obscurely.
- **A dev server in the checkout** once clobbered `node_modules/.vite`. Use the production build and `astro preview` (the Playwright config does).
- **The laptop can't reach the Docker daemon** and has no nginx, osmium or sqlite3: Docker builds, `deploy/test-nginx.sh` and a real data build are verified only by CI or on the server. Say so instead of claiming they ran.
- **The deploy scripts are split by job** (`deploy.sh`, `check.sh`, `backup.sh`, `update-data.sh`) at the owner's ask; `check.sh` runs a minute after deploying because the health checks need that gap. Don't add wrapper scripts back.
- **vaul (the Menu drawer) crashes when an open drawer switches between modal and non-modal** (React error 310). The Menu remounts (`key`) when the tour changes it.
- **Playwright's `toBeVisible` is true for the desktop sidebar that slid off-screen**; use `toBeInViewport`.
- **A pane's `visibility` is the only testable thing about Leaflet panes** (they are 0×0); size assertions mean nothing.
- **Routing order in Playwright:** `routeApi`'s `**/api/**` catches `/overpass/api/interpreter`; register the Overpass mock after it.
- **`hiderChoosing.set(true)` on becoming the hider** shows the pick view over a set station (known issue, plan 05).
- **The commit counter and the old plan's round numbers differ by two.** From round 29 the round files follow the commits.
- **The server's clock rules**: every API answer carries `now`; phones correct their own clock (`serverTime.ts`). Timers compare against `serverNow()`, never `Date.now()`.
- **Two tabs of one browser are one player** (since round 32): the second tab opens the game with no join dialog, as the same player and role. To try a hider and a seeker on one machine, use a second browser context (Playwright: `browser.newContext()`) or a private window.
- **The player key and the public id are different things:** the phone sends `X-Player-Key` (secret); the game knows `p…` (sha256 of the key). Tests that need a player's id read it from the join answer (`player.id`, `you`), never from the key.
- **A screenshot right after a click can catch a colour transition** (`transition-colors`): the old choice still looks selected. Wait a beat, or fill another field first, before judging selection state from a picture.
- **An orphaned `astro preview` on port 4329** (this repo's, from an earlier run) is reused by Playwright (`reuseExistingServer`); it serves `dist/` from disk, so a fresh `npm run build` is what it serves. Check with `ss -ltnp` and leave it be.
