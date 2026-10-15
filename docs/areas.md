# Adding an area (Bern, Munich, …)

What it takes for a new play area to work the way Zürich does, after round
17. One server serves one data pack, built for one box (`BBOX`); everything
inside the box works: play areas by name, stations, places, borders, lakes,
ground heights and basemap tiles. The rulebook rule that places outside the
play area don't exist (null answer) means the pack needs nothing from
beyond the box: no "far places", no pre-computed nearest-place maps.

| Area                                             | What to do                                                                                    |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Bern, Basel, Geneva, Lausanne, Lugano, Konstanz… | Nothing to download: pick it in the play-area picker, then Settings → Places before the game. |
| Munich                                           | Widen the box and the extract list, refresh the data, sort out place search (below).          |
| Vienna, Berlin, Milan…                           | The same, but the box gets big; see "What doesn't scale yet".                                 |

## Inside the box: Bern and the rest of Switzerland

The box is Switzerland plus about 30 km (`5.5,45.6,11.0,48.1`). Pick the
place in the play-area picker (the search knows every municipality, district
and canton in the pack); the pack covers it; Swiss rules apply by themselves
(canton and municipality labels, 100,000+ cities, the lake shore question).

Before the first game there, open **Settings → Places**: it counts what each
place question will find inside the play area, after the built-in rules.
**Review on the map…** shows the places of a kind as pins; tap one to reject
it. The built-in rules were written from the Zürich data (pet corners and
aviaries tagged as zoos, indoor golf lounges, toy libraries, visa centres,
emergency rooms listed next to their hospital, places split in "West" and
"Ost" parts); another area may have other oddities. Rejections are kept per
play area on that phone and go into the next game started from it.

## Outside the box: Munich

Munich (11.58 E, 48.14 N) is east of the box. Steps, all on the server:

1. **The box.** `BBOX=5.5,45.6,12.3,48.6` in `deploy/.env` (the compose file
   reads it). Everything downstream follows it: the OpenStreetMap extract
   that Overpass imports, the pack, the basemap tiles and the elevation
   tiles. Munich's S-Bahn reaches about 11.0–12.1 E, 47.8–48.5 N.
2. **The extracts.** `REGIONS` in `deploy/update-data.sh` must cover the box:
   add `europe/germany/bayern/oberbayern` (Munich; about 400 MB). The
   north-east corner of that box is Niederbayern; add
   `europe/germany/bayern/niederbayern` too or accept a thin empty corner.
   Then `deploy/refresh-data.sh`. Count on a bigger Overpass database (a
   few GB more, an hour more to import) and a bigger tile file.
3. **Place search** follows the pack: the picker searches the pack's own
   zones (every state, district and municipality in the box, with their
   relation ids), so Munich's districts are found as soon as the pack
   covers them. Nothing to configure.
4. **Airports.** `src/maps/datasets/airports.ts` already lists MUC and the
   other Bavarian airports; the pack takes the ones inside the box.
5. **Rules.** A German play area gets the German rules under "Automatic":
   the Swiss question list (no coastline or 7-Eleven, the lake shore on)
   with 1,000,000+ cities (Munich counts).
6. **Labels.** Zone questions already say state, district, municipality and
   borough for Germany (`src/maps/adminBorders.ts`), and the Austrian,
   French and Italian names too.
7. **Before the first game:** Settings → Places, and the review for the
   kinds the game uses. Expect new oddities (Munich has many honorary
   consulates and a big "park" called Englischer Garten in several parts).

On a PC, `REGION=europe/germany/bayern/oberbayern scripts/build-dev-data.sh`
builds a pack for that region alone into `public/data/` (one pack at a time;
it replaces the Swiss one).

## What doesn't scale yet

- **One box per server.** A far-away city (Berlin, Vienna) makes the box,
  the Overpass database and the tile file huge. The fix is one pack per
  area, chosen by the play area's box (`manifest.json` per pack, a small
  change in `src/maps/datasets/load.ts` and the build script). Not needed
  for Munich or Bern.
- **The kind rules** are name-based and German/English; a French- or
  Italian-speaking area may need a few more words in
  `src/lib/placeRules.ts` (`KIND_RULES`), found by reviewing on the map.
