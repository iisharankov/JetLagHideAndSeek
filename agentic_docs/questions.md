# Questions and your steps

Updated 2026-11-09 (round 31). Write after `> **Answer:**`. "yes" takes the suggestion. A blank means you haven't answered: it stays here and nothing is built for it. Answered items move to agentic_docs/rounds/.

**Only 5 minutes?** Q58 (my reading of your team answer), Q56 (admin codes: blank stops run C), S1.

## Now

Nothing.

## Plans waiting on you

- [plans/nov-game-fixes/plan.md](plans/nov-game-fixes/plan.md): seven runs, A–G, with what you do after each. Say "go A" (or "go A B C") in a new Opus session; `RunA.md`–`RunG.md` are the briefs. Q55, Q56 and Q58 below are what's left to settle.

## Questions

**Q48. Nightly backups.** Schedule `deploy/backup.sh` nightly (one crontab line, in docs/deployment.md)? Players won't press a download button before a disk dies. (asked 2026-10-17)

*Suggested:* yes.

> **Answer:**

**Q55. Photos from the gallery.** A game setting, "Hiders may send photos from the gallery", gives the hider two buttons, "Camera" and "Gallery". The rulebook means a photo taken when asked, so the suggestion is off by default and the organiser turns it on in setup. (asked 2026-11-09)

*Suggested:* add the setting, off by default.

> **Answer:** Looks good

**Q56. How the admin codes work.** From your Q49 answer, [plans/nov-game-fixes/08-admin-and-gates.md](plans/nov-game-fixes/08-admin-and-gates.md): one admin code in `deploy/.env` that you type once in Menu → Game; it opens an Admin section where you make named creator codes and revoke them; a friend types a creator code once and can then start games, 5 a day; everyone else only joins by link. No accounts, nothing to reset. (asked 2026-11-09)

*Suggested:* yes, build it like that (run C).

> **Answer:** I added my secret there, great, let's go

**Q58. My reading of your Q54 answer.** Correct any line. (asked 2026-11-09)
- A game setting **Teams** (on/off) in setup.
- Teams on: every team has a password, set when the team is made and typed to join it; the team that hides is the hider team; its members are hiders; there is **no separate hider password** anywhere.
- Teams off: whoever taps "I'm the hider" first is the hider, known by their phone's player id; a second phone becomes that hider only with the player code; no password.
- Team passwords: at least 6 characters, 5 wrong tries a minute (your Q50 answer, now for teams).

*Suggested:* "yes" means all four lines are right; Run A builds exactly this.

> **Answer:** yup, looks good. make it so even solo players need to make their own team in teams mode, no players outside team can join game

## Your steps

### Before the next deploy

- [ ] **S1. Deploy rounds 27–28 and check.** **Where:** the server, as root. Rounds 22–26 may already be deployed; `check.sh` tells.
  ```bash
  ~/jetlag/deploy/deploy.sh
  # expect: ends with the containers restarted, no "error"
  sleep 60 && ~/jetlag/deploy/check.sh
  # expect: every line PASS or OK; the API answers /api/health
  ```
  **Done:** Already deployed a moment ago?

### After deploying

- [ ] **S2. Refresh the map data.** **Where:** the server, as root. The pack predates the `access` tag and the country codes (known issue 5). About 20–40 minutes; the app keeps working meanwhile.
  ```bash
  ~/jetlag/deploy/update-data.sh
  # expect: the last line says "Done: … of map data and … of tiles (build …)"
  ```
  **Done:** Still updating from last time

- [ ] **S3. Review the places for Zürich canton.** **Where:** a phone or the laptop's browser, on the site. Menu → Game → Change game settings → Questions → "Review places on the map…"; reject wrong zoos, parks and museums. About 10 minutes.
  **Done:** Will do later

### Before run C is deployed

- [ ] **S5. Choose the admin code.** **Where:** the server, as root. 12 characters or more from your password manager; the agent building run C will tell you the exact line and when.
  ```bash
  nano ~/jetlag/deploy/.env    # add: ADMIN_CODE=<your code>
  # expect: no other line changed
  ```
  **Done:** Set

### When you have time

- [ ] **S4. Schedule the backups** (after Q48). **Where:** the server, as root. The crontab line is in [docs/deployment.md](../docs/deployment.md) under "Backups". Must run as the user that owns `deploy/data/api/`.
  ```bash
  crontab -l | grep backup.sh
  # expect: one line with backup.sh
  ```
  **Done:**
