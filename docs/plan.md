# Plan

Goal: **self-hosted, private, reliable on game day, with team sync.**
Switzerland first, nothing that stops other regions working.

Updated after your round-3 answers (2026-10-09). Status: ✅ done and
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

## Phase 3: one shared game board, photos, curses ⏭️ (next round)

From your round-3 answers (Q10–Q17):

1. **One live link** for seekers and hider: questions added, moved or changed
   by anyone show up on everyone's phone. Stored in the API's SQLite, pushed
   live over a WebSocket.
2. **Hider role** behind a password the hider sets. The hider's position never
   leaves their phone; hider mode **suggests** each answer and the hider taps
   to send it (nothing is sent automatically).
3. **Game settings page**, including who may change answers (for now: only
   the hider).
4. **Seeker brainstorm mode:** seekers add questions only they see, with a
   "send to hider" button. Shading in different colours: confirmed answers
   versus speculative ones.
5. **Edits:** last change wins (Q13). No live location sharing (Q14).
6. **Old games:** kept 30 days, or a year if small (Q15).
7. **Photos:** shrunk to at most 5 MB, attached per game; a tab listing the
   photo questions (Q16).
8. **Curses:** a tracker per game using the transcribed curse cards
   (`src/lib/rules/cards.ts`).

## Phase 4: game-day UX ⏭️

- Phone-first layout: question list as the main view, bigger buttons, a
  "remaining area" figure (km² and % left).
- Heavy geometry in a background worker, so the map never freezes.
- Split ZoneSidebar and OptionDrawers; stop mutating questions in place.

## Later / dropped 💤

- Per-area offline data packs on the phone (only if signal turns out to be a
  real problem in play).
- Android APK (dropped: install the web app instead).
