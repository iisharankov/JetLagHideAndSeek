# Round 48, 2026-11-11: A thermometer's pins both purple; the Questions tab's ⚙; drafts on the map fixed

Model: Opus 5.5. Budget: a fix.

Asked: "make the second pin for thermometer purple too, you can make the main pin darker maybe. Maybe a faint dashed line between those two pins to show they're connected? Might help when on another question / Also maybe a few settings could be in the quesitons tab as small buttons at the top that relate to questions. I'm thinking an optoin for "show all active pins" and "show only current question pin". But shorter and more compact, so maybe a "Pins: All/Active" or something. Question type could be here too. Maybe just a gear though that makes a popup? / Does "Seekers' drafts on the map" work? I'm confused as i see no differences."

Read as: both thermometer pins purple (the start darker) with a faint dashed line between them; a ⚙ at the top of Questions with a small pop-up: Pins All / Active, the card's layout, and the drafts setting; find out why the drafts setting shows nothing.

Answers used: none.

Did:
- **The drafts setting didn't work: fixed.** The map redraws only when what its refresh lists changes (questions, answers, the play area…); neither the setting nor the active card was in that list, so switching it showed nothing until something else redrew the map, and "only the open card" didn't follow the card you opened. Now both are (`draftsKey` in `lib/game/drafts.ts`, `Map.tsx`).
- **Questions → ⚙** (`QuestionOptions.tsx`): a small button next to Reference opens a pop-up with **Pins** (All / Active: only the question you last opened or tapped; `pinsOnMap`, `pinShown`, `DraggableMarkers.tsx`), **Drafts** (All / Active, the others outlined) and **Card** (Sections / Sentence), one short line each. Menu → Settings → Questions shows the same three.
- **A thermometer's pins** (`THERMOMETER_PINS` in `maps/questionColors.ts`, `pinIcon` in `maps/markerIcon.ts`): the end purple, the start a darker purple, a faint dashed purple line between them (`thermometer-link`); the card's Location buttons purple too. Round 47's gold end is gone.
- **Tests, seen failing first:** `tests/drafts.test.ts` (`draftsKey`, `pinShown`), `e2e/questionOptions.spec.ts` (the ⚙'s three groups; Drafts: Active outlines both drafts at once, then shades the opened one only; Pins: Active shows one pin, All two; a thermometer's two pin colours and its dashed line). The drafts part checked against the old map: it fails without the fix (0 outlined where 2 are expected). Updated: `e2e/menu.spec.ts` ("no Options button" is now exact: "Question options" matched it).

Changed from the ask: nothing. The drafts setting is kept, now working, beside Pins.

Found on the way: the drafts setting's bug (above).

Checked: lint and types clean; vitest 564 passed (77 files); build and build:server; Playwright full run 104 passed, 8 skipped. Screenshots looked at: the ⚙ pop-up (phone and desktop), a draft thermometer's pins and line (phone). Test-first. Not checked: on a real phone.
Root-run files changed: none. Also flagged: none.
Decisions: decisions.md, round 48. Steps changed: S1 (rounds 32–48). Questions added: none.
Commit message: Round 48: a thermometer's pins both purple (the start darker) joined by a dashed line, a ⚙ on Questions (Pins, Drafts, Card), the map now follows the drafts setting
