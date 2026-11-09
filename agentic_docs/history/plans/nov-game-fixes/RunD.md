# Run D — The thermometer as the rulebook plays it

For the agent that executes this. Read `CLAUDE.md`, `agentic_docs/agents/notes.md`, then this file and [02-thermometer.md](02-thermometer.md). Binding answers: Q52 "Allow other questions" while a thermometer is armed; the large distance is **75 km** (the owner's edit, Q51); Custom distance allowed.

## The code today

| Piece | Where | Now |
|---|---|---|
| Schema | `src/maps/schema.ts` `thermometerQuestionSchema` (~l.56) | `latA/lngA/latB/lngB`, `warmer`, colours, `drag/collapsed/hidden` |
| Card | `src/components/cards/thermometer.tsx` | two `LatitudeLongitude` pickers, the distance between them, a Colder/Warmer toggle (solo) |
| Adding | `src/components/AddQuestionDialog.tsx` `runAddThermometer` (~l.82) | start = `startPoint()`, end = 5 **miles** east (`units: "miles"`) — note the A/B coordinates are swapped in the object literal (`lngB: center.lng`, `lngA: destination…`): a bug, the start pin is east of the phone |
| Engine | `src/maps/questions/thermometer.ts` | Voronoi of the two points; `warmer` keeps the half nearer the end; `hiderifyThermometer` answers from `hiderAnswerPosition()`; `travelArrow` draws the line |
| Answers | `src/lib/game/answers.ts` ~l.78 | choices Hotter/Colder → `warmer` |
| Identity / ×2 | `src/lib/game/questionIdentity.ts` | `thermometer:` with no distance; every thermometer counts as the same question for the double cost |
| Sending | `server/src/gameOps.ts` `sendQuestion`: draft → asked; `QuestionEntry.state` is `draft|asked|answered|vetoed` | no armed state |
| Map | `src/components/mapRefresh.ts` via `roleOnMap` (`src/lib/game/sync.ts`) | drafts speculative, asked waiting, answered confirmed |
| Position | `src/lib/geolocation.ts` `currentPosition`, `recentPosition()`; `src/lib/game/askFrom.ts` (Round 27) | the phone's position while followed |
| Distances | `src/lib/game/settings.ts` has `RADAR_KM`, `radarDefaults`, nothing for thermometers | |

## Changes

### D1. Data

`thermometerQuestionSchema` gains `distanceKm: z.number().positive().default(5)` and `armedAt: z.number().optional()` (server time). `latB/lngB` become `nullable()` (no end until Ask); the engine and `travelArrow` must tolerate `null` (draw nothing). Keep `warmer`.

`QuestionState` gains `"armed"` (`src/lib/game/types.ts`; `server/src/opSchema.ts` `putQuestion.state` enum unchanged: a phone never creates an armed question directly). `roleOnMap`: `armed` → `"waiting"` for the map (nothing applied; the ring is drawn by the card's layer, D4).

`src/lib/game/settings.ts`:
```ts
export const THERMOMETER_KM = [1, 5, 15, 75];
export const thermometerDefaults = (size: GameSize) => ({ small: [1, 5], medium: [1, 5, 15], large: [1, 5, 15, 75] })[size];
```
`GameSettings.thermometerKm: number[]` with `normalizeGameSettings` default by size; setup screen 1 gets the chips like `radarKm` (reuse the `radar-choices` pattern; `data-testid="thermometer-choices"`).

`questionIdentity`: `thermometer:${distanceKm}` so the ×2 is per distance (as the radar).

### D2. Ops and rules

`GameOp` and `opSchema`:
- `armThermometer { key, distanceKm, start: { lat, lng } }` — seekers only (`assertNotMoving`, `assertMayAsk(state, "thermometer")`); the entry must exist as a draft (the phone `putQuestion`s it first, as now); sets `data.latA/lngA = start`, `data.distanceKm`, `data.armedAt = now`, `data.latB = data.lngB = null`; `state = "armed"`; `askedAt` not set. No draw, no `rollAgain`.
- `askThermometer { key, end: { lat, lng } }` — the entry must be `armed`; refuse (409 "You've covered X of Y km") when `haversine(start, end) < distanceKm * 0.98` (2 % slack for GPS); sets `latB/lngB`, `state = "asked"`, `askedAt = now`, `rollAgain(state)`; the hider's five minutes run from here.
- `cancelThermometer { key }` — `armed` → `draft` (clears `armedAt`, `latB/lngB`); seekers only.
- `sendQuestion` on a thermometer draft → 409 "Start the thermometer first." `vetoQuestion`/`randomizeQuestion` on an armed one → 409 (nothing asked yet); `randomizeQuestion` on an asked thermometer keeps its "(no variants)" rule.
- Delete while armed: allowed for seekers as a draft is (no agreement needed).

`viewFor`: the hider sees armed thermometers (they're not drafts): change the filter to `entry.state !== "draft"` — already so; make sure the hider's view of an armed entry has `latA/lngA` and `distanceKm` (it does: the whole data).

Distance helper shared: `src/lib/game/thermometer.ts` with `coveredKm(start, here)` (turf `distance`), `canAsk(question, here)`, `remainingKm`. The server imports it (the server already imports from `@/lib/game/*`).

### D3. The seekers' card (mock-ups 07–09)

Rewrite `thermometer.tsx` as three states:
- **Draft (arming):** chips from `settings.thermometerKm` + **Custom…** (an `Input` in km, as the radar's custom); "Start: here" with the position (`recentPosition()`; without a fix, a warning and "the map's centre" with a Change link that uses the question's current `latA/lngA`); pinned **Start the thermometer (5 km)** → `armThermometer`.
- **Armed:** "Covered, as the crow flies: 2.3 of 5 km", a progress bar, the hint "Leave the dashed circle, then ask. Other questions can be asked meanwhile."; **Ask: hotter or colder? · 2.7 km to go** disabled until `canAsk`; **Cancel the thermometer (no cost)**. Ticks with `useTick` and `currentPosition`.
- **Ready/asked/answered:** as the frozen card today (the two points, the distance, the answer).

`AddQuestionDialog.runAddThermometer`: fix the swapped coordinates; `latB/lngB: null`; `distanceKm: thermometerDefaults(size)[1] ?? first`.

The hider's card: state `armed` shows "Started from the violet pin, 5 km. Nothing to answer yet." (no answer buttons); `QuestionGameBar` `STATE_TEXT` gains `armed: "Started: the seekers are travelling"`; the list row tag "Travelling" (`QuestionList.tsx` `STATUS.armed`).

### D4. The map

`mapRefresh.ts`: for an `armed` thermometer draw the start pin (DraggableMarkers already draws pin A; make it non-draggable when armed), a dashed circle of `distanceKm` around the start (reuse the `WAITING_STYLE` dash), and a line from the start to `currentPosition` on the seekers' phones (a small layer in `src/maps/thermometerLayer.ts`, started like `askFromLayer.ts`). No shading.

### D5. Alerts and news

`events.ts`: a new event kind `"thermometer"` for the hider when an entry turns `armed` ("Thermometer started: 5 km from the seekers' position"), a toast with a buzz; `tipForEvent` → a tip "A thermometer is on: nothing to answer until they ask." `GamePopups` shows it as a toast (not a popup).

## Tests first

Unit (`tests/thermometer.test.ts`): `coveredKm` on two known points; `canAsk` at 4.9 / 5.0 km of 5; `questionIdentity` differs by distance; `roleOnMap(armed) === "waiting"`; the engine with `latB === null` applies nothing.
Server (`gameOps.test.ts`): arm → ask → answer; ask early → 409 with the covered/needed km in the message; arm twice → 409; send on a thermometer draft → 409; cancel → draft, no `owed` draw added; the hider's view includes the armed entry; `timesAnsweredBefore` counts only answered.
Browser (`e2e/thermometer.spec.ts`, faked GPS as in `location.spec.ts`): Ana at HB arms 1 km; Ben (hider) sees the toast and the row "Travelling"; Ana's position moves 1.2 km north (`context.setGeolocation`) → Ask lights up → asked; Ben answers Colder; the map on Ana's phone shades the far half (a `path` with the question's colour exists). Also the older `sharedGame.spec.ts` flows that add a thermometer (the curses test's Drained Brain lists "Thermometer") still pass.

## Acceptance

`docs/architecture.md` "The map" and "Changes" mention the armed state; `agentic_docs/known-issues.md` loses the thermometer entry; the metric run (G) only has to touch the rules page for thermometers, since the chips are already km here.
