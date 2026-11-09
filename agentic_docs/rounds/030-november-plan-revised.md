# Round 30, 2026-11-09: the November plan revised from the answers and the mock-up comments

Model: Fable 5.1. Budget: the rest of the session.

Asked: "I updaed one metric conversion from 80km to 75. I answered all the questions and also left comments below about all the PNGs, can you look at them all and update everythign, ask more questions if any, and make a plan to execute this … come back to me with a full plan to fix everything and table of exectuion runs and what to do on my side." Then 17 numbered comments on the mock-ups (quoted in `plans/nov-game-fixes/01-mobile-design.md`, one per screen).

Answers used:
- **Q47. A public site without accounts.** Suggested both gates. Answer: "I think Q49 answers this too now, right? And 5 games/day seems enough?" Read as: the creator codes are the gate, 5 games a day per code, no nginx cap.
- **Q49. Accounts and a fee.** Suggested no accounts, no fee. Answer: "No let's keep it free for now. Let's make an admin login with code that's in .env so i can log in and make games. Maybe a way to make multiple and revoke some so i can give friends access to make games. Only admins can make games and create game codes. All others must join a game. Something like that? What's the best way to do this?" Read as: designed in `plans/nov-game-fixes/08-admin-and-gates.md`; confirmed by Q56.
- **Q50. The hider password minimum.** Suggested 6. Answer: "6 char min is fine, make it 5 tries per min please, 5/s is too many. I don't expect players to be trying to hack each other too much, we're all playing for fun."
- **Q51. The metric values.** Suggested the table. Answer: blank in the file, but the owner edited the table (large thermometer 80 → **75 km**, "not 80!") and wrote "I answered all the questions". Read as: the table stands with 75 km; restated in Q57.
- **Q52. Other questions while a thermometer is armed?** Suggested allow. Answer: "Allow other questions".
- **Q53. Player id and rejoin code, or accounts?** Suggested the id and code. Answer: "player Id is nice, i don't understand it and the code? Are they the same thing? Which do oyu need to save? Which do you need to input?" Read as: yes to the id and code; explained more simply in 04 ("In plain words") and restated in Q57.
- Not answered, not built: Q48 (since 2026-10-17).

Did:
- **Mock-ups** (`plans/nov-game-fixes/mockups/screens.html`, 16 PNGs re-rendered; 17 dropped as the owner skipped it): x/y draw badge top-right on every tile and screen, uniform; the type picker's subtitle and ×2 banner removed, a **?** for a mini-tour; **Custom…** chips on radar and thermometer; tentacles as tiles without counts; photo rows unfold the requirement, time limit per game size; rule text behind an **i**; toasts with a full-height ×; the hider's timer a plain pill, Veto and Randomize separate and greyed without the card; photo detail with Take a photo / From the gallery; the end game as the last Hider row with confirm then 5 s undo; team password on the join screen.
- **Docs:** `01-mobile-design.md` rewritten with a comment-by-comment table and ten principles; `02` has 75 km, Custom and Q52; `03` notes the 75; `04` explains id vs code in plain words and adds the team password; `06` adds the team password; `07` adds the gallery setting; new `08-admin-and-gates.md`; `plan.md` is now seven runs A–G with a "what you do" column.
- **questions.md:** Q47, Q49, Q50, Q52, Q53 out (above); Q54 (team passwords), Q55 (gallery photos), Q56 (admin codes as designed), Q57 (my reading) in; S5 (choose the admin code) added.

Found on the way: Prettier had reformatted `screens.html` in round 29 (the folder was formatted before it moved); rewritten from source, and the file now carries a note; `agentic_docs/` is already in `.prettierignore`.
Checked: `npm run lint:check` (exit 0); the 16 PNGs looked at (03, 06, 12, 14 in full). Not run: build and tests (no code changed).
No root-run file changed.
Decisions: decisions.md, round 30. Steps created: S5. Questions added: Q54–Q57.
Commit message: Round 30: the November plan revised from the answers and the mock-up comments; admin codes designed; seven runs A–G
