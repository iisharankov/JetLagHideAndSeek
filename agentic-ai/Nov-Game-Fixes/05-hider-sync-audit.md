# 5 · A new hider phone mid-game: "pick your station" over a running game

## What happened

A hider's phone was lost (reload, new tab) or a second hider joined while
the game was on. The phone asked them to pick a hiding spot although the
station was already set, and when they tapped through, every phone got
"The hider picked their station" again.

## Why, in the code

`src/components/game/JoinDialog.tsx`, on "Become the hider":

```ts
await claimHider(password);
markJoined($gameId);
hiderChoosing.set(true);          // ← always: the phone enters "choosing"
showHiderTab();
if (chosenStation.get()) { toast… }
if (!offerTour("hider", pointAtStationPick)) pointAtStationPick();
```

- `hiderChoosing.set(true)` is unconditional. `claimHider` does reconnect
  (`await connect()`), so by the time it returns the phone has the game as
  the hider and `chosenStation` is the game's station — and the toast
  "You're the hider. The Hider tab is yours" even fires on that. But the
  Hider tab shows the **pick view** whenever `hiderChoosing` is true
  (`const choosing = $choosing || !$chosen`), so the phone shows "Pick your
  station" with a **Done** button over a game whose station is set. On the
  map, the tapped-station circle replaces the real one.
- The Hider tab in choosing mode shows **Done**; tapping it sends
  `hiderReady`, which the server accepts at any time
  (`gameOps.ts` case `hiderReady`): it overwrites `state.hider.station`,
  sets `hiderReadyAt = now`, and every phone's `events.ts` fires the
  "hider ready" news (`hr${hiderReadyAt}` is a new key) and the push.
- `hiderShowAll`, `hiderChoosing`, `pendingStation` are plain atoms per
  phone, not in the game; a second hider phone can be in a different mode
  from the first.

## The fix

1. **The server decides what a joining hider sees.** On becoming the hider
   (claim or rejoin), the phone awaits the state as hider, then:
   `hiderChoosing.set(!state.hider?.station)`. No coach mark and no tour
   pointer when a station is set; instead a toast "You're the hider. Your
   station is X" (the toast exists, it's just in the wrong order).
2. **`hiderReady` is guarded**: refused (409) when `state.hider.station`
   is set and the clock is running or paused, unless `state.move` is on
   (a Move legitimately re-picks). The phone shows the error. Changing the
   station outside a Move is already blocked in the UI
   (`station-locked`); the server now enforces it.
3. **`hiderReadyAt` news only when the station changes** or is first set:
   `events.ts` compares `before.hider?.station?.id` too, so a repeated op
   (a retry) is silent.
4. **The hider's modes go into the game** where two phones must agree:
   `pending` already does; `choosing` becomes derived (`!station || move`)
   rather than a flag anyone can flip.

## The audit: every piece of hider state, its source of truth, and the late-joiner path

| State                | Lives in                                               | Source of truth | Late second phone gets it?                                                 | Fix                                                                                                                                                                          |
| -------------------- | ------------------------------------------------------ | --------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| station              | `state.hider.station` + `chosenStation` (localStorage) | server          | yes, once a state arrives as hider; **but** the join flow acts before that | 1                                                                                                                                                                            |
| pending station      | `state.hider.pending` + `pendingStation`               | server          | yes                                                                        | —                                                                                                                                                                            |
| pin                  | `state.hider.pin` + `hiderMode`                        | server          | yes (first state wins over local)                                          | —                                                                                                                                                                            |
| pin locked           | `state.hider.pinLocked` + `pinLocked`                  | server          | yes                                                                        | —                                                                                                                                                                            |
| choosing             | `hiderChoosing` atom                                   | **phone**       | no: set true by the join flow                                              | 1, 4                                                                                                                                                                         |
| show all stations    | `hiderShowAll` atom                                    | phone           | n/a (a view setting)                                                       | keep per phone                                                                                                                                                               |
| pin follows GPS      | `pinFollowsGps` (localStorage)                         | phone           | n/a, but **two hider phones both following** fight over the pin            | the server keeps the last writer; add "pin driven by: Ana's phone" and let only one phone follow (the one that turned it on last; the other's toggle turns off via the game) |
| hider token          | `hiderTokens` (localStorage)                           | server issues   | only by password                                                           | 04/06: by player id or rejoin code                                                                                                                                           |
| hiderReadyAt / clock | server                                                 | server          | yes                                                                        | 2, 3                                                                                                                                                                         |
| research questions   | `questions` with `data.research`                       | phone           | not shared (by design)                                                     | say so in the Research tab (it does)                                                                                                                                         |
| suggested answers    | `suggestedAnswers` atom                                | phone           | recomputed                                                                 | —                                                                                                                                                                            |
| end game by hider    | `state.endgame.byHider`                                | server          | yes                                                                        | —                                                                                                                                                                            |

Also found while reading:

- `claimHider` reconnects, so the hider's view does arrive before the join
  flow continues; the order is right. What's missing is only the guard on
  `hiderChoosing` (above) and on the server (fix 2).
- `leaveGame()` clears `pendingStation` and `pinLocked` but not
  `chosenStation`; a station from an earlier game can show for a moment on
  the next one until the first state arrives. Clear it on leave.
- `newRound` resets `state.hider` on the server; the old hider's phone
  keeps `chosenStation` until it rejoins; with 04, a phone that stays the
  same player is told at once.

## Tests

- Server: `hiderReady` with a set station and a running clock is a 409;
  allowed during a Move; `hiderReadyAt` unchanged by a refused op.
- Unit (`tests/gameEvents.test.ts`): a second `hiderReady` with the same
  station yields no news.
- Browser (`e2e/roles.spec.ts`): Ben is the hider with a station; a
  second phone becomes the hider with the password: no "Pick your station",
  no coach mark, the station shown, no toast on the seekers' phone, the
  hider's pin and zone drawn within a second (the reconnect).
