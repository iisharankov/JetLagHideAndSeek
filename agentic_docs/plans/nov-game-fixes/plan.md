# The run plan

For an Opus-only run, in sessions a context window can hold. Each session
ends with the full check (`npm run check`, then `npm run build`,
`npm run build:server`, `npx playwright test`) and a round entry in
`agentic_docs/rounds/`, as always; the owner commits.

## Order, and why

The identity and sync bugs (points 4, 5, 6) broke the trial game and will
break the next one, so they come first; the phone-first redesign (1) is the
biggest piece and reshapes what the thermometer (2) and photo (7) screens
look like, so it comes before them; metric (3) is independent and mostly
text, so it slots in wherever a session has room.

| Session | Points | What it delivers                                                                                                                |
| ------- | ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| A       | 4, 6   | A player identity that survives reloads and phone changes; roles that follow the team; no stale players; positions by player id |
| B       | 5      | The hider's phones in step: a joining hider sees the picked station, no "pick a station" over a running game; the sync audit    |
| C       | 1 (i)  | The phone shell: bottom tab bar with Back, the question-type picker and sub-type sheets, bigger touch targets                   |
| D       | 1 (ii) | The remaining screens in the new shell: cards, hider, photos, menu; the seeker and hider tours updated to the new layout        |
| E       | 2      | The thermometer as the rulebook plays it: armed at your position, travel the set distance, then ask                             |
| F       | 3, 7   | Metric everywhere (rules pages, app texts, settings), the conversion doc confirmed; photo request detail and randomize history  |

Sessions A and B can merge if the context allows: both are in
`server/src/gameOps.ts`, `server/src/games.ts` and `src/lib/game/session.ts`.

## What "done" means

### Session A — identity (04, 06)

- A player is a stable id (`playerId`, made once per phone and kept in
  localStorage) with a name; the server stores both. A reload, a closed
  browser, or a new tab rejoins the same player without asking.
- A **rejoin code** (six characters, shown in Menu → Game and on the join
  screen) moves the player to another phone or restores them after cleared
  storage. Entering it joins as that player; the old phone is told it was
  taken over.
- Positions and team membership are keyed by `playerId`, not by name; a
  renamed player keeps their marker and team. A player who hasn't been heard
  from for 10 minutes leaves the map; a player can be removed from the game
  by the organiser or by anyone after an hour of silence.
- With teams, the role comes from the team: everyone in the hider team is a
  hider (sees the Hider tab, sends no position, gets the hider's view);
  everyone else is a seeker. The hider password becomes the team's way to
  claim the hider role, entered once per team per round, and the token is
  handed to each teammate's phone through the game (encrypted to a key the
  teammate sends when joining — or, simpler and acceptable for friends: the
  server marks the team's players as hiders by id, no token needed for
  them). The file argues for the simple version.
- Browser tests: reload mid-game keeps the player; a second phone with the
  rejoin code takes over; a hider-team member joining after the password
  was set is a hider at once and sends no position.

### Session B — hider sync (05)

- A phone becoming the hider in a game whose hider has a station does not
  enter "choosing": it sees the station and the Hider tab's normal view, no
  coach mark, no `hiderReady` is sent, no notification goes out.
- `hiderReady` is refused by the server when a station is already set and
  the round is going (unless a Move is in progress).
- The audit in the file is worked through: each line of hider state has one
  source of truth and a test for the "second phone joins late" path.

### Sessions C and D — phone-first (01)

- Everything reachable from a bottom tab bar of five: **Map · Questions ·
  Cards · Hider/Stations · Menu**; every pushed screen has a **Back** in
  its top-left; nothing requires a swipe.
- Questions: the list, then a type picker (icons), then the sub-type sheet
  with its distances or places, a one-line rule summary and "ⓘ Full rules",
  and the double-cost badge on anything asked before; photo questions are
  a type in the same picker.
- Touch targets at least 44 px; one primary action per screen, pinned at
  the bottom; the map keeps at least 40 % of the screen while a sheet is
  half open.
- Desktop keeps working (the sidebar is the same screens in a column).
- The tours point at the new places.

### Session E — thermometer (02)

- A thermometer is **armed** at the seekers' position with a set distance;
  the hider is told "a thermometer is on, from here"; nothing is asked yet.
- While travelling, the card shows the distance covered as the crow flies
  and when it passes the set distance the **Ask** button lights up; asking
  sends the end point and the hider answers hotter or colder from the
  station; the map applies the half-plane as now.
- An armed thermometer that is cancelled costs nothing; the distances per
  game size are the rulebook's (metric per 03).

### Session F — metric and photos (03, 07)

- Every value in `03-metric-conversion.md` confirmed by the owner is applied
  to the rules pages and the app; the unit toggle and imperial code paths
  are removed; the converted doc lists the final values.
- A photo request opens its full rules on tap (the same text as the Photos
  reference); a randomized photo question shows "was X" on its card and in
  Cards → History.

## Before the next game night

Sessions A, B and E at least, deployed and played through once by two
phones on the same table (one reload each, one phone swap) before anyone
leaves the house.
