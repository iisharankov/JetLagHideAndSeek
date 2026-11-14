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
| Munich, Toronto                                  | One command each on the server (below, round 49).                                             |
| Vienna, Berlin, Milan…                           | A line in `deploy/update-data.sh`'s area list, then the same command.                         |

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

## Far areas: Munich, Toronto (round 49)

Since round 49 one server holds several packs: the main one (Switzerland
and around, as above) and a small one per far city, each with its own
basemap file. The app asks each question of the pack that covers it, draws
each basemap only inside its box, and searching a place in another area
starts a new play area there (nobody plays Zürich + Toronto). Nothing to
choose in the app: search "Munich" or "Toronto" in the play-area picker.

| Area | Box | Extract (download) | Country |
| --- | --- | --- | --- |
| Munich | `11.25,48.00,11.85,48.30` (the city and its edge; MUC airport is outside) | `europe/germany/bayern/oberbayern` (about 250 MB) | DE |
| Toronto | `-79.70,43.55,-79.05,43.90` (the City of Toronto and a little beyond; Pearson and the island airport inside) | `north-america/canada/ontario` (about 970 MB) | CA |

On the server (the area list is in `deploy/update-data.sh`; add another
city there the same way):

```bash
AREA=munich ~/jetlag/deploy/update-data.sh
AREA=toronto ~/jetlag/deploy/update-data.sh
~/jetlag/deploy/check.sh        # "ok area munich: data", "… basemap", same for toronto
```

Each writes `data/datasets/areas/<area>/`, `data/tiles/<area>.pmtiles` and the
list `data/datasets/areas.json`. The monthly refresh (`update-data.sh` alone)
rebuilds only the main area and leaves these alone. To drop an area: delete
its folder and its `.pmtiles`, then `AREA=list deploy/update-data.sh`. The
downloads stay in `data/osm/areas/<area>/downloads/` for a quicker refresh;
delete them to save the space.

What the app does in each:

- **Rules:** game setup picks them from the play area's country: Germany for
  Munich (Swiss rules, cities of a million), Canada for Toronto (the lake
  shore question for Lake Ontario, no sea coast: the Great Lakes aren't
  coastline in the map data; 7-Elevens in). A city's extract can't hold
  whole country outlines, so the country comes from the area's line in
  `update-data.sh` when the data can't say.
- **Zone names:** Germany's state, district, municipality, borough;
  Ontario's province, region, city or county, municipality, neighbourhood.
  Check them in the play-area picker before the game: OpenStreetMap's
  levels in Toronto may differ from these guesses.
- **Airports:** Toronto Pearson, Billy Bishop and Hamilton are on the list
  (`src/maps/datasets/airports.ts`); only those inside the play area count.
- **Before the first game:** Settings → Places and the review for the kinds
  the game uses (Munich has many honorary consulates and an Englischer
  Garten in several parts; Toronto is new ground).

On a PC, `REGION=europe/germany/bayern/oberbayern scripts/build-dev-data.sh`
builds a pack for that region alone into `public/data/` (one pack at a time;
it replaces the Swiss one).

## What doesn't scale yet

- **The kind rules** are name-based and German/English; a French- or
  Italian-speaking area may need a few more words in
  `src/lib/placeRules.ts` (`KIND_RULES`), found by reviewing on the map.
- **A question running past an area's box** (a big radar near the edge of
  the Toronto box) has no data beyond it and says "No map data for this
  area". Keep play areas inside the box; widen the box in `update-data.sh`
  if needed.
