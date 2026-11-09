# November game fixes

Inputs from the trial game in Zürich (zone 110, 8 November 2026), worked
into a plan for the next agent runs. Everything about this batch lives in
this folder: one file per point, the mobile mock-ups, and the run plan.

| File                                                   | Point                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| [plan.md](plan.md)                                     | The order of work, sessions, what "done" means for each             |
| [01-mobile-design.md](01-mobile-design.md)             | 1 · Phone-first layout; the mock-ups are in `mockups/png/`          |
| [02-thermometer.md](02-thermometer.md)                 | 2 · The thermometer as the rulebook plays it (start, travel, ask)   |
| [03-metric-conversion.md](03-metric-conversion.md)     | 3 · Every imperial value in the rules and the app, with its metric  |
| [04-identity-and-rejoin.md](04-identity-and-rejoin.md) | 4 · Losing your player when the page reloads; stale players on maps |
| [05-hider-sync-audit.md](05-hider-sync-audit.md)       | 5 · A new hider phone asked to pick a station mid-game; sync audit  |
| [06-teams-and-roles.md](06-teams-and-roles.md)         | 6 · Round 2: a hider-team member left as a seeker, position shown   |
| [07-photo-questions.md](07-photo-questions.md)         | 7 · Tap a photo request for its rules; randomize shown in history   |
| [mockups/](mockups/)                                   | `screens.html` (the source), `render.mjs` (makes the PNGs), `png/`  |

## How this was made

The points were checked against the code as it is at commit `8391484`
(Round 28) and against the rulebook in `src/content/rules/`. Where a point
reports a bug, the file names the cause in the code; where it asks for a
design, the file gives one with the alternatives considered. Nothing in
this folder changes the app: it's the brief for the runs that will.

## Regenerating the mock-ups

```
node agentic_docs/plans/nov-game-fixes/mockups/render.mjs
```

It opens `screens.html` in Playwright's Firefox (already installed for the
e2e tests) and writes one PNG per screen into `mockups/png/`.
