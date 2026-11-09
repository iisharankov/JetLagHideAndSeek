# 4 · Who you are: identity that survives a reload

## What happened

Players who dragged the sheet down, reloaded, or had the browser drop the
tab came back to the join dialog and joined again as a new player. Half a
dozen stale players and their GPS markers stayed on the maps.

## Why, in the code

There is no player identity. A player is:

- a **name**, a string in localStorage (`playerName`), sent with every
  change as `by`; the server keeps it on questions ("asked by Ana"), team
  membership (`team.members: string[]`) and positions
  (`positions.set(id, { name, … })`, keyed by name);
- a **joined flag** per game in **sessionStorage** (`joinedGames`,
  `src/lib/game/knownGames.ts`), which is per tab and gone when the tab is
  closed, the browser restarted, or iOS evicts the page. That is the "join
  again" dialog;
- for the hider, a **token** per game in localStorage (`hiderTokens`).

So a reload in the same tab is fine; a new tab or a restarted browser asks
again, and a name typed slightly differently ("Ana", "ana ", "Ana B") is a
new player for the team list and the positions map. A player who stops
sending positions stays on the map for 12 hours (`KEPT_MS` in
`server/src/positions.ts`).

## In plain words (your question of 2026-11-09)

Two things, and you only ever touch one of them:

- **The player id** is a random number your phone makes once and keeps for itself, silently. You never see it, type it or save it. It's how the server knows "this is the same phone as before", so a reload or a closed browser never asks you to join again. It is lost only if the browser's storage is wiped, or you change phones.
- **The player code** (six letters, like `K7M-4PQ`) is the only thing you might type, and only in two cases: your storage was wiped, or you continue on another phone. It's shown in Menu → Game; type it on the new phone and it becomes you (team, role, hider rights). Nothing to save: it stays visible in the Menu of any phone that is you.

So: the id does the everyday work by itself; the code is the spare key.

## Options

**A. Stable player id + rejoin code (recommended).**
Each phone makes a `playerId` once (16 random bytes, localStorage) and
sends it with every request as `X-Player-Id`. The server's game keeps a
`players` map: `{ id, name, role, teamId, lastSeen, rejoinCode }`. Joining
a game you're already in (same id) skips the dialog; the name is remembered
server-side. A six-character **rejoin code** per player (shown in Menu →
Game → "Your player code", and on the join dialog as "Already playing?
Enter your code") lets another phone, or the same phone after storage was
cleared, become that player: the server reissues the hider token if they
were the hider, moves the id's team and role, and tells the old phone it
was taken over (it becomes a spectator until it rejoins). Positions, teams
and "asked by" use the id; the name is a label.
Cost: a day. No passwords, nothing to forget during a game; the code is
only needed in the rare phone swap.

**B. Accounts (name + password).**
Solves the same thing and more (history across games) but adds password
resets, a privacy notice, and a login step at the start of every game on
every phone. Already weighed in `agentic_docs/questions.md` Q49 and set aside.

**C. Put the identity in the link.**
`?game=ID&p=PLAYERTOKEN`: whoever opens the link is that player. Simple,
but the links get forwarded ("send me the link") and two people become the
same player. Rejected.

## The design (option A)

### Server

- `GameState.players: Record<PlayerId, Player>`,
  `Player = { id, name, role: "seeker" | "hider", teamId: string | null, joinedAt, lastSeen, left?: number }`.
- Every request carries `X-Player-Id`; `playerName(body.by)` becomes
  `playerOf(c, state)`; `actor` is `{ id, name, role }`.
- `POST /games/:id/join { name, team?, hiding?, password? }` is the one
  way in: creates or updates the player, joins the team, claims the hider
  role (06 says how), returns `{ player, state, rejoinCode }`.
- `POST /games/:id/rejoin { code }`: moves that player's identity to this
  `X-Player-Id` (the server stores the mapping; the old id is marked
  `left`). Rate-limited (5 tries a minute per game) and the code has
  ~31 bits (6 chars from a 32-letter alphabet without look-alikes).
- Positions keyed by player id; `lastSeen` updated on any request; a player
  silent for 10 minutes is drawn faded and after 60 minutes dropped from
  the positions list. `DELETE /games/:id/players/:pid` by the organiser,
  or by anyone when that player has been silent for an hour ("Remove stale
  players" button in Menu → Game).
- Team members are ids; `team.members` migrates from names at load
  (existing games: a name becomes a placeholder player).

### Phone

- `playerId` persistent atom; `joinedGames` moves from sessionStorage to
  the server (you're joined if the game's `players` has your id and you
  haven't `left`). The join dialog shows only for a new player, with the
  "Already playing? Enter your code" link.
- Menu → Game shows "You: Ana · code K7M-4PQ · Share this code to move to
  another phone".
- The hider's token stays per phone, issued on join/rejoin by the server
  (see 06 for teams).

### Tests

- Server: join twice with the same id is one player; rejoin with the code
  moves role, team and hider token; the old id can't act; positions by id;
  stale players dropped at 60 min; team members migrate from names.
- Browser: Ana joins, reloads in a new tab (Playwright `context.newPage()`
  shares storage; closing the context and making a new one with the same
  localStorage simulates a restart) and is still Ana with no dialog; Ben's
  phone enters Ana's code and becomes Ana; the first phone shows "Taken
  over on another phone".

## The team password (your idea on the join mock-up, 2026-11-09)

Each team has a password, chosen by whoever creates the team; joining a team means typing it. It replaces the hider password: the team that hides this round is the hider team, and its password is what protects the hider's view. This also means a stray phone can't join the hider team by picking it from the list. Details in [06-teams-and-roles.md](06-teams-and-roles.md). Open as Q54.

## Side effects to check

- `docs/architecture.md` "Joining" section and the privacy notes (a player
  id is a random number, not personal data; say so).
- The organiser token (Round 24) can become the organiser's `playerId`
  flag; keep the header for the old games.
- Push subscriptions are per role today; they become per player.
