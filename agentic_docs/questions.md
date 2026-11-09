# Questions and your steps

Updated 2026-11-09 (round 32). Write after `> **Answer:**`. "yes" takes the suggestion. A blank means you haven't answered: it stays here and nothing is built for it. Answered items move to agentic_docs/rounds/.

**Only 5 minutes?** S1 (deploy, now with Run A), then S6 (two phones, five minutes).

## Now

Nothing.

## Plans waiting on you

- [plans/nov-game-fixes/plan.md](plans/nov-game-fixes/plan.md): seven runs, A–G, with what you do after each. Run A is built (round 32). Say "go B" (or "go B C") in a new Opus session; `RunB.md`–`RunG.md` are the briefs. Q55 and Q56 are answered; runs F and C use them.

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

## Your steps

### Before the next deploy

- [ ] **S1. Deploy Run A (round 32) and check.** **Where:** the server, as root, after you commit and push round 32. If you deployed after round 28, this adds Run A; if not, it brings 27, 28 and Run A at once. After it, each phone shows the join screen once (players are new); a phone that was the hider stays the hider until the next round.
  ```bash
  ~/jetlag/deploy/deploy.sh
  # expect: ends with the containers restarted, no "error"
  sleep 60 && ~/jetlag/deploy/check.sh
  # expect: every line PASS or OK; the API answers /api/health
  ```
  **Done:**

### After deploying

- [ ] **S6. Try Run A on two phones** (after S1). **Where:** two phones at one table, on the site. About 5 minutes. Everyone's phone reloads the page once.
  1. Phone 1: Menu → Game → Start a shared game; on the first screen turn **Teams** on; start. Make team "Owls" with a password, tick "We hide this round", join.
  2. Phone 2: open the link, tap Owls, type the password, join. Expect: the Hider tab, no "Location off" prompt.
  3. Phone 2: close the browser completely, open the link again. Expect: no join screen, still in Owls.
  4. Phone 2: Menu → Game, note the code (like `K7M-4PQ`). On a third browser (or a private window on phone 1), open the link and use "Rejoin with the code". Expect: that browser is phone 2's player; phone 2 shows "You continued on another phone".
  **Done:**

- [ ] **S2. Refresh the map data.** **Where:** the server, as root. The pack predates the `access` tag and the country codes (known issue 5). About 20–40 minutes; the app keeps working meanwhile.
  ```bash
  ~/jetlag/deploy/update-data.sh
  # expect: the last line says "Done: … of map data and … of tiles (build …)"
  ```
  **Done:** Still updating from last time

- [ ] **S3. Review the places for Zürich canton.** **Where:** a phone or the laptop's browser, on the site. Menu → Game → Change game settings → Questions → "Review places on the map…"; reject wrong zoos, parks and museums. About 10 minutes.
  **Done:** Will do later

### When you have time

- [ ] **S4. Schedule the backups** (after Q48). **Where:** the server, as root. The crontab line is in [docs/deployment.md](../docs/deployment.md) under "Backups". Must run as the user that owns `deploy/data/api/`.
  ```bash
  crontab -l | grep backup.sh
  # expect: one line with backup.sh
  ```
  **Done:**
