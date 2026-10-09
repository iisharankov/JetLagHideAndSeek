# Project docs

Notes, audit and plan for this fork. Last updated 2026-10-09 (round 4 done).

| File                                       | What's in it                                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| [plan.md](plan.md)                         | **Status and next steps:** what's done (with the test for each fix), what's next (shared game board, photos, curses) |
| [questions.md](questions.md)               | **Your turn:** 3 new questions (metric cards, round timer, first impressions), decisions made |
| [architecture.md](architecture.md)         | How the app works now: self-hosted services, reference data, refresh pipeline, state, sharing |
| [audit.md](audit.md)                       | The round-2 audit (findings as found, with a status note on top)                               |
| [../deploy/FIRST-DEPLOY.md](../deploy/FIRST-DEPLOY.md) | **First deploy**, step by step, without Authelia                                  |
| [../deploy/README.md](../deploy/README.md) | How to run it on your server (reference)                                                       |

## Round 4 in short

- **Shared game:** one link for seekers and hider. Seekers' drafts stay
  hidden from the hider until sent; the hider's phone suggests answers and
  nothing is sent until the hider taps one; photos and curses are tracked
  per game.
- **New:** altitude question ("higher or lower than me?"); Lugano and Sion
  count as airports; reference places only for the active question.
- **Next:** your answers to Q32–Q34, a real test game.

## Round 3 in short

- **Every question works from the reference data**, including "same train
  line"; Overpass is only a fallback outside the covered area.
- **Across the border:** nearest-airport/city/place questions count places up
  to ~300 km away (Basel-Mulhouse, Milan, Munich), from pre-computed
  "nearest place" maps, so matching questions are instant.
- **New:** lake shore question, reference places on the map (star, dots, zone
  outline), ⓘ on every question and a question reference page linking to the
  rulebook built into the app, tram/boat switches and a "stations left" count.
- **Fixed:** hide button, cut-off labels, Winterthur missing from big cities,
  admin-border shading now limited to hiding zones when they're on.
- **Removed:** Thunderforest, Google Plus codes, print button, permanent
  overlay.
- **Next:** one shared game board for seekers and hider, photos, curses.
