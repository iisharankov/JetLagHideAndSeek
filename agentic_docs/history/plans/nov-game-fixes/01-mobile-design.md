# 1 · Phone-first

The game is played on phones; the desktop is for planning. The current layout is a desktop sidebar squeezed into a bottom sheet: controls are small, the sheet is moved by swiping (which nobody discovered), and there's no Back. This is the layout to build towards. The pictures are in `mockups/png/` (made from `mockups/screens.html`; `render.mjs` regenerates them). Revised 2026-11-09 from the owner's comments on each picture.

## Principles

1. **A bottom tab bar, always visible**: Map · Questions · Cards · Hider (or Stations for seekers, when the game allows) · Menu. One tap reaches anything; a badge shows what waits.
2. **Back, not swipe.** Every pushed screen has ‹ at its top-left (44 px). The sheet can still be dragged by its handle, but nothing needs it.
3. **The map stays reachable.** Tapping **Map** in the tab bar hides the sheet and shows the whole map; tapping **Questions** again comes back to exactly where you were (the same list scroll, the same open question). This is how you check what an answer did to the map when the sheet fills the screen.
4. **One primary action per screen, pinned at the bottom** above the tab bar. Secondary actions sit under it as separate buttons; an action you can't take right now (Veto without the card, Randomize without the card) is shown greyed with the reason in its label, not hidden.
5. **Rules text is behind an "i".** Every question screen has a round **i** at its top right that unfolds the one-line rule and the "Full rules" link; the screen itself shows only what's needed to act. The draw shows as a small **x/y** badge (draw x, keep y) at the top right of every question tile and question screen, uniform everywhere; the numbers are the rulebook's per kind (radar 2/1, thermometer 2/1, matching 3/1, measuring 3/1, tentacles 4/2, photo 1/1).
6. **×2 is a corner badge** on the tile or chip of anything asked before this round (same place everywhere: top-left of a tile, top-right of a chip).
7. **Touch targets 44 px or more**, 16 px text at least, rows 56 px. **Notifications** (toasts) have a full-height × on their right edge to close them.
8. **Custom is always an option** for distances: radar and thermometer chips end with **Custom…**, which takes any number.
9. **The hider and the seekers get different tab bars**: Hider on the hiding team's phones, Stations on the seekers' (only when the game shows them).
10. **Dangerous actions confirm and then allow 5 s to undo**: Start the end game (it reveals the hider's station and zone) asks "Start the end game?" and, once confirmed, shows "Started · Undo" for five seconds before the seekers are told.

## The screens

| PNG | Screen | Your comment, and what changed |
|---|---|---|
| `01-map-home` | Map with clock, gear, tab bar, pinned **＋ Ask a question**, centre-on-me | "green and blue zones": they're the basemap's forests and lakes under the play-area shading; a general idea, kept |
| `02-questions-list` | Half sheet, one row per question with state tag | "promising"; principle 3 (Map tab hides the sheet, Questions returns to where you were) added |
| `03-question-types` | Six tiles, each with its icon, one-line shape and the **x/y** badge top-right; a **?** top-right opens a 3–4 step mini-tour of this screen (what the kinds are, the badge, ×2) | subtitle and the ×2 banner removed; badges uniform |
| `04-radar-subtypes` | Chips for this game size, **Custom…**, ×2 on a chip asked before, "asked from", pinned Ask | "perfect"; Custom kept |
| `05-tentacles-subtypes` | Place kinds as tiles in two groups (2 km, 10 km), ×2 corner badge; a kind with nothing in the play area is dimmed with "none in the play area" | counts removed; tiles like 03 |
| `06-photo-subtypes` | Rows; tapping one unfolds its exact requirement; ×2 corner badge; the time limit says this game's size | time dynamic per size; dropdown on tap |
| `07-thermometer-arm` | Start = here, chips + **Custom…**, **i** for the rule, pinned Start | info behind **i**; Custom |
| `08-thermometer-travel`, `09-thermometer-ask` | unchanged | "Perfect" |
| `10-hider-thermometer-armed` | Toast with a full-height × | principle 7 |
| `11-hider-answer` | Timer as a plain pill (not blue), **i** for the rule, two big answer buttons, pinned Send; **Veto** and **Randomize** as separate buttons, greyed with "(no card)" when the card isn't in hand | as asked |
| `12-photo-request-detail` | Rule text, randomized badge with "was X", timer pill, **i**; **Take a photo** / **From the gallery** side by side when the game allows gallery photos (a setup option, Q55; camera only otherwise); **I cannot answer** and **Randomize** separate | as asked |
| `13-cards-over-limit` | Hand, Select, pinned bar | "clearer"; judge in the real thing |
| `14-hider-tab` | Rows: station, pin follows GPS, seekers on the map, **Start the end game** as the last row (not a pinned banner) with "confirm, then 5 s to undo" | principle 10 |
| `15-join-identity` | Name, team segmented control, **team password**, one join button worded for the role, "rejoin with the code" | team password (Q54); id vs code explained in 04 |
| `16-menu-player` | You, your player code, players with last-seen and Remove | "play with it once live" |

(The former `17-navigation-map` is dropped; the map of screens is the table above.)

## What changes in the code (for the shell and ask-flow runs)

- **Shell.** `src/pages/index.astro` and `QuestionSidebar.tsx`: on phones the `Sidebar` becomes a `BottomSheet` per tab plus a fixed `TabBar` (`src/components/TabBar.tsx`, new). The tab bar replaces the `SegmentedControl` of tabs on phones; on desktop the same screens render in the sidebar column with the tab bar at its top. `sidebarTab` stays the store; `mapBottomInset` follows the sheet. The Map tab sets the sheet closed without clearing the other tabs' state (principle 3).
- **Back.** A `screenStack` store (`src/lib/screens.ts`, new): `push(screen)`, `back()`. Round 28's `openQuestion` becomes the first entry; the type picker and sub-type sheets are entries too. Android's hardware Back is wired to `back()` through `history.pushState`.
- **Ask flow.** `AddQuestionDialog.tsx` becomes two screens: `QuestionTypes.tsx` and `QuestionSubtype.tsx` (one component with a per-kind body: radar chips, thermometer chips, matching/measuring place tiles, tentacle tiles, photo rows with the unfolding requirement). The sub-type screen creates the question only on **Ask**. `timesAnsweredBefore` drives the ×2 badge. `DRAWS` drives the x/y badge. A `RuleInfo` component is the **i**.
- **Mini-tour.** The **?** on the type picker runs a 3–4 step tour (`tourSteps.ts` gains `ask`): the kinds, the x/y badge, ×2, the **i**.
- **Cards, Hider, Menu, tours, tests** as before: three tiles a row, rows with the end-game row last and its confirm-then-undo, the Menu as a tab, tour targets moved, phone project first in Playwright.
- **Toasts:** `react-toastify`'s close button replaced by a full-height × (`closeButton` option).

## Not in the pictures, but part of the work

- Haptics on Send/Ask where the browser allows (`navigator.vibrate`, already used for alerts).
- Large text: the layout must survive the phone's "larger text" setting (test at 120 %).
- Safe areas: `env(safe-area-inset-bottom)` under the tab bar.
- The install prompt ("Add to Home Screen") in Menu → Help stays.
