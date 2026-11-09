# Known issues

Bugs and debt not fixed yet. Updated 2026-11-09 (round 38). A fixed item leaves this file in the round that fixes it.

## From the game of 2026-11-08 (planned in history/plans/nov-game-fixes/)

- **Phone layout, left after runs E and F** (rounds 35–37): an open card's game bar comes before its fields, so a thermometer draft's Start sits above its chips on a half sheet; the radar's "Asked from" has no Change (the pin is dragged after); a card's header on a phone truncates a long title ("Question 1 · Measuri…") beside its three 44 px buttons; tapping the tab you're on doesn't scroll its list back to the top (the brief's E1); the six two-phone browser tests (roles, location, tutorial) still run on the desktop project only. [01-mobile-design.md](history/plans/nov-game-fixes/01-mobile-design.md).
- **`vaul` is in package.json but unused since round 37** (the Menu drawer went). Drop it with `pnpm remove vaul`, which rewrites the lockfile too (not run in round 37).
- **The rules pictures and the printed cards show miles** (`public/rules/img/*.webp`, `public/rules/cards/`), while the texts say km since round 38. Replacing the pictures is the owner's call.
- **The hider password from before players still works** for one release (round 32; kept in round 33 because Run A's deploy wasn't confirmed, S1): `POST /api/games/<id>/hider`, the `X-Hider-Token` header and `isHider` in `server/src/app.ts` `roleOf`, `hiderTokens` in `session.ts`. It keeps phones that were the hider at deploy time the hider; since round 33 it needs 6 characters and allows 5 wrong tries a minute. Remove once S1 is done and every phone has reloaded.

## From the audit of 2026-10-17 (round 20)

Numbering as in [history/audit-2026-10-17.md](history/audit-2026-10-17.md); status as of that date, check before acting. Items 2 and 3 wait on Q47, Q48 and Q50.

### Risks

1. **The Overpass client is dead code the app still carries and still
   calls.** `src/maps/api/overpass.ts` (511 lines), `overpassClient.ts`,
   `cache.ts`, the `osmtogeojson` dependency and the fallback branches in
   `matching.ts`, `measuring.ts`, `references.ts`, `hidingZoneStations.ts`,
   `trainLines.ts` and `places.ts` are all behind "the pack can't answer".
   Since round 19 nothing serves `/overpass/api/interpreter`: a miss POSTs
   to the `web` container, gets a 405, and the player reads "No map data
   for this area on the server … (jetlag.sharankov.com: HTTP 405)". The
   hiding zones, the station questions and the tentacles all go through
   `findPlacesInZone`, which still builds Overpass query strings before
   asking the pack. Removing it: every dataset miss throws
   `NotApplicableError("No map data for this area")` where the fallback
   is now; `findPlacesInZone` becomes `datasets.placesInZone` plus the
   subtracted areas; `determineMapBoundaries` reads `boundaryById` only;
   `fetchCoastline` keeps a plain `fetch`; `osmtogeojson`, `cache.ts`,
   `overpassClient.ts`, `OVERPASS_URLS`, `PUBLIC_OVERPASS_URL`,
   `CacheType` and `tests/overpassClient.test.ts` go; the two browser
   tests that mock `**/overpass/api/interpreter` (`hide.spec.ts`,
   `hidingZones.spec.ts`) mock `/data/` instead. About 1,000 lines less,
   the `thermometer` chunk smaller, and an honest message. Half a day.
   (Round 21 changed the message: it no longer ends in "HTTP 405"; the
   removal is still to do.)
2. **The site is public and the hider password is short.** Anyone with
   the address can make games, upload 100 photos of 6 MB each per game and
   try hider passwords at nginx's 5 requests a second (a four-character
   password is 1.3 million tries). The invite code and the per-address cap
   are Q47; a 10-character minimum, or a 2-second wait after a wrong
   password in `claimHider`, is a one-liner either way. (Round 32: new
   games have no hider password; team passwords are 6 to 64 characters,
   5 wrong tries a minute per game. Round 33: making a game needs a
   creator code or the admin code, 5 or 20 a day. Left: anyone with a
   game's link can upload its 100 photos.)
3. **No scheduled backups yet** (Q48). `backup.sh` works and `check.sh`
   warns when the newest copy is older than two days; the crontab line is
   in `deploy/README.md`. One thing to know: the script moves a file the
   container wrote (owned by uid 1000) out of `deploy/data/api/`, so it
   must run as the user that owns that folder.
4. **Rest periods, to check after one night's use** (round 18): the
   period is in the time zone of the phone that set it and the clock bar
   shows "22:00–07:00" without a zone; the late-answer penalty counts the
   rest (a question asked at 21:58 and answered at 07:02 is late); in a
   game played alone the switch shows in setup but nothing pauses;
   `newRound` keeps `restWindow`.
5. **Old packs lack the country codes** until the next data refresh; the
   search then works out the country from the level-2 zone's name, right
   for Switzerland, empty for the French and German bits of the box.
   `update-data.sh` fixes it.
6. **The first search loads about 4 MB** (every station, airport, city and
   place file but the bus stops) and keeps it for the session. A name
   index built with the pack (about 500 kB) would make it instant.
7. **Settings → Places counts all twelve kinds the moment Settings opens**
   (`PlacesSettings.tsx`), and again on every rejection: thousands of
   points against the country outline, about a second on a phone. Count
   when the group is expanded, or cache per play-area key.
8. **The archive travels with every change.** Each change sends the whole
   game to every phone, `rounds` and `moves` with full question entries
   included; `games.ts` also parses and re-serialises the whole document per
   change and `tick()` re-parses every game touched in three days every 20
   seconds. Fine for a few friends; the first thing to change if it ever
   isn't: `rounds` out of the live view, fetched on demand.
9. **Double validation.** Since round 19 `opSchema.ts` checks every
   change's shape, but `gameOps.ts` still re-checks what zod guarantees
   (`CLOCK_ACTIONS`, `Array.isArray(op.kinds)`, the pin's numbers,
   `awardMinutes`' range, `drawCards`' extra, `setCurseTime`'s rounding).
   Harmless, but two places to keep in step; the rules should trust the
   schema.
10. **No offline map:** tiles and data load on demand; a dead spot means a
    grey map. A feature of its own.
11. **Geometry on the main thread:** a Web Worker only if a real game
    stutters (the per-question cache covers the common edits).

### Structure

12. **Duplicates.** `LAKE_AREA_CHOICES` in `settings.ts` and again in
    `measuring.ts`; `SIZE_INDEX` in `curseRules.ts` and again in `deck.ts`
    and `CardsPanel.tsx`; the question-category labels in `events.ts`,
    `CardsPanel.tsx` and `curseRules.ts`; the "why can't the seekers ask"
    logic in `QuestionGameBar.tsx`, `ask/QuestionTypes.tsx` and the server's
    `assertMayAsk`; `stationOf` (hider.ts) re-trims what `opSchema`'s
    `stationPick` already bounds. One `askRefusal(state, kind, now)` in
    `lib/game` would serve the three panels and the server.
13. **Exports nothing imports.** 108 exports are used only inside their own
    file (types included); dropping the `export` keyword where nothing
    imports makes each module's real API visible. Seven are alive only
    because a test imports them (`sync.canChangeQuestion`,
    `hand.cardChoices`, `hand.removeOne`, `hidingZones.expandingSearch`,
    `answers.isCurrentAnswer`, `adminBorders.adminBorderRegion`,
    `overpassClient.memoryCache`): delete each with its test, or find the
    caller that should exist.
14. **The big files.** `gameOps.ts` (1,044 lines) is one switch of about
    45 cases; the helpers already live in `server/src/rules/` by feature,
    so the cases could follow them with `applyOp` dispatching.
    `GamePanel.tsx` holds six components; `RoundClock.tsx` two dialogs;
    `CardsPanel.tsx` mixes the hand, the draw flows, the choosers and the
    history; `context.ts` holds 58 stores and `session.ts` the connection,
    the sync and the hider sync. None of it blocks anything.
15. **Bundle.** ArcGIS (1.2 MB + wasm) is there for geodesic buffers; Turf's
    planar buffers would be off by metres at this scale and would halve the
    download. The `context` chunk pulls Turf and the schema into the first
    load; the `thermometer` chunk carries the references, the Voronoi code
    and (until item 1) the Overpass client.
16. **Development settings** are clean now (`.env.development` only picks
    the public OpenStreetMap tiles); `PUBLIC_GEOCODER_URL` is a Photon
    escape hatch for a PC without a pack. Keep it or drop it with item 1.

### Tests

17. **Direct unit tests cover 59 of about 200 modules.** The rest is mostly
    UI that the end-to-end tests exercise, but a few engine modules carry
    real logic and have no test of their own: `hidingZoneLayer.ts`
    (`applyQuestionToHidingZones` decides the hider's station list),
    `mapRefresh.ts` (`suggestAnswers`, the null-answer suggestion),
    `references.ts`, `questions/tentacles.ts`, `maps/index.ts`'s cache
    (partly, via `engine.test.ts`). The first two are the ones to add.
18. **The real pack is exercised by nothing automatic.** Every test mocks
    `/data/`; a data-shape change is caught only by hand (and by CI's
    Liechtenstein build, which checks that files exist, not what's in
    them). A unit test that reads `public/data` when it exists and is
    skipped otherwise would catch it at `npm test` time.
19. **End-to-end:** 20 tests, about two minutes; 10 skip on the phone
    project, among them every shared-game flow, so the sheet layout of the
    team picker, the next-hider popup, the found popup, the place review,
    the answer list and the rest dialog has never run in a phone-sized
    browser. The `closeMenu` helper was flaky (fixed this round, item 5
    above); four more tests still use `waitForTimeout` where a state to
    wait for would do. No end-to-end test for the rest flow or the null
    answer between two phones (the server tests cover both).
