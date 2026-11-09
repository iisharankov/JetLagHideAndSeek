# 1 · Phone-first

The game is played on phones; the desktop is for planning. The current
layout is a desktop sidebar squeezed into a bottom sheet: controls are
small, the sheet is moved by swiping (which nobody discovered), and there's
no Back. This is the layout to build towards. The pictures are in
`mockups/png/` (made from `mockups/screens.html`; `render.mjs` regenerates
them).

## Principles

1. **A bottom tab bar, always visible**: Map · Questions · Cards ·
   Hider (or Stations for seekers, when the game allows) · Menu. One tap
   reaches anything; a badge shows what waits (a question to answer, cards
   to pick).
2. **Back, not swipe.** Every pushed screen has ‹ at its top-left (44 px).
   The sheet can still be dragged by its handle, but nothing needs it: a
   half sheet shows the list, a row pushes a full screen, Back returns.
3. **One primary action per screen, pinned at the bottom** above the tab
   bar: Ask, Send answer, Start the thermometer, Discard 2 selected, Start
   the end game. It is never below the fold.
4. **Touch targets 44 px or more**, 16 px text at least, chips and rows
   56 px tall. No icon-only buttons without a label except the three that
   are standard (Back, Menu gear, Centre on me).
5. **The map keeps at least 40 % of the screen** while a list is open; a
   question's full screen may cover it, with Back one tap away.
6. **The hider and the seekers get different tab bars**, not different
   content behind the same tabs: the fourth tab is Hider on the hiding
   team's phones and Stations on the seekers' (only when the game shows
   them; otherwise the tab is absent and the bar has four).

## The screens

| PNG                          | Screen                                                                                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01-map-home`                | Map with the clock, the gear, the tab bar, **＋ Ask a question** pinned, centre-on-me. Pins labelled "Q1 · Radar 5 km".                                                      |
| `02-questions-list`          | Half sheet, one row per question: number · kind · distance, pin colour, state tag (Yes/No answer, Travelling, Waiting).                                                      |
| `03-question-types`          | Full screen from ＋: six tiles with an icon, the question's shape in one line and the draw ("2 / 1"); photo is one of them.                                                  |
| `04-radar-subtypes`          | Radar: one-line rule, ⓘ Rules, distance chips for this game size, **×2** on a distance asked before (with which question), where it's asked from, pinned Ask.                |
| `05-tentacles-subtypes`      | Tentacles: the two reaches (2 km, 10 km Swiss) as sections, each place kind a row with how many are in reach or "none in the play area", ×2 badges.                          |
| `06-photo-subtypes`          | Photo as a question kind: rows with the name and a one-line hint, ×2 badge, pinned Ask for.                                                                                  |
| `07-thermometer-arm`         | Thermometer, step 1: start = here, distance chips, pinned **Start the thermometer (5 km)**. See `02-thermometer.md`.                                                         |
| `08-thermometer-travel`      | Step 2: dashed ring of the set distance around the start, a line to you, "2.3 of 5 km" with a bar, Ask greyed with the remainder, Cancel (no cost).                          |
| `09-thermometer-ask`         | Step 3: outside the ring, **Ask: hotter or colder?** lights up; the end is where you are.                                                                                    |
| `10-hider-thermometer-armed` | The hider's phone: toast "Thermometer started… nothing to answer yet", the seekers' start pin, the row says "Started · travelling".                                          |
| `11-hider-answer`            | A question on the hider's phone: the question in words, from which station and how far, the suggestion, two big answer buttons, pinned Send answer, Veto · Randomize second. |
| `12-photo-request-detail`    | A photo request opened: the **full rule text**, the time limit, the draw, Randomized badge with "was X at 14:48", pinned Take and send. See `07-photo-questions.md`.         |
| `13-cards-over-limit`        | The hand, three a row, Select on each, the bar pinned: "Too many cards… Select 2", **Discard 2 selected** (Round 28's bar, kept).                                            |
| `14-hider-tab`               | Hider tab: station row, pin follows GPS (On), seekers on the map with last seen, pinned **Start the end game** with its condition.                                           |
| `15-join-identity`           | Joining: name, team segmented control, a note that the hider team hides, **one** join button worded for the role, and "Rejoin with the code". See `04`, `06`.                |
| `16-menu-player`             | Menu → Game: you, your player code (share it), the players with last seen and Remove on a stale one, share link.                                                             |
| `17-navigation-map`          | The whole map of screens in one page.                                                                                                                                        |

## What changes in the code (for sessions C and D)

- **Shell.** `src/pages/index.astro` and `QuestionSidebar.tsx`: on phones
  the `Sidebar` becomes a `BottomSheet` per tab plus a fixed `TabBar`
  (`src/components/TabBar.tsx`, new). The sidebar's `SegmentedControl` of
  tabs goes on phones (the tab bar replaces it); on desktop the same
  screens render in the sidebar column with the tab bar at its top.
  `sidebarTab` stays the store; `mapBottomInset` follows the sheet.
- **Back.** A `screenStack` store (`src/lib/screens.ts`, new): `push(screen)`,
  `back()`. The Round 28 `openQuestion` becomes the first entry; the type
  picker and sub-type sheets are entries too. Android's hardware Back is
  wired to `back()` through `history.pushState` (one entry per push).
- **Ask flow.** `AddQuestionDialog.tsx` (a modal with six buttons) becomes
  two screens: `QuestionTypes.tsx` and `QuestionSubtype.tsx` (one component
  with a per-kind body: radar chips, thermometer chips, matching/measuring
  place rows, tentacle reaches, photo rows). The sub-type screen creates
  the question only on **Ask**, so abandoned picks leave no draft behind.
  `timesAnsweredBefore` (`lib/game/questionIdentity.ts`) drives the ×2
  badge: it already knows "asked as" per kind and distance.
- **Cards.** `CardsPanel.tsx`: three tiles a row on phones (done), the bar
  pinned above the tab bar.
- **Hider / Stations.** `HiderPanel.tsx` into rows; the end-game button
  pinned. `StationsPanel.tsx` likewise.
- **Menu.** The drawer becomes the Menu tab (same content), with a
  Game / Settings / Help segmented control.
- **Tours.** `tourSteps.ts` targets move to the new ids; the sidebar steps
  become tab-bar steps.
- **Tests.** The phone project in Playwright is the one that matters now:
  every e2e that is desktop-only because "the sidebar is open" should be
  made to run on the phone with the tab bar; aim for no phone skips except
  genuinely two-phone layouts.

## Not in the pictures, but part of the work

- Haptics on Send/Ask where the browser allows (`navigator.vibrate`,
  already used for alerts).
- Large text: the layout must survive the phone's "larger text" setting
  (test at 120 %).
- Safe areas: `env(safe-area-inset-bottom)` under the tab bar.
- The install prompt ("Add to Home Screen") in Menu → Help stays.
