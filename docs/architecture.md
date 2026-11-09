# Architecture

How the app works, kept current each round (last checked 2026-11-09, round 29). What's left is in
[../agentic_docs/roadmap.md](../agentic_docs/roadmap.md); known problems in [../agentic_docs/known-issues.md](../agentic_docs/known-issues.md).

## The big picture

```
Phone (installable web app)                 Your server (Docker, behind host nginx; Authelia later)
  React islands on an Astro page   ──────►  web       the app + /tiles/basemap.pmtiles + /data/
  Leaflet map, Protomaps basemap   ──────►  api       /api/share, /api/games (SQLite, photos, live updates)
  question engine (Turf + ArcGIS)
  service worker (app shell)
```

**Metric only** (round 38): distances are km or m everywhere, the rules
pages included (`src/content/rules/`, converted as in
`agentic_docs/history/plans/nov-game-fixes/03-metric-conversion.md`; their pictures
still show the original miles); a question saved in miles loads in km
(`lib/metric.ts`); `tests/metric.test.ts` keeps it so.

The browser talks to no other host. The production nginx sends a
Content-Security-Policy that enforces that, and `e2e/csp.spec.ts` runs the app
under exactly that policy. For `pnpm dev`, `.env.development` points the app
at public services instead.

## Stack

| Layer     | Tech                                                                                                                                      |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Page      | Astro 5 (static), one page `src/pages/index.astro` plus the reference and rulebook pages; each panel is a React 19 island behind an error boundary (`src/components/islands/`) |
| UI        | Tailwind 3, shadcn/ui (Radix), react-toastify                                                                                             |
| Map       | Leaflet 1.9 via react-leaflet; basemap drawn from a Protomaps `.pmtiles` file by `protomaps-leaflet`, with its rules adjusted in `src/maps/basemapStyle.ts` |
| State     | nanostores (`src/lib/context.ts`, `src/lib/game/session.ts`), saved to localStorage per tab through `src/lib/persist.ts` (no cross-tab sync) |
| Geo maths | Turf; ArcGIS geodesic distance/buffer (its engine served from `/arcgis/`, copied there by `scripts/copy-arcgis-assets.mjs`)               |
| Map data  | Reference files under `/data/`, built on the server for one box; a play area outside it isn't possible (the old Overpass client in `src/maps/api/` only ever answers "no map data for this area" now) |
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
    hiderSpot.ts            the hider's station and pin: picking, clamping, where answers come
                            from, the pin following the hider's GPS (at most every 15 s)
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
                            curseRules.ts (what each curse does to the game), positions.ts
                            (the seekers' positions: when to send, who's shown), askFrom.ts
                            (a question's seekers' point, checked against the phone's)
    activeQuestion.ts       which question draws its reference places
    jobs.ts                 busy tracker, "latest runner" (no overlapping refreshes), yieldToUi
    format.ts               "3 min ago", "14:05": the panels' shared formatters
    placeRules.ts           which places count: inside the play area, the kind rules, rejections, duplicates
    sharedGame.ts           a game's play area and zone settings: names, checks, applying
    storage.ts              safe decoding of saved questions
    memoizeAsync.ts         cache that forgets failures
    geolocation.ts          GPS with readable errors; the phone's position (currentPosition)
    tracking.ts             one GPS watch, while Follow me is on or the hider's pin follows them
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
    trainLines.ts           "same train line" (reference data)
    references.ts           what to draw for a question: star, dots, zone outline
    elevation.ts            ground height from the elevation tiles (altitude question)
    datasets/               reading the reference data; airports.ts, stations.ts (unreachable ones)
    questions/*.ts          per question type: adjust map, hider mode, planning outline
    questions/places.ts     airports / big cities / places of a type inside the play area; the null answer when none
    api/overpass*.ts        the queries that read the reference data (placesInZone…); the Overpass client behind them has no server any more
    api/geocode.ts          place search over the reference data (zones, stations, places)
  components/
    islands/                the islands: Map, QuestionSidebar, TabBar, GameDialogs, PlayAreaBar
    Map.tsx, mapRefresh.ts  the map and its refresh pipeline (the play area's shape: maps/playArea.ts)
    DraggableMarkers.tsx    question pins and the hider pin; PolygonDraw.tsx: drawing tools
    QuestionSidebar.tsx     the sidebar: Questions (with the photo questions), Cards, Stations
                            (Hider on the hider's phone), Menu
    QuestionList.tsx        the Questions tab: one row per question (lib/game/questionList.ts:
                            the order); a row (or the pin) opens the card in its place
    cards/                  base.tsx (the open card's frame: back, lock, hide, delete) + one card per type
    StationsPanel.tsx       seekers: hiding zones, stations left, "Found it" (end game)
    HiderPanel.tsx          hider: pick the station, then rows (station, pin follows GPS, seekers on
                            the map, show stations, show pin, Start the end game with 5 s to undo)
    PlayAreaBar.tsx         choosing the play area during setup: tapping cantons, districts or
                            municipalities on the map (lib/playAreaPick.ts, maps/playAreaPickLayer.ts),
                            search, drawing; the areas are joined without slivers (maps/mergeAreas.ts)
    MenuScreen.tsx          the Menu tab: Game (GamePanel), Settings (SettingsPanel), Help, Admin;
                            openMenu / closeMenu (Escape). GameDialogs.tsx: the game's dialogs,
                            popups, the tutorial and the desktop's Menu button
    game/                   GameSetupDialog (+ setup/DeckEditor, setup/QuestionsStep), GamePanel
                            (incl. scoreboard), JoinDialog (name and role
                            first, also after starting a game), QuestionGameBar (send / answer / veto /
                            randomize, the answer timer), PhotoRequests (the photo rows, a photo
                            question's screen, other photos), PlayCardConfirm, CardsPanel (the hand) with
                            CardTiles, ActiveCurses, CardHistory, CardFace; RoundClock, GamePopups
                            (alerts), PushCard, NotePins
    ReferenceMarkers.tsx    draws the active question's reference places
    CoachMark.tsx           the tutorial's ring and note (dims nothing): runs the tours (lib/tour.ts:
                            state and what was seen; lib/tourSteps.ts: the texts, the tips),
                            single pointers ("pick your hiding spot", lib/coachMark.ts) and tips;
                            the examples in Zürich: lib/tourDemo.ts (shapes), maps/tourDemoLayer.ts;
                            a step opens the sidebar on a tab, the Menu on a section, the question
                            types, or a new game's setup on a screen (the note above them)
server/src/                 API: app.ts routes, games.ts (games in SQLite, photos, live updates),
                            positions.ts (the seekers' positions, in memory),
                            gameOps.ts (the rules: applyOp, viewFor) with its helpers in
                            rules/ (shared checks, questions, curses, hider, teams), push.ts
                            (push notifications, VAPID keys)
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
| `admin-<level>.json`        | boundaries with bbox                                                                                             | zone questions, admin-border measuring                      |
| `train-lines.json`          | train lines (OSM `route=train`) stopping at each station                                                         | "same train line"                                           |
| `lakes.json`                | lakes of 10 km² or more, with their area                                                                         | lake shore measuring                                        |
| `highspeed.json`            | high-speed lines                                                                                                 | high-speed measuring                                        |
| `elevation/<z>/<x>/<y>.i16` | ground height in metres, 256 × 256 per web-map tile, zooms 9–11, from AWS Terrain Tiles                         | altitude question                                           |
| `manifest.json`             | covered area, counts                                                            | coverage checks                                             |

**Only the play area counts.** The rulebook: places outside the play area
don't exist. So every place question (nearest airport, city, zoo, museum…,
the lake shore, McDonald's) works from the places inside it
(`questions/places.ts`, `lib/placeRules.ts`), and none inside is the
_null answer_: offered first on the hider's card, sent like any other
answer, and it rules nothing out. The "same nearest X?" answer is a Voronoi
diagram over those places, computed on the phone (the 400 nearest at most).
The pack therefore holds only what's inside its box: no far places, no
pre-computed nearest-place maps.

`src/maps/datasets/` answers questions from these files. When they can't
answer (outside the covered area, or no file for a filter) it returns
null/undefined and the caller's query ends in "no map data for this area"
(there is no Overpass server in the deploy since round 19). "Closer to a border",
"closer to a lake shore" and the admin-border answer inside hiding zones use
grid distance maps (`src/maps/distanceRegion.ts`) instead of buffering.

## Data the app requests (all from the own server)

| What                      | Request                                                          | Cached                                     |
| ------------------------- | ---------------------------------------------------------------- | ------------------------------------------ |
| Play-area boundary        | reference files (`admin-<level>.json` by relation id)             | in memory per session                      |
| Places, stations, borders | reference files                                                  | in memory per play area                    |
| Admin levels at a point   | reference files                                                  | in memory                                  |
| Basemap                   | HTTP range requests into `/tiles/basemap.pmtiles`                | browser HTTP cache                         |
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
  `armThermometer`, `askThermometer`, `answerQuestion`, `vetoQuestion`,
  `castCurse`, `drawCards`, `playCard`, `move`, `startEndgame`, `clock`…),
  checked for shape and size by `server/src/opSchema.ts` (a bad one is a
  400) and for the rules by `gameOps.ts`: a seeker's new
  question is a _draft_ the hider can't see; a thermometer the seekers
  started is _armed_ (the hider sees it, nothing to answer yet); _asked_
  questions wait for the hider; _answered_ ones are locked for seekers
  unless the hider allows them to answer. Last change wins. `viewFor` strips what a role may not see
  (drafts from the hider, the hider's spot and the deck's order from the
  seekers), every team's password, and every player code but the
  viewer's own.
- **Live updates:** each phone reads a server-sent-events stream
  (`/api/games/<id>/events`, over fetch so the player's key can go in the
  header) and gets the whole game, as its role may see it, after every
  change, with its role and the server's clock (the role can change with
  the game: a new round hands it to another team). `events.ts` diffs the old and new game
  into what to tell this phone (toast; buzz, beep and background
  notification only for news worth it, one sound per burst); the server
  runs the same diff for push notifications. "Download this game" in Menu
  → Game saves the game this phone sees as a JSON file (`download.ts`).
  Lost connections are retried with a growing wait (5 s to a minute).
- **Where the seekers are** (the rulebook has them keep a tracker on so the
  hider can follow them): a seeker's phone with Follow me on sends its
  position (`POST /api/games/<id>/position`) after a 25 m move (at most
  every 10 s) and once a minute. The server keeps each seeker's newest in
  memory only, one per player (not in the game, not in SQLite: a restart
  forgets them, the phones resend within a minute; dropped after an hour
  without news) and passes them on in the same stream as a `positions`
  event, so a moving seeker doesn't resend the whole game. Every seeker on
  the hider's map, the others on a seeker's (`SeekerMarkers.tsx`, faded
  after 10 minutes). A hider's position, any hider's, is refused (403).
- **On the phone**, `session.ts` mirrors the game into the usual stores
  (questions, play area, zone settings, end game, the hider's spot). Local
  edits are compared with what the server last sent and the differences go
  out as operations; edits not sent yet survive incoming updates. View
  settings (folded, hidden, locked) stay per phone.
- **The map** applies answered questions as usual, then the seekers' drafts
  on top in their colours; questions waiting for the hider are outlined.
  A thermometer under way is outlined as the dashed circle of its
  distance around its start, and the seekers' phones draw the line from
  the start to where they are (`ThermometerTravel.tsx`).
- **The thermometer** (`lib/game/thermometer.ts`, shared; the server's
  `rules/thermometer.ts`) is played as the rulebook says: in a shared game
  a seeker picks a distance (the game's `thermometerKm`: 1, 5, 15, 75 km by
  size, or any other) and taps Start where they are (`armThermometer`: the
  question is `armed`, the start fixed, the hider told, nothing to answer
  and nothing drawn); once the phone has covered the distance as the crow
  flies, Ask sends its position as the end (`askThermometer`: refused
  under 98 % of the distance; the question is `asked`, the hider's five
  minutes start). Cancel while armed makes it a draft again, at no cost. A
  thermometer can't be sent like other questions. Playing alone it keeps
  its two pins to drag. Asked again at the same distance it costs double.
- **Players** (`players` in the game state; `src/lib/game/players.ts`,
  `server/src/rules/players.ts`): each phone makes a random key once
  (`playerKey.ts`, localStorage) and sends it on every request as
  `X-Player-Key`: never in the URL, which servers log. The server knows the
  player by a public id made from the key (a hash), so the game can list
  its players without letting anyone act as another. One key per browser:
  two tabs are one player. A player has a name, a team (with teams), the
  hider flag (without teams), when they joined and were last seen, and a
  six-character **player code** (`K7M-4PQ`, no 0/O or 1/I) that only they
  see. Typed on another phone (`POST /api/games/<id>/rejoin`), the code
  moves the player there, team and role included; the old phone's id is
  marked `left` and it leaves the game with a note. Last seen is stamped in
  memory and written with the next change, or every 5 minutes at most.
  Whoever started the game removes any player; anyone removes one not seen
  for an hour (`DELETE /api/games/<id>/players/<player>`).
- **The role** (`roleOfPlayer`, shared): with the **Teams** setting, the
  team hiding this round (`hiderTeamId`) is the hider, every member of it;
  without, the one player who said "I'm the hider". The server works it out
  on every request and sends it with every answer. A phone that became the
  hider with the old hider password, before players, still is by its token
  (`X-Hider-Token`) for one more release. The hider's station and pin live
  in the game so two hider phones share one spot, and are never sent to
  seekers; answers are worked out from the station until the end game,
  then from the pin. Photos are re-encoded before upload, which drops their
  location data; a game holds 100 at most.
- **Joining** (`POST /api/games/<id>/join`, `JoinDialog.tsx`): a game's link
  opens a dialog before anything else, once per phone (a reload, a
  restarted browser or a new round doesn't ask again): the name, then
  without teams "I'm a seeker" or "I'm the hider" (the first to say so; no
  password), with teams a team (every player is in one) and its password,
  and "We hide this round" while no team hides. Below, "Rejoin with the
  code". Wrong team passwords and codes: 5 a minute per game, then a
  minute's wait (`server/src/rateLimit.ts`, in memory). Menu → Game shows
  you, your code with Share, your team (switching asks the other team's
  password), and the players with when each was last heard of.
- **Push notifications** (`server/src/push.ts`): phones that opted in get
  what their role must hear about through the browser's push service, as
  encrypted messages signed with the server's own keys; the service worker
  (`public/push-sw.js`) shows them when the app isn't in front.
- **The digital deck** (`deck.ts`, pure, shared with the server): the server
  shuffles and deals what an answered question earns, the hider keeps or
  plays cards, and the time bonuses are worked out from the hand.
- **Teams** (`teams` in the game state, the `teams` setting): members by
  player id; each team's password stored hashed (scrypt) and never sent to
  the phones; at least 6 and at most 64 characters. A team left empty goes,
  unless it hides this round or the next. After a round one team claims the
  next (`nextHiderTeamId`) before anyone starts it; the new round makes
  its members the hiders and everyone else a seeker, with nothing to type.
  Without teams a new round clears the hider, and whoever hides next says
  so in Menu → Game. Games from before players keep their team list (each
  member a `legacy:<name>` placeholder) and play on without the setting.
- **The hider's station:** a tapped station is `pendingStation` (memory
  only) until Done makes it `chosenStation` and tells the server
  (`hiderReady`): the seekers hear that, the clock starts. Before that the
  hider's Research tab holds `research` questions: never synced, answered
  from the tapped station or the pin, deleted on Done. Once the clock goes
  the station is set for the round: the server refuses another one
  (`assertStationOpen`, 409) except during a Move, and the same station
  again is a no-op, so the seekers hear "the hider is in place" once. A
  phone that becomes the hider later (a teammate, a player code) gets the
  station from the game and never the pick view (`HiderPanel` picks only
  without a station, or during a Move).
- **The hider's pin** is shared by the hider's phones; the game notes which
  player's phone moved it last (`hider.pinDriver`). With "Move my pin with
  GPS" on two phones, the one turned on last drives it and the other turns
  its own off after 30 seconds (`followPin` in `lib/hiderSpot.ts`).
- **Which places count** (`lib/placeRules.ts`): only places inside the
  play area (the rulebook); of those, the named ones that fit their kind's
  built-in rules (a "zoo" must say zoo, Tierpark, Wildpark…; no indoor golf,
  toy libraries, visa centres, tiny parks) less the two places dropped after
  a look by hand; the same place listed several times (same name, within
  300 m; "West" and "Ost" parts within 1 km) is one place; and the places
  the players rejected while setting up (kept per play area on the phone,
  carried in the game's settings) are out of every question. Settings →
  Places shows the counts and opens the review on the map.
- **Rest periods** (`lib/game/rest.ts`, shared): a game setting (from,
  until, time zone). The server's `games.tick` runs every 20 s over the
  games touched in the last days: at the start of a rest it pauses the
  clock (`clock.pausedBy = "rest"`, once per rest, so an early resume by
  agreement holds) and at the end resumes it; the phones only show it.
  While the clock rests the server refuses questions. Changing the rest
  during a round is a `setRest` request the other side must repeat.
- **The curses** (`curseRules.ts`, shared with the server): which curses
  stop the seekers from asking until cleared, which take questions away
  (the Drained Brain's three, the Spotty Memory's die), which end by
  themselves, and what they award the hider. The server refuses what a
  curse forbids; the phones grey it out and say why.
- **Who may make games** (`server/src/codes.ts`): `POST /api/games` needs
  `X-Creator-Code`: the admin code (`ADMIN_CODE` in the server's
  environment, compared in constant time, never stored; 20 games a day) or
  a creator code the admin made (12 random letters, stored as a SHA-256
  hash; 5 games a day, Zürich days). No admin code set: nobody makes
  games. The phone keeps the typed code (`lib/game/codes.ts`) and shows
  Start only with one; the admin code adds Menu → Admin
  (`AdminPanel.tsx`: `/api/admin/codes` to make, list and revoke codes,
  `/api/admin/games` for every game, who made it, and Delete). Wrong admin
  or creator codes count towards 5 a minute, like the passwords.
- Games untouched for a year are deleted (`games.cleanup`, daily).

## Persistence and sharing

- Game state lives in localStorage, read once per tab (another tab's writes
  are not picked up, on purpose). Saved questions that this version can't
  read are backed up (`questions-unreadable-backup`) instead of stopping the
  app. Questions belong to the game they were asked in: joining a game
  replaces them with the game's, and leaving it (or the game being
  deleted) drops them.
- **The shell.** On phones a tab bar sits at the bottom (`TabBar.tsx`):
  Map (hides the sheet; what was open stays open), the sidebar's sections
  (Questions, Cards, Stations or Hider; Hider and Research while
  the hider picks a station; their counts from `lib/game/tabBadges.ts`)
  and Menu. The sections open a bottom sheet above the bar
  (`ui/bottom-sheet.tsx` via `ui/sidebar-l.tsx`): half the screen or all
  of it (`sheetSnap`), nothing dimmed behind it. "＋ Ask a question" floats
  over the map. On desktop the left sidebar with the sections as tabs at
  its top. The Menu is a tab too (`MenuScreen.tsx`): the tab bar's Menu, or
  the desktop's round button at the top right; Escape closes it.
- **Screens and Back** (`lib/screens.ts`): the open question
  (`openQuestion`) and over it the ask flow (`askFlow`: the types, then
  one kind's choices) are pushed screens with a ‹ Back; each adds a
  history entry, so the phone's own Back pops one screen.
- **The ask flow** (`components/ask/`): six tiles with what the hider
  draws (`2/1`), then the kind's choices: distances with Custom (radar,
  thermometer), the types as tiles (matching, measuring, tentacles in two
  groups by distance), the photo questions as rows that unfold their rule;
  ×2 on what was answered before this round. The question is made only on
  **Ask** (sent; a thermometer started) or **Add as a draft**; playing
  alone, **Add the question** (`lib/game/newQuestion.ts` builds it). A
  tentacle kind with no places in the play area is dimmed
  (`lib/game/placeCounts.ts`, counted once per play area). The **?** on
  the types runs a four-note tour of that screen (`ASK_TOUR` in
  `lib/tourSteps.ts`); a tour step may open the types itself
  (`TourStep.screen`).
- **Photo questions** (`components/game/PhotoRequests.tsx`): rows under
  the questions; a row pushes the photo question's screen (`pushedScreen`
  in `lib/screens.ts`): the rule, the time to send (10 or 20 minutes,
  `photoTimeLeft`), what it earns, and for the hider Take a photo (the
  camera; also From the gallery when the game's `galleryPhotos` allows),
  I cannot answer (`photoNullAnswer`) and Randomize. A photo past its
  time counts as a late answer (server `photoAnswered`). Randomize Question
  writes what changed into the history (`PowerupEntry.detail`).
- **The hider's answer screen** (`QuestionGameBar.tsx`): the timer as a
  plain pill, "Asked by … · from your station, …, 2.1 km away", the
  choices as big buttons (tentacle places as a list), Send pinned at the
  bottom; Veto and Randomize side by side, greyed with the reason when the
  card isn't in hand, each confirmed with the card's face
  (`PlayCardConfirm.tsx`).
- **Start the end game waits 5 s** (`lib/game/delayed.ts`,
  `startEndgameSoon` in `lib/game/endgame.ts`): confirm, then "Starting
  the end game… Undo"; nothing is sent before it runs out. The browser
  tests shorten it with localStorage `endgameDelayMs`.
- **Rules behind an "i"** (`components/RuleInfo.tsx`): every question
  screen (a kind's choices, an open card) has a round **i** at its top
  right that unfolds the rulebook's text for that question, how the app
  works it out, and the Full rules link. The draw badge (`3/1`) sits left
  of the title.
- **Phones:** every button is at least 44 px tall (`ui/button.tsx` and the
  sidebar's rows, `max-md:`); notifications (`components/Toasts.tsx`) have
  a full-height × on their right edge.
- There is no snapshot sharing (links, files, pasted games): the shared
  game on the server is the one way to play together.

## Known structural debt

- The question engine reads global state (the stores, the Overpass caches),
  so it can't run in a Web Worker yet; the per-question cache covers the
  common edits.
- Every change sends the whole game to every phone, earlier rounds included.
- The remaining big files: CardsPanel (the hand's flows), GameSetupDialog
  (the Game step), context.ts (the stores); the rest came apart in round 14.
