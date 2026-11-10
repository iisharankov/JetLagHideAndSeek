# Decisions

Every decision and why, newest first. A reversal is a new row; the old row stays. Decisions from before the standard are at the end, as they were written, one bullet per round.

## 2026-11-10, round 41: full-screen tabs, questions before the station, the station chooser, History

| Decision | Why | From |
|---|---|---|
| **The phone's tab bar is Hider (or Stations) · Questions · Map · Cards · Menu; every tab is the whole screen above it, no handle, no half height, no close button** | the owner: Map in the middle "as a hotbar to always go back"; half a sheet showed only some of the questions | the owner (in chat) |
| **The ‹ Back on pushed screens stays** | it's how a card or the ask flow goes back to its list; "remove the back button" read as the panel's close button | this round |
| **The hider sees the seekers' questions before setting a station; the tabs don't change with the station; the Hider tab opens once** | the owner: seekers sometimes start early "to make the game more speedy" | the owner (in chat) |
| **Until the station is set, answers come from the tapped station, or the pin** | the same rule as the research questions (`hiderAnswerPosition`); said in a note on Questions | this round |
| **Research is a toggle inside Questions ("The seekers' \| My research"), shown while there's no station or research is left** | the owner's "research is a toggle" | the owner (in chat) |
| **The station list is a pop-up with a search ("Choose from the list"); the Hider tab shows "Selected zone: …"; a pick flies the map there (on a phone, shows the map)** | the owner's design; the red circle was drawn but off screen | the owner (in chat) |
| **History is one list, newest first, built from the game's state (`lib/game/history.ts`), open by itself, 30 lines then "Show all"** | the owner: "seekers asking questions, hiders answering them, cards played, etc."; one story on every phone | the owner (in chat) |
| **History says who asked and answered, never where the hider is** (the station picked is "The hider picked their station") | the seekers read it too | this round |
| **A card's distance is one button; the game's distances, ×2 and Custom… in a pop-up; Custom keeps it open with the number pad; custom distances in km** | the owner's chat answer to the mock-ups (Q59 in part); km/m toggle no longer needed (0.5 km is 500 m) | the owner (in chat) |
| **On a phone the tutorial's note stays at the top; the examples are framed between it and the tab bar** | the owner: "map should go north a bit" | the owner (in chat) |

## 2026-11-10, round 40: the question card on phones, no Ask button over the map

| Decision | Why | From |
|---|---|---|
| **No "Ask a question" button over the map; asking starts in the Questions tab** | the owner: "there's a questions tab" | the owner's comments (round 40) |
| **The tab bar's items share the width evenly, however many sections there are** | the owner: "it's weird with the middle gap" | the owner's comments |
| **The card is rebuilt as option A (sections) tonight; three other layouts are drawn for the morning (Q59)** | the owner: "try fixing it and also make a few pngs of different ideas" | the owner's comments |
| **The header holds only ‹, the badge, the title and the i; Hide, Lock and Delete move to the card's foot, with words** | the title was cut off beside three icon buttons | the owner's screenshot |
| **"Asked from" is one row; Change opens Use my location, typed or pasted coordinates and Copy** | three small icon buttons (edit, GPS, copy) were the "GPS options" | the owner's comments |
| **The answer is one big toggle, labelled "Show the map as if the answer is" in a game and "Answer" alone; the thermometer's "Warmer" says "Hotter" as the rulebook does** | in a game a draft's answer is only the map's guess; the old "Result" label hid that | this round |
| **Coordinates in the editor show six decimals** | 14 decimals were unreadable; six is about 10 cm | seen in the screenshots |

## 2026-11-09, round 38: Run G, metric everywhere

| Decision | Why | From |
|---|---|---|
| **Metric only, the values as in 03's tables** (radar 500 m to 160 km, thermometer 1, 5, 15, 75 km, tentacles 2 and 25 km, hiding zones 500 m and 1 km, found within 2 m, 3 m from a path, map sizes 25–250, 250–2,500, 2,500+ km²) | the owner's decision (2026-11-09) and Q51/Q57 | 03-metric-conversion.md |
| **Mentions outside 03's tables convert with its rounding**: curses page "at least 15 km away", "within 3 m of any seeker", "Went 10 km"; the tentacle intro "Within ____ km"; prose miles → kilometres | the same rule, one page further | this round |
| **The curses page's "100 feet" is Endless Tumble's, and says 30 meters as its card does** (03 named Gambler's Feet; that card has no distance) | the card text in `cards.ts` already says 30 meters | this round |
| **"with cars and feet" stays** (walking, not a unit); the metric test allows exactly that phrase | it isn't a distance | this round |
| **The tentacle page notes "Under the Swiss rules this game uses 10 km." under the big places** | the brief's one-line note; 10 km is a game setting, not the book's | RunG.md G1 |
| **The rules pictures still show miles** | replacing the pictures is the owner's call | RunG.md G1 |
| **The unit setting goes (Settings → Default unit); questions, the map's scale bar and the thermometer card are km; the radius card's Custom keeps km/m** | no imperial option anywhere | RunG.md G2 |
| **Saved questions in miles convert on load (this phone's and an old shared game's), 3 decimals; a hiding radius saved in miles too; the server keeps accepting old games as they are** | old data must still open | RunG.md G2 |
| **Internal geometry that measured in miles (measuring, buffers) measures in km** | self-consistent pairs; no visible change, no "miles" left in the code but the conversions | this round |

## 2026-11-09, round 37: Run F, the remaining screens in the shell, and photos

| Decision | Why | From |
|---|---|---|
| **Photo questions are rows under the questions; the Photos tab goes. The bar: Map · Questions · Cards · Stations or Hider · Menu** | principle 1's five tabs; round 35 kept Photos only until this run | 01-mobile-design.md, round 35 |
| **The hider's Questions count includes the photos waiting for them** | one place for "something to answer" | this round |
| **Photos sent without a question ("Other photos") fold away under the photo questions, and may come from the gallery** | they aren't answers, so the rule "taken when asked" doesn't apply; they need a home without the tab | this round |
| **"Hiders may send photos from the gallery": a setup switch, off by default; on, Take a photo and From the gallery side by side** | the owner's answer | Q55 |
| **"I cannot answer" for a photo is an answer: it earns the draw, ends the timer, tells the seekers; a photo sent after it replaces it without a second draw** | the rulebook: valid answers are a photo or "I cannot answer"; the brief: "owes the draw as a sent photo does" | RunF.md F3 |
| **A photo past 10 minutes (20 in a large game) counts as a late answer** | the late rule had a gap for photos | 07-photo-questions.md |
| **The Menu is a sidebar tab on both phone and desktop; the vaul drawer goes; Game, Settings, Help (and Admin) as sections; Escape closes it** | the brief's "simpler: both use the tab"; one place, no drawer crash | RunF.md F4 |
| **The Menu button opens the Menu; it doesn't close it** (Escape, Map, or another tab do) | a second tap on Menu closing it surprised the tests and would surprise players switching sections | this round |
| **Start the end game: a confirm, then 5 s with Undo before anything is sent; the browser tests shorten it through localStorage `endgameDelayMs`** | principle 10; the brief's documented test seam | RunF.md F1, F5 |
| **Veto and Randomize are always shown to the hider for an asked question, greyed with the reason ("no card in hand", "not a thermometer")** | principle 4: shown greyed with the reason, not hidden | 01-mobile-design.md |
| **"Pin follows GPS" is a row of its own, shown whenever the pin can move (turning it on shows the pin)** | mock-up 14 | RunF.md F1 |
| **The phone's sheet goes full height for the Menu, a pushed screen (a photo question, the seekers) and a question waiting for this phone's answer** | at half height the pinned Send covered the answers (seen in the screenshots); mock-up 16 is a full screen | this round |
| **The seekers' list (Hider → Seekers on the map) taps through to the seeker on the map** | the mock-up's row pushes a screen; a list without an action would be a dead end | this round |

## 2026-11-09, round 36: Run E part 2, the i, toasts, targets, the mini-tour, the tests on the phone

| Decision | Why | From |
|---|---|---|
| **The "i" unfolds in place under the header: the rulebook's text for the type (or the kind's first paragraph), "In this app", Full rules** | principle 5 ("unfolds", not a popover); the rule text was what the old ⓘ showed and the reference test expects | RunE.md E3 |
| **Every button is at least 44 px tall on phones, set once in `ui/button.tsx` and the sidebar's rows (`max-md:min-h-11`)** | one change reaches every screen; class-by-class edits would miss some | RunE.md E3, changed |
| **A question card shows its draw as the 3/1 badge left of the title; the "Hider draws 3, keeps 1" line goes** | principle 5: the badge, the same everywhere; Q57 places it left | Q57 |
| **The mini-tour is a fourth tour (`ask`), started by the **?**, never offered, not in the Menu** | the brief's `startTour("ask")`; it explains one screen, where the player already is | RunE.md E4 |
| **The seeker tour's Photos step opens the types screen and points at the Photo tile** (a step field `screen`) | photos are asked through Ask a question now; the brief's `TourStep.screen` | RunE.md E5 |
| **A tentacle kind with no places in the play area is dimmed with "none in the play area" but can still be picked** | the data can be wrong; dimmed tells, a disabled tile would stop a real question | 01-mobile-design.md 05 |
| **The 11 browser tests skipped on the phone for "sidebar open on desktop" now run on both projects; the 6 two-phone tests stay desktop-only** | the brief allows two-phone layouts to stay | RunE.md E5 |
| **A short buzz on Ask (30 ms), off with the alerts switch** | the design's "haptics on Send/Ask where the browser allows" | 01-mobile-design.md |

## 2026-11-09, round 35: Run E part 1, the tab bar, Back and the ask flow

| Decision | Why | From |
|---|---|---|
| **Stop at the brief's first checkpoint (E1 + E2), everything green; E3–E5 next session** | the brief: "may take two sessions; stop at a clean checkpoint" | RunE.md |
| **Photos stays a tab for now (six items on the phone's bar)** | photo requests and photos need a home until run F puts them in the questions list; 65 px an item still fits 390 px | this round |
| **The ask flow keeps drafts: "Add as a draft (plan first)" under the primary Ask** | drafts shade the map as speculation, a feature the game uses; principle 4 allows a secondary action under the primary | 01-mobile-design.md principle 4 |
| **The draw badge (2/1) sits left of the title, on tiles and headers** | the owner's Q57 comment | Q57 |
| **`openQuestion` stays an atom; the ask flow is a second atom (`askFlow`); `screenDepth` and Back are computed from both** | the brief's single stack would have rewritten Round 28's uses; two atoms give the same Back with less change | RunE.md E1, changed |
| **The ask flow opens the phone's sheet full height** | at half height the header, the location prompt and the clock left the choices almost no room (seen in the screenshots) | this round |
| **On phones the gear and the "Questions" button over the map go; the tab bar has Menu and the sections** | one way to each place; two "Menu" buttons would be ambiguous | RunE.md E1 |
| **The tour's targets list the desktop tab first and the phone's tab bar item second** | the coach mark takes the first visible one | this round |

## 2026-11-09, round 34: Run D, the thermometer as the rulebook plays it

| Decision | Why | From |
|---|---|---|
| **Thermometer distances 1, 5, 15, 75 km (small: 1, 5; medium: + 15; large: + 75), chosen in setup, Custom on the card** | the rulebook's ½, 3, 10, 50 miles in km; the owner set 75 | Q51 |
| **Other questions may be asked while a thermometer is armed** | the owner's answer | Q52 |
| **The phone lights Ask at the full distance; the server accepts 98 % of it** | GPS fixes wander between the phone's check and the server's | RunD.md D2 |
| **A new thermometer gets the game's second distance (5 km in every size)** | the brief's "`thermometerDefaults(size)[1]`" | RunD.md D3 |
| **A started thermometer's start and distance are fixed on the server: a phone's later edit keeps them** | a phone's edit still on its way after Start must not move the start | this round |
| **The armed thermometer's dashed circle is its own outline (drawn with the questions waiting), not a new layer; only the line to the phone is new** | one drawing path for "waiting" questions; less code | this round |
| **Without a position, Start uses the question's pin (drag it), with a warning** | the brief's "map's centre with a Change link"; the pin already starts at the position or the map's centre and can be dragged | RunD.md D3 |
| **Curses and rest periods that stop asking stop Start and Ask too** | the rulebook's thermometer is one question; a block applies to it whole | this round |
| **Playing alone, a thermometer keeps two pins to drag, now 5 km apart (it was 5 miles, with the pins swapped)** | metric only; the swap was a bug | RunD.md, CLAUDE.md rule 4 |

## 2026-11-09, round 33: Runs B and C, the hider's phones in step, who may make games

| Decision | Why | From |
|---|---|---|
| **Admin code in `.env`, creator codes made and revoked in Menu → Admin, 5 games a day per creator code and 20 for the admin, joining needs nothing** | the owner's design answer | Q56 ("let's go"), Q49 |
| **No admin code set: nobody makes games** (the server warns at start; `check.sh` warns) | safer than open, as the brief says | RunC.md |
| **An admin code shorter than 12 characters works, with a warning** | refusing would stop every game on a deploy over a length; 5 wrong tries a minute makes guessing useless anyway | this round |
| **Creator codes: 12 random letters, stored as a plain SHA-256 hash** (not scrypt) | random codes have ~60 bits; a plain hash allows a lookup, scrypt would need a scan of every code | this round |
| **"A day" is a Zürich day** | the brief allowed UTC "simpler"; `Intl` gives the Zürich date in one line | RunC.md |
| **One code field in Menu → Game for both kinds; the server says which** (`GET /api/codes/mine`) | the design: "An admin types the admin code in the same field" | 08-admin-and-gates.md |
| **A code refused when starting a game is forgotten on the phone; one used up for the day is kept** | a revoked code is no use; tomorrow the used one works again | RunC.md |
| **The old hider password stays** (now 6 characters and 5 tries a minute) | Run A's deploy isn't confirmed (S1's Done is blank); the brief says remove only after | RunB.md B5 |
| **Once the clock goes the station is set: another station is refused, the same one is a no-op** | a second hider phone re-announced "the hider is in place" | RunB.md B2 |
| **The pin's last mover is in the game (`pinDriver`); the phone that turned GPS-follow on last drives, the other gives way after 30 s** | the audit's "the one that turned it on last" | 05, RunB.md B4 |
| **`followPin` says "taken" when it gives way, so the phone can say why** | the brief's "off" would be silent | this round |

## 2026-11-09, round 32: Run A, who you are

| Decision | Why | From |
|---|---|---|
| **With Teams on, every player is in a team; nobody joins outside one and nobody leaves one (switch instead)** | the owner: "make it so even solo players need to make their own team in teams mode, no players outside team can join game" | Q58 |
| **The phone's secret is a key (`X-Player-Key`, store `playerKey`); the game lists players by a public id hashed from it** | the brief had the id in the header *and* as the key of `players`, which every phone gets: anyone could have read the hider's id and sent it. Named "key" so the two aren't confused | RunA.md, changed |
| **Two tabs of one browser are one player** | one key per browser; the brief wants it. To try hider and seeker on one laptop, use a private window for the second | RunA.md pitfalls |
| **A player's name comes from their record; a rename joins again (Menu → Game, on leaving the field)** | one source for "asked by Ana"; phones from before players still sign with the name they send | this round |
| **Last seen: stamped in memory, written with the next change, or every 5 minutes at most per game; removal checks the unwritten stamp too** | every write streams the whole game to every phone; a player only watching must not look gone | RunA.md pitfalls |
| **Old games keep their team list as placeholder players (`legacy:<name>`) and play on without the Teams setting** | turning teams on for them would ask for passwords nobody set; their teams stay on the scoreboard | this round |
| **The old hider password stays one release** (`/hider`, `X-Hider-Token`), refused in Teams games and when a player already hides | phones that were the hider at deploy time stay the hider | RunA.md |
| **A team left empty goes, unless it hides this round or the next** | stray and typo teams would fill the join screen | this round |
| **Switching team clears the typed password** | the old team's password sent to the new team is a wrong try, counted against the limit | seen in the screenshots |
| **After a new round, the push subscription is re-sent with the new role** | subscriptions are per role; a role swap mid-session kept the old role's notifications | found on the way |
| **Without teams, "I'm the hider" and "I'm not the hider after all" sit in Menu → Game** | after a new round nobody is the hider and nobody sees the join dialog again; a mistaken tap needs an undo | this round |

## 2026-11-09, round 31: the run briefs

| Decision | Why | From |
|---|---|---|
| **Teams are a game setting; with teams, team passwords and no hider password; without teams, the hider is the first to claim, by player id, no password** | the owner: "no hider password needed, just joining any team has a password needed … solo hiders … their ID counts as one" | Q54 (restated as Q58) |
| **The draw badge sits left of the title, the "i" on the right** | the owner's comment | Q57 |
| **Blank questions stop their part of a run** (Q56 → RunC's codes; Q55 → RunF's gallery button) | the standard's rule 10 | — |

## 2026-11-09, round 30: the November plan revised

| Decision | Why | From |
|---|---|---|
| **Only admins and holders of a creator code make games; everyone else joins by link** | the owner: "Only admins can make games and create game codes. All others must join a game." | Q49, Q47 |
| **No accounts, no fee** | "let's keep it free for now" | Q49 |
| **Hider (and team) password at least 6 characters, 5 wrong tries a minute per game** | "5/s is too many" | Q50 |
| **Thermometer chips 1 / 5 / 15 / 75 km, plus Custom; other questions allowed while one is armed** | the owner's table edit; "Allow other questions" | Q51, Q52 |
| **A silent player id per phone plus a six-character player code as the spare key** | "player Id is nice"; the code only for a phone swap | Q53 |
| **The draw shows as an x/y badge top-right, uniform, with the rulebook's numbers per kind** | the owner's comment on mock-up 3, read as the notation, since the rulebook's draws differ per kind | mock-up 3 |
| **Rules text behind an "i"; Veto and Randomize separate, greyed without the card; the end game a row with confirm then 5 s undo; toasts close with a full-height ×** | the owner's comments on mock-ups 7, 10, 11, 12, 14 | mock-ups |
| **Team passwords and photos from the gallery are proposed, not decided** | asked as Q54 and Q55 | mock-ups 12, 15 |

## 2026-11-09, round 29: adopted the standard

| Decision | Why | From |
|---|---|---|
| **The work files live in `agentic_docs/`, the project's pages in `docs/`** | the owner's standard v0.3, adopted on his ask | the owner: "The only thing in docs should be the project docs" |
| **The round counter continues the commit log: this is round 29** | the old plan's sections lagged the commits by two ("updates tutorials" and a round split across commits); the commits are what the owner sees | adopt.md step 1 |
| **A plan may be a folder under `plans/`** | nov-game-fixes has eight files and seventeen mock-ups | this round |
| **The deploy docs are `docs/deployment.md` and `docs/guides/first-deploy.md`; `deploy/README.md` points there** | the standard's fixed name; one home per fact | agents.md section 3 |
| **A blank answer is not an answer** (the old header already said "ok" takes the suggestion; it never said a blank does) | the standard, rule 10 | agents.md |
| **Metric only, no imperial option** | the owner: "it should all be set to metric! … (no imperial option)" | 2026-11-09, in chat; values pending Q51 |

## 2026-11-03, rounds 22–28 (commits 22–28), from the old plan's entries

| Decision | Why | From |
|---|---|---|
| **The play area is picked by tapping cantons, districts or municipalities on the map**; search and drawing stay | adding a dozen municipalities by hand was too slow | the owner's point 2, 2026-11-03 |
| **When seekers can't see the stations, the hider starts the end game** (seekers in the zone, off transport); seekers have no Stations tab until then | the rulebook's trigger; the reviewers want stations hidden | point 5 |
| **Only whoever started a game deletes it**; anyone after 30 quiet days | "anyone can delete a game" | point 6 |
| **The hider has a tour of their own**; tutorial steps up to 45 words | points 4, 10 | |
| **While the hider picks, station icons only; the tapped one's red circle; no pin until Done** | too many circles with trams on a small map | round 27 |
| **The hider's pin may follow GPS** (inside the zone, at most every 15 s) | the owner's ask | round 27 |
| **Seekers' positions go to the hider's map, always**, by their own stream event, in memory only; seekers see each other too | the rulebook: seekers keep a tracker on | round 27 |
| **At Send, a pin far from the phone asks "Send from where I am / from the pin"** | questions are asked from where the seekers are | round 27 |
| **Questions are a list of rows that open one card at a time**; folding is gone | five cards didn't fit a phone | round 28 |
| **One way to pick cards: Select on the card, the action in a bar pinned at the bottom** | "Discard" vs "Discard this" was confusing; the Cast button was off-screen | round 28 |

## Before the standard (rounds 1–22), from `docs/questions.md` as it was

From your earlier answers (rounds 1–4), already built or planned:

- **Direction:** a private fork for you and friends that diverges freely from
  upstream. Development is test-driven, and changes go straight to master
  (you commit and push).
- **Privacy:** all analytics and tracking removed; no third-party services.
- **Hosting:** your Hetzner server (Ubuntu 24.04, 12 cores, 62 GB RAM, 3.4 TB
  free) with Docker behind your host nginx, at `jetlag.sharankov.com`; open
  for now, Authelia later (`auth.jetlag.sharankov.com`).
- **Map data:** Switzerland plus a margin into neighbours, refreshed monthly.
  Old saves and links may break while we rebuild.
- **App form:** installable web app, no APK. Team sync is more important than
  phone-offline. "Offline" means third-party data lives on your server.
- **ArcGIS:** kept for now, with its files served from your server.
- **Rules:**
  - Metric units.
  - Hiding zones: train stations, maybe trams and boats; radius 500 m or 1 km,
    settable during play.
  - Zone levels: canton, district, municipality, with "not applicable" where a
    level doesn't exist.
  - Station names as on the sign, with a tooltip explaining the rule.
  - Swiss adaptations where questions don't fit.
  - Game sizes: Zürich city (small), a canton (medium), all of Switzerland
    (large).
- **Hider mode:** used; the hider's position stays on their phone.
- **Photos and curses:** shared with the team per game; photos shrunk to
  5 MB; rules, curses and cards built into the app.
- **Round 3:** Overpass stays as a fallback (up to ~30 GB of server storage is
  fine); nearest-place maps pre-computed on the server; places up to ~300 km
  away count, kept small and refreshed rarely; commercial airports from an
  editable list; no place search across the border; admin-border answers
  only inside hiding zones when those are on; halts count as stations; trams
  and boats as separate switches; 100k+ cities everywhere; lake shore
  question (10 km², adjustable); updates by hand; upstream extras removed.
- **Tutorial:** shortened to 15 steps (replaced by the tours in round 21).
  Upstream credit: one line, no table.
- **Round 4:**
  - **Airports:** the ones people call airports count, so Lugano and Sion are
    in (Lugano has had no scheduled flights since 2020 as far as I know, but
    it's open).
  - **Altitude question:** "higher or lower than me", from free elevation
    data on the server.
  - **Reference places:** only for the active question.
  - **Shared game (Q10–Q15):**
    - One link per game.
    - The hider role is behind a password.
    - Nothing is sent automatically: the hider confirms each suggested answer.
    - Only the hider answers, unless the hider allows seekers in the game
      settings.
    - Seekers' drafts stay hidden from the hider until sent and shade the map
      amber.
    - Last change wins.
    - No live locations.
    - Games are kept a year after their last change: they're a few KB, and
      photos are at most 5 MB each.
  - **Photos:** at most 5 MB and stripped of location data, attached to
    photo questions or the game.
  - **Curses:** a tracker per game (the hider casts, everyone sees, seekers
    clear).
  - **Rules:** all built into the app, never linked elsewhere.
- **Round 5 (after the first real game):** game settings are chosen on a few
  screens before a game starts and are fixed while it runs (hider may widen
  the hiding zones); radar defaults 2/10/50 km; the hider sees a question's
  pin and outline before answering; answer buttons keep their order; seekers
  can't delete answered questions; the Hider tab holds the password step;
  seekers get private note pins; the hiding-zone sidebar is Zones \| Stations
  plus "stations left" and "removed" lists; stations are de-duplicated
  automatically; zones are cut to the possible area; custom station lists are
  gone.
- **Round 6 (after the second real game):** a station is in or out of an
  answer by its own position, never the hider's spot (whole green circles,
  no cutting, no per-zone check); the hider and the seekers each pick the
  station (the hider's stays on their phone, the seekers' is shared); the
  hider's phone is simply in hider mode; mountain questions are off; the
  Stations tab replaces the right sidebar; the place search and drawing
  tools live in game setup; powerups the hider plays are shown to everyone;
  leaving a game keeps the questions on the phone; stations behind airport
  security (Dock E) are left out through an editable list.
- **Round 7:** one "I'm the hider" switch (password popup); the Stations tab
  is the Hider tab on the hider's phone (pick the station, then only its
  zone); the hider pin is the real spot, kept inside the zone, and is the
  source of truth only in the end game (the station until then); the seekers'
  pick starts the end game (only that zone left, earlier questions not
  applied, undoable); halts are trains, funiculars are trams; "Share a copy"
  is one button; a games list with delete; no page zoom on phones; saved
  settings don't sync between tabs.
- **Round 8 (Q33):** a shared hiding clock (start when the seekers set off,
  pause for a Move, stop when found) at the top of the sidebar; the hider's
  hand of cards on the hider's phone (Cards tab: draw per the rulebook's
  "draw N, keep M", play, discard, hand limit 6 + expansions), with the time
  bonuses sent to the seekers at the end of the round.
- **Round 9:** real or virtual hider deck per game (virtual: the server
  shuffles and deals, owes draws per answered question, logs extra draws for
  the seekers, works the bonuses out itself); card pictures in the hand;
  Found! only in the end game; the clock at the bottom of the sidebar.
- **Round 10 (Q32):** the cards are the metric edition's (from your photos);
  the deck is 100 cards as counted; physical or digital deck chosen first in
  setup, deck and question lists behind "Customise", custom cards with text
  or a photo; the digital deck deals draws by itself (no drawing by hand);
  Move puts the questions away and freezes the seekers until the hider
  continues; played cards pop up for the seekers.
- **Round 11 (Q36):** buzz, beep and background notifications for the game's
  news; drafts on the map per colour or only the open card; the draw per
  question type shown on the cards; toasts swipe away; card picks open the
  card to read, and draws without a choice go straight to the hand.
  The hider's station and pin are shared between the hider's phones (hidden
  from the seekers), so two hiders always have the same spot.
- **Round 12 (audit):** no new behaviour: questions are only ever replaced,
  never changed in place; one `hiderPhone` store; the map remembers each
  question's result and recomputes from the first change on; auto-save off
  now means the map and the shared game take the edits on Save (the cards
  and pins follow at once).
- **Round 14 (Q34, Q35, Q37, Q39, and your notes):** a five-minute answer
  timer on asked questions; "asked before: costs double" on drafts; a
  scoreboard per hider, best round wins; "restore my earlier questions"
  after a game; joining a game asks for the name and the role first; auto
  zoom off by default; a setting for whether seekers may show the hiding
  zones; the auto-save setting removed. The hider token only in a header;
  100 photos per game; a game being played is the hider's to delete; the
  server's clock rules; Overflowing Chalice and Randomize Question are
  enforced; push notifications opt-in per phone and game; on phones the
  questions are a bottom sheet and the Menu a panel behind a gear; new
  questions start where the phone is while Follow me is on.
- **Round 15:** the sheet snaps to half or full and never blocks the page;
  radar distances are a game setting with defaults per size; the role is
  asked once per tab when joining and nowhere else; leaving a game (or
  opening the plain address after one) clears its questions; photo
  questions asked again cost double; no share button on the cards.
- **Round 16:** with the digital deck a curse's card cost is enforced
  (which cards, or the hand); question cards are compact: the place as one
  row, hide and delete in the title row, no lock in a game, no result
  toggle once the game has the answer.
- **Round 17:** the curses are enforced from their texts: one that stops
  the asking blocks sends until cleared; the Drained Brain's three
  questions are the hider's choice and gone for the run; the Spotty
  Memory's category comes from a real die; timed curses and the Move's
  period end by themselves; awarded minutes are recorded in Cards; Egg
  Partner and Lemon Phylactery not in the end game; Duplicate Another Card
  copies a card. No dice on the site, no hangman board. Questions belong
  to their game (no "kept from before the game" box); no snapshot sharing
  (links, files, copy and paste of whole games). No hider switch in the
  Menu: starting a game asks who you are like joining does, and a hider
  without a station gets a pointer at the Hider tab. Seekers don't see how
  many cards the hider holds. Randomize Question works on photo questions.
  The hider's station is picked first (other tabs wait) and set for the
  round unless Move is played; the seekers hear that it's picked, not
  where; the hiding clock starts by itself at the end game at the latest;
  awarded minutes are asked for when the hider is found. A tapped station
  counts only once confirmed (a refresh forgets it); the clock starts at
  that confirmation; teams (one hides, the rest seek; the next hider team
  is claimed after each round, then everyone re-joins); a Research tab for
  the hider's own probing questions before the station is set. Asked
  questions are statements; the hider's answers preview on the map before
  Send, with every real choice (all places within reach for tentacles);
  tentacle distances are a game setting in km; the late-answer penalty
  (setting); pause, resume and deleting asked questions take both sides;
  no discards unless over the hand limit. The hider's pin is fixed once
  the end game is on at their station and shown to the seekers after the
  round; one version of each place question; places can be reviewed and
  rejected before a game, duplicates merged. Later in round 17: places
  outside the play area don't exist (the rulebook's null answer, first on
  the hider's card for place questions); mountains are gone; built-in
  kind rules and two hand-checked drops; Settings → Places; no far places
  or nearest-place maps in the data build; German, Austrian, French and
  Italian zone labels; [../../docs/guides/areas.md](../../docs/guides/areas.md) for Bern and Munich.
- **Round 18 (Q38, Q40–Q42):** rest periods as a game setting (the clock
  pauses and goes on by itself; changed during a round by agreement);
  place search from the reference data instead of Photon (one service
  fewer, any box works); a German rule set; the push "contact" is the
  site's address, no email needed.
- **Round 19 (Q43–Q46):** no Overpass: the downloaded data is all a game
  needs, a play area outside it isn't possible; the site stays public, so
  every change is checked for shape and size; no addresses in the
  coordinate picker; a "Download this game" file, and a backup script.
- **Round 21 (the tutorial):** offered, not forced: a **Show Tutorial**
  note the first time on a phone as a seeker, as the hider and on the plain
  address; from zero (the game, with examples on the map in Zürich canton)
  to the app; the station decides until the end game, then the pin; notes
  of at most 20 words; one-time tips the first time something happens.
- **Round 22:** the play area picked by tapping cantons, districts or
  municipalities on the map; when the seekers can't see the stations, the
  hider starts the end game (the seekers in the zone and off transport) and
  the seekers have no Stations tab until then; whoever starts a game is the
  only one who deletes it (anyone after 30 quiet days); the hider has a
  tour of their own; tutorial steps up to 45 words.
