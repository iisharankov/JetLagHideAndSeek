# Plan

Goal: **self-hosted, private, reliable on game day, with team sync.**
Switzerland first, nothing that stops other regions working.

Updated after your first real game (round 5, 2026-10-09). Status: ✅ done and
tested · 🟡 written, not yet run for real · ⏭️ next · 💤 later or dropped.

## What changed in the plan

- **Team sync moves up, phone-offline moves down** (your Q14 answer).
  "Offline" now means: third-party data lives on your server, so it's fast and
  always there. The phone still caches the app itself, but per-area offline
  data packs are parked.
- **No APK.** An installed web app does the same job without the Play Store
  or sideloading (Q11/Q12).
- **nginx + Authelia instead of Caddy**, since that's what your server runs
  (Q7/Q9).
- **Development is test-driven** (Q5): nearly every fix below came with a
  test written first and seen failing; the exceptions are marked.

## Phase 0: make it yours ✅

| Step | Status |
| --- | --- |
| Remove Google Analytics, Clarity, Partytown, Google Fonts, upstream icons and links, "Star on GitHub" | ✅ `e2e/privacy.spec.ts`: a visit contacts only the app's own server |
| Configurable site address and base path (defaults to `jetlag.sharankov.com`, `/`) | ✅ |
| Tests runnable (ArcGIS under Node), 10 type errors fixed | ✅ |
| CI on every push: lint, typecheck, unit tests, build, browser tests | ✅ `.github/workflows/ci.yml` |
| Error boundaries around every panel | ✅ |

## Phase 1: game-day bugs ✅

| Fix | Audit IDs | Test |
| --- | --- | --- |
| No more stuck "loading": job counter instead of a shared flag; refreshes never overlap; 1-second layer janitor removed | B4, B20 | `tests/jobs.test.ts` |
| Overpass client: tries every server, POST, timeouts, never caches "runtime error" answers, shares duplicate requests | A5, B9, B10 | `tests/overpassClient.test.ts` |
| "Nearest X" searches stop at 400 km and say so, instead of looping forever; hiding-zone search re-searches correctly | B5, B6 | `tests/hidingZones.test.ts` |
| Caches keyed by play area (including added/removed regions), failures not kept | B9 | `tests/memoizeAsync.test.ts` (written with the code, not seen failing first) |
| Zone questions: levels picked by name ("Canton: Zürich"), default level 4, "not applicable" where a level doesn't exist | B1 | `tests/adminBorders.test.ts`, `tests/engine.test.ts` |
| Admin-border measuring: works for multi-part zones and measures to *every* border of the level | B2, B3 | `tests/adminBorders.test.ts` |
| Hiding radius in km/m used correctly everywhere; default unit metric | B7 | `tests/hidingZones.test.ts` |
| Station-name questions: the seeker's real station; name on the sign; accents ignored; tooltip in the tutorial | B8, B18 | `tests/stationNames.test.ts` |
| Every card shows why a question wasn't applied (red: error, amber: doesn't apply here) | B11 | `tests/engine.test.ts` |
| Tutorial: 15 steps, works on phones, doesn't capture typing | B13, B21 | `e2e/tutorial.spec.ts` |
| Shared links ask before replacing your game; files and links validated before anything changes; presets merged | B14, B15 | `tests/sharedGame.test.ts`, `e2e/sharedLink.spec.ts` |
| Delete has Undo; "Delete all" moved to its own confirmed button | B16 | `tests/questions.test.ts` |
| Saved data this version can't read is backed up instead of breaking the app | B17 | `tests/storage.test.ts` |
| Station names escaped in map popups | S3 | `tests/html.test.ts` |
| Swiss rules: 100,000+ "major cities", coastline and 7-Eleven hidden; Options setting to override | Q18 | `tests/regionRules.test.ts` |
| **Found during the work:** a saved tentacles answer was wiped every time the card loaded | new | `e2e/tentacles.spec.ts` (fails on the old code) |
| **Found during the work:** changing the default unit relabelled the hiding radius without converting it (0.5 mi became 0.5 km) | new | fixed by removing that sync; no automated test |
| Search text URL-encoded; search errors reported | round 1 #4 | `tests/geocode.test.ts` |

## Phase 2: self-hosting 🟡

All written and checked as far as possible without Docker access. **Your
next step:** follow [deploy/README.md](../deploy/README.md) on the server, and
send me any errors.

| Piece | Status |
| --- | --- |
| Docker Compose stack: web, api, overpass, photon, updater; ports on 127.0.0.1 only | 🟡 `docker compose config` validates |
| Map data: Geofabrik extracts for CH plus neighbours (all 10 URLs checked), cut to CH + 30 km | 🟡 |
| Basemap: Protomaps extract (1.5 GB at street level) | ✅ rendering tested locally with a Zürich sample |
| ArcGIS engine served from the app itself | ✅ |
| Share links API | ✅ `server/src/app.test.ts`, plus run locally with curl |
| Place search: self-hosted Photon with the Swiss dump | 🟡 |
| Host nginx site with Authelia, TLS and a strict privacy policy | 🟡 policy tested by `e2e/csp.spec.ts` |
| Monthly refresh script (cron) | 🟡 |

**About ArcGIS's size (your Q4 question):** the 1.2 MB file (300 KB
compressed, plus its 2.8 MB engine) downloads once per app version and is then
cached on the phone. It isn't re-downloaded per question or per visit, so
it's fine to keep.

## Phase 2b: reference data instead of live queries ✅ (after your first local test)

Your idea: build the data once on the server instead of asking Overpass during
the game.

| Change | Status |
| --- | --- |
| `server/datasets/`: turns the OSM extract into small files: every zoo, museum, airport, city, McDonald's, station (rail, tram, bus, ferry, cable car), admin border (levels 2–10) and high-speed line. Switzerland takes 30 s and is 21 MB, compressed when served | ✅ `server/datasets/elements.test.ts`, plus a CI run on a real (Liechtenstein) extract |
| The app answers from those files first, and only falls back to Overpass outside the data or for "same train line" | ✅ `tests/datasets.test.ts`; every question type checked in a browser with Overpass switched off: 0 queries, about 2 s each |
| Admin-border distance computed on a grid: municipality borders across Switzerland in about 1 s instead of 3 minutes | ✅ `tests/distanceRegion.test.ts` |
| "Every place of a type" questions allowed up to 5,000 places (was 1,000) | ✅ checked: 4,298 parks in 1.9 s |
| Dev mode: three public Overpass servers as fallbacks; `pnpm data:dev` builds the Swiss data locally | ✅ |
| CARTO maps removed (they now need a paid key) | ✅ |

## Phase 2c: round 3 ✅

Your round-3 answers, except the shared game board (next round).

| Change | Your answer | Test |
| --- | --- | --- |
| Hide button works on matching, measuring and tentacles cards (it flipped twice) | bug | `e2e/hide.spec.ts` (all five card types) |
| Long question-type names wrap instead of being cut off | bug | none (styling) |
| "Same train line" from the reference data: OSM train routes matched to stations (1,734 Swiss stations and halts have lines; Zürich HB 97). Overpass stays as the fallback | Q1 | `server/datasets/routes.test.ts`, `tests/datasets.test.ts` |
| "Which place is nearest" maps pre-computed on the server for every place type, airports and big cities: matching questions no longer compute them on the phone, and the 5,000-place limit is gone for them (17,700 peaks, including those just across the border, answer in under 3 s) | Q2 | `server/datasets/nearest.test.ts` (checked against true great-circle distances) |
| Places up to ~300 km away count for nearest-place questions: e.g. Lugano's nearest airport is Malpensa, Basel's the EuroAirport, St. Moritz's Bergamo. The neighbour downloads (6.5 GB) are cut down to a 22 MB file of places; places that can never be anyone's nearest in Switzerland are dropped (Munich's airport, say) | Q3 | `tests/placeQuestions.test.ts` (an airport outside the play area) |
| Commercial airports: an editable list of airports with international flights (`src/maps/datasets/airports.ts`) | Q4 | `server/datasets/elements.test.ts` |
| Admin-border answers only shade inside the hiding zones while those are on (hider mode still uses the full map) | Q6 (c) | `tests/distanceRegion.test.ts` |
| Reference places on the map: a star on the seeker's nearest airport/zoo/station…, dots on the other candidates, the seeker's zone outlined for zone questions. Option to turn it off | Q7 | checked in a browser for every type; no automated test |
| ⓘ on every question card with the rulebook text for it; the full rulebook in the app at `/rules/` (36 pages, with diagrams) and a question & card reference at `/reference/` (every question, photo questions, all 24 curses, powerups and time bonuses transcribed from the cards) | Q8, Q9 | `tests/questionInfo.test.ts`, `tests/rulesSections.test.ts`, `tests/rulesText.test.tsx`, `e2e/reference.spec.ts` |
| Halts count as train stations by default | Q18 | `tests/hidingZones.test.ts` |
| Separate switches for tram stops and boat stops, "show remaining stations" (markers on top of the zones) and a "N stations left" count | Q19 | `tests/hidingZones.test.ts` (switch logic) |
| 100,000+ people for "major city" across the border too; Winterthur now counts (its population was written "122’937") | Q21 | `server/datasets/elements.test.ts` |
| Lake shore measuring question: lakes of 10 km² or more (17 in Switzerland), with a per-question choice of 10, 20, 25 or 50 km² | Q22 | `tests/placeQuestions.test.ts` |
| Removed Thunderforest maps, Google Plus codes, the print button and the permanent overlay | Q25 | typecheck |
| Deleted `src/styles/licenses/` | Q26 | – |

All question types were checked in a browser with Overpass switched off: 0
live queries, about 3 s each including page load (the museum measuring
question takes 8 s).

**Round 3b (after your test):** the hiding-zone sidebar no longer crashes with
"Must have at least 2 geometries" (merging no zones now gives an empty area;
regression tests `tests/operators.test.ts`, `e2e/hidingZones.spec.ts`), and its
error panel offers "Reset its settings". The bottom buttons became one Menu
(Game / Hider / Settings, `e2e/menu.spec.ts`), settings are on/off cards, the
zone display style is a segmented control, and the hider has its own black
"HIDER" pin.

## Phase 3: one shared game board, photos, curses ✅ (round 4)

| Change | Your answer | Test |
| --- | --- | --- |
| **Shared game:** Menu → Game → "Start a shared game". The link (`?game=<id>`) is the game; everyone opens it and sees changes live (server-sent events, reconnects by itself). The phone rejoins its game when reopened | Q10 | `server/src/app.test.ts` (incl. the live stream), `e2e/sharedGame.spec.ts` (two phones) |
| **Question states:** a seeker's new question is a *draft* only seekers see (its answer is a guess, shaded amber on the map); "Send to the hider" makes it *asked*; the hider's answer makes it *answered* (shaded as usual) | Q12 | `server/src/gameOps.test.ts`, `tests/gameSync.test.ts`, e2e (amber shading appears and goes) |
| **Hider role** behind a password the first hider sets; the hider never sees drafts | Q10 | `server/src/games.test.ts`, e2e |
| **Nothing sent automatically:** with hider mode on, the hider's card shows the suggested answer; one tap sends it (or another answer). Answers worked out for an older version of a question are refused | Q11 | `server/src/gameOps.test.ts`, e2e ("suggests: Yes", sent "No") |
| **Game settings:** game size, and "seekers can answer" (only the hider can switch it; off by default, which locks answered questions for seekers) | Q12 | `server/src/gameOps.test.ts` |
| Last change wins, with "changed by Ana · 2 min ago" on each card | Q13 | `server/src/gameOps.test.ts` |
| **New round:** puts the questions, photo questions and curses away (kept with the game) and frees the hider role | – | `server/src/games.test.ts` |
| Games kept a year after their last change, photos included | Q15 | `server/src/games.test.ts` |
| **Photos tab:** the rulebook's photo questions for the game size; seekers ask, the hider sends a photo (camera on phones), everyone sees it; other photos for the game. Photos are re-encoded to at most 5 MB, which also removes their location data | Q16 | e2e (ask, send, see), `server/src/app.test.ts` (size limit) |
| **Curses tab:** the hider casts a curse (text shown for the game size, countdown for timed ones); everyone sees it; seekers mark it cleared | Q17 | `server/src/gameOps.test.ts`, `tests/rulesText.test.tsx`, e2e |
| **Altitude question** ("are you higher or lower than me?"): free AWS Terrain Tiles elevation data, built on the server (~100 MB, ~50 m detail); the seeker's altitude comes from the map or their phone's reading | Q29 | `server/datasets/elevation.test.ts` (PNG decoding checked against PIL), `tests/elevation.test.ts` (incl. a real tile that once broke it), `tests/placeQuestions.test.ts`; checked in a browser (Zürich HB 413 m, Uetliberg 857 m) |
| Lugano and Sion count as airports | Q28 | `server/datasets/elements.test.ts` |
| Reference places only for the active question (the card last opened, tapped or added); Settings: active / all / off | Q31 | `tests/activeQuestion.test.ts` |
| **Fixed:** the hider password was sometimes sent empty (the app's text fields report changes after half a second) | found by the e2e test | `e2e/sharedGame.spec.ts` |

**Found on the first server run (2026-10-09 evening):** the `web` container
labelled every file as a download (a `types` block in its nginx config
replaced nginx's whole MIME list), and the API couldn't write to its data
folder (owned by root) so it restarted for ever. Both fixed; the nginx
configs are now checked by a real nginx in CI (`deploy/test-nginx.sh`:
content types, caching, compression, basemap range requests, host site
syntax). Also fixed before they bit: gzip would have broken the basemap's
range requests, and a data refresh swapped a folder the `web` container has
mounted.

**Metric cards:** not found online; see Q32. The app still shows the imperial
card texts.

**For the server:** this update needs the new nginx `/api/` settings (live
updates and photos), a data refresh for the elevation tiles and airports, and
the usual app update. See [deploy/FIRST-DEPLOY.md](../deploy/FIRST-DEPLOY.md#updating-to-round-4).

## Phase 3b: after your first real game (round 5) ✅

| Change | Your point | Test |
| --- | --- | --- |
| **Game settings screens** (Menu → Game → Change game settings, or Start a shared game): size, local rules, hiding-zone radius and station kinds, which question types are in (coastline, lake size, 7-Eleven…). Decided before the game, **fixed once it runs**; the hider can still widen the hiding zones and let seekers answer. Radar questions default to 2 / 10 / 50 km | 1, 3, 7 | `tests/gameSettings.test.ts`, `server/src/gameOps.test.ts` (locked settings), `e2e/sharedGame.spec.ts` (small game → 0.5 km zones on the other phone) |
| **Hider sees the question before answering:** pins of locked questions stay on the map, and a question waiting for the hider is drawn as a dashed outline (circle, split line…) | 1 | e2e (pin and outline on the hider's phone) |
| Answer buttons keep their order (Yes, No; Closer, Further…); the suggested one is filled in | 1 | `tests/gameAnswers.test.ts`, e2e |
| Seekers can't delete an answered question (button disabled, no "deleted" banner); no "Clear all" in a shared game | 2 | `tests/gameSync.test.ts` (`canChangeQuestion`), e2e |
| **Hider tab:** the password step lives there; hider controls are faded until the phone is the hider; seekers can't switch hider mode on in a shared game (and the hider pin isn't drawn for them) | 4 | e2e (faded, then enabled after the password) |
| **Note pins:** seekers' private pins (long press on the map → "Add a note pin"), with a label, a list in the Questions tab, violet pin; never shared | 5 | none (checked by hand) |
| **Hiding-zone sidebar:** only Show on/off, Zones \| Stations, a collapsible "N stations left" list with search and Remove, and a collapsible "Removed" list with Restore. Custom station lists, "merge duplicates", "merged"/"nothing" styles and "show remaining stations" are gone | 6, 8, 9, 11 | `e2e/hidingZones.spec.ts` (old saved style doesn't break it) |
| Stations are de-duplicated automatically: a station that is also a tram/bus/boat stop counts once (the railway station is kept, so train lines work) | 6 | `tests/stationManipulations.test.ts` |
| **Zones are cut to the area still in play**, so a zone on the edge of an answer shows only its possible part | 10 | `tests/hidingZones.test.ts` (`clipZonesToRemaining`) |

**Found right after (2026-10-09, late):** a game created before the settings
update crashed the options bar ("can't access property halts"): its settings
on the server lacked the new fields. Now the server fills in defaults when it
loads a game (`server/src/games.test.ts`), the phone does the same when it
receives one, the plain address no longer rejoins the last game (Menu → Game
offers "Rejoin it" / "Forget it"), and the options bar's error box can reset
the game and settings.

**Pfungen (your point 10):** that was correct, not a bug. The hider was
"further from the airport" than the seeker, so everything nearer than the
seeker's distance (the shaded disc around Zürich airport) was ruled out.
Pfungen's station is just outside that disc, so its zone was still possible,
even though most of its circle lay inside the shaded area. The circle was
drawn whole, which looked wrong; zones are now clipped to the possible part.

## Phase 4: game-day UX ⏭️

- Phone-first layout: question list as the main view, bigger buttons, a
  "remaining area" figure (km² and % left).
- Heavy geometry in a background worker, so the map never freezes.
- Split ZoneSidebar and OptionDrawers; stop mutating questions in place.

## Later / dropped 💤

- Per-area offline data packs on the phone (only if signal turns out to be a
  real problem in play).
- Android APK (dropped: install the web app instead).
