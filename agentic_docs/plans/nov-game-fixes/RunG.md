# Run G — Metric everywhere

For the agent that executes this. Read `CLAUDE.md`, `agentic_docs/agents/notes.md`, then this file and [03-metric-conversion.md](03-metric-conversion.md). Binding: the table in 03 as written, with the large thermometer at **75 km** (Q51, read as accepted in Q57 which the owner answered "Yes"). No imperial option anywhere.

## The code today

| Where | Imperial left |
|---|---|
| `src/content/rules/**/*.md` | every row in 03's tables: radar, thermometer, tentacle headings ("Museums Within 1 Mile"…), hiding zones (¼ / ½ mile), "within 5 feet", "within 10 feet of a path", "100 feet" (Gambler's Feet), map sizes in sq. miles, prose "miles" |
| `src/maps/schema.ts` l.24 `unitsSchema` includes `"miles"`; `getDefaultUnit()` falls back to `"miles"` | saved questions may carry `unit: "miles"` |
| `src/components/UnitSelect.tsx` (Miles/Kilometers/Meters) | used only by `SettingsPanel.tsx` l.93 for the `defaultUnit` setting |
| `src/components/UnitToggle.tsx` (km/m) | already metric; keep |
| `src/components/AddQuestionDialog.tsx` l.86 `units: "miles"` (thermometer default end) | Run D rewrites this; if G runs first, change to km |
| `src/components/Map.tsx` l.148–156 `units: "miles"` | the map's long-press menu adds a thermometer with a 5-mile end point; make it km (Run D replaces the thermometer default anyway) |
| `src/lib/game/curseRules.ts` l.170 `if (data.unit === "miles")` | conversion branch |
| `src/lib/questionInfo.ts` l.198–224 | rule headings "… Within 1 Mile" must match the renamed headings |
| `src/lib/rules/cards.ts` Gambler's Feet | card text "100 feet"; the name stays |
| `src/components/cards/matching.tsx` l.124 "±360 feet (100 meters)" | text |
| `src/lib/context.ts` `defaultUnit` (persistent, default "kilometers"), `hidingRadiusUnits` | the setting and its toggle in `SettingsPanel.tsx` |
| `src/maps/geo-utils/operators.ts`, `hidingZoneLayer.ts`, `measuring.ts`, `sharedGame.ts`, `gameSettings.ts`, `hiderSpot.ts`, `events.ts`, `StationsPanel.tsx`, `HiderPanel.tsx`, `CardsPanel.tsx`, `mapRefresh.ts` | each reads `unit`/`Units`; most just pass km/m through; find every `"miles"` literal and every `Units` type use |
| `src/pages/reference.astro` | renders the questions and cards from the same sources; check the chips it prints |

## Changes

### G1. The rules pages

Apply 03's two tables row by row to `src/content/rules/`. Headings that other code points at change together: `tentacle-questions.md` headings become "Museums within 2 km", "Libraries within 2 km", "Movie Theaters within 2 km", "Hospitals within 2 km", "Metro Lines within 25 km", "Zoos within 25 km", "Aquariums within 25 km", "Amusement Parks within 25 km" (the Swiss 10 km is a game setting, not the book's text; say so in a one-line note under the heading: "Under the Swiss rules this game uses 10 km."). Update `lib/questionInfo.ts` `rules.heading` strings to match (the test `questionInfo.test.ts` "point at rules that exist" catches a mismatch).

Image alt texts: "Are you within 160 km of me?", "After traveling 15 km…", "Within 25 km of me…". The images themselves (`public/rules/img/*.webp`) show miles; leave them, note it in the round file (replacing the pictures is the owner's call).

### G2. The code

- `unitsSchema`: `z.union([z.literal("kilometers"), z.literal("meters")])`; `getDefaultUnit` falls back to `"kilometers"`. **Migration of saved questions:** `src/lib/storage.ts` (decodes saved questions) converts `unit: "miles"` → `kilometers` with `radius * 1.609344` rounded to 3 decimals, before zod parsing; the server's `sharedQuestionSchema` is `z.record` (no unit check) so old games load; `curseRules.radiusKm` keeps a tolerant branch for `"miles"` data from old games (keep the one conversion there, with a comment "old games only").
- Delete `UnitSelect.tsx`; where it was used, use `UnitToggle` (km/m) or nothing. Remove the `defaultUnit` setting from `SettingsPanel.tsx` (the store stays for compatibility, always "kilometers"; or delete it and its uses — prefer delete, grep `defaultUnit`).
- `Map.tsx` l.154 and anything else with `units: "miles"` → `"kilometers"` with the metric value.
- Card text (`lib/rules/cards.ts`): Gambler's Feet "100 feet" → "30 m". `matching.tsx` "±360 feet (100 meters)" → "±100 m".
- `settings.ts` comment "the book's 15 miles" → "25 km".

### G3. The test that keeps it metric

`tests/metric.test.ts`:
- reads every `src/content/rules/**/*.md` and asserts none matches `/\b(miles?|feet|ft|sq\. ?mi)\b/i` except the exact string "Gambler's Feet";
- the radar page lists exactly `RADAR_KM` as "500 m, 1 km, 2 km, 5 km, 10 km, 15 km, 40 km, 80 km, 160 km";
- the thermometer page lists `THERMOMETER_KM` (from Run D; if G runs before D, define the constant here);
- the tentacle page's headings match `questionInfo.ts`'s `rules.heading` values;
- `unitsSchema` rejects `"miles"`; `storage` converts a saved `{ radius: 5, unit: "miles" }` to `8.047 km`.

Browser: the reference page shows "2 km" tentacle headings; the radius card has no Miles option; a saved pre-metric question still loads (seed `localStorage.questions` with `unit: "miles"`).

## Acceptance

03's table copied into the round file with the final values; `agentic_docs/agents/decisions.md` row "metric only, values as in 03"; `known-issues.md` loses the metric entry; `docs/architecture.md` says the app is metric only.
