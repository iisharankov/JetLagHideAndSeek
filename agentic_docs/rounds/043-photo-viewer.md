# Round 43, 2026-11-10: Seekers open an answered photo straight away, and can turn it

Model: Opus 5.5. Budget: a fix.

Asked: "PHoto questions for seekers do not need this section. Once photo is answered, just they tap to show, so change "Sent" to "Show" and let it be shown. Also maybe option to rotate it if it's landscape so phone shows it fully? Depends on photo so a 90deg rotate would be nice" (with a screenshot of a seeker's answered photo question: the rule, the time to send and the draw above the photo)

Read as: for seekers, an answered photo question's row says Show and opens the photo itself, full screen, with a 90° turn; the detail screen (rule, time, draw) stays for questions still waiting, and for the hider.

Answers used: none.

Did:
- **Show:** a seeker's answered photo question says **Show** (green) in the list; a tap opens the photo itself, not the question's screen (`PhotoRows` in `game/PhotoRequests.tsx`). The hider's row still says Sent and opens the screen; a question still waiting opens its screen for everyone (the rule, the time, Remove).
- **The photo over the whole screen** (`PhotoViewer`): black, the photo fitted, **↻ Turn** a quarter at a time (a landscape photo fills a phone held upright), × or Escape to close. A photo on a question's screen, and the "Other photos", open it too (they opened a new tab).
- **Tests:** `e2e/photos.spec.ts`: the row says Show, opens the photo, it turns (90°), closes back to the list; seen failing first. `e2e/sharedGame.spec.ts` follows the new Show.

Changed from the ask: nothing.

Found on the way: nothing.

Checked: lint and types clean; vitest 523 passed (73 files); build and build:server; Playwright, full run 88 passed, 8 skipped, 2 failed (the shared-game test on both projects expected Ana's answered photo to open its screen; it opens the photo now: the test updated), that spec rerun 14 passed. Screenshots looked at, phone: the list with Show, a landscape photo in the viewer, then turned (it fills the phone held upright). Test-first. Not checked: a real phone, a real camera photo.
No root-run file changed.
Decisions: decisions.md, round 43. Questions added: none.
Commit message: Round 43: seekers open an answered photo straight away (Show), full screen, with a quarter turn
