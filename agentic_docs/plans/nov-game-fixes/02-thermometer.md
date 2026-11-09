# 2 · The thermometer, as the rulebook plays it

## The rule

From `src/content/rules/seeking/thermometer-questions.md`:

> When starting a thermometer question, you should inform the hider that
> you are starting a thermometer and send them your current location. Then,
> after traveling a sufficient distance — measured as the crow flies — send
> them your new location. If the new location is closer to the hider's
> current location, then you are hotter. Otherwise, you are colder.

Distances: small games ½ mile and 3 miles; medium adds 10 miles; large adds
50 miles. Metric values per [03-metric-conversion.md](03-metric-conversion.md):
**1 km, 5 km, 15 km, 75 km** (the owner set 75, not 80, on 2026-11-09). A
**Custom…** chip takes any distance, as the radar does.

The hider draws 2, keeps 1. Asked twice: double cost, like any question.

## What the app does today

`src/components/cards/thermometer.tsx` is a card with two draggable pins
(Start, End), a live distance between them and a Hotter/Colder result. It
is sent as one question with both pins already placed. Nothing holds the
seekers to a distance, the start isn't tied to where they were, and the
hider only hears of it when it's complete. The engine
(`src/maps/questions/thermometer.ts`) keeps the half-plane nearer the start
(colder) or the end (hotter); that part is right and stays.

## The new flow

A thermometer has three states, kept in the game's question entry so every
phone sees the same one.

```
 draft ──Arm──► armed ──(distance covered ≥ set)──► ready ──Ask──► asked ──► answered
   │              │                                   │
   └─ delete      └─ Cancel (no cost, no draw)        └─ Cancel (no cost)
```

1. **Arm.** The seekers pick a distance (one of the game's chips) and tap
   **Start the thermometer**. The start pin is their current position
   (GPS; if there's no fix, the map's centre with a warning). The game gets
   `armThermometer { key, distanceKm, start }`. The hider's phone shows
   "Thermometer started from here, 5 km" with the start pin, and nothing to
   answer. The clock keeps running; no cards are drawn.
2. **Travel.** The seekers' card shows the distance covered as the crow
   flies from the start to their live position ("2.3 of 5 km"), a progress
   bar, and a greyed **Ask** button. The map draws the start pin, a dashed
   circle of the set distance around it (leave the circle: that's where
   you can ask from), and the line to the current position. Other
   questions may be asked meanwhile (the rules don't forbid it; the hider
   answers them from their station as usual).
3. **Ask.** Once covered ≥ set distance, **Ask: hotter or colder?** lights
   up. Tapping it sends `askThermometer { key, end }` with the current
   position as the end pin (the send-from check of Round 27 applies: if the
   phone's position is far from where the map thinks, it asks). The
   question is now `asked`: the hider has five minutes, answers Hotter or
   Colder, worked out from their station (end game: their pin), with the
   app's suggestion as for every question.
4. **Cancel** while armed or ready: the question goes back to a draft (or
   is deleted); nothing is drawn, nothing counts as asked.

The seekers can't move the start pin once armed, and the end pin is placed
by the app, not dragged. (Dragging stays available in solo mode / planning
mode, where there's no game.)

## Data

`ThermometerQuestion.data` gains:

```ts
distanceKm: number;        // the chip chosen
armedAt?: number;          // server time, when started
// latA/lngA = start (fixed once armed), latB/lngB = end (set at Ask)
```

`QuestionEntry.state` gains `"armed"` (between draft and asked). The server
refuses `askThermometer` when the great-circle distance start→end is below
`distanceKm` (so a phone with a stale position can't ask early), and
refuses `armThermometer` on an already armed question. `viewFor` shows an
armed thermometer to the hider (start pin and distance), unlike a draft.

The engine (`thermometer.ts`) is unchanged: it needs both pins and the
answer; while armed it draws nothing but the ring.

## Screens

See the mock-ups `mockups/png/07-thermometer-arm.png`, `08-thermometer-travel.png`,
`09-thermometer-ask.png` and the hider's `10-hider-thermometer-armed.png`.

## Tests to write first

- Unit (`tests/thermometer.test.ts`): `coveredKm(start, here)`,
  `canAsk(question, here)` at the boundary (4.99 km no, 5.0 km yes),
  cancel returns to draft, the engine still applies hotter/colder.
- Server (`server/src/gameOps.test.ts`): arm → ask → answer; ask too early
  is a 409; arm twice is a 409; cancel while armed draws nothing; a
  thermometer counts as "asked before" only once it's asked, not armed.
- Browser (`e2e/thermometer.spec.ts`, with faked GPS as `location.spec.ts`
  does): arm at HB, the hider sees "started from here"; move the fake
  position 1.2 km north with a 1 km thermometer, Ask lights up; ask;
  the hider answers Colder; the map shades the far half.

## Open questions for the owner

- May the seekers ask other questions while a thermometer is armed? The
  rules don't say; this plan allows it. (The investigation book's framing
  "after traveling \_\_\_" suggests the thermometer is one question, the
  travel being part of asking it.)
- If the seekers split up, whose phone's position is the thermometer's?
  This plan: the phone that armed it; the card says so on the other phones.
