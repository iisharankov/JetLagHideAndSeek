# Questions and your steps

Updated 2026-11-09 (round 29). Write after `> **Answer:**`. "yes" takes the suggestion. A blank means you haven't answered: it stays here and nothing is built for it. Answered items move to agentic_docs/rounds/.

**Only 5 minutes?** Q51, Q53, S1.

## Now

Nothing.

## Plans waiting on you

- [plans/nov-game-fixes/](plans/nov-game-fixes/README.md): the seven points from the 2026-11-08 game, in six sessions (A–F). Q51–Q53 below are its questions. Say "go" with the session letters you want, or "go" for A, B and E first (the ones that broke the game).

## Questions

**Q47. A public site without accounts.** Anyone with the address can make games. Two cheap gates, both or either: an invite code to create a game (one shared secret in `.env`, told to friends; joining a game by link stays open), and a cap of, say, 20 new games per day per address in nginx. (asked 2026-10-17)

*Suggested:* both, before the address goes anywhere.

> **Answer:** 

**Q48. Nightly backups.** Schedule `deploy/backup.sh` nightly (one crontab line, in docs/deployment.md)? Players won't press a download button before a disk dies. (asked 2026-10-17)

*Suggested:* yes.

> **Answer:**

**Q49. Accounts and a fee.** Accounts (name, password, reset by email, sessions) are about a round of work and a running duty (lost passwords, abuse reports, a privacy notice: Swiss and EU rules apply to a public service). Without a fee, the invite code (Q47) does the same job for friends of friends. With a fee, three things come first: the rulebook and card texts are Jet Lag: The Game's (a free fan tool is tolerated; a paid one needs their permission or their texts out); a public map must credit OpenStreetMap on the map itself; payments mean a payment service, which sees who pays. (asked 2026-10-17) See also Q53: the November plan proposes player ids and a rejoin code instead of accounts.

*Suggested:* no accounts and no fee for now; revisit if more than friends of friends turn up.

> **Answer:**

**Q50. The hider password minimum.** It is at least 4 characters, and players may pick "1234". Anyone with the game's link could then guess it (nginx allows 5 tries a second) and read the hider's station. Raising the minimum only affects passwords chosen from then on. (asked 2026-10-31) Note: with the November plan's team-based roles (06), the password is typed once per team per round, so a longer one costs less.

*Suggested:* 6 characters; 10 is safer, but it is typed on a phone at the start of every round.

> **Answer:** 6 char min is fine, make it 5 tries per min please, 5/s is too many. I don't expect players to be trying to hack each other too much, we're all playing for fun.

**Q51. The metric values.** [plans/nov-game-fixes/03-metric-conversion.md](plans/nov-game-fixes/03-metric-conversion.md) lists every imperial value in the rules with a proposed round metric value and a tick box. The ones that matter most: thermometer 1 / 5 / 15 / 80 km, hiding zones 500 m / 1 km (as the app has them), tentacles 2 / 25 km (10 km under Swiss rules), "found within 2 m", Gambler's Feet 30 m. (asked 2026-11-09)

*Suggested:* the table as written; tick the rows, or write the value you want next to any row.

> **Answer:**

**Q52. Thermometer: other questions while one is armed?** The rulebook says the seekers start a thermometer, travel, then ask; it doesn't say whether they may ask other questions in between. Allowing it keeps the game moving on a long ride; forbidding it makes the thermometer a real commitment. (asked 2026-11-09)

*Suggested:* allow it.

> **Answer:** Allow other questions

**Q53. Who you are: player id and rejoin code, or accounts?** [plans/nov-game-fixes/04-identity-and-rejoin.md](plans/nov-game-fixes/04-identity-and-rejoin.md): each phone gets a stable player id so a reload or a closed browser never asks you to join again, and a six-character code (shown in Menu → Game) moves you to another phone. No passwords during a game. Accounts (Q49) would do the same with logins and resets. (asked 2026-11-09)

*Suggested:* the player id and rejoin code.

> **Answer:** player Id is nice, i don't understand it and the code? Are they the same thing? Which do oyu need to save? Which do you need to input?

## Your steps

### Before the next deploy

- [ ] **S1. Deploy rounds 27–28 and check.** **Where:** the server, as root. Rounds 22–26 may already be deployed; `check.sh` tells.
  ```bash
  ~/jetlag/deploy/deploy.sh
  # expect: ends with the containers restarted, no "error"
  sleep 60 && ~/jetlag/deploy/check.sh
  # expect: every line PASS or OK; the API answers /api/health
  ```
  **Done:**

### After deploying

- [ ] **S2. Refresh the map data.** **Where:** the server, as root. The pack predates the `access` tag and the country codes (audit item 5). About 20–40 minutes; the app keeps working meanwhile.
  ```bash
  ~/jetlag/deploy/update-data.sh
  # expect: the last line says "Done: … of map data and … of tiles (build …)"
  ```
  **Done:**

- [ ] **S3. Review the places for Zürich canton.** **Where:** a phone or the laptop's browser, on the site. Menu → Game → Change game settings → Questions → "Review places on the map…"; reject wrong zoos, parks and museums. Takes 10 minutes.
  **Done:**

### When you have time

- [ ] **S4. Schedule the backups** (after Q48). **Where:** the server, as root. The crontab line is in [docs/deployment.md](../docs/deployment.md) under "Backups". Must run as the user that owns `deploy/data/api/`.
  ```bash
  crontab -l | grep backup.sh
  # expect: one line with backup.sh
  ```
  **Done:**
