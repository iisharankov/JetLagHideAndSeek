# Round 38, 2026-11-09: Run G, metric everywhere

Model: Opus 5.5. Budget: "go", overnight (continues rounds 36 and 37).

Asked: (as round 36) "…Once you finish all of those and everything is in place, continue onto G."

Answers used: Q51 (75 km for the large thermometer) and Q57 ("Yes": 03's table stands as written). Not answered, not built: Q48.

Did:
- **G1, the rules pages** (`src/content/rules/`), with the values below: radar and thermometer lists, the tentacle headings ("Museums within 2 km" … "Amusement Parks within 25 km", and under the big places "Under the Swiss rules this game uses 10 km."), the tentacle question's own wording, the hiding zones, found within 2 m, 3 m from a path, the map sizes in km², the coastline's 1.5 km, the powerups' example, the curses page, and the prose ("kilometres"). Image alt texts: "Are you within 160 km of me?", "After traveling 15 km…", "Within 25 km of me…". `lib/questionInfo.ts` points at the new headings.
- **G2, the code:** `maps/schema.ts` takes only kilometers and meters (default kilometers); `lib/metric.ts` turns a question saved in miles into km on load (`storage.ts`, `game/sync.ts` for old shared games, `addQuestion` for a pasted one); a hiding radius saved in miles converts once (`context.ts`); Settings → Default unit and `UnitSelect.tsx` gone (`defaultUnit` deleted); the thermometer card is km; the map's scale bar has no miles (`Map.tsx`); the matching card's "±100 m"; the tentacle groups "Big places…" / "Small places…" instead of "15 Miles (Typically)"; internal geometry in km (`measuring.ts`, `operators.ts`); `curseRules.radiusKm` keeps its miles branch for old games, commented.
- **G3, the test:** `tests/metric.test.ts` (6, all seen failing first): no rules page says miles or feet (but Gambler's Feet, and "with cars and feet", which is walking); the radar and thermometer lists equal `RADAR_KM` and `THERMOMETER_KM`; the tentacle headings, and `questionInfo` points at them; the schema refuses miles; a saved 5-mile radar loads as 8.047 km. Browser (`e2e/reference.spec.ts`): the rulebook page shows "Museums within 2 km" and no miles; a saved radar in miles opens as 8.047 km; no imperial scale bar.
- **The plan:** all of runs A–G are built: `plans/nov-game-fixes/` moved to `history/plans/nov-game-fixes/` with a Built note (links fixed in known-issues, the docs index, the roadmap).
- **Docs:** `docs/architecture.md` (metric only), decisions, known-issues (the metric entry gone).

The table, as built (03's, with the values used):

| Where | Was | Now |
|---|---|---|
| Radar | ¼, ½, 1, 3, 5, 10, 25, 50, 100 miles | 500 m, 1, 2, 5, 10, 15, 40, 80, 160 km |
| Thermometer | ½, 3, 10, 50 miles | 1, 5, 15, 75 km |
| Tentacles | 1 mile, 15 miles | 2 km, 25 km (10 km under the Swiss rules, a game setting) |
| Hiding zone | ¼ mile, ½ mile | 500 m, 1 km |
| Coastline waterway | 1 mile across | 1.5 km |
| Matching, big park tolerance | ±360 feet (100 meters) | ±100 m |
| Found within | 5 feet | 2 m |
| Hiding spot from a path | 10 feet | 3 m |
| Endless Tumble (the page; 03 said Gambler's Feet) | 100 feet | 30 meters, as the card |
| Map sizes | 10–100, 100–1,000, 1,000+ sq. miles | 25–250, 250–2,500, 2,500+ km² |
| Randomize example | 10 mile → 50 mile radar | 15 km → 80 km radar |
| Curses page (not in 03) | at least 10 miles away; within 10 feet; "Went 5 miles" | 15 km; 3 m; "Went 10 km" |
| Prose | several miles, a mile, miles and miles | kilometres, a kilometre |

Changed from the brief: the curses page's "100 feet" belongs to Endless Tumble (its card already says 30 meters), not Gambler's Feet; Gambler's Feet's card has no distance, so `cards.ts` needed nothing. The hiding radius unit store stays (km or m), as the brief allowed.

Found on the way: the map's scale bar showed miles beside km on every screen (`imperial={false}` now). The rules pictures (`public/rules/img/*.webp`) and the printed cards (`public/rules/cards/`) still show miles: replacing them is your call.

Checked (with round 37, one working tree): lint and types clean; vitest 518 passed (71 files); build and build:server; Playwright 87 passed, 7 skipped. `tests/metric.test.ts` and the metric browser test were seen failing before the change. Not checked: the rendered rules pages on a phone beyond the tentacle page (the test reads every page's text).
No root-run file changed.
Decisions: decisions.md, round 38. Questions added: none.
Commit message: Round 38: Run G, metric everywhere: the rules pages in km, no unit setting, old questions in miles load in km, a test that keeps it so
