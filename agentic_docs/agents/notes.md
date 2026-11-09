# Agent notes

## The owner, here

Only what differs from `../standard/profile.md`.

- Feedback arrives as a numbered list after a real game, often with screenshots, and a budget ("I have 10% and want it all used", "my last runs with Fable"). Work through every point; questions at the end.
- Hand-backs here have always mapped each numbered point to what changed, with file links, then the git lines, then the questions. Keep that shape inside the standard's hand-back.
- Rules come from the rulebook embedded in `src/content/rules/`. The owner has the source's permission; the project never names or links the site the texts came from.
- The owner plays with friends who are new to the game and the app; copy and tutorials are for them, on phones, mid-game.

## State on 2026-11-09 (round 31)

- **Code:** at commit `8391484` (Round 28); rounds 29 and 30 changed docs only. Checks at the last code round: lint and types clean, 439 unit tests, Playwright 51 passed and 17 skipped.
- **Deployed:** unknown from the laptop; S1 asks the owner to deploy and run `check.sh`.
- **What the app does now:** shared games by link with a hider password; the hider's station and pin shared between hider phones and hidden from seekers; the pin may follow GPS; seekers' positions on the hider's map; questions as a list of rows; cards picked on the tiles with a pinned bar; play area picked on the map; tours by role. Reference: `../../docs/architecture.md`.
- **Invariants a change must keep:** hiding zones decided by the station's own position; questions replaced, never mutated (`updateQuestion`); `hiderPhone` is the one "is this the hider's phone" source; `persistentAtom` from `@/lib/persist`; rule texts are the rulebook's; metric only.
- **Next:** `../plans/nov-game-fixes/RunA.md`–`RunG.md` are the briefs: A (identity, Teams setting, team passwords), B (hider sync), C (admin codes; blank Q56 blocks the codes, Q50's limits can be built), D (thermometer), E, F (phone-first; F's gallery button waits on Q55), G (metric). The owner starts a run with "go A" in a new Opus session.
- **Waiting on the owner:** Q48, Q55, Q56, Q58; S1–S5.

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
