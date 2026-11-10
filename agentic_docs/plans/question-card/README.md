# The question card on phones: options

Round 40, 2026-11-10, from your comments on the radar draft's card ("the questions are still artifacts of the original design; buttons too small; some settings could be combined, toggled or cycled, like the GPS options and inside/outside"). The pictures are in `mockups/png/` (option A is the app itself; the others are drawn in `mockups/screens.html`, rendered by `render.mjs`).

## A · Sections (built tonight, in the app now)

`01-option-a-built-sections.png`, `01b-option-a-change-sheet.png`, `01c-option-a-thermometer.png`, `01d-option-a-matching.png`.

- Header: ‹, the cost badge, the title, **i**. Nothing else, so the title has room.
- The game's status and its one action (Send to the hider, Start the thermometer) right under it.
- Labelled sections with 44–48 px controls: **Distance** (chips), **Type** (the dropdown), **Asked from** (one row: the pin's colour, the coordinates, **Change ›**; Change opens Use my location, typed or pasted coordinates, Copy), and the answer as one big two-way toggle (**Inside | Outside**, **Hotter | Colder**, **Same | Different**, **Closer | Further**). In a game it's labelled "Show the map as if the answer is", playing alone "Answer".
- Hide from the map and Delete at the card's foot, with words.

Good: every card changed at once (the parts are shared: `cards/parts.tsx`, `LatLngPicker.tsx`, `cards/base.tsx`); nothing to learn. Less good: it's still a form; at half height the map is hidden behind it.

## B · The question as a sentence (`02-option-b-sentence.png`)

"Are you within **10 km ▾** of **📍 me (GPS) ▾**?" Tapping a word opens its choices (the distance chips; "me" cycles GPS → pin on the map → typed). The guess is one switch ("Shade the map as if: Yes"). Hide and Delete behind **⋯**. Send pinned at the bottom.

Good: reads like the rulebook; the fewest controls on screen. Less good: tappable words are less obvious than buttons for new players; each kind needs its own sentence (matching and measuring have many types).

## C · A summary; editing goes back to the ask screens (`03-option-c-summary.png`)

The card shows what was chosen in big text ("Within 10 km? From where you are, ±12 m"), **Edit the question ›** reopens the ask flow's screens (the same chips and tiles as when it was made), then the guess (**Yes · inside | No · outside**) and Send pinned.

Good: one place to choose things (the ask flow), so the card can't drift from it; the card is calm. Less good: a change is one tap further away.

## D · Map first (`04-option-d-peek.png`)

A short card over the map (about a third of the screen): the chips in one scrolling row, "From me · GPS ⟳" as one control that cycles GPS → pin → typed, the Inside/Outside toggle, Send. The hiding clock moves onto the map.

Good: you see what the guess does to the map while choosing (principle 3); everything in thumb reach. Less good: a small card has room for one row of chips; tentacles and matching with many types need the full height anyway.

## Ideas for any option

- `05-toggles-per-kind.png`: a segmented control (two big halves) where both words matter (Inside/Outside, Hotter/Colder); a switch where the question reads as yes/no ("Same airport as me"). And "from where" as one control with a cycle button instead of three icons.
- `06-clock-in-header.png`: the hiding clock as a pill in the sheet's header instead of the bar at the bottom of every tab (it takes about a sixth of a half sheet today); a tap opens Start, Pause and Rest.

## Since (round 41)

- Your chat answer: a distance is one button ("10 km ▾"), its choices, ×2 and Custom… in a pop-up. Built on the radar and thermometer cards (`DistancePicker`).
- Every tab is now full screen, Map in the middle of the tab bar: option D's "short card over the map" doesn't fit as drawn; its one-row ideas (the cycling "from where") still do.

## Suggested

C's structure: the card as a summary with the guess toggle and Send, **Edit** reopening the ask screens, and the clock as a pill (06). It removes the duplicated controls (the ask flow and the card both choose the distance today). (Round 40 suggested D's height too; with full-screen tabs since round 41, the map is a tap away on the tab bar instead.) A, as built with the distance pop-up, is a sound fallback if you'd rather keep editing on the card.
