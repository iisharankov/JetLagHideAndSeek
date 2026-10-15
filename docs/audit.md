# Code audit (consolidated, 15 October 2026)

One document in place of the four audits so far (round 2, and the three
of October: rounds 11, 17 and 18). What they found and what became of it
is condensed below; what is still open is listed once, in order of value.
The decisions that are yours are in [questions.md](questions.md) (Q43–Q46);
the to-do list is in [plan.md](plan.md) under "What's left".

## Size and shape

| What                   | Now (round 18)                                                                                        | Round 17  | Round 11  |
| ---------------------- | ----------------------------------------------------------------------------------------------------- | --------- | --------- |
| Source                 | 169 modules, about 33,000 lines (2,500 of them shadcn `ui/`)                                          | 31,200    | 24,600    |
| Tests                  | 54 files, about 9,000 lines: 355 unit tests, 20 end-to-end tests (30 runs, 10 phone skips)            | 348 / 19  | 267 / 17  |
| Biggest files          | `gameOps.ts` 1,044 · `CardsPanel.tsx` 870 · `GamePanel.tsx` 685 · `measuring.ts` 630 · `session.ts` 621 |           |           |
| Biggest chunks         | ArcGIS 1.2 MB · `context` 448 kB · `thermometer` (references, Voronoi) 408 kB · `Map` 232 kB           | same      | same      |
| Services on the server | web, api, overpass; updater on demand (Photon gone in round 18)                                       | + photon  | + photon  |

`TODO`/`FIXME`: none. `console.log`: three, in error paths. Loose typing
(`any`) is concentrated where GeoJSON meets Turf: `PolygonDraw.tsx` 20,
`overpass.ts` 14, `measuring.ts` 13, `references.ts` 10 (162 in round 11).

**Sound, and worth keeping:** one language and one set of types end to
end (`src/lib/game/types.ts` is read by the server and the phones); the
rules are pure functions with tests; a static site plus a tiny API; SQLite
as a single file; reference data precomputed on your server; no
third-party services; the end-to-end suite runs the real server. A rewrite
in another stack would not help: the pain points are inside the structure
and fixable in place, the libraries (Leaflet, Turf, Protomaps, d3-geo, the
ArcGIS engine) are JavaScript, and the shared types are an asset.

## What the earlier audits found, and what happened

- **Round 2 (8 October):** what blocked the four goals (privacy,
  self-hosting, Switzerland, shared play), the bugs that would ruin a game
  day, the questions that made no sense here, security. All addressed in
  rounds 3–11.
- **Round 11:** questions mutated in place → fixed (round 12). Geometry on
  the main thread → each question's result is remembered, the zones only
  recompute when the area changed (round 12); the worker stays "only if a
  real game stutters". The hider's role derived in five places → one
  store (round 12). The hider token in the stream URL, anyone deleting
  games or uploading photos, clock times mixing clocks, reconnects without
  backoff, Randomize and Chalice by hand → fixed (round 14). God modules
  and the full-state broadcast → still open (below).
- **Round 17:** duplicate merging in O(n²) and the teams deadlock → fixed
  the same day; seven small bugs (stale delete requests, the second
  hider's phone, dead "hiding zones only" variants, unnamed places, the
  deck log, lingering previews, the reference page) → fixed (round 17,
  item 34); the rejection fallback → moot since the nearest-place maps are
  gone (round 17, item 35). Phone-project tests for the shared-game flows
  and the archive in the live view → still open (below).

## Open findings

### Risks

1. ~~**Nothing checks the shape of what the phones send.**~~ Done in round 19 (`server/src/opSchema.ts`). The API applies
   `body.op` as a `GameOp` and `putQuestion` stores the question as it
   came, up to 2 MB; `playArea` and `zone` are opaque blobs the server
   broadcasts to every phone. A wrong shape mostly throws a 500 instead
   of a 400, and a bad actor with the link can fill a game with junk. The
   server already bundles `src/lib`, so parsing the question with
   `questionSchema` and the op with a small zod union is a one-file change
   (`server/src/app.ts`).
2. **The site is still public.** Anyone with the address can make games,
   upload 100 photos of 6 MB each per game and run Overpass queries. The
   nginx `noauth` config rate-limits, which stops accidents, not intent.
   Authelia (the config is ready) closes 1 and 2 at once. **Q44.**
3. **No backups** (half done: `deploy/backup.sh` exists, scheduling is Q48; players can also download a game). `deploy/data/api` (the SQLite file and the photos) is
   the only copy of every game. A nightly `sqlite3 jetlag.db ".backup …"`
   plus an rsync of `photos/` is a five-line cron job. **Q45.**
4. **Rest periods, to check after one night's use** (round 18):
    - The period is in the time zone of the phone that set it and the
      clock bar shows "22:00–07:00" without a zone; a player abroad sees
      the wrong local time. Show the zone when it differs from the
      phone's.
    - The late-answer penalty counts the rest: a question asked at 21:58
      and answered at 07:02 is late. Refuse questions in the last five
      minutes before a rest, or leave rest time out of the five minutes.
    - In a game played alone (no server) the switch shows in game setup
      but nothing pauses. Hide it in "solo" setup, or say so.
    - `newRound` keeps `restWindow`: after an early resume by agreement a
      round started later the same night isn't paused. Defensible,
      undocumented.
5. **Old packs lack the country codes** until the next data refresh: the
   search then works out the country from the level-2 zone's name, right
   for Switzerland, empty for the French and German bits of the box
   (standard rules, "level-8 region" labels there). The refresh fixes it.
6. **The first search loads about 4 MB** (every station, airport, city
   and place file but the bus stops) and keeps it for the session: a few
   seconds of "Loading…" on mobile data the first time. A small name index
   built with the pack (name, file, id, position; about 500 kB) would make
   it instant and let bus stops in.
7. **Settings → Places counts all twelve kinds the moment Settings opens**,
   and again on every rejection: for the default play area (all of
   Switzerland) that is thousands of points against the country outline,
   about a second on a phone. Count when the group is expanded, or cache
   per play-area key as the review does.
8. ~~**The coordinate picker lost street addresses**~~ Decided (Q46): no addresses.
9. ~~**Overpass is a pure fallback now.**~~ Removed in round 19 (Q43). Every question path reads the pack
   first: zones and borders, stations, train lines, places, brands,
   lakes, high-speed lines, boundaries by id. Overpass is reached only for
   a play area the pack doesn't cover, plus the "public Overpass" toggle.
   It is the heaviest service (10–20 GB, an hour of import on every
   refresh, the one reason the refresh needs a quiet day). **Q43.**
10. **The archive travels with every change.** Each change sends the whole
    game to every phone, `rounds` and `moves` with full question entries
    included: late in a long game that is hundreds of kB per tap. Leave
    `rounds` out of the live view (fetch on demand); later, deltas keyed
    by version.
11. **No offline map:** tiles and data load on demand; a dead spot means a
    grey map. Caching the play area's tiles is a feature of its own.
12. **Geometry on the main thread:** a Web Worker for the question
    pipeline and the zones, only if a real game still stutters.

### Structure

13. **Duplicates.** `LAKE_AREA_CHOICES` in `settings.ts` and again in
    `measuring.ts`; `SIZE_INDEX` in `curseRules.ts` and again in
    `CardsPanel.tsx`; the question-category labels in `events.ts`,
    `CardsPanel.tsx` and `curseRules.ts`; the "why can't the seekers ask"
    logic (rest, blocking curse, kind refusal) in `QuestionGameBar.tsx`,
    `PhotosPanel.tsx` and the server's `assertMayAsk`. One
    `askRefusal(state, kind, now)` in `lib/game` would serve all three.
14. **Exports nothing imports.** About 80 exports are used only inside
    their own file (`getOverpassData`, `determineGeoJSON`,
    `commercialAirports`, `majorCities`, `allPlacesOfType`, `EMPTY_CLOCK`,
    `MOVE_MINUTES`…) and `placeRules.hasRejections` is unused. Dropping
    the `export` keyword where nothing imports makes each module's real
    API visible. (`content.config.ts`'s `collections` is Astro's own
    convention; the two hooks in `src/hooks/` are used by the sidebar.)
15. **The big files.** `gameOps.ts` (1,044 lines) is one switch of about
    45 cases; `server/src/rules/` already holds the helpers, so the cases
    could move next to them by feature (clock and rest, questions, deck,
    hider, teams) with `applyOp` dispatching. `GamePanel.tsx` holds six
    components; `RoundClock.tsx` two dialogs; `CardsPanel.tsx` still mixes
    the hand, the draw flows, the choosers and the history; `context.ts`
    holds 58 stores and `session.ts` the connection, sync and hider sync.
    None of it blocks anything; it is what makes the next feature slower.
16. **Development settings.** `.env.development` points `pnpm dev` at
    public Overpass and photon.komoot.io; production never uses them (the
    CSP forbids it, `e2e/csp.spec.ts` proves it) and with `public/data`
    present the search never calls out. Worth a line in the agent brief
    so nobody "fixes" the empty `GEOCODER_URL` default back to a public
    service. Also: `npm run check` calls `pnpm`, the lockfile is pnpm's,
    the docs use `npm run`; pick one.
17. **Bundle.** ArcGIS (1.2 MB + wasm) is there for geodesic buffers;
    Turf's planar buffers would be off by metres at this scale, probably
    fine for a game, and would halve the download. The `context` chunk
    pulls Turf and the schema into the first load; the `thermometer` chunk
    carries the references and Voronoi code and could load on demand.

### Tests

18. **Direct unit tests cover 59 of 169 modules.** The rest is mostly UI
    that the end-to-end tests exercise, but a few engine modules carry
    real logic and have no test of their own: `hidingZoneLayer.ts`
    (`applyQuestionToHidingZones` decides the hider's station list),
    `mapRefresh.ts` (`suggestAnswers`, the null-answer suggestion),
    `references.ts`, `questions/tentacles.ts`, `maps/index.ts`. The first
    two are the ones to add.
19. **The real pack is exercised by nothing automatic.** Every test mocks
    `/data/`; a data-shape change (round 17's `area_m2`, say) is caught
    only by hand. A unit test that reads `public/data` when it exists and
    is skipped otherwise would catch that at `npm test` time.
20. **End-to-end:** 20 tests, about two minutes; 10 skip on the phone
    project, among them every shared-game flow, so the sheet layout of the
    team picker, the next-hider popup, the found popup, the place review,
    the answer list and the rest dialog has never run in a phone-sized
    browser. Five tests use `waitForTimeout`. No end-to-end test for the
    rest flow or the null answer between two phones (the server tests
    cover both).

## Suggested order

1. **The shakedown game**, with the rest-period notes (4) checked the
   morning after. Every real game so far found two or three things.
2. ~~Overpass optional~~ (done, round 19); next: several areas on one
   server (Q43).
3. ~~Authelia~~ (the site stays public, Q44); the public site's gates
   (Q47) instead; the input checks are done.
4. **The cleanups** (13, 14, 7, 6): an afternoon, no behaviour change
   except faster Settings and search.
5. **Tests** for the zone layer and the suggestion path (18), the pack
   smoke test (19), the shared-game flows on the phone project (20).
6. **Backups**: schedule `deploy/backup.sh` (Q48).
7. **Live view without the archive** (10); then the bundle (17), the
   worker (12), the offline map (11).
