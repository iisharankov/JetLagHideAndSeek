# Questions

Open questions in one place. My recommendation is in _italics_, so "ok" is a
valid answer. Answer after **Answer:**, then tell me to execute. Questions
answered and built in round 3 are gone; what was built is in
[plan.md](plan.md#phase-2c-round-3-). Decisions are listed at the end.

---

## New questions (round 4)

**Q28.** Commercial airports: please check the list in
[`src/maps/datasets/airports.ts`](../src/maps/datasets/airports.ts). I wrote
it from general knowledge, not from current timetables. In Switzerland it
counts Zürich, Geneva, Basel-Mulhouse, Bern and St. Gallen-Altenrhein, and
leaves out **Lugano** (no scheduled flights since 2020, as far as I know) and
**Sion** (only occasional seasonal flights). Abroad it has the main airports
within ~300 km (Milan ×3, Turin, Lyon, Munich, Stuttgart, Friedrichshafen,
Memmingen, Strasbourg, Innsbruck…). Add or remove any? Only airports whose
"nearest" area reaches Switzerland matter.

**Answer:** Airports that people would assume are airports should count, what happened to Lugano? Did it close?

**Q29.** Compared with the rulebook, the app doesn't have: matching
**landmass** and **street or path**; measuring **sea level** (altitude);
tentacles **metro lines**. (International border already works: admin border
at country level.) Add any? _Recommended: sea level, since Switzerland has lots
of altitude to play with. It needs a free elevation dataset on the server (a
few hundred MB). The others make little sense in Switzerland or need street
data._ 

**Answer:**Elevation could work. Are you higher or lower in elevation than me could be a fun question.


**Q31.** Reference places (star, dots, zone outline) are drawn for every
question that isn't hidden. With many questions on the map it can get busy.
Keep it like that (there's an on/off switch in Options), or show them only for
the question whose card is open? _Recommended: keep, try it in a game._

**Answer:** I think only show pins for active questions, otherwise not.

---

## Next run: one shared game board (your answers, kept for reference)

How I understood your idea:
- One game link for everyone. Questions added, moved or changed by anyone
  appear on everyone's phone straight away.
- The hider joins the same link and taps **"I'm the hider"**. That role is
  protected by a password the hider sets.
- The hider sees the same map and can switch on hider mode. Their phone then
  answers each new question from their position and sends **only the answer**
  to everyone. Their position never leaves their phone.

**Q10.** Is that right? Anything to add or change?

**Answer:** Sounds great. If hard to implement can be in next round of items to add. Also make it so the url is the link that's uniue to the game map/instance? 

**Q11.** Should the hider **confirm** each automatic answer before it's sent
(like answering out loud in the real game), or should answers go out
automatically? _Recommended: confirm with one tap; it also lets the hider
correct an answer the map data gets wrong._

**Answer:** Nothing gets sent automatically. So it can offer the answer for the hider to click. Also the hider often has some time to answer, so they might want to stall the few minutes (but often shouldn't, lol)

**Q12.** Once the hider has answered a question, should seekers still be able
to **change that answer**? _Recommended: no, answered questions are locked for
seekers; the hider can still change them._

**Answer:** Let's make a setting togglable for this in the game settings? There should be a game settings page... And for now only hiders can change question answers. But seekers should have their own mode/section where they can add questions and not show them so they can brainstorm! Maybe a "send question to hider button" and the question overlays but does not show to hiders until pressed. multiple colours of shading should be used then for out of bounds (standard or hider convifmred) and then speculative.

**Q13.** If two seekers edit the **same question** at the same moment, is "last
change wins, with a small 'changed by Ana' note" enough? _Recommended: yes._

**Answer:** Sure, don't see as major issue

**Q14.** Should the app share the **seekers' live GPS positions** with each
other (and/or with the hider)? Some groups play with seeker locations visible.
_Recommended: share among seekers only, off by default, one switch to turn on._

**Answer:** If it can that'd be great. We tried whatsapp location sharing but it didn't work well. Can we relistically expect the app to get live location well? Probably don't add this, i think too bulky and glitchy for now i expect

**Q15.** Old games: keep them to look back at, or delete them automatically
after some days (photos included)? _Recommended: keep for 30 days._

**Answer:** Keep for 30 days i guess. Do they take much data? If not keep 1 year or else delete?

---

### Photos and curses

**Q16.** Photos: attach them to **a specific question**, to **the game in
general**, or both? Shrink them to about 2 MB on upload? _Recommended: both,
and yes._

**Answer:**Shrink to 5mb max and we should add all photo questions too i guess in a tab so they can be referenced

**Q17.** Curses: can you send me the **official curse list** (name, effect,
cost, duration)? I won't make up card texts; until then the tracker takes
free-form entries. Track **curses cast on the seekers**, **curses the hider
holds**, or both?

**Answer:** (curse list provided; now built into the app) Note: Make sure it's metric version, let me know if you need help with this, do not guess

---

FYI: good job finding the cards and downloading them. As a heads up, that's the imperial version of the game, there's a metric version too. Can you try to find that version and update the cards? Only if you manage.
---

## Decisions already made

From your earlier answers (rounds 1–3), already built or planned:

- **Direction:** a private fork for you and friends that diverges freely from
  upstream. Development is test-driven, and changes go straight to master
  (you commit and push).
- **Privacy:** all analytics and tracking removed; no third-party services.
- **Hosting:** your Hetzner server (Ubuntu 24.04, 12 cores, 62 GB RAM, 3.4 TB
  free) with Docker behind your host nginx, at `jetlag.sharankov.com`, closed
  behind Authelia.
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
