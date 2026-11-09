# 8 · Who may make games: admin codes, creator codes, and the password limits

From the answers of 2026-11-09 to Q47, Q49 and Q50: free, no accounts; only admins make games; an admin logs in with a code from `.env`; admins can hand out codes to friends and revoke them; everyone else joins a game by its link. The hider password is at least 6 characters, and guessing is limited to 5 tries a minute.

## The design

Two kinds of code, both typed once per phone and kept in that phone's localStorage.

| Code | Where it comes from | What it unlocks | How many |
|---|---|---|---|
| **Admin code** | `ADMIN_CODE` in `deploy/.env` (you choose it; 12 characters or more) | Menu → Admin: make and revoke creator codes, see the games list with who created each, delete any game | one |
| **Creator code** | made by an admin in Menu → Admin, with a name ("Ana's code") | **Start a shared game** (today's button, hidden until a code is entered) | any number; each can be revoked, which stops new games from it but keeps the games it made |

- **Where you type it:** Menu → Game → "Have a creator code?" (one field, remembered). An admin types the admin code in the same field; the Admin section appears.
- **The cap:** 5 new games per day per creator code (your "5 games/day"), 20 for the admin code; the server counts, nginx stays as it is.
- **Joining needs nothing**: the link is enough, as now. Playing alone (no shared game) needs nothing either.
- **What the server stores:** creator codes in SQLite (`codes` table: code hash, name, created by, created at, revoked at, games made today). The admin code is never stored, only compared (constant time) with `.env`.
- **The organiser token** (Round 24) stays: the phone that made a game may delete it; an admin may delete any.

## Why this shape and not accounts

Accounts need password resets, sessions and a privacy notice. A creator code is one secret a friend types once; losing it means asking you for another, and you revoke the old one. It can't be guessed usefully (12 random characters) and the only thing it unlocks is making a game.

## The hider password limits (Q50)

- Minimum 6 characters for passwords chosen from now on (the join dialog says so).
- **5 wrong tries a minute per game**, enforced by the server (`claimHider` keeps a per-game counter in memory; the 6th try in a minute gets 429 "Too many tries, wait a minute"). nginx's limit stays as the outer wall.
- With 06's team passwords, the same limit applies to joining a team.

## Tests to write first

- Server: a game made without a code is refused (403, "Ask the organiser for a creator code"); with a valid code it works and counts; the 6th game of the day on one code is refused; a revoked code is refused for new games but its games stay; the admin code makes, lists and revokes codes; a wrong admin code is a 403 with no hint; the hider password's 6th wrong try in a minute is 429.
- Browser: Menu → Game shows no Start button until a code is typed; a friend's phone with a creator code starts a game; the admin's phone revokes it and the friend's next Start fails with the message.

## What you do

- Put `ADMIN_CODE=<12+ random characters>` in `deploy/.env` on the server before deploying this (a step in questions.md when the run lands).
- Make one creator code per friend who should start games, in Menu → Admin, and send it to them (not in the game chat if the chat is public).
