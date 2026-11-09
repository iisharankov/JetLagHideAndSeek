# Run A — Who you are: player ids, team passwords, roles that follow the team

For the agent that executes this. Read `CLAUDE.md`, then `agentic_docs/agents/notes.md`, then this file. Related design notes: [04-identity-and-rejoin.md](04-identity-and-rejoin.md), [06-teams-and-roles.md](06-teams-and-roles.md). Test first; the owner commits; never deploy.

## What the owner decided (binding)

- A **player id** per phone, silent; a **player code** (six characters) as the spare key for a phone swap or wiped storage (Q53, 2026-11-09).
- **Team passwords, no hider password** (Q54): "no hider password needed, just joining any team has a password needed, so if you join a different team you need their password. Maybe a game setup option for teams or not, but if solo hiders then they don't need a password as their ID counts as one." Read as:
  - a game setting **teams: on/off**, chosen in setup;
  - **teams on:** every team has a password set when the team is made; joining a team means typing it; the team that hides is the hider team and its members are hiders; no separate hider password anywhere;
  - **teams off:** players are individuals; the first player to tap "I'm the hider" is the hider, identified by their player id; a second phone becomes that hider only with the player code; no password.
- Passwords (team) at least 6 characters, 5 wrong tries a minute per game (Q50).

## The problem in the code today

| What | Where | Why it breaks |
|---|---|---|
| A player is a name string | `src/lib/game/session.ts` `playerName`, `me()`; every op carries `by` | two phones with the same name are one player; "Ana " and "Ana" are two |
| Joined = per tab | `src/lib/game/knownGames.ts` `joinedGames` in **sessionStorage** | a closed tab or restarted browser shows the join dialog again |
| Role = per phone token | `hiderTokens` (localStorage) → `X-Hider-Token`; server `roleOf()` in `server/src/app.ts` l.85; `games.isHider` | a teammate who didn't type the password is a seeker: seekers' view, position broadcast (the round-2 bug) |
| Team members = names | `Team.members: string[]`; `server/src/rules/teams.ts` `teamOf(state, name)`; `gameOps.ts` `joinTeam`, `leaveTeam`, `claimNextRound` | renaming leaves the team; nothing ties a team to a role |
| Positions keyed by name | `server/src/positions.ts` `seekers.set(position.name …)` | a renamed or re-joined player is a second marker; kept 12 h (`KEPT_MS`) |
| Push subscriptions per role | `server/src/push.ts` `subscribe(gameId, role, …)` | fine for now; see "Out of scope" |
| New round forgets the hider | `games.ts apply()` runs `setHider.run(null, null, id)` on `newRound`; `session.ts startOfRound()` sets role seeker and `unmarkJoined` | with teams the next hider team is known; nobody should have to type anything |

## The design, in order of building

### A1. The player id and `players` on the server

**Types** (`src/lib/game/types.ts`, shared with the server):

```ts
export type PlayerId = string;
export interface Player {
    id: PlayerId;
    name: string;
    teamId: string | null;
    /** Without teams: the one player who is the hider. */
    hider?: boolean;
    joinedAt: number;
    lastSeen: number;
    /** Taken over by another phone (rejoin code): this id is dead. */
    left?: number;
}
// GameState gains:
players: Record<PlayerId, Player>;
```

`games.ts load()` adds `state.players ??= {}`; `newGameState` starts with `{}`.

**Actor** (`server/src/rules/shared.ts`): `{ id: PlayerId; name: string; role: Role }`. Every place that compares `actor.name` to a team member or a request's author compares ids instead; `actor.name` stays for "asked by Ana" labels (`createdBy`, `askedBy`, `by`…). Keep those as names: they are display text.

**The header** `X-Player-Id` on every request. Phone side: `src/lib/game/api.ts` `headers()` adds it from a new store `playerId` (`src/lib/game/player.ts`, `persistentAtom("playerId")`, created on first read with `crypto.randomUUID()`); `openEvents` sends it too (the stream is a fetch, so the header works). Server side: `playerOf(c)` reads it; a request without it (an old phone) gets a synthetic id `legacy:<name>` so nothing breaks mid-rollout.

**`POST /games/:id/join`** (new, replaces the "join by just acting" of today):

```ts
body: { name: string; team?: { id?: string; name?: string; password?: string }; hider?: boolean }
→ { player: Player; role: Role; state: GameState(viewFor role); now }
```

- Creates or updates `players[id]` (name, `lastSeen`).
- Team handling (A3). Hider claim without teams (A4).
- Idempotent: joining again with the same id is a no-op update.

`GET /games/:id` and `/events` also stamp `players[id].lastSeen` when the id is known (cheap: in memory map of last stamps, written to the state at most once a minute, or simply on the next op; don't write the game on every GET — see "Pitfalls").

**Phone:** `joinedGames` is replaced by "`state.players[playerId.get()]` exists and isn't `left`". `JoinDialog` opens when the game is loaded and that is false. `markJoined/unmarkJoined` go.

### A2. The player code

- `Player.code: string` (6 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, grouped `K7M-4PQ` for display; store without the dash), made on join. The code is in `viewFor` **only for the player it belongs to**: strip every other player's code (`players[x].code` → undefined unless `x === viewer.id`). Add a `viewFor(state, role, viewerId)` parameter.
- **`POST /games/:id/rejoin { code }`** with the new phone's `X-Player-Id`: finds the player by code; marks the old record `left: now`; copies name, teamId, hider flag into a record under the new id (same code, so a further swap works); returns the join response. Rate limit: 5 tries a minute per game (same helper as passwords, C3 in RunC; build the helper here, `server/src/rateLimit.ts`, in memory, `allow(key): boolean`).
- The old phone: on its next state it finds its own record `left` → `session.ts receive()` calls `leaveGame()` with a toast "You continued on another phone. Rejoin here with your code if that was a mistake."
- UI: `GamePanel.tsx` (Menu → Game) shows "You: Ana · code K7M-4PQ" with a **Share the code** button (`navigator.share` or clipboard). `JoinDialog.tsx` gets a second section, "Were you in this game on another phone?", with a code field and **Rejoin with the code** (mock-up 15).

### A3. Teams: passwords, ids, the setting

**Setting:** `GameSettings.teams: boolean` (default `false`), `normalizeGameSettings` gives the default; a `ToggleCard` **Teams** on setup screen 1 ("Players join teams; the team hides together. Each team has a password.").

**Team type:** `Team { id; name; members: PlayerId[]; passwordHash: string }` (`passwordHash` stripped in `viewFor` for everyone). Migration in `games.ts load()`: a member that isn't a known player id becomes a legacy player `legacy:<name>` in `players` (so old games still render).

**Ops:**
- `joinTeam { name; password }` — makes the team (hashing with `hashPassword` from `games.ts`; move `hashPassword`/`passwordMatches` to `server/src/rules/passwords.ts` so `gameOps` can use them) or joins it after `passwordMatches`; wrong password → 403 "Wrong team password", counted by the rate limiter (5 a minute per game). Password < 6 chars → 400. Replaces the member by id; `leaveTeam` by id.
- Teams off: `joinTeam` is a 409 "This game has no teams."

**Role from the team** (`server/src/rules/shared.ts`):

```ts
export const roleOfPlayer = (state, player): Role =>
    state.settings.teams
        ? player?.teamId && player.teamId === state.hiderTeamId ? "hider" : "seeker"
        : player?.hider ? "hider" : "seeker";
```

`app.ts roleOf(c, id)` becomes `roleOfPlayer(state, state.players[playerOf(c)])`, with the **old token path kept as a fallback for one release**: `games.isHider(id, header)` still grants hider (so phones mid-game at deploy time keep working). Remove the fallback in the next run.

`hiderTeamId`: set when the first member of a team taps "I'm hiding" in the join dialog (`join` with `hider: true` and a team) while `hiderTeamId` is null; `claimNextRound`/`newRound` already set it for the next round. `games.ts apply()`'s `setHider.run(null, null, id)` on `newRound` stays (clears the legacy token).

**Positions:** `positions.set(id, { playerId, name, … })` keyed by `playerId`; `app.ts /position` refuses when `roleOfPlayer` is hider (the existing 403). `SeekerPosition` gains `playerId`; `SeekerMarkers.tsx` keys by it and filters "me" by id (`positionsShown` in `src/lib/game/positions.ts` takes `me: PlayerId`).

**Stale players:** `positions.ts` `KEPT_MS` → 60 minutes; `SeekerMarkers` fades at 10 minutes (already 5; make it 10). `DELETE /games/:id/players/:pid`: allowed for the organiser token, or for anyone when `now - player.lastSeen > 60 min`; marks `left`, drops the position. UI: the players list in Menu → Game (mock-up 16) with **Remove** on stale rows.

### A4. Hider without teams

`join { hider: true }` with `teams: false`: if no player has `hider: true` (or that player is `left`), this one gets it; otherwise 409 "Someone is already the hider. If that's you on another phone, rejoin with your code." No password. `viewFor` for that player is the hider's. `newRound` clears every `hider` flag.

### A5. Phone-side plumbing

- `session.ts`: `gameRole` comes from the join response and from each state (`state.players[me].role` — add `role` to the view's own player record, or compute with the same `roleOfPlayer` in `src/lib/game/roles.ts`, shared). Drop `hiderTokens`, `claimHider`, `forgetHider`, `hiderToken()` after the fallback period; this run: keep them but stop using them for new joins. `ensureHiderMode()` runs when the role is hider.
- `JoinDialog.tsx` (mock-up 15): name; **with teams** a segmented control of teams + "New team", a password field, and one button worded for the role ("Join as Ana · hiding with Foxes" when the chosen team is the hider team, or when no team hides yet and the player ticks "We hide this round"); **without teams** two buttons "I'm a seeker" / "I'm the hider" (no password). Below: the rejoin-with-code section. `hiding` state and `claimHider` go.
- `startOfRound()`: no `unmarkJoined`; the role is recomputed from the new state. Keep clearing `chosenStation`, `pendingStation`, `pinLocked`.
- `GamePanel.tsx` `TeamLine`: joining/changing team asks the password; shows "You: … · code …"; the players list with last-seen and Remove.
- `NextHiderDialog.tsx`: `mine` by id.
- `leaveGame()` keeps the player id (it's the phone's).

## Tests to write first

Server (`server/src/app.test.ts`, `server/src/gameOps.test.ts`, new `server/src/players.test.ts`):
1. `join` twice with the same `X-Player-Id` is one player; a different id is another.
2. `rejoin` with the code moves team, hider flag and role to the new id; the old record is `left`; an op from the old id is 403 "This player continued on another phone"; a 6th wrong code in a minute is 429.
3. Teams on: making a team with a 5-char password is 400; joining with the wrong password is 403; the hider team's members are `hider` with no token; `viewFor` gives them `hider` and `deck.hand`, and no other player's code or any `passwordHash`.
4. A hider-team member's `POST /position` is 403; a seeker's is 200 and keyed by id (two positions from one id = one marker).
5. `newRound` with `nextHiderTeamId`: the roles swap without any join.
6. Teams off: the first `join { hider: true }` is the hider; a second is 409; `newRound` clears it.
7. Migration: a stored game with `members: ["Ana"]` and no `players` loads with a legacy player.
8. `DELETE /players/:pid`: organiser ok; anyone after 60 min; otherwise 403.

Unit (`tests/`): `roleOfPlayer`; `positionsShown` by id; `formatCode("K7M4PQ") === "K7M-4PQ"`.

Browser (`e2e/identity.spec.ts`, new; pattern from `e2e/location.spec.ts` and `roles.spec.ts`):
1. Ana joins; a new context with the same `localStorage` (copy it with `context.storageState()` → `browser.newContext({ storageState })`) opens the link: no join dialog, still Ana.
2. Ben's phone enters Ana's code: it becomes Ana; the first phone shows the taken-over toast.
3. Teams on, Owls hide: Ben joins Owls with the password → Hider tab, no `location-prompt`, no `/position` requests (assert with `page.on("request")`); Cleo joins Foxes → seeker; Ben's marker never appears on Cleo's map.
4. Wrong team password shows the error and keeps the dialog.

## Acceptance

- All of the above green; `npm run check` and the Playwright suite pass; no phone-project skips added.
- `docs/architecture.md` "Shared games" and "Joining" updated: players, codes, team passwords, the role rule. `agentic_docs/known-issues.md`: the identity and round-2 entries removed.

## Pitfalls

- **Don't write the game on every GET** to stamp `lastSeen`: the state is re-serialised and streamed to every phone on each `store()`. Stamp in memory and flush with the next op, or at most once a minute per player.
- `viewFor` is called per subscriber in `/events`; it now needs the viewer's id: `streamSSE` gets `playerOf(c)` once at connect.
- `hiderTokens.listen(() => {})` in `session.ts` exists so another tab's claim doesn't leak; keep the same care for `playerId` (one id per browser is correct and wanted here, two tabs are the same player).
- `positions.ts` is in memory; a restart loses it (fine, documented).
- The old `claimHider` path must keep working until every phone has reloaded once after deploy; remove it in run B or C, with a round-file note.
- Tests that create games directly on the API (`e2e/roles.spec.ts`, `tutorial.spec.ts`, `location.spec.ts`) post without a player id: the server's `legacy:<name>` fallback keeps them running; update them to send the header as you touch them.

## Out of scope (say so in the round file)

- Push subscriptions stay per role (`push.ts`); per-player push is roadmap.
- The organiser token stays as is (RunC uses it for creator codes).
