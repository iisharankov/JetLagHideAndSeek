# The question card on phones: options

**Round 47: Sections (A) and Sentence (B) are in the app**, to try in real games: Menu → Settings → Question card. Summary (C) was built in round 46 and removed in round 47 at your word. Both have What if as the chip on the map (picture 14, way 3), Location's pop-up (15), the thermometer, matching and after-Send cards as in 16–18, and on a phone the real map between the card's header and its controls, with ‹ List in the lower half. Q59 now asks which one stays.

Round 45, 2026-11-10, redrawn from your comments on the card in the app (round 40's option A) and on round 40's picture D. Nothing here is built yet: Q59 picks one. The pictures are in `mockups/png/`, drawn in `mockups/screens.html` and rendered by `render.mjs` (`node agentic_docs/plans/question-card/mockups/render.mjs`).

## What every picture has now

Your comments, each in every option:

- **The map on top and large, the controls at the bottom** (your "04-option-d has the idea"). The pin is on that map, and you drag it there; **⤢** opens the big map.
- **Send between Hide and Delete**, at the foot, the biggest button. "Hide from the map" is **Hide**, "Send to the hider" is **Send**.
- **×2 beside the cost** (2/1 ×2) in the header. Once a question has been sent, the header says "sent by …" instead.
- **No Draft strip**: a question is a draft until it's sent. Who made it moves under the title ("by Ana · 2 min ago").
- **Location**, not "Asked from", on the same row as **Distance**.
- **A smaller guess**, called **What if**: one 42 px row instead of a 64 px pair of buttons under its own label (picture 14 shows four ways).

## The four options, with the map on top

| | Picture | What's under the map |
|---|---|---|
| **D** | `10-d-map-on-top.png` | One row: **10 km ▾** and **Me · GPS ⟳** (⟳ switches between your GPS and the pin; a tap on the rest opens picture 15). Then **What if: Inside \| Outside**. The fewest rows with every choice on screen. |
| **A** | `11-a-sections-under-map.png` | Today's labelled sections, folded into two rows: DISTANCE and LOCATION (the coordinates, › for the choices) side by side, then WHAT IF THE ANSWER IS. The most familiar; a little taller. |
| **B** | `12-b-sentence-under-map.png` | "Are you within **10 km ▾** of **me ▾**?" Tap a word to change it; the guess answers it: **Yes \| No**. Reads like the rulebook; each kind needs its own sentence (matching and measuring have many types). |
| **C** | `13-c-summary-under-map.png` | "Within 10 km of me?" with **Edit** (which reopens the ask screens). The guess sits on the map ("What if: Inside ⟳"). The biggest map; a change is one tap further away. |

The same layout on the other kinds, and after Send (drawn as D):

- `16-d-thermometer.png`: distance and where it starts, then **Start the thermometer** where Send is. What if comes once you've travelled, as it needs the end.
- `17-d-matching.png`: the type (**Canton ▾**) where the distance is; What if: **Same \| Different**.
- `18-d-after-send.png`: distance and place fixed (dashed, with a lock), no guess on the map, **Waiting · 4:12** where Send was.
- `15-location-choices.png`: tapping Location (in any option) shows your GPS, the pin (drag it on the map), type or paste, or copy. It works like the distance's pop-up.
- `14-the-guess-smaller.png`: the guess four ways: today's buttons, one row, a chip on the map, a switch. It also has the words: **What if** (suggested), "If they say", "Shade as if", "Preview".

## Suggested

**D** (picture 10), with What if as one row. It's the one you pointed at, every choice is still a visible button for new players, and the map gets about 60% of the screen. C's chip on the map (picture 14, way 3) is the next step if you want the map even bigger. B is the nicest to read but needs a sentence for every matching and measuring type.

## Built this round (not part of the card)

- **The Questions tab:** the clock is at the top and **Ask a question** at the bottom, over the tab bar. The clock is at the top of every tab now, so it stays in one place.
- **The map:** answered and vetoed questions show no pin. Their answer stays on the map.

## Before (round 40)

`01-option-a-built-sections.png`, `01b-option-a-change-sheet.png`, `01c-option-a-thermometer.png`, `01d-option-a-matching.png` and `07-distance-popup-built.png` are the card as it is in the app (option A, rounds 40–42), for comparison. Round 40's drawings of B, C, D, the toggles and the clock pill (02–06) are replaced by 10–18; they're in git history.
