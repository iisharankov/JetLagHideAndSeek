# Questions and your steps

Updated 2026-11-10 (round 46). Write after `> **Answer:**`. "yes" takes the suggestion. A blank means you haven't answered: it stays here and nothing is built for it. Answered items move to agentic_docs/rounds/.

**Only 5 minutes?** S1 (deploy rounds 32–46), then try the three cards (Q59) and S7 (your admin code on your phone).

## Now

Nothing.

## Plans waiting on you

- [plans/question-card/README.md](plans/question-card/README.md): the question card on phones; A, B and C are built (round 46), switched in Settings. Q59 picks the one that stays. (The November plan, runs A–G, is built and in `history/plans/nov-game-fixes/`.)

## Questions

**Q59. The question card: which layout stays?** Round 46 built all three you picked, to try over a few days: Menu → Settings → Question card: **Sections** (A, picture 11), **Sentence** (B, 12, one line on a phone), **Summary** (C, 13; Edit shows the Sections rows under it until Done). All have What if as the chip on the map, Location's pop-up, Send between Hide and Delete, and the map between the card's header and its controls. Once you've played with them: which one stays (the others go, and so does the setting)? (asked 2026-11-10, built in round 46)

*Suggested:* decide after a real game; no default to suggest yet.

> **Answer:**

**Q60. Two greys on the map.** Round 42 tried your idea: outside the play area plain grey, what the answers ruled out inside it grey stripes at 45° (one pattern for all answers; a pattern per question would need each answer's own cut, more work). Keep the stripes, go back to one grey, or a pattern per question? (asked 2026-11-10)

*Suggested:* keep the stripes as they are; a pattern per question only if two answers' cuts are hard to tell apart in a real game.

> **Answer:**

**Q48. Nightly backups.** Schedule `deploy/backup.sh` nightly (one crontab line, in docs/deployment.md)? Players won't press a download button before a disk dies. (asked 2026-10-17)

*Suggested:* yes.

> **Answer:**

## Your steps

### Before the next deploy

- [ ] **S1. Deploy rounds 32–46 and check.** **Where:** the server, as root, after you commit and push round 46. `ADMIN_CODE` is already in `deploy/.env` (you set it for S5); from this deploy on, games start only with a code. After it, each phone shows the join screen once (players are new); a phone that was the hider stays the hider until the next round.
  ```bash
  ~/jetlag/deploy/deploy.sh
  # expect: ends with the containers restarted, no "error"
  sleep 60 && ~/jetlag/deploy/check.sh
  # expect: every line ok; among them "ok    ADMIN_CODE is set (NN characters)" and "ok    the API knows the admin code: games need a code"
  # Round 44: photos go whole, up to 15 MB; nginx's limit was 7m.
  grep -rn client_max_body_size /etc/nginx/sites-available/
  # expect: the jetlag site's line says 7m (the /api/ block); then:
  sudo sed -i 's/client_max_body_size 7m;/client_max_body_size 17m;/' /etc/nginx/sites-available/<the jetlag file from the grep>
  sudo nginx -t && sudo systemctl reload nginx
  # expect: "syntax is ok", "test is successful", no output from reload
  ```
  Until nginx says 17m, photos over about 7 MB go as a smaller copy (the hider sees "made smaller").
  **Done:**

### After deploying

- [ ] **S7. Your admin code on your phone, and a code per friend** (after S1). **Where:** your phone, on the site. About 5 minutes.
  1. Menu → Game → **Have a code?**: type your `ADMIN_CODE` (from your password manager), Save. Expect: "Admin code saved", and an **Admin** tab next to Settings.
  2. Menu → Admin → "Whose code": a friend's name → **New code**. Expect: a code like `JFSQ-EM3Z-TC5Q`, shown once; Copy it and send it to that friend privately. One per friend who should start games (5 games a day each); Revoke any time.
  **Done:**

- [ ] **S8. Walk one thermometer** (after S7). **Where:** outdoors, two phones, on the site. About 20 minutes. A game with you as the hider on one phone, a seeker on the other with location on.
  1. Seeker: **Ask a question** → Thermometer → **1 km** → **Start the thermometer (1 km)**. Expect: the hider's phone says "Thermometer started"; the seeker's card shows "Covered, as the crow flies: 0 of 1 km" and a greyed Ask.
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
