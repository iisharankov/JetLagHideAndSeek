# Run E — The phone shell and the ask flow

For the agent that executes this. Read `CLAUDE.md`, `agentic_docs/agents/notes.md`, then this file and [01-mobile-design.md](01-mobile-design.md) with the PNGs in `mockups/png/` (01–09). Binding: the owner's comments per screen are in 01's table; Q57: the x/y badge sits **left, beside the title**, the **i** on the right (the PNGs still show the badge right of the title; follow the text).

This is the biggest run; it may take two sessions. Stop at a clean checkpoint (E1+E2, then E3+E4) with everything green.

## The code today

| Piece | Where | Now |
|---|---|---|
| Page shell | `src/pages/index.astro` | `SidebarProvider` → `QuestionSidebar` + `main` with the map, `SidebarButton` (bottom centre on phones), `PlayAreaBar`, `OptionDrawers` (gear, top right, z-1036) |
| Sidebar | `src/components/ui/sidebar-l.tsx` (812 lines, shadcn) | on phones renders `BottomSheet` (`ui/bottom-sheet.tsx`: half/full, drag by handle, nothing dimmed); `SidebarContext` atom with `isMobile`, `open`, `openMobile`, `setOpen`, `setOpenMobile`, `toggleSidebar`; sets `mapBottomInset` |
| Tabs | `QuestionSidebar.tsx` ~l.274 `SegmentedControl` with `sidebarTab` store (`questions|stations|photos|curses|research`) | tab logic: hider's station first, over-limit forces Cards, Stations tab only when allowed |
| Open question | `openQuestion` store (Round 28) in `context.ts`; `QuestionList.tsx`; `cards/base.tsx` `QuestionHeading` context with Back | one level of "push" |
| Add question | `AddQuestionDialog.tsx` (a `Dialog` with six `SidebarMenuButton`s; `startPoint()`; `refusal()` per category) | creates the question at once with defaults |
| Sub-type choices | inside each card: `cards/radius.tsx` chips (`radarKm`, Custom input), `tentacles.tsx` (`locationType`, places), `matching.tsx`/`measuring.tsx` (`type` selects), photos in `PhotosPanel.tsx` (list of `photoQuestions()`) | the question exists before its type is chosen |
| ×2 | `timesAnsweredBefore` (`questionIdentity.ts`) shown in `QuestionGameBar.tsx` as "Asked before this round: it costs double" | text, not a badge |
| Draws | `DRAWS` in `lib/game/deck.ts`; shown in `cards/base.tsx` as "Hider draws 2, keeps 1" | text |
| Rules | `QuestionInfoButton.tsx` (ⓘ popover with `CATEGORIES`/`TYPES` from `lib/questionInfo.ts`) | a popover per card |
| Menu | `OptionDrawers.tsx`: a vaul `Drawer` from the right, tabs Game/Settings (`menuTab` store) | |
| Toasts | `react-toastify` `ToastContainer` in `src/layouts/Layout.astro` (`draggable closeOnClick`) | default small close icon |
| Tours | `lib/tourSteps.ts` targets `data-tutorial-id` ids: `sidebar-tabs`, `left-sidebar-trigger`, `add-questions-buttons`, `send-question`, `menu-button`, `menu-help`, `follow-me`, `alerts`, `hider-pick`… | |
| Tests | `e2e/*.spec.ts`; many `test.skip(project !== "desktop", "sidebar open on desktop")` | the phone project skips most game flows |

## Changes

### E1. The tab bar and the screen stack

- `src/components/TabBar.tsx` (new): fixed bottom bar, `env(safe-area-inset-bottom)` padding, five tabs: Map · Questions · Cards · Hider|Stations · Menu. Icons: lucide (`Map`, `MessageCircleQuestion`, `Layers`/`WalletCards`, `TrainFront`/`EyeOff`, `Menu`). Badges: waiting questions (hider), active curses, cards to pick/over limit (`deck.pending.length`, over-limit), from the same computations `QuestionSidebar` does for the tab labels (move them into `src/lib/game/tabBadges.ts`, pure, tested). The fourth tab follows the current rule for the Stations tab (`stationsTab` in `QuestionSidebar.tsx`); absent → four tabs.
- Behaviour: a tab other than Map sets `sidebarTab` and opens the sheet (`setOpenMobile(true)`); **Map** closes the sheet without touching `sidebarTab` or `openQuestion` (principle 3); tapping the current tab again scrolls its list to the top. Desktop: the same component at the top of the sidebar column (`md:` styles), replacing the `SegmentedControl`.
- `src/lib/screens.ts` (new): `screenStack` atom of `{ tab, screen: "list" | "question" | "types" | "subtype"; questionKey?; kind? }`, `push`, `back`, `reset(tab)`. `openQuestion` becomes derived from the stack's top (keep the atom name as a computed, so Round 28's uses still work). Android Back: `history.pushState({ screen }, "")` on push, `popstate` → `back()`; guard against the initial entry.
- `SidebarButton` (`index.astro`) goes on phones (the tab bar replaces it); keep it on desktop. `mapBottomInset` = sheet height + tab bar height.
- `QuestionSidebar.tsx`: the tab segmented control removed; the header (title + Reference link) stays; the body renders by `screenStack` top: list / open card / types / subtype.

### E2. The ask flow (mock-ups 03–06)

- `src/components/ask/QuestionTypes.tsx` (new): six tiles (`DRAWS` for the x/y badge, placed **left of the title**; one-line shape texts from a `KIND_LINES` table), header `‹ Ask a question` with **?** (E4). A disabled tile when `refusal(kind)` (the existing curse/rest logic from `AddQuestionDialog.tsx`, moved to `src/lib/game/askRefusal.ts` — also the server's `assertMayAsk` shares the wording; known-issue 12).
- `src/components/ask/QuestionSubtype.tsx` (new): header `‹ Radar` + x/y badge left + **i** right (`RuleInfo`, E3). Body per kind:
  - **Radar:** chips from `settings.radarKm` + **Custom…** (number input, km); ×2 corner badge on a chip when `timesAnsweredBefore` would be > 0 for that distance (compute against `gameState.questions` with a probe `{ id: "radius", data: { radius, unit: "kilometers" } }`); "Asked from" row (`recentPosition()` or the map centre, with Change → tap the map); pinned **Ask: within 10 km of me?**.
  - **Thermometer:** chips `thermometerKm` + Custom (Run D's card takes over after creation; here only the distance and the start).
  - **Matching / Measuring:** tiles per `type` from the schema unions (`matchingQuestionSchema`, `measuringQuestionSchema`, minus `settings.disabledQuestions` and `ALWAYS_OFF`), labels from `lib/questionInfo.ts` `TYPES`; ×2 corner badge.
  - **Tentacles:** two groups, "Within {tentacleKm[0]} km" (museum, library, cinema, hospital) and "Within {tentacleKm[1]} km" (zoo, aquarium, theme_park) as tiles; a kind with no places in the play area dimmed with "none in the play area" (`datasets.placesInZone` count; cache per play-area key); ×2 badge.
  - **Photo:** rows from `photoQuestions()` for the game size, each unfolding its `rules` text on tap (an accordion, one open at a time); the time limit line "The hider has 10 minutes (this is a medium game)" from `size`; ×2 from `timesPhotoAnsweredBefore`; pinned **Ask for: Tallest building** → `askPhoto`.
  - Creating happens on **Ask** only: `addQuestion` with the chosen fields, then for a game `putQuestion` + `sendQuestion` go as today through `SendQuestion` logic (reuse `sendQuestion(key)` from `session.ts`; the send-from check of Round 27 stays). After Ask, the stack goes to the question's card.
- `AddQuestionDialog.tsx` is deleted; `runAdd*` helpers move to `src/lib/game/newQuestion.ts` (pure builders taking the chosen fields and the start point) with unit tests.
- The **＋ Ask a question** pinned button on Map and Questions (`pinned` above the tab bar); on the hider's phone it's absent (the Research tab keeps its own Add).

### E3. Rules behind an "i"; toasts; targets

- `src/components/RuleInfo.tsx` (new): a round **i** button that unfolds (collapsible, not a popover) the category's one-line `app` note from `CATEGORIES`, the type's `note`, and "Full rules" → the rulebook page (`QuestionInfoButton`'s link logic). Used in `QuestionSubtype`, the open question card header (`cards/base.tsx`, replacing `QuestionInfoButton`), the hider's answer screen (Run F).
- Toasts: `Layout.astro` `ToastContainer` gets `closeButton={<ToastClose />}` — a full-height × on the right (44 px wide), `className="full-close-toast"` with CSS in `globals.css`; keep `closeOnClick`.
- Touch targets: audit buttons in the sidebar for `h-7`/`h-8` classes and raise to `h-11` (44 px) on phones (`max-md:h-11`); the icon buttons in `cards/base.tsx` (`ICON_BUTTON` is `h-7 w-7`) → 44 px on phones with labels in `title`.

### E4. The "?" mini-tour

`lib/tourSteps.ts` gains a tour `ask` (3–4 steps, each ≤ 45 words, labels in bold as the test demands): the kinds, the x/y badge, ×2, the **i**. Started by the **?** via `startTour("ask")`; `tests/tour.test.ts` budgets apply. `CoachMark` needs no new feature (targets inside the sheet are fine).

### E5. Tours and tests

- `tourSteps.ts`: `sidebar` step targets the tab bar's Questions tab (`data-tutorial-id="tab-questions"`); `ask` step → the pinned Ask button (`ask-question`); `stations`, `curses`, `photos` → `tab-stations`, `tab-cards`, `tab-photos`… (Photos moves under Ask → Photo; the seeker tour's "photos" step points at the Photo tile instead: open the types screen in that step via a new `TourStep.screen` field the `CoachMark` arranges, like `menu`).
- Playwright: remove `test.skip(… !== "desktop")` from every spec whose only reason is the sidebar; open screens through the tab bar in helpers (`e2e/helpers/phone.ts`: `openTab(page, "Questions")`, `ask(page, kind, …)`). Two-phone layouts may stay desktop-only.
- New `e2e/shell.spec.ts`: the tab bar on the phone; Map hides the sheet and Questions restores the same open question; Back on each pushed screen; Android Back (`page.goBack()`) pops one screen; the Ask flow for a radar ends on the question's card with the chosen distance; the ×2 badge appears on a distance already answered; the photo row unfolds its rule.

## Acceptance

- All e2e on the phone project except two-phone tests; `npm run check` green; screenshots of 01–06 taken with Playwright at 390×844 and looked at (dark, below the fold).
- `docs/architecture.md`: the shell section rewritten (tab bar, screen stack, ask flow); `01-mobile-design.md` moved to `agentic_docs/history/plans/` only when Run F is done.

## Pitfalls

- `SidebarContext` is a nanostores atom with `isMobile` from a media query hook; the tab bar must read the same store so desktop and phone agree.
- `mapBottomInset` drives `fitBounds` padding in several layers (`tourDemoLayer`, `askFromLayer`, the main refresh): include the tab bar height.
- `cards/base.tsx` `onPointerDown` sets `activeQuestionKey`; keep that on the open card.
- Keep `data-testid`s the existing tests use (`question-list`, `coach-mark`, `hand-bar`, `hider-panel`, …) or update the tests in the same commit.
- The hider's Research tab (before the station is set) still needs its own Add; it can use `QuestionTypes` with `research` set.
