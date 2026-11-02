# Tutorial revamp (plan, 31 October 2026)

> **Built in round 21** (the same day); see [plan.md](plan.md). Ivan's
> answers to section 7: Zürich canton, either deck, teams or not; a
> **Show Tutorial** offer on every first time rather than a tour that
> starts by itself; nothing left out: "zero to hero", with questions
> applied to examples in Zürich canton, and the station as the truth until
> the end game, then the pin. So the seeker and hider tours open with nine
> steps on the game itself (five with an example drawn on the map) before
> the app's steps. The tables below are the first draft; the texts as built
> are in `src/lib/tourSteps.ts`.

A brief for the agent that builds this. Ivan plays with **new people next
week** (around 7 November): they open a game link on their own phones, know
little of the game and nothing of the app. The tutorial must get them
playing in a minute, with very little text, and show the features added
since it was last written (round 6). Read `docs/agent-brief.md` first; its
rules apply (test first, never commit, no dev server, the hand-over format).

## 1. What's there now, and why it isn't enough

The tutorial is a modal walkthrough of 12 steps:

| File | What it holds |
| --- | --- |
| `src/lib/tutorial.ts` | `TUTORIAL_STEP_IDS`, the ordered step names other components react to |
| `src/components/tutorialSteps.tsx` | The steps: title, body (JSX), target selector, position; five steps embed live example question cards |
| `src/components/TutorialDialog.tsx` | The modal (Radix AlertDialog), the dimming overlay with a ring around the target, ~200 lines of hand-written positioning, arrow-key paging |
| `src/components/islands/TutorialDialog.tsx` | The island wrapper with its error boundary |
| `src/hooks/use-tutorial-step.tsx` | `useTutorialStep`: lets a component change state on given steps (the sidebar expands on "question-types") |
| `src/components/ui/sidebar-l.tsx` | Uses it: `SIDEBAR_TUTORIAL_STEPS`; on phones it keeps the sheet **closed** during the tutorial, because the modal and the sheet fight over focus and freeze |
| `src/lib/context.ts` | `showTutorial` (persisted as `showTutorials`, default true: it opens on every first visit) and `tutorialStep` |
| `src/components/OptionDrawers.tsx` | Menu → Game → "Tutorial" button reopens it |
| `src/components/CoachMark.tsx`, `src/lib/coachMark.ts` | A **non-modal** ring and note for one thing to do now; used once, by `JoinDialog.tsx`, to point a new hider at `[data-tutorial-id="hider-pick"]` |
| `e2e/tutorial.spec.ts` | Clicks through every step; asserts at most 15 steps and no page errors |

Targets that exist today: `[data-tutorial-id="menu-button"]`
(OptionDrawers), `left-sidebar-trigger` (index.astro), `add-questions-buttons`
(QuestionSidebar), `place-picker`, `place-picker-content` (PlacePicker),
`hider-pick` (HiderPanel).

Problems:

1. **Too much text.** Steps are two or three paragraphs; the welcome step
   alone is 80 words. On a phone the dialog is capped at half the screen
   and scrolls.
2. **Out of date.** It says "Radius" (the app says Radar), describes the
   lock (only when playing alone now), says station-name questions "need
   hiding zones turned on" (no longer true), and "share" a game (snapshot
   sharing is gone). It says nothing of: joining by link (name, team,
   role), drafts and "Send to the hider", the five-minute answer timer,
   answers arriving, the null answer, the Stations tab and "Found it",
   the end game, Photos, Cards (digital deck, curses on the seekers,
   powerups, Move, Veto, Randomize), the hiding clock and bonuses, pause
   and rest periods by agreement, alerts and push, the Research tab, the
   place review, the scoreboard and new rounds.
3. **One tour for everyone.** A seeker and the hider need different
   things; neither needs the other's.
4. **It can't point inside the sidebar on a phone** (the sheet stays
   closed under the modal), which is where nearly everything new lives.
5. **Embedded example cards** are full question cards with `Math.random()`
   keys, out of date with the compact cards, and the heaviest part.
6. It opens on the plain address for every first visit, but new players
   arrive through a game link, where the join dialog comes first: the two
   can stack.

## 2. The new design

**Short role tours on the non-modal coach mark, plus one-time tips at the
moment a feature first matters.**

- **Build tours on `CoachMark`, not the modal.** It dims nothing, traps no
  focus, follows its target (re-measures every 300 ms) and lets the sheet
  open, so a step can point at a tab, a button on a card or the clock bar
  on a phone. Extend it to a sequence: `Next`, `Back`, `Skip`, "3 of 7",
  and a step that can say "tap the highlighted thing to go on" (advance
  when the target is clicked or disappears). Retire the modal walkthrough
  and its positioning code once the tours replace it.
- **Three tours, chosen by role:**
  - **Seeker tour** (about 7 steps), started right after a seeker joins.
  - **Hider tour** (about 7 steps), started right after the hider claims
    the role; it absorbs today's "Pick your hiding spot" coach mark as its
    first step.
  - **Organiser tour** (about 5 steps), on the plain address for a first
    visit and from Menu → Game → Tutorial: the play area, setup, starting
    a game, the link.
  - Menu → Game → "Tutorial" becomes "Show the tour: Seeker · Hider ·
    Setting up".
- **One-time tips** (single coach marks, once per phone, never during a
  tour): shown when the thing first happens, e.g. the hider's first asked
  question, the first cards dealt, the first curse on the seekers, the end
  game starting, a Move, a rest period starting. Each is one sentence and
  points at the control to use.
- **Text budget, enforced by a unit test:** title at most 4 words, body at
  most 20 words, one sentence where possible, the action in **bold** with
  the exact label shown on screen. No paragraphs, no lists, no example
  cards. Pictures only where they replace words: the rulebook's diagrams
  in `public/rules/img/` (`seeking_radar_questions.webp` and the other six)
  may illustrate the "five question kinds" step.
- **Remember what was seen** in one persisted store (e.g.
  `tutorialsSeen: Record<string, true>`, through `src/lib/persist.ts`), so
  a tour or tip shows once per phone; "Skip" marks it seen. Keep
  `showTutorials` as the master switch (the e2e tests set it to `false`).

## 3. The tours, step by step

Wording is a draft; check every label against the UI before using it
(`grep` the component). Targets marked *new* need a `data-tutorial-id`
added; prefer existing ids and `data-testid`s where they already sit on
the right element.

### Seeker (after "I'm a seeker")

| # | Points at | Title | Body (≤ 20 words) |
| --- | --- | --- | --- |
| 1 | the map | How it works | You ask, the hider answers, the map **shades** everywhere the hider can't be. |
| 2 | `left-sidebar-trigger` / the sheet handle | Your questions | Tap **Questions** to open them; swipe the sheet up for more. |
| 3 | `add-questions-buttons` | Ask one | **Add Question**, pick the kind, drag its pin. Long-press the map works too. |
| 4 | the draft card's send button (*new*) | Send it | A draft is only yours. **Send to the hider** starts their five minutes. |
| 5 | the tab bar's Stations tab (*new*) | Stations left | Green circles are where the hider may be. Think you've found them? **Found it**. |
| 6 | the Cards tab (*new*) | Curses | Curses on you show here, with what they block. Tap **Cleared** when done. |
| 7 | `round-clock` | The clock | Hiding time. Pausing or a rest needs **both sides** to agree. |
| 8 | `menu-button` | Rules | Rules, every card and this tour are in the **Menu**. |

### Hider (after "I'm the hider")

| # | Points at | Title | Body |
| --- | --- | --- | --- |
| 1 | `hider-pick` | Your station | Tap your station; the red circle is your hiding zone. Then **Done**. |
| 2 | the Research tab (*new*), only while choosing | Test it first | Questions here are only yours: see how answers would look from a station. |
| 3 | the map | Questions arrive | You'll hear a beep. Answer within **five minutes**. |
| 4 | `answer-panel` | Answering | The app suggests the answer and shows it on the map. Tap **Send**. |
| 5 | the Cards tab (*new*) / `hand` | Your cards | Answers earn cards. Keep what you're told; play curses and powerups from here. |
| 6 | `round-clock` / `clock-bonus` | Time bonus | Your time plus the bonuses in your hand. Highest round wins. |
| 7 | `hider-panel` | Found? | Once the seekers start the end game your pin is fixed: stay put. |

Steps 3–7 can't all point at something before a question exists. Either
point at the tab and say "when a question arrives…", or move 4 and 5 to
one-time tips (first asked question, first cards dealt); decide by trying
it on the phone project.

### Organiser (first visit to the plain address; Menu → Tutorial)

| # | Points at | Title | Body |
| --- | --- | --- | --- |
| 1 | centre | Hide and Seek | A map for Jet Lag's Hide and Seek. Set up a game, then send the link. |
| 2 | `menu-button` | Set up | **Menu → Game → Start a shared game**: area, size, deck, questions. |
| 3 | setup's last screen (*new*) | Check places | **Review places on the map** drops fake zoos and duplicate parks before you play. |
| 4 | Game tab's link (*new*) | Invite | Send **the game link**. Everyone picks a name, a team and a role. |
| 5 | `menu-button` | Later | The rules, the card reference and these tours stay in the **Menu**. |

### One-time tips (examples)

| When | Who | Says |
| --- | --- | --- |
| First question waits for an answer | hider | Answer it here; the map shows what your answer rules out. |
| First cards dealt (digital deck) | hider | Tap the cards to keep, then **Keep**. |
| First curse cast | seekers | A curse is on you: read it in **Cards**. |
| End game started | both | Only one zone is left; the hider's pin is fixed. |
| Move played | seekers | The hider is moving: no questions until they continue. |
| Rest period starts | both | The clock pauses by itself until the rest ends. |
| First null answer | seekers | No such place in the play area: nothing ruled out, the hider still draws. |

## 4. Order of work (Phase 1 must ship before game night)

**Phase 1, for next week:**

1. A failing unit test for the text budget (every step and tip: title ≤ 4
   words, body ≤ 20) and for id/step sync (replace the `console.error` in
   `TutorialDialog.tsx` with a test).
2. Turn `CoachMark` into a sequence runner (`coachMark.ts` gains a tour
   store: steps, index, `next`, `back`, `skip`); keep the single-mark API
   for tips.
3. The seeker and hider tours, started from `JoinDialog.tsx` after the
   role is chosen (only if `showTutorials` and not seen); the hider tour
   replaces today's single coach mark there.
4. The organiser tour replaces the modal walkthrough; Menu → Game →
   Tutorial offers the three.
5. e2e: rewrite `e2e/tutorial.spec.ts` to click through each tour on both
   the desktop and phone projects (the phone run is the point of the
   rebuild); check that a tour doesn't block the game (the map and the
   sheet stay usable). **Make sure every existing e2e test that joins a
   game still runs**: they set `showTutorials=false` before joining; a
   tour that ignores that switch will block `e2e/sharedGame.spec.ts`.
6. Remove what the tours replace: the modal steps, the embedded example
   cards, `useTutorialStep` and `SIDEBAR_TUTORIAL_STEPS` if nothing uses
   them any more, the dead positioning code.

**Phase 2, if time allows:** the one-time tips (a `tips` table plus a
watcher on `gameState` changes; `src/lib/game/events.ts` already computes
"what changed" per role and is the natural trigger), setup screen marks,
a "Replay tips" switch in Settings.

## 5. Constraints and gotchas

- **No dev server in the checkout.** Check in the production build:
  `npm run build && npm run build:server && npx playwright test` (preview
  on port 4329). Real-phone behaviour (touch, the sheet, notifications)
  can't be verified here: say so in the hand-over.
- Copy rules (brief): short, plain English, for someone on a phone mid-
  game; use the exact on-screen labels; game rules come from the rulebook
  in the app, never invented; never mention or link lifack.ch.
- The tour must not open over the join dialog, the game setup dialog or
  the "load this game?" prompt; start it after they close.
- Coach marks sit at `z-[1038]`, under the Menu drawer (`1040`) and the
  dialogs; a step pointing into the Menu needs the Menu open or a higher
  layer.
- The sheet on phones (`ui/bottom-sheet.tsx`) snaps half or full; a step
  pointing at a tab or card must open it (`sidebarTab.set(...)`, the
  sidebar context's `setOpenMobile`) and wait for the target, which
  `CoachMark` already does (it gives up after 15 s).
- Questions are changed only via `updateQuestion` (`src/lib/context.ts`);
  the tour must never create or edit real questions. The old example
  cards rendered real card components; don't.
- Add a `docs/plan.md` round section and update `docs/architecture.md`
  (the TutorialDialog and CoachMark lines) when done.

## 6. Tidy-up for game night (not the tutorial)

Small things worth doing before new people play; check with Ivan which.

- **Commit and deploy round 20** (the audit and deploy scripts are still
  uncommitted), then `deploy/check.sh` on the server.
- **Refresh the data** (`deploy/update-data.sh`): the pack predates the
  `access` tag and the zones' country codes, so private "zoos" still count
  and the search guesses countries from names.
- **Settings → Places → Review on the map** for next week's play area,
  before the game.
- **Hider password**: four characters minimum today; new people may pick
  "1234". Consider a longer minimum (audit item 2).
- **The dead Overpass fallback** answers a data miss with "HTTP 405";
  confusing for newcomers (audit item 1). At least change the message.
- **Backups**: schedule `deploy/backup.sh` before a game whose history
  matters (Q48).

## 7. Questions to ask Ivan at the start

1. Next week's play area and size, digital or physical deck, teams or
   not? (Decides which tour steps matter most.)
2. Should the seeker and hider tours start by themselves after joining,
   or only be offered ("Show me how" / "I know")? *Recommended: offered,
   with "Show me how" as the default button.*
3. Any part of the app the new players won't use (photos, curses, rest
   periods) that the tours can leave out?
4. Which of the tidy-up items in section 6 should be done this week?
