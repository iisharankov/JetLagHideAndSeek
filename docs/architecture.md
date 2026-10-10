# Architecture

How the app works **as of round 12** (2026-10-10). Status and what's left are
in [plan.md](plan.md); the audits are [audit-2026-10.md](audit-2026-10.md)
(current) and [audit.md](audit.md) (round 2, history).

## The big picture

```
Phone (installable web app)                 Your server (Docker, behind host nginx; Authelia later)
  React islands on an Astro page   ──────►  web       the app + /tiles/basemap.pmtiles + /data/
  Leaflet map, Protomaps basemap   ──────►  api       /api/share, /api/games (SQLite, photos, live updates)
  question engine (Turf + ArcGIS)  ──────►  overpass  /overpass/api/interpreter (Swiss OSM data)
  service worker (app shell)       ──────►  photon    /photon/api/ (place search)
```

The browser talks to no other host. The production nginx sends a
Content-Security-Policy that enforces that, and `e2e/csp.spec.ts` runs the app
under exactly that policy. For `pnpm dev`, `.env.development` points the app
at public services instead.

## Stack

| Layer     | Tech                                                                                                                                      |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Page      | Astro 5 (static), one page `src/pages/index.astro` plus the reference and rulebook pages; each panel is a React 19 island behind an error boundary (`src/components/islands/`) |
| UI        | Tailwind 3, shadcn/ui (Radix), react-toastify                                                                                             |
| Map       | Leaflet 1.9 via react-leaflet; basemap drawn from a Protomaps `.pmtiles` file by `protomaps-leaflet`                                      |
| State     | nanostores (`src/lib/context.ts`, `src/lib/game/session.ts`), saved to localStorage per tab through `src/lib/persist.ts` (no cross-tab sync) |
| Geo maths | Turf; ArcGIS geodesic distance/buffer (its engine served from `/arcgis/`, copied there by `scripts/copy-arcgis-assets.mjs`)               |
| Map data  | Reference files under `/data/` first, Overpass (own server) through `src/maps/api/overpassClient.ts` as the fallback                      |
| PWA       | `@vite-pwa/astro`, registered in `src/pwa.ts`; precaches the app (not the data), shows background notifications                           |
| API       | `server/`: Hono on Node with `node:sqlite`, bundled by esbuild                                                                             |
| Tests     | Vitest (unit, `tests/` and `server/`), Playwright with Firefox (browser, `e2e/`, desktop and phone); CI in `.github/workflows/ci.yml`      |

## Directory map

```
src/
  pages/index.astro         the page; pages/reference.astro and pages/rules/ (the rulebook, from src/content/rules)
  layouts/Layout.astro      <head>: local fonts, icons, manifest, service worker, toasts
  lib/
    config.ts               where the self-hosted services live (PUBLIC_* overrides)
    context.ts              the stores (questions, play area, hider pin, zone settings, UI state)
                            and the question helpers: addQuestion, updateQuestion, deleteQuestion
    hiderSpot.ts            the hider's station and pin: picking, clamping, where answers come from
    persist.ts              persistentAtom without cross-tab listening
    questionKey.ts          a question's identity for the map (its shared fields, cached per object)
    gameSettings.ts         applying a game's settings to the stores; newRadiusQuestion
    questionInfo.ts         each question type: rulebook section + how the app answers it
    rules/                  rulebook sections and the transcribed cards (cards.ts)
    game/                   shared games: types.ts (shared with the server), api.ts (calls, the
                            live stream over fetch), session.ts (connection, sync, hiderPhone),
                            knownGames.ts (the games list, joined games), serverTime.ts (the
                            server's clock), sync.ts, answers.ts, settings.ts,
                            deck.ts (the digital deck, pure), deckSession.ts, hand.ts (physical
                            deck), clock.ts, endgame.ts, events.ts + alerts.ts (what to tell
                            whom; push opt-in), drafts.ts, photos.ts, answerTimer.ts,
                            questionIdentity.ts (asked again, randomize), scoreboard.ts,
                            curseRules.ts (what each curse does to the game)
    activeQuestion.ts       which question draws its reference places
    jobs.ts                 busy tracker, "latest runner" (no overlapping refreshes), yieldToUi
    sharedGame.ts           a game's play area and zone settings: names, checks, applying
    storage.ts              safe decoding of saved questions
    memoizeAsync.ts         cache that forgets failures
    geolocation.ts          GPS with readable errors; the phone's position while Follow me is on
  maps/
    schema.ts               zod schemas for the 5 question types
    index.ts                question engine: applies questions, remembers each step, reports status
    errors.ts               NotApplicableError ("doesn't apply here", shown in amber)
    regionRules.ts          Swiss adaptations (100k cities, hidden question types)
    adminBorders.ts         border lines, "closer to a border" region, level labels
    distanceRegion.ts       grid distance maps ("within X km of these lines")
    stationNames.ts         station-name rules (name on the sign, accents ignored)
    hidingZones.ts          station filters, expanding search
    hidingZoneStations.ts   the stations hiding zones are drawn around (kinds, de-duplication)
    hidingZoneLayer.ts      the zones on the map: which stations are left, drawing, the hider
                            picking a station, the end game, the Move marker
    trainLines.ts           "same train line" (reference data, else Overpass)
    references.ts           what to draw for a question: star, dots, zone outline
    elevation.ts            ground height from the elevation tiles (altitude question)
    datasets/               reading the reference data; airports.ts, stations.ts (unreachable ones)
    questions/*.ts          per question type: adjust map, hider mode, planning outline
    questions/places.ts     airports / big cities / places of a type, incl. across the border
    api/overpass*.ts        Overpass queries and the client (fallbacks, cache, remarks)
    api/geocode.ts          Photon place search
  components/
    islands/                the islands: Map, QuestionSidebar, OptionDrawers, PlayAreaBar, TutorialDialog
    Map.tsx, mapRefresh.ts  the map and its refresh pipeline
    DraggableMarkers.tsx    question pins and the hider pin; PolygonDraw.tsx: drawing tools
    QuestionSidebar.tsx     the sidebar: Questions, Stations (Hider on the hider's phone), Photos, Cards
    cards/                  base.tsx (the card frame: fold, lock, hide, delete) + one card per type
    StationsPanel.tsx       seekers: hiding zones, stations left, "Found it" (end game)
    HiderPanel.tsx          hider: pick the station, the pin, Continue after a Move
    PlayAreaBar.tsx         choosing the play area (search, draw) during setup
    OptionDrawers.tsx       the Menu panel: Game (GamePanel) and Settings (SettingsPanel) tabs,
                            MenuGroup
    game/                   GameSetupDialog (+ setup/DeckEditor, setup/QuestionsStep), GamePanel
                            (incl. scoreboard), JoinDialog (name and role
                            first, also after starting a game), QuestionGameBar (send / answer / veto /
                            randomize, the answer timer), PhotosPanel, CardsPanel (the hand) with
                            CardTiles, ActiveCurses, CardHistory, CardFace; RoundClock, GamePopups
                            (alerts), PushCard, NotePins
    ReferenceMarkers.tsx    draws the active question's reference places
    TutorialDialog.tsx + tutorialSteps.tsx (15 named steps; ids in lib/tutorial.ts)
    CoachMark.tsx           a one-off pointer in the tutorial's style (lib/coachMark.ts), e.g. "pick your hiding spot"
server/src/                 API: app.ts routes, games.ts (games in SQLite, photos, live updates),
                            gameOps.ts (the rules: applyOp, viewFor), push.ts (push
                            notifications, VAPID keys)
server/datasets/            builds the reference data (build.ts; nearest.ts, routes.ts, elevation.ts)
deploy/                     Docker Compose stack, nginx configs, data scripts, guide
tests/, e2e/                unit and browser tests
```

## How a map refresh works (`components/mapRefresh.ts`)

1. `requestMapRefresh()` runs when something the map can see changes: a
   question's data, hidden or locked (`questionsMapKey`; folding a card
   isn't one), the hider pin, the play area, the end game, a question's
   state in the shared game. Runs never overlap: a call during a run
   schedules one more run afterwards.
2. The play area comes from the drawn polygon or the chosen place; in the
   end game it is clipped to the picked station's zone.
3. On the hider's phone (`hiderPhone`): alone, each unlocked question is
   answered from the pin on a copy, and the ones whose answer changed are
   written back; in a shared game, answers are only suggested (nothing is
   sent until the hider taps one).
4. `applyQuestionsToMapGeoData` narrows the area question by question and
   returns a status per question: ok, skipped (hidden / planning / waiting
   / vetoed / before the end game / inactive draft), not applicable, or
   error. An answer that would leave no area is reported as a contradiction
   and skipped. Each step's result is remembered by the chain of questions
   before it, so editing the newest question recomputes one step. The page
   gets to paint between steps.
5. Confirmed answers are applied first, then each seekers' draft on its own
   so its ruled-out area can be drawn in its colour; questions waiting for
   the hider are outlined, not applied.
6. The area outside is shaded; the hiding zones recompute from it only when
   it changed (`hidingZoneLayer.ts`, through its own no-overlap runner).

All background work goes through `busy.track()`, which counts running jobs, so
one failing job can't leave the app stuck in "loading".

## Reference datasets

Map questions are answered from pre-built files instead of live queries.
`server/datasets/build.ts` turns the OSM extract (Switzerland + 30 km) into
`/data/*.json`:

| File                        | What                                                                                                             | Used by                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `<category>.json`           | Overpass-shaped places: POIs, airports (only those on `airports.ts`), cities, stations, brands                   | places in the play area, tentacles, hiding zones            |
| `voronoi-<set>.json`        | for each place type, airports and cities of 100k / 1M people: the part of the covered area nearest to each place | matching ("same nearest X?"): the seeker's cell is the answer |
| `admin-<level>.json`        | boundaries with bbox                                                                                             | zone questions, admin-border measuring                      |
| `train-lines.json`          | train lines (OSM `route=train`) stopping at each station                                                         | "same train line"                                           |
| `lakes.json`                | lakes of 10 km² or more, with their area                                                                         | lake shore measuring                                        |
| `highspeed.json`            | high-speed lines                                                                                                 | high-speed measuring                                        |
| `elevation/<z>/<x>/<y>.i16` | ground height in metres, 256 × 256 per web-map tile, zooms 9–11, from AWS Terrain Tiles                         | altitude question                                           |
| `manifest.json`             | covered area, counts, the wider area if built with it                                                            | coverage checks                                             |

**Places across the border.** With `--far far-places.osm.pbf` (airports,
cities and POIs within ~300 km, see `deploy/update-data.sh`), the builder
computes spherical Voronoi cells over all places, keeps the far places whose
cell reaches into the covered area and adds them to the category files. So
"nearest airport" can be Basel-Mulhouse or Milan, and the category files are
complete for any nearest-place question inside the covered area. Measuring
questions take every place within the seeker's distance of the play area
(`datasets.placesForMeasuring`).

`src/maps/datasets/` answers questions from these files. When they can't
answer (outside the covered area, or no file for a filter) it returns
null/undefined and the caller falls back to Overpass. "Closer to a border",
"closer to a lake shore" and the admin-border answer inside hiding zones use
grid distance maps (`src/maps/distanceRegion.ts`) instead of buffering.

## Data the app requests (all from the own server)

| What                      | Request                                                          | Cached                                     |
| ------------------------- | ---------------------------------------------------------------- | ------------------------------------------ |
| Play-area boundary        | Overpass `relation(id); out geom;`                               | Cache Storage (permanent)                  |
| Places, stations, borders | reference files, else Overpass `nwr[...](area...)`, `way(r)`     | Cache Storage, and in memory per play area |
| Admin levels at a point   | reference files, else Overpass `is_in`                           | Cache Storage                              |
| Basemap                   | HTTP range requests into `/tiles/basemap.pmtiles`                | browser HTTP cache                         |
| Place search              | Photon `/photon/api/?q=...`                                      | no                                         |
| Share links               | `POST /api/share`, `GET /api/share/:id`                          | no                                         |
| Shared games              | `/api/games/...` (see below), a server-sent-events stream        | no                                         |

Overpass answers that are really errors (HTTP 200 with a "runtime error"
remark) are treated as failures and never cached.

## Shared games (`src/lib/game/`, `server/src/games.ts`)

One game per link (`?game=<id>`). The server keeps each game as one JSON
document in SQLite: play area, hiding zone settings, game settings (size,
rules, deck, which questions and cards), questions, photo questions, photos
(files on disk), curses and powerups, the clock, the digital deck, a Move in
progress, the hider's spot, and earlier rounds.

- **Changes** are small operations (`putQuestion`, `sendQuestion`,
  `answerQuestion`, `vetoQuestion`, `castCurse`, `drawCards`, `playCard`,
  `move`, `startEndgame`, `clock`…) checked by `gameOps.ts`: a seeker's new
  question is a _draft_ the hider can't see; _asked_ questions wait for the
  hider; _answered_ ones are locked for seekers unless the hider allows them
  to answer. Last change wins. `viewFor` strips what a role may not see
  (drafts from the hider, the hider's spot and the deck's order from the
  seekers).
- **Live updates:** each phone reads a server-sent-events stream
  (`/api/games/<id>/events`, over fetch so the hider's token can go in the
  header) and gets the whole game, as its role may see it, after every
  change, with the server's clock. `events.ts` diffs the old and new game
  into what to tell this phone (toast, buzz, beep, background
  notification); the server runs the same diff for push notifications.
  Lost connections are retried with a growing wait (5 s to a minute).
- **On the phone**, `session.ts` mirrors the game into the usual stores
  (questions, play area, zone settings, end game, the hider's spot). Local
  edits are compared with what the server last sent and the differences go
  out as operations; edits not sent yet survive incoming updates. View
  settings (folded, hidden, locked) stay per phone.
- **The map** applies answered questions as usual, then the seekers' drafts
  on top in their colours; questions waiting for the hider are outlined.
- **The hider** proves the role with a token (from the password) in a
  header on every request: never in the URL (servers log it) and never a
  cookie (tabs share it, which would make a seeker's tab the hider). The
  hider's station and pin live in the game so two hider phones share one
  spot, and are never sent to seekers; answers are worked out from the
  station until the end game, then from the pin. Photos are re-encoded
  before upload, which drops their location data; a game holds 100 at most.
- **Joining:** a game's link opens a dialog for the name and the role
  before anything else; the choice is remembered per browser.
- **Push notifications** (`server/src/push.ts`): phones that opted in get
  what their role must hear about through the browser's push service, as
  encrypted messages signed with the server's own keys; the service worker
  (`public/push-sw.js`) shows them when the app isn't in front.
- **The digital deck** (`deck.ts`, pure, shared with the server): the server
  shuffles and deals what an answered question earns, the hider keeps or
  plays cards, and the time bonuses are worked out from the hand.
- **Teams** (`teams` in the game state): optional; a player is in one team
  at a time, the hider's team is the round's hider (`hiderTeamId`), and
  after a round one team claims the next (`nextHiderTeamId`) before anyone
  starts it. A new round voids the hider token, so every phone re-joins.
- **The hider's station:** a tapped station is `pendingStation` (memory
  only) until Done makes it `chosenStation` and tells the server
  (`hiderReady`): the seekers hear that, the clock starts. Before that the
  hider's Research tab holds `research` questions: never synced, answered
  from the tapped station or the pin, deleted on Done.
- **Which places count** (`lib/placeRules.ts`): places rejected while
  setting up (kept per play area on the phone, carried in the game's
  settings) are out of every question, and duplicates (same name, within
  300 m) are one place. Rejections bypass the pre-computed nearest-place
  maps for that kind; the answer is then computed from the place list.
- **The curses** (`curseRules.ts`, shared with the server): which curses
  stop the seekers from asking until cleared, which take questions away
  (the Drained Brain's three, the Spotty Memory's die), which end by
  themselves, and what they award the hider. The server refuses what a
  curse forbids; the phones grey it out and say why.
- Games untouched for a year are deleted (`games.cleanup`, daily).

## Persistence and sharing

- Game state lives in localStorage, read once per tab (another tab's writes
  are not picked up, on purpose). Saved questions that this version can't
  read are backed up (`questions-unreadable-backup`) instead of stopping the
  app. Questions belong to the game they were asked in: joining a game
  replaces them with the game's, and leaving it (or the game being
  deleted) drops them.
- On phones the questions are a bottom sheet (`ui/bottom-sheet.tsx`, used
  by `ui/sidebar-l.tsx`): half the screen or all of it, nothing dimmed or
  blocked behind it; on desktop the left sidebar. The Menu is a panel from
  the right behind the gear (`OptionDrawers.tsx`).
- There is no snapshot sharing (links, files, pasted games): the shared
  game on the server is the one way to play together.

## Known structural debt

- The question engine reads global state (the stores, the Overpass caches),
  so it can't run in a Web Worker yet; the per-question cache covers the
  common edits.
- Every change sends the whole game to every phone, earlier rounds included.
- The remaining big files: CardsPanel (the hand's flows), GameSetupDialog
  (the Game step), context.ts (the stores); the rest came apart in round 14.
