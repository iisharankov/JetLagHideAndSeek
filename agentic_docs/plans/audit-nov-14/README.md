# Audit, 2026-11-14 (round 49): tracker

The owner's ask: a full audit (what's left, loading speed, bugs, architecture), fix what's found, the map smoother when zoomed out, and data for Munich (in 2 weeks) and downtown Toronto (in 6 weeks), both small games, with commands to run.

Kept up to date as work goes, so a later session can pick it up. `[x]` done and checked, `[~]` started, `[ ]` not started.

## Work

- [x] Read the data pipeline and decide: one pack per far area (`areas/<id>/`, `<id>.pmtiles`, `areas.json`); the Swiss pack untouched at the root
- [x] Munich and Toronto: app routing, `update-data.sh AREA=munich|toronto|list` (dry-run with stand-in tools), check.sh, Canada's rules, rules from the play area's country, the country from the area when the pack can't say, Toronto airports, Ontario level names, a far place replaces the play area; e2e `dataAreas.spec.ts`; docs (areas.md, deployment.md, S9)
- [x] Map smoothness when zoomed out: hiding zones and stations on one canvas (was an SVG shape and an HTML marker per station), the basemap not redrawn per zoom step and bounded to its box. Tested: `e2e/hidingZones.spec.ts`. Not measurable here (no real tiles or stations on the laptop): judge on the phone
- [x] Loading: measured the first load (scripts the page fetches before anything is tapped); lodash replaced by `lib/unique.ts`. Left as a plan: JSTS (turf's buffer) lazy
- [x] Bugs and architecture: findings below, fixed or listed in known-issues.md
- [x] What's left: known-issues.md read through; still open there and in questions.md (Q59, Q60, Q48; S1–S9)
- [x] Checks (lint, types, 578 unit, Playwright 104 + 8 skipped), docs, round file

## Findings

(added as found: what, where, fixed or why not)

- **The main data rebuild deleted everything in /data/datasets** (`find -delete`): it would have wiped far areas. Fixed: it keeps `areas/` and `areas.json`.
- **A new game's rules were always Swiss** whatever the play area: in Munich the owner had to remember "Germany". Fixed: setup follows the play area's country (CH, DE, CA).
- **The basemap asked for tiles of the whole world** when zoomed out (`noWrap` with no bounds): now bounded to each file's box.
- **Basemap re-rendered on every zoom step** (vector tiles drawn in the browser): `updateWhenZooming: false`, `keepBuffer: 4`.
- **The heavy rough-terrain unit test timed out under load** (1.5 s alone, 5 s limit): 20 s for it.
- **Station dots drew in the zones' green**: a GeoJSON layer's `style` applies to its point layers too. Fixed with a style per geometry.
- **Searching a place in another area added it** ("Switzerland + Toronto"): now it replaces the play area (`sameArea`).
- **lodash whole in the first load (71 KB)** for three functions: replaced by `src/lib/unique.ts`. `lodash` is still in package.json, unused: `pnpm remove lodash` when convenient (left alone: a lockfile change).
- **Not done, a plan: JSTS (264 KB, ~70 KB gzipped) in the first load**, pulled by `turf.buffer` in `mergeAreas`, `lib/tourDemo.ts` and `maps/questions/measuring.ts`. Some callers are synchronous; making them async and importing a one-line `buffer` module with `await import()` would move it out of the first load.
- **ArcGIS projection engine (1.2 MB)**: already loaded only when a question needs it, and precached by the service worker after the first visit. Fine.
- **Setup forced the Swiss rules when the country was unknown** (my own first version this round): an unknown country now changes nothing.
- **A far pack may have no country outline** (a city's extract can't hold whole borders): the country comes from the state's ISO code, else the area's line in `update-data.sh` (`country` in areas.json).
- **The hider's own zone and the end game's circle** stay SVG (one or two shapes); the many zones and the stations are on the canvas, counted on the map element (`data-hiding-zones`, `data-hiding-stations`) for the tests.
- **First load: 609 → 583 KB gzipped** (lodash out).
