# Run B — The hider's phones in step

For the agent that executes this. Read `CLAUDE.md`, `agentic_docs/agents/notes.md`, then this file and [05-hider-sync-audit.md](05-hider-sync-audit.md). Can be merged into Run A's session if the context allows; otherwise run after A (it assumes the role comes from the team or the hider flag).

**After Run A (round 32):** the role comes from the server with every answer (`session.ts applyRole`); becoming the hider bumps `hiderTurn`, and `useHiderTurn` in `JoinDialog.tsx` opens the Hider tab and sets `hiderChoosing` only when no station is set. `claimHider`/`forgetHider` are already gone from the phone; what's left of the old path is `hiderTokens` and the `X-Hider-Token` header on the phone, and `/api/games/:id/hider` with `isHider` in `app.ts roleOf` on the server (known-issues).

## What went wrong

A second hider phone (or the same phone after a reload) was asked to pick a station over a game whose station was set, and tapping Done re-announced "the hider is in place" to everyone.

## The code

| Line | Problem |
|---|---|
| `src/components/game/JoinDialog.tsx` ~l.178: `hiderChoosing.set(true)` after `claimHider` | unconditional; `HiderPanel.tsx` shows the pick view when `$choosing || !$chosen`, so the pick view appears even with a station set (the toast "You're the hider. The Hider tab is yours" fires at the same time, which is the contradiction the players saw) |
| `server/src/gameOps.ts` case `hiderReady` (~l.546) | accepts at any time: overwrites `state.hider.station`, sets `hiderReadyAt = now`, starts the clock if idle |
| `src/lib/game/events.ts` ~l.287 | news on every new `hiderReadyAt`, so a repeat is re-announced to seekers and pushed |
| `src/lib/hiderSpot.ts` `pinFollowsGps` (localStorage per phone) + `followPin()` | two hider phones with it on both send `setHiderPin` every 15 s and fight |
| `src/lib/game/session.ts` `leaveGame()` | clears `pendingStation`, `pinLocked`, not `chosenStation` |
| `HiderPanel.tsx` "Change station" button | shown when `!$game || $game.move`; fine, but the server doesn't enforce it |

## Changes

### B1. The pick view only when there's nothing picked

- `JoinDialog.tsx`: after the join (Run A's `join` returns the hider's state), `hiderChoosing.set(!state.hider?.station)`. When a station is set: `showHiderTab()` and the existing toast "You're the hider. Your station is X." No `pointAtStationPick()` coach mark in that case (it already checks `chosenStation`, but call order matters: set `chosenStation` from the state before any of this; Run A's join response makes that synchronous).
- `HiderPanel.tsx`: `const choosing = $choosing && !$chosen || !$chosen || !!$game?.move` → simpler: `choosing = !$chosen || ($choosing && (!$game || !!$game.move))`. "Change station" stays only when `!$game || $game.move`.

### B2. The server guards `hiderReady`

`gameOps.ts` case `hiderReady`:
```ts
const going = clockState(state.clock);
if (state.hider?.station && !state.move && (going === "running" || going === "paused")) {
    throw new GameRuleError("The station is set for this round. Only playing Move changes it.", 409);
}
```
A `hiderReady` with the **same** station id as the current one while going is a no-op (return the state unchanged except version) rather than an error, so a retry is harmless. Also `setHiderStation` with a different station under the same condition → 409.

### B3. News only when the station changes

`events.ts`: fire the "hider is in place" event when `after.hiderReadyAt !== before.hiderReadyAt` **and** (`!before.hiderReadyAt` or `after.hider?.station?.id !== before.hider?.station?.id`). The seekers' view has `hider: null`, so compare `hiderReadyAt` plus a new `state.hiderStationId?: string` kept in both views? No: the station id reveals nothing but would be a hash of the choice. Simpler: the server only bumps `hiderReadyAt` when the station actually changes (B2 makes a repeat a no-op), so `events.ts` needs no change. Test it at the server: a repeated `hiderReady` leaves `hiderReadyAt` as it was.

### B4. One phone follows GPS

- `HiderSpot` gains `pinDriver?: PlayerId` (`types.ts`); op `setHiderPin` carries `by` implicitly (the actor id) and sets `pinDriver`. A phone whose `pinFollowsGps` is on but `state.hider.pinDriver !== me` for the last 30 s turns its toggle off with a toast "Another phone drives the pin". Implement in `src/lib/tracking.ts`'s `followPin` path: before sending, check `gameState.get()?.hider?.pinDriver` (undefined or me → send; else skip and switch off after the grace).
- The Hider tab row says "Pin follows GPS · this phone" or "· Ana's phone".

### B5. Housekeeping

- `leaveGame()` and `startOfRound()` clear `chosenStation` (the latter already does).
- `claimHider`/`forgetHider`/`hiderTokens`: remove, with the server's token fallback (Run A's "one release" note), **only if** the owner has deployed Run A and the phones have reloaded; otherwise leave for Run C and say so.

## Tests first

Server: `hiderReady` with a set station and a running clock → 409; during a Move → ok; repeat with the same station → ok, `hiderReadyAt` unchanged, `version` +1; `setHiderPin` sets `pinDriver` to the actor's id.
Unit (`tests/gameEvents.test.ts`): same `hiderReadyAt` → no "hider" event (regression guard).
Unit (`tests/pinFollow.test.ts`): `followPin` returns "off" when another id drives the pin.
Browser (`e2e/roles.spec.ts`): Ben is the hider with a station; a second phone joins the hider team (teams) or rejoins with Ben's code (no teams): no "Pick your station", `hider-station` shows the station, the seeker gets no new "hider is in place" toast; both phones turn on "Move my pin with GPS": only one stays on.

## Acceptance

The audit table in 05 has every row at "server" or "derived"; `agentic_docs/known-issues.md` loses the hider-sync and pin-fight entries; `docs/architecture.md`'s hider paragraph mentions the guard and the pin driver.
