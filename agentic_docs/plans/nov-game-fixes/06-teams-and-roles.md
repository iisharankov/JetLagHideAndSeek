# 6 · Round 2: a hider-team member left as a seeker

## What happened

After round 1 the teams swapped. Ivan set the hider password and became the
hider. Their teammate, in the same team, stayed a seeker: she saw the
seekers' view, and her phone kept sending her position, so the seekers saw
where the hiding team was.

## Why, in the code

Two different things decide "hider":

- **The team** is a list of names (`team.members`), and `hiderTeamId` says
  which team hides this round. It gates _who may claim_ the hider password
  (`games.claimHider` refuses other teams).
- **The role** is per phone: the phone that posted the password holds the
  hider token (`hiderTokens[gameId]`), and `roleOf()` on the server looks
  only at the token. A teammate who never typed the password is a seeker
  in every respect: `viewFor` gives her the seekers' view, the Stations tab
  rules apply, and `session.ts` sends her position because
  `gameRole === "seeker"`.

Nothing joins the two. Round 1 hid it because the only hider typed the
password; in round 2 the hider team had two phones.

Related: the join dialog's "I'm a seeker" button is the default and enabled
for a member of the hider team, so a teammate who just taps through is a
seeker without noticing.

## The fix: the role follows the team

With teams, membership in the hider team **is** the hider role.

- Server: `roleOf(c, id)` becomes `roleOf(player, state)`:
  `player.teamId === state.hiderTeamId ? "hider" : player.role` (the hider
  token path stays for games without teams and for the first claim). All
  rule checks (`assertHider`) use it, so a teammate may answer, pick the
  station, move the pin, play cards, start the end game — as they should,
  they're hiding together.
- The **password** stays the way a team claims the hider role when teams
  aren't set up front: the first member who types it makes the whole team
  the hider team (`hiderTeamId = team.id`), and the others are hiders by
  membership, no password needed. With `claimNextRound` already naming the
  next hider team, round 2 needs no password at all: everyone in that team
  is the hider when `newRound` runs.
- `viewFor(state, role)` is per player; the hider team's members all get
  the hider's view (station, pin, deck hand).
- Positions: never sent by a hider (by role, which now includes the
  teammate); the server also refuses (`403`) a position from a player
  whose role is hider — the existing check, made to use the team-aware
  role.
- The join dialog: a member of the hider team sees one button, **"I'm
  hiding with team X"**; the seeker button is hidden for them. Someone in
  the hider team who really wants to seek leaves the team first.
- The old hider's phone at `newRound`: it was the hider by token in round
  1; with the team-aware role it is a seeker the moment `hiderTeamId`
  changes, no "say who you are again" needed for the role (the dialog can
  still confirm the name once per round, or not at all with 04).

## Without teams

Games with no teams keep today's rule: one hider token, shared between the
hider's phones by typing the same password. With 04's rejoin code the
second phone can also just rejoin as the same player.

## Tests

- Server: with teams, a member of the hider team is `"hider"` without a
  token; a position from them is refused; `viewFor` gives them the hider's
  view; after `newRound` with `nextHiderTeamId`, the roles swap without any
  password; a team member who leaves the team is a seeker again.
- Browser (`e2e/roles.spec.ts`): two teams of two; round 1 Owls hide;
  Foxes claim the next round; `newRound`; both Foxes phones show the Hider
  tab at once, neither sends positions, the Owls' map shows no Fox markers,
  and one Fox picks the station while the other sees it appear.

## Note on rules

The rulebook (`quick-start-guide/creating-teams.md`, `rotating-rounds.md`)
has whole teams hide and seek; nothing there is a password or a single
"hider device", so this matches the book.
