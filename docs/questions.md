# Questions

Open questions in one place. My recommendation is in _italics_, so "ok" is a
valid answer. Answer after **Answer:**, then tell me to execute. Answered
questions are gone once built; what was built is in [plan.md](plan.md).
Decisions are listed at the end.

---

## Open questions

**Q38.** Rest periods. The rulebook suggests agreed rest periods in long
games. A shared "rest" switch that pauses the clock and freezes questions?
_Recommended: later, if you play large games._

**Answer:** Later, for large games; we only play over one day for now.

**Q40.** Push notifications need a contact address for the browsers' push
services (they may write to it if the server misbehaves). It's
`PUSH_CONTACT` in `deploy/docker-compose.yml`, a `mailto:`; which address?
_Recommended: an alias you read._

**Answer:**

---

## Decisions already made

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
- **Tutorial:** shortened to 15 steps. Upstream credit: one line, no table.
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
  awarded minutes are asked for when the hider is found.
