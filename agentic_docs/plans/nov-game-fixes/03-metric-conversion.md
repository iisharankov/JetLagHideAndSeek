# 3 · Metric only

The rulebook pages in `src/content/rules/` are the original's, in miles and
feet. The app already plays in kilometres (its radar chips are
0.5/1/2/5/10/15/40/80/160 km, hiding zones 500 m / 1 km, tentacles 2/10 km
under the Swiss rules) but keeps a unit toggle and imperial code paths. The
decision: **metric everywhere, no imperial option**, and the rules pages
say the metric values the game is played with.

Conversions below follow the pattern the app already set: the nearest
"round" metric value, not the exact figure (½ mile → 1 km, 3 miles → 5 km,
¼ mile → 500 m, 15 miles → 25 km or 10 km under Swiss rules). Exact values
are in the table so you can judge each one. **Tick each row to confirm.**

> 2026-11-09: the owner changed the large thermometer to **75 km** (not 80) and
> left the rest; read as: the table stands as written (Q51, restated in Q57).

## Distances the game plays with

| Where                                                                                         | Original                               | Exact   | Proposed metric | Note                                                                          | OK? |
| --------------------------------------------------------------------------------------------- | -------------------------------------- | ------- | --------------- | ----------------------------------------------------------------------------- | --- |
| Radar chips (`seeking/radar-questions.md`)                                                    | ¼ mile                                 | 0.40 km | **500 m**       | app has it                                                                    | ☐   |
|                                                                                               | ½ mile                                 | 0.80 km | **1 km**        | app has it                                                                    | ☐   |
|                                                                                               | 1 mile                                 | 1.61 km | **2 km**        | app has it                                                                    | ☐   |
|                                                                                               | 3 miles                                | 4.83 km | **5 km**        | app has it                                                                    | ☐   |
|                                                                                               | 5 miles                                | 8.05 km | **10 km**       | app has it                                                                    | ☐   |
|                                                                                               | 10 miles                               | 16.1 km | **15 km**       | app has it                                                                    | ☐   |
|                                                                                               | 25 miles                               | 40.2 km | **40 km**       | app has it                                                                    | ☐   |
|                                                                                               | 50 miles                               | 80.5 km | **80 km**       | app has it                                                                    | ☐   |
|                                                                                               | 100 miles                              | 161 km  | **160 km**      | app has it                                                                    | ☐   |
| Radar image caption                                                                           | 100 miles                              |         | 160 km          | alt text only                                                                 | ☐   |
| Thermometer (`seeking/thermometer-questions.md`), small                                       | ½ mile                                 | 0.80 km | **1 km**        |                                                                               | ☐   |
|                                                                                               | 3 miles                                | 4.83 km | **5 km**        |                                                                               | ☐   |
| + medium and large                                                                            | 10 miles                               | 16.1 km | **15 km**       | same rounding as the radar's 10 miles                                         | ☐   |
| + large                                                                                       | 50 miles                               | 80.5 km | **75 km** (not 80!) |                                                                               | ☐   |
| Thermometer image caption                                                                     | 10 miles                               |         | 15 km           |                                                                               | ☐   |
| Tentacles, small places (`seeking/tentacle-questions.md`)                                     | 1 mile                                 | 1.61 km | **2 km**        | app has it (museums, libraries, cinemas, hospitals)                           | ☐   |
| Tentacles, big places                                                                         | 15 miles                               | 24.1 km | **25 km**       | app has it for German rules; **10 km** under Swiss rules (`tentacleDefaults`) | ☐   |
| Tentacles image caption                                                                       | 15 miles                               |         | 25 km           |                                                                               | ☐   |
| Hiding zone, small and medium (`quick-start-guide/hiding-zones.md`, `hiding/hiding-zones.md`) | ¼ mile                                 | 0.40 km | **500 m**       | app has it (`hidingRadiusDefaultKm`)                                          | ☐   |
| Hiding zone, large                                                                            | ½ mile                                 | 0.80 km | **1 km**        | app has it                                                                    | ☐   |
| Measuring, coastline definition (`seeking/measuring-questions.md`)                            | waterway never less than 1 mile across | 1.61 km | **1.5 km**      | a definition, not a chip; 2 km would also do                                  | ☐   |
| Matching, Big Park ±tolerance (`components/cards/matching.tsx`)                               | 360 feet (100 m)                       | 110 m   | **100 m**       | already metric in brackets; drop the feet                                     | ☐   |

## Rules that aren't chips

| Where                                                                                                                                                                      | Original                      | Exact         | Proposed                      | Note                                      | OK? |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------- | ----------------------------- | ----------------------------------------- | --- |
| Found when within… (`quick-start-guide/rotating-rounds.md`)                                                                                                                | 5 feet                        | 1.5 m         | **2 m**                       | "within arm's reach" would read better    | ☐   |
| Hiding spot within … of a path (`hiding/hiding-spots.md`)                                                                                                                  | 10 feet                       | 3.0 m         | **3 m**                       |                                           | ☐   |
| Curse of the Gambler's Feet, die rolled … (`curses.md` l.93)                                                                                                               | 100 feet                      | 30.5 m        | **30 m**                      | the card text in `lib/rules/cards.ts` too | ☐   |
| Map size, small (`setting-up-your-map/choosing-a-transit-system.md`)                                                                                                       | 10–100 sq mi                  | 26–259 km²    | **25–250 km²**                |                                           | ☐   |
| Map size, medium                                                                                                                                                           | 100–1,000 sq mi               | 259–2,590 km² | **250–2,500 km²**             |                                           | ☐   |
| Map size, large                                                                                                                                                            | 1,000+ sq mi                  | 2,590+ km²    | **2,500+ km²**                |                                           | ☐   |
| Randomize example (`powerups.md` l.15)                                                                                                                                     | 10 mile radar → 50 mile radar |               | **15 km radar → 80 km radar** | an example                                | ☐   |
| Prose: "several miles", "miles and miles away", "a mile from the park icon" (`matching-questions.md` l.75, `measuring-questions.md` l.77, `photo-questions.md` l.25/41/87) | —                             | —             | "kilometres", "a kilometre"   | wording only                              | ☐   |

## In the app (code)

| Where                                                        | What                                                                                                                                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/maps/schema.ts` `unitsSchema`                           | keep "kilometers" and "meters" (meters is used for the hiding radius input); drop "miles"; migrate saved questions with `unit: "miles"` by converting the value                             |
| `src/components/UnitToggle.tsx`, `UnitSelect.tsx`            | remove, and the toggle from Settings (`defaultUnit`) and the radius card                                                                                                                    |
| `src/components/cards/thermometer.tsx`                       | distance label always km (rewritten anyway in 02)                                                                                                                                           |
| `src/components/AddQuestionDialog.tsx` l.86, `Map.tsx` l.154 | `units: "miles"` defaults → kilometers                                                                                                                                                      |
| `src/lib/game/curseRules.ts` l.170                           | the imperial branch goes                                                                                                                                                                    |
| `src/lib/questionInfo.ts` l.198–224                          | rule headings "Museums Within 1 Mile" etc. follow the renamed headings in `tentacle-questions.md` ("Museums within 2 km") — the test `tests/questionInfo.test.ts` checks the headings exist |
| `src/lib/rules/cards.ts` Gambler's Feet                      | card text "100 feet" → "30 m" (the card's name stays)                                                                                                                                       |
| `src/content/rules/**/*.md`                                  | every row above; `tests/rulesText.test.tsx` already parses the pages, add a test that no page contains "mile" or "feet" except the card name                                                |
| `src/lib/game/settings.ts`                                   | comment "the book's 15 miles" → 25 km; the tables are already metric                                                                                                                        |
| Reference page (`src/pages/reference`)                       | reads from the same sources; check the rendered chips                                                                                                                                       |

## Procedure for the run

1. The owner ticks the rows above (or writes the value they want).
2. Write `tests/metric.test.ts`: the rules pages contain none of
   `/\bmiles?\b|\bfeet\b|\bft\b|sq\. mi/` outside the one card name; the
   chips in the pages equal `RADAR_KM`, the thermometer list, and the
   tentacle distances for the German rules.
3. Apply the table; run the test; update `agentic_docs/questions.md` with the
   decision and this file with the final values.
