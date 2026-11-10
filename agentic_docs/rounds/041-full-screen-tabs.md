# Round 41, 2026-11-10: Full-screen tabs with Map in the middle, the hider sees questions before the station, a station chooser, a distance pop-up, a fuller History, the tutorial's examples below its note

Model: Opus 5.5. Budget: "go" (six asks in one session, in chat).

Asked (in chat, in this order):
1. "The tutorial on mbile has the text covering the area, it doesn't center the map in a way you can see both the text and the zone properly, try to move it so both are in view (mapshold go north a bit)" (seven screenshots of the hider tour)
2. "Also make it so hiders can see questoins seekers ask before setting their location, sometimes the seekers start before hiders set their final hiding spot to make hte game more speedy. Maybe both can be in the questions tab and reseratch is a toggle"
3. "Remoe the list of all hiding zones for hider. Instead make it a "select" button that shows a popup with a list, and one is clicked, and then in the main hider area a "selected zone: _______________" section. Also i noted that when hiders pick the zone from the current list and click one, it doesn't update the red circle, only hwen you click the icon."
4. "make the map icon the middle one. Make hider the left mofst, keep questions where it is, and move cards to 4th position, so hdier, questions, map, cards, menu. Also make the icons open full screen and remove the drag menue and back button to utilize space better in full screen on all tabs. […] it's better to just be full screen and design the layout to match and take advantage of this"
5. "also make sure to add more things that go to history, seekers asking questions, hiders answering them, cards played, etc."
6. "as for the questions pngs and what to do: not sure yet, but i think for all options that have it, the radius/distance/whatevers should show only one element (such as 1km) and when you tap it a small popup overlays with all options, including custom, and the "x2" stuff if applicable) to click on and then it goes back. If you click custom then you stay in that menue and the keyboard comes up (maybe with just the numberpad?) […]"

Answers used: Q59 in part (in chat, item 6: the distance as one element with a pop-up; the card's overall layout "not sure yet", so Q59 stays open). Not answered, not built: Q48.

Did:
1. **The tutorial on phones:** the note sits at the top and the example is framed below it, above the tab bar (`maps/tourDemoLayer.ts` measures where the note ends; `CoachMark.tsx` keeps the note at the top). Cause: since round 35 the "sheet closed" check saw the tab bar's 64 px, so the note went to the top while the framing still kept the bottom free.
2. **Questions before the station:** the hider's tabs are the same with or without a station (`lib/game/tabBadges.ts`); the Hider tab opens once when there's no station, nothing is locked; Research is a toggle inside Questions ("The seekers' | My research (n)", while there's no station or research is left); a note says answers come from the tapped station or the pin until the station is set (`QuestionSidebar.tsx`). The server always accepted early questions.
3. **The station chooser:** the long list is gone from the Hider tab; **Choose from the list (n)** opens a pop-up with a search; the Hider tab shows **Selected zone: Wipkingen** (with Show) and Done. Choosing flies the map to the station (and on a phone shows the map with a note to come back for Done). The red circle was drawn before too, but off screen: a pick from the list didn't move the map.
4. **The tab bar and full-screen tabs:** Hider (or Stations) · Questions · **Map** · Cards · Menu; every tab opens the whole screen above the bar; no handle, no dragging, no close button (Map is the way back) (`ui/bottom-sheet.tsx`, `ui/sidebar-l.tsx`, `TabBar.tsx`, `QuestionSidebar.tsx`).
5. **History:** one list, newest first, open by itself: questions asked, answered and vetoed (with the answer), thermometers started, photo questions asked, sent and "can't answer", curses cast and cleared, cards played (with what Randomize changed), moves, the end game, and the digital deck's draws (`lib/game/history.ts`, `game/CardHistory.tsx`).
6. **The distance pop-up:** the radar and thermometer cards show one button ("10 km ▾"); a tap opens the game's distances with ×2 on any asked before, and Custom…, which stays open with the number pad (`DistancePicker` in `cards/parts.tsx`). The radar's km/m toggle went with it (`UnitToggle.tsx` deleted; custom distances in km, 0.5 for 500 m).
- **Tests:** `tests/history.test.ts` (2) and `tests/tabBadges.test.ts` (changed), seen failing first; `e2e/tutorial.spec.ts` "on a phone the examples sit on the map below the note" (seen failing first: the zone at 124 px under a note ending at 232); `e2e/sharedGame.spec.ts` (the toggle before the station, the chooser, the circle in view after a pick), `e2e/photos.spec.ts` (History lists who asked and what came back); helpers `chooseStation`, `setDistance` in `e2e/ask.ts`.

Changed from the asks: "remove the back button" read as the panel's close button (the ‹ Back on pushed screens stays: it's how a question's card goes back to the list); Research shows as a toggle only while there's no station or research is left (after the station it has nothing to show). On a phone a pick from the station list shows the map at once, so the red circle is seen; Done is back in the Hider tab.

Found on the way: a closed full-screen panel still counted as on screen (now moved off it); the station helper must open the Hider tab first on a phone.

Checked, not finished (the session ran out of credit):
- Lint and types: clean after a Prettier fix to 3 files. Vitest: 520 passed (72 files). Both builds pass.
- Playwright, last full run before the fixes: 83 passed, 8 skipped, 5 failed. After the fixes, the four specs rerun (menu, roles, identity, sharedGame): 27 passed, 2 skipped, 1 failed.
- **Still failing:** `e2e/roles.spec.ts:215` on the phone project ("a second phone of the hiding team gets the station…"). `chooseStation` times out on `hider-choose` (e2e/ask.ts line 105). Not diagnosed. Likely the Hider tab's chooser isn't showing on that phone at that point (a station already set, or the panel closed).
- **Next session:** fix that test, run the four check lines, take phone screenshots (the new tab bar, full-screen tabs, the chooser, the toggle, the distance pop-up, History) and look at them. The identity failure in the first run was a Firefox crash ("RenderCompositorSWGL failed"); it passed on the rerun.
No root-run file changed.
Decisions: decisions.md, round 41. Questions added: none.
Commit message: Round 41: full-screen tabs with Map in the middle, the hider sees questions before the station (research a toggle), a station chooser, a distance pop-up, a fuller History, the tutorial's examples below its note
