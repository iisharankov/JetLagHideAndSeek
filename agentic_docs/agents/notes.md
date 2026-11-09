# Agent notes

## The owner, here

Only what differs from `../standard/profile.md`.

- Feedback arrives as a numbered list after a real game, often with screenshots, and a budget ("I have 10% and want it all used", "my last runs with Fable"). Work through every point; questions at the end.
- Hand-backs here have always mapped each numbered point to what changed, with file links, then the git lines, then the questions. Keep that shape inside the standard's hand-back.
- Rules come from the rulebook embedded in `src/content/rules/`. The owner has the source's permission; the project never names or links the site the texts came from.
- The owner plays with friends who are new to the game and the app; copy and tutorials are for them, on phones, mid-game.

## State on 2026-11-09 (round 33)

- **Code:** runs A (round 32, committed) and B and C (round 33, not committed yet) built. Checks: lint and types clean, 478 unit tests, Playwright 63 passed and 17 skipped.
- **Deployed:** unknown from the laptop; S1 deploys A–C; S7 puts the admin code on the owner's phone; S6 is the two-phone check of Run A. `ADMIN_CODE` is in the server's `deploy/.env` (the owner's Q56 answer).
- **What the app does now:** shared games by link; only the admin code (server `.env`) or a creator code from Menu → Admin starts a game, 20 or 5 a day; a player per phone (a random key in localStorage, a public id in the game) with a six-character player code to move to another phone; a **Teams** setting: with teams everyone is in one, each team has a password, the hiding team's members are the hiders; without, the first to say "I'm the hider" is; the hider's station is set for the round once the clock goes (the server refuses another outside a Move) and a phone joining the hider gets it, never the pick view; one hider phone at a time moves the pin with GPS; seekers' positions on the hider's map, by player; questions as a list of rows; cards picked on the tiles with a pinned bar; play area picked on the map; tours by role. Reference: `../../docs/architecture.md`.
- **Invariants a change must keep:** hiding zones decided by the station's own position; questions replaced, never mutated (`updateQuestion`); `hiderPhone` is the one "is this the hider's phone" source; the role is the server's (`roleOfPlayer` in `src/lib/game/players.ts`, sent with every answer), never worked out on the phone alone; the player key never appears in the game state (only the hashed public id); `viewFor` strips every team password and every code but the viewer's; the admin code is never stored, creator codes only as hashes; every wrong secret (admin, creator, team password, player code, old hider password) goes through `guarded` in `app.ts` (5 a minute); `persistentAtom` from `@/lib/persist`; rule texts are the rulebook's; metric only.
- **Next:** run D (thermometer). Remove the old hider-password path (known-issues) once S1 is done and the phones have reloaded. Then E, F (Q55 answered), G. The owner starts a run with "go D" in a new Opus session.
- **Waiting on the owner:** Q48; S1–S4, S6, S7.

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
- **E2e tests that start a game need a creator code** (since round 33): API-made games through `createGameOnApi` in `e2e/api.ts` (a fresh code each, 5 games a day), UI starts through `giveCreatorCode(page)` before the first `goto`. The test API's admin code is in `playwright.config.ts` (`ADMIN_CODE=e2e-admin-code-not-a-secret`). The desktop and phone projects share one test API server: names made in a test (codes, teams) can meet the other project's; make them unique per project.
- **A tour's first step must be drawn before its Next is clicked** (`tutorial.spec.ts`): right after "Show Tutorial", a Next click was lost now and then under load (1 of 1 full runs, 0 of 5 alone). Wait for `data-tour-step` first.
- **Tour text's bold words are checked against the app** (`tests/tour.test.ts`): each `**label**` must appear as a whole label or button text. A label with a sentence after it fails; split the sentence into its own line.
