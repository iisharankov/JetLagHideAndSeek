# Questions and your steps

Updated 2026-11-09 (round 35). Write after `> **Answer:**`. "yes" takes the suggestion. A blank means you haven't answered: it stays here and nothing is built for it. Answered items move to agentic_docs/rounds/.

**Only 5 minutes?** S1 (deploy rounds 32–35), then S7 (your admin code on your phone, a code per friend).

## Now

Nothing.

## Plans waiting on you

- [plans/nov-game-fixes/plan.md](plans/nov-game-fixes/plan.md): seven runs, A–G, with what you do after each. Runs A to D are built (rounds 32–34), run E half (round 35: the tab bar, Back, the ask flow). Say "go E" again in a new Opus session for the rest of E (the **i**, toasts, targets, the mini-tour, the tests on the phone), then F and G; `RunE.md`–`RunG.md` are the briefs. Q55 is answered; run F uses it.

## Questions

**Q48. Nightly backups.** Schedule `deploy/backup.sh` nightly (one crontab line, in docs/deployment.md)? Players won't press a download button before a disk dies. (asked 2026-10-17)

*Suggested:* yes.

> **Answer:**

**Q55. Photos from the gallery.** A game setting, "Hiders may send photos from the gallery", gives the hider two buttons, "Camera" and "Gallery". The rulebook means a photo taken when asked, so the suggestion is off by default and the organiser turns it on in setup. (asked 2026-11-09)

*Suggested:* add the setting, off by default.

> **Answer:** Looks good

## Your steps

### Before the next deploy

- [ ] **S1. Deploy runs A–D and half of E (rounds 32–35) and check.** **Where:** the server, as root, after you commit and push round 35. `ADMIN_CODE` is already in `deploy/.env` (you set it for S5); from this deploy on, games start only with a code. After it, each phone shows the join screen once (players are new); a phone that was the hider stays the hider until the next round.
  ```bash
  ~/jetlag/deploy/deploy.sh
  # expect: ends with the containers restarted, no "error"
  sleep 60 && ~/jetlag/deploy/check.sh
  # expect: every line ok; among them "ok    ADMIN_CODE is set (NN characters)" and "ok    the API knows the admin code: games need a code"
  ```
  **Done:**

### After deploying

- [ ] **S7. Your admin code on your phone, and a code per friend** (after S1). **Where:** your phone, on the site. About 5 minutes.
  1. Menu → Game → **Have a code?**: type your `ADMIN_CODE` (from your password manager), Save. Expect: "Admin code saved", and an **Admin** tab next to Settings.
  2. Menu → Admin → "Whose code": a friend's name → **New code**. Expect: a code like `JFSQ-EM3Z-TC5Q`, shown once; Copy it and send it to that friend privately. One per friend who should start games (5 games a day each); Revoke any time.
  **Done:**

- [ ] **S8. Walk one thermometer** (after S7). **Where:** outdoors, two phones, on the site. About 20 minutes. A game with you as the hider on one phone, a seeker on the other with location on.
  1. Seeker: Add Question → Add Thermometer → **1 km** → **Start the thermometer (1 km)**. Expect: the hider's phone says "Thermometer started"; the seeker's card shows "Covered, as the crow flies: 0 of 1 km" and a greyed Ask.
  2. Walk about 1 km in a straight line. Expect: the bar fills; at 1 km **Ask: hotter or colder?** lights up; tap it. Expect: the hider's phone has a new question and suggests Hotter or Colder.
  **Done:**

- [ ] **S6. Try Run A on two phones** (after S7: your phone can start games). **Where:** two phones at one table, on the site. About 5 minutes. Everyone's phone reloads the page once.
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
