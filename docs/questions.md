# Questions

Open questions in one place. My recommendation is in _italics_, so "ok" is a
valid answer. Answer after **Answer:**, then tell me to execute. Answered
questions are gone once built; what was built is in [plan.md](plan.md).
Decisions are listed at the end.

---

## Open questions

**Q32.** Metric cards. The card texts in the app are from the imperial
edition, and I couldn't find the metric edition's texts anywhere online, so I
haven't changed them (no guessing). Only these cards mention distances; could
you send photos of your metric versions (or just the numbers)?
- Curse of the Bridge Troll ("at least 1 / 5 / 30 miles")
- Curse of the Mediocre Travel Agent ("0.25 / 0.25 / 0.5 miles")
- Curse of the Unguided Tourist ("500 feet")
- Curse of the Impressionable Consumer ("100 feet")
- Curse of the Endless Tumble ("100 feet")
- Curse of the Right Turn ("1,000 feet")
- Curse of the Water Weight ("1,000 feet (300 meters)": maybe unchanged)

If your metric rulebook has different distances for radar, thermometer,
tentacles or the hiding zone radius, a photo of those pages would let me
switch the rules pages too.

**Answer:**

**Q34.** Answer timer. The rulebook gives the hider five minutes to answer
a question. Show a countdown on every question waiting for an answer (both
phones), amber in the last minute? _Recommended: yes._

**Answer:**

**Q35.** Asking again. A question asked a second time costs double (the
hider draws twice). Count how often each exact question type was asked this
round and tell both sides ("asked before: draw twice")? _Recommended: yes,
small._

**Answer:**

**Q36.** Buzz. Vibrate (and, when the page is in the background, show a
notification) when a question arrives for the hider, an answer arrives for
the seekers, or a curse is cast. Phones in pockets miss toasts.
_Recommended: yes, as a setting that's on by default._

**Answer:**

**Q37.** Scoreboard. Each round's hiding time plus bonuses, per hider, in
Menu → Game; the best round wins (the rulebook counts only a player's best
round). _Recommended: yes, now that the clock exists._

**Answer:**

**Q38.** Rest periods. The rulebook suggests agreed rest periods in long
games. A shared "rest" switch that pauses the clock and freezes questions?
_Recommended: later, if you play large games._

**Answer:**

**Q39.** Questions from before a game. Joining a shared game backs up the
phone's own questions (`questions-before-game` in storage) but nothing brings
them back. A "Restore my earlier questions" button in Menu → Game?
_Recommended: yes, small._

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
