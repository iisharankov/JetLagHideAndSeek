# Run F — The remaining screens in the new shell, and photos

For the agent that executes this. Read `CLAUDE.md`, `agentic_docs/agents/notes.md`, then this file, [01-mobile-design.md](01-mobile-design.md) (mock-ups 10–16) and [07-photo-questions.md](07-photo-questions.md). Needs Run E. **Q55 (photos from the gallery, off by default) was blank on 2026-11-09**: check `questions.md`; if still blank, build the photo detail without the gallery button and say so.

## The code today

- Hider tab: `src/components/HiderPanel.tsx` (choosing view / station section / end-game section with `window.confirm` / Show all stations / Show my pin / Use my GPS / Move my pin with GPS). `startEndgame(station)` in `lib/game/endgame.ts` sends `startEndgame` at once.
- The hider's answer: `QuestionGameBar.tsx` `AnswerPanel` (choices from `answerChoices`, suggestion from `suggestedAnswers`, Send answer; Veto/Randomize buttons under `canVeto`/`canRandomize` which require the card in hand with the digital deck) inside the card below the question's own fields.
- Photos: `PhotosPanel.tsx` (the reference list + the asked requests; `PhotoButton` with `<input type="file" accept="image/*" capture="environment">` ~l.49); `Photo` shows the sent picture; randomize note faint.
- Cards: `CardsPanel.tsx` (Round 28's tiles and `HandBar`).
- Menu: `OptionDrawers.tsx` (vaul drawer); Help group with tours.
- History: `CardHistory.tsx` lists `PowerupEntry { name, playedAt, by }`.
- Server: `randomizePhoto` (`gameOps.ts` ~l.336) pushes `{ name: "Randomize Question", playedAt, by }`; `randomizeQuestion` similar.
- Timers: questions have `askedAt` and `answerTimer.ts`; photo requests have `askedAt` but no countdown in the UI; the late rule (`noteLateAnswer`) applies to `answerQuestion` — check `addPhoto` in `games.ts`: it doesn't call it (a rules gap: photos over 10/20 minutes aren't counted late).

## Changes

### F1. Hider tab as rows (mock-up 14)

`HiderPanel.tsx` after the station is set becomes rows (the `row` style of `QuestionList`): **Your station** (name, zone radius, "set for this round"); **Pin follows GPS** with an On/Off tag (the toggle); **Seekers on the map** (names and last seen from `seekerPositions`, pushes a screen with the list); **Show all stations left** (toggle); **Show my pin** (toggle); **Start the end game** as the last row, red border, subtitle "seekers in your zone, off transport · confirm, then 5 s to undo".

End game flow: tap → confirm dialog (`AlertDialog`: "Start the end game? The seekers see your zone.") → on confirm, a 5-second pinned bar "Starting the end game… **Undo**" (`HandBar`-style, amber) with a countdown; `startEndgame` is sent only when it reaches zero; Undo cancels locally, nothing sent. Unit-test the countdown helper (`src/lib/game/delayed.ts`: `schedule(fn, ms)` returning `cancel`). The existing "Started by mistake? Undo" after the fact stays (it calls `endEndgame`).

The "pin is fixed" note and the Move section stay above the rows. The choosing view (station list) is unchanged except the pinned **Done** above the tab bar.

### F2. The hider's answer screen (mock-up 11)

`QuestionGameBar.tsx` `AnswerPanel` for the hider: header has the timer as a plain pill (`answer-timer`, not the blue `tag`), the x/y badge left of the title, **i** right (`RuleInfo`); one line "Asked by Ana · just now · from your station, Wipkingen, 2.1 km away. The app suggests **Yes**."; the choices as big buttons (`h-16`, two per row; tentacle places as a list); pinned **Send answer: Yes**; under it **Veto** and **Randomize** as two separate buttons, greyed (`disabled` with the label "Veto (no card in hand)") when the card isn't available, hidden only in solo mode. Remove the `window.confirm` on veto in favour of a confirm dialog with the card's face (reuse `CardDialog`).

### F3. Photo requests (mock-up 12, point 7)

- The Photos list (seekers: asked requests; hider: the same) uses rows like questions: name, "asked by · ago", tags **Waiting**/**Sent**/**Randomized**; the row opens a detail screen on the stack: title, the `rules` text (`photoQuestions().find(q => q.name === request.name)?.rules`, rendered with `RulesText`), "Time to send: 10 minutes (medium game)" with a countdown from `askedAt` (`answerTimer.ts` with the photo limit), "You draw 1, keep 1", the randomized line "Was: Tallest building · randomized at 14:48"; for the hider the pinned buttons **Take a photo** (and **From the gallery** when `settings.galleryPhotos` — Q55), then **I cannot answer** and **Randomize** (greyed without the card); for seekers the photo, or "Waiting" and Remove.
- `settings.galleryPhotos: boolean` (default false) with a `ToggleCard` in setup screen 3 ("Hiders may send photos from the gallery"); `PhotoButton` drops `capture` when on, and a second input with `capture="environment"` keeps the camera path.
- "I cannot answer" for a photo: a new op `photoNullAnswer { id }` (hider only; sets `request.nullAnswer = true`, `answeredAt`, owes the draw as a sent photo does); the rulebook allows it. Add to `opSchema`, `types.ts`, the detail, and the seekers' row ("Can't be answered").
- History: `PowerupEntry.detail?: string`; `randomizePhoto` sets `"Photo: Tallest building → Widest street"`, `randomizeQuestion` sets `"Radar 5 km → Radar 15 km"` (use `variantLabel`); `CardHistory.tsx` shows it; `GamePopups` adds it to the card popup's note.
- Late photos: `games.ts addPhoto` calls `noteLateAnswer(state, request.askedAt, now, photoLimitMinutes(size))` when the photo answers a request (server test).

### F4. Cards and Menu in the shell

- Cards tab: no change to the hand; the `HandBar` pins above the tab bar (`bottom: tabBarHeight`); the over-limit forcing (`QuestionSidebar` effect) stays.
- Menu tab: `OptionDrawers`' content (`GamePanel`, Help, `SettingsPanel`) renders as the Menu tab's screen with a `Game / Settings / Help` segmented control (`menuTab` gains `"help"`); the gear button and the vaul drawer go on phones (keep the drawer on desktop, or move desktop to the same tab — simpler: both use the tab, delete the drawer and its vaul-remount trap). `CoachMark`'s `arrangeMenu` sets `sidebarTab = "menu"` instead of `menuOpen`.
- `GamePanel` additions from Run A (player code, players list) sit at the top of Game.

### F5. Tours and tests

- Hider tour steps re-pointed: `pick` → the choosing view, `answer` → `tab-questions`, `hand` → `tab-cards`, `start-endgame` → the end-game row (`data-testid="hider-start-endgame"` kept on the row), `alerts`/`menu` → the Menu tab's Settings/Help.
- Playwright: `e2e/roles.spec.ts` end-game flow uses the confirm dialog and waits past the 5 s (or a test hook that shortens it: `window.__endgameDelayMs` is not acceptable; instead make the delay a constant exported from `delayed.ts` and set it via `page.addInitScript` on a `localStorage` key `endgameDelayMs` read once — a documented test seam); `e2e/hand.spec.ts` unchanged; new `e2e/photos.spec.ts`: a request opens its rule text, the hider sends from the camera input (set files on the hidden input), the randomized line and the history detail show on the seeker's phone; with `galleryPhotos` on, two inputs exist.

## Acceptance

- Every e2e runs on the phone project except two-phone layouts; screenshots of 10–16 at phone size looked at.
- `docs/architecture.md` updated (Menu as a tab, photo detail, the end-game delay); `01-mobile-design.md` and the PNGs move to `agentic_docs/history/plans/nov-game-fixes-design/` with a Built note; `known-issues.md` loses the photo and layout entries.
