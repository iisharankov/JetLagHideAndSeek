# Architecture

How the app works **as of round 4** (2026-10-09). Plans are in
[plan.md](plan.md); the original findings are in [audit.md](audit.md).

## The big picture

```
Phone (installable web app)                 Your server (Docker, behind host nginx + Authelia)
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

| Layer      | Tech                                                                                                            |
| ---------- | --------------------------------------------------------------------------------------------------------------- |
| Page       | Astro 5 (static), one page `src/pages/index.astro`; each panel is a React 19 island behind an error boundary (`src/components/islands/`) |
| UI         | Tailwind 3, shadcn/ui (Radix), react-toastify                                                                    |
| Map        | Leaflet 1.9 via react-leaflet; basemap drawn from a Protomaps `.pmtiles` file by `protomaps-leaflet`            |
| State      | nanostores (`src/lib/context.ts`), mostly persisted to localStorage                                             |
| Geo maths  | Turf; ArcGIS geodesic distance/buffer (its engine served from `/arcgis/`, copied there by `scripts/copy-arcgis-assets.mjs`) |
| Map data   | Overpass API (own server) through `src/maps/api/overpassClient.ts`                                              |
| PWA        | `@vite-pwa/astro`, registered in `src/pwa.ts`; precaches the app (not pages, so an expired Authelia login reaches the login page) |
| API        | `server/`: Hono on Node with `node:sqlite`, bundled by esbuild                                                  |
| Tests      | Vitest (unit, `tests/` and `server/`), Playwright with Firefox (browser, `e2e/`); CI in `.github/workflows/ci.yml` |

## Directory map

```
src/
  pages/index.astro         page layout
  layouts/Layout.astro      <head>: local fonts, icons, manifest, service worker
  pages/reference.astro     question reference page (descriptions + rules links)
  lib/
    config.ts               where the self-hosted services live (PUBLIC_* overrides)
    context.ts              global state (nanostores) + helpers like deleteQuestion
    questionInfo.ts         each question type: rulebook section + how the app answers it
    rules/                  rulebook sections, transcribed cards (cards.ts)
    game/                   shared games: types (shared with the server), API client,
                            session.ts (connection, sync), sync.ts, answers.ts, photos.ts
    activeQuestion.ts       which question draws its reference places
    jobs.ts                 busy tracker + "latest runner" (no overlapping refreshes)
    sharedGame.ts           parse / summarize / apply shared games (links, files)
    shareApi.ts             client for /api/share
    storage.ts              safe decoding of saved questions
    memoizeAsync.ts         cache that forgets failures
  maps/
    schema.ts               zod schemas for the 5 question types
    index.ts                question engine: applies questions, reports per-question status
    errors.ts               NotApplicableError ("doesn't apply here", shown in amber)
    regionRules.ts          Swiss adaptations (100k cities, hidden question types)
    adminBorders.ts         border lines, "closer to a border" region, level labels
    distanceRegion.ts       grid distance maps ("within X km of these lines")
    stationNames.ts         station-name rules (name on the sign, accents ignored)
    hidingZones.ts          unit-safe hiding-zone maths, station kinds
    hidingZoneStations.ts   the stations hiding zones are drawn around
    trainLines.ts           "same train line" (reference data, else Overpass)
    references.ts           what to draw for a question: star, dots, zone outline
    elevation.ts            ground height from the elevation tiles (altitude question)
    datasets/               reading the reference data; airports.ts is the airport list
    questions/*.ts          per question type: adjust map, hider mode, planning outline
    questions/places.ts     airports / big cities / places of a type, incl. across the border
    api/overpass*.ts        Overpass queries and the client (fallbacks, cache, remarks)
    api/geocode.ts          Photon place search
  components/
    Map.tsx, mapRefresh.ts  the map and its refresh pipeline
    QuestionSidebar.tsx, cards/*.tsx
    ZoneSidebar.tsx         hiding zones (stations, filters, per-zone check)
    ReferenceMarkers.tsx    draws the active question's reference places
    cards/QuestionInfoButton.tsx  the ⓘ popover (rulebook text)
    game/                   shared game panel, question state bar, Photos and Curses tabs
    OptionDrawers.tsx       share/load/settings bar
    SharedGameDialog.tsx    "load this shared game?" prompt
    TutorialDialog.tsx + tutorialSteps.tsx (15 named steps; ids in lib/tutorial.ts)
server/src/                 API: app.ts routes, games.ts (games in SQLite, photos, live
                            updates), gameOps.ts (who may change what), shareStore.ts
server/datasets/            builds the reference data (build.ts; nearest.ts, routes.ts,
                            elevation.ts)
deploy/                     Docker Compose stack, nginx configs, data scripts, guide
tests/, e2e/                unit and browser tests
```

## How a map refresh works (`components/mapRefresh.ts`)

1. `requestMapRefresh()` is called when questions or hider mode change. Runs
   never overlap: a call during a run schedules one more run afterwards.
2. The play area comes from the drawn polygon or the chosen place (Overpass).
3. In hider mode, each question is auto-answered (`hiderify*`); failures are
   recorded per question instead of aborting.
4. `applyQuestionsToMapGeoData` narrows the area question by question and
   returns a status per question: ok, skipped (hidden / planning), not
   applicable, or error. An answer that would leave no area is reported as a
   contradiction and skipped. Statuses go to `questionStatuses`; each card
   shows its own.
5. The area outside is shaded; the hiding-zone sidebar recomputes from it
   (through its own no-overlap runner).

All background work goes through `busy.track()`, which counts running jobs, so
one failing job can't leave the app stuck in "loading".

## Reference datasets

Map questions are answered from pre-built files instead of live queries.
`server/datasets/build.ts` turns the OSM extract (Switzerland + 30 km) into
`/data/*.json`:

| File | What | Used by |
| --- | --- | --- |
| `<category>.json` | Overpass-shaped places: POIs, airports (only those on `airports.ts`), cities, stations, brands | places in the play area, tentacles, hiding zones |
| `voronoi-<set>.json` | for each place type, airports and cities of 100k / 1M people: the part of the covered area nearest to each place | matching ("same nearest X?"): the seeker's cell is the answer |
| `admin-<level>.json` | boundaries with bbox | zone questions, admin-border measuring |
| `train-lines.json` | train lines (OSM `route=train`) stopping at each station | "same train line" |
| `lakes.json` | lakes of 10 km² or more, with their area | lake shore measuring |
| `highspeed.json` | high-speed lines | high-speed measuring |
| `elevation/<z>/<x>/<y>.i16` | ground height in metres, 256 × 256 per web-map tile, zooms 9–11, from AWS Terrain Tiles | altitude question |
| `manifest.json` | covered area, counts, the wider area if built with it | coverage checks |

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

| What                         | Request                                                                 | Cached                                  |
| ---------------------------- | ----------------------------------------------------------------------- | --------------------------------------- |
| Play-area boundary           | Overpass `relation(id); out geom;`                                      | Cache Storage (permanent)               |
| Places, stations, borders    | Overpass `nwr[...](area...)`, `way(r)` for borders                      | Cache Storage, and in memory per play area |
| Admin levels at a point      | Overpass `is_in`                                                        | Cache Storage                           |
| Basemap                      | HTTP range requests into `/tiles/basemap.pmtiles`                       | browser HTTP cache                      |
| Place search                 | Photon `/photon/api/?q=...`                                             | no                                      |
| Share links                  | `POST /api/share`, `GET /api/share/:id`                                 | no                                      |

Overpass answers that are really errors (HTTP 200 with a "runtime error"
remark) are treated as failures and never cached.

## Shared games (`src/lib/game/`, `server/src/games.ts`)

One game per link (`?game=<id>`). The server keeps each game as one JSON
document in SQLite: play area, hiding zone settings, game settings
(size, whether seekers may answer), questions, photo questions, photos
(files on disk) and curses, plus earlier rounds.

- **Changes** are small operations (`putQuestion`, `sendQuestion`,
  `answerQuestion`, `castCurse`…) checked by `gameOps.ts`: a seeker's new
  question is a *draft* the hider can't see; *asked* questions wait for the
  hider; *answered* ones are locked for seekers unless the hider allows them
  to answer. Last change wins.
- **Live updates:** each phone keeps a server-sent-events stream
  (`/api/games/<id>/events`) and gets the whole game, as its role may see
  it, after every change.
- **On the phone**, `session.ts` mirrors the game into the usual stores
  (questions, play area, zone settings). Local edits are compared with what
  the server last sent and the differences go out as operations; edits not
  sent yet survive incoming updates. View settings (collapsed, hidden,
  locked) stay per phone.
- **The map** applies answered questions as usual, then the seekers' drafts
  on top, shaded amber; questions waiting for the hider aren't applied.
- **The hider** proves the role with a token (from the password) on every
  request. Hider mode works out suggested answers on copies of the questions;
  only the answer the hider taps is sent. Their position never leaves the
  phone. Photos are re-encoded before upload, which drops their location
  data.
- Games untouched for a year are deleted (`games.cleanup`, daily).

## Persistence and sharing

- Game state lives in localStorage. Saved questions that this version can't
  read are backed up (`questions-unreadable-backup`) instead of stopping the
  app.
- A shared game (link, file or pasted JSON) is validated as a whole before
  anything changes. Opening a link asks first if you already have questions.
  Presets are merged, never removed.
- Share links: `?share=<id>` (own server), with `?hzc=` (compressed game in
  the link) as a fallback. `?hz=` and `?url=` still load.

## Known structural debt (not yet addressed)

- Questions are still mutated in place and refreshed with `questionModified()`.
- ZoneSidebar (≈1.4k lines) and OptionDrawers are still large.
- The question engine still reads global state, so it can't run in a worker yet.
