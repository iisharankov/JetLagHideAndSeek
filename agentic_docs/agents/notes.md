# Agent notes

## The owner, here

Only what differs from `../standard/profile.md`.

- Feedback arrives as a numbered list after a real game, often with screenshots, and a budget ("I have 10% and want it all used", "my last runs with Fable"). Work through every point; questions at the end.
- Hand-backs here have always mapped each numbered point to what changed, with file links, then the git lines, then the questions. Keep that shape inside the standard's hand-back.
- Rules come from the rulebook embedded in `src/content/rules/`. The owner has the source's permission; the project never names or links the site the texts came from.
- The owner plays with friends who are new to the game and the app; copy and tutorials are for them, on phones, mid-game.

## State on 2026-11-09 (round 29)

- **Code:** at commit `8391484` (Round 28). Nothing changed in this round; it adopted the standard and moved the docs. Checks at the last code round: lint and types clean, 439 unit tests, Playwright 51 passed and 17 skipped (size-specific skips).
- **Deployed:** unknown from the laptop; rounds 22–28 were handed over with deploy lines. S1 asks the owner to deploy and run `check.sh`.
- **What the app does now:** shared games by link with a hider password; the hider's station and pin shared between hider phones and hidden from seekers; the hider's pin may follow GPS; seekers' positions on the hider's map; questions as a list of rows; cards picked on the tiles with a pinned bar; play area picked on the map; tours by role; a basemap with no footpaths when zoomed out. Reference: `../../docs/architecture.md`.
- **Invariants a change must keep:** hiding zones decided by the station's own position; questions replaced, never mutated (`updateQuestion`); `hiderPhone` is the one "is this the hider's phone" source; `persistentAtom` from `@/lib/persist` (no cross-tab sync); rule texts are the rulebook's.
- **Next:** the November plan (`../plans/nov-game-fixes/plan.md`): sessions A (identity, team roles), B (hider sync) and E (thermometer) before the next game night, then C–D (phone-first), F (metric, photos). Blocked on nothing except Q51 (metric values) for F and Q53 (identity approach) for A.
- **Waiting on the owner:** Q47–Q53; S1–S4.

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
