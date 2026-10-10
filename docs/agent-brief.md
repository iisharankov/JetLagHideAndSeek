# Working on JetLagHideAndSeek: brief for a new agent

How the owner (Ilia) works with an agent on this repo. Read this, then
`docs/plan.md` (status) and `docs/questions.md` (open questions and the
decisions so far) before touching code.

## What this is

A private fork of the Jet Lag: The Game "Hide and Seek" map tool, for the
owner and friends, Switzerland first. Self-hosted on their Hetzner server
(`jetlag.sharankov.com`, Docker behind the host's nginx; `deploy/`). Astro 5
+ React 19 islands + Leaflet + nanostores; a Hono API with SQLite for shared
games; reference data built from OpenStreetMap and served from their box.

## Rules that don't bend

1. **Test-driven.** Write or extend the test first where there's logic
   (`tests/` and `server/` with Vitest, `e2e/` with Playwright).
2. **Never commit or push.** Changes go straight to master, but the owner
   runs git. End your hand-over with the exact `git` lines and the deploy
   step (`~/jetlag/deploy/update-app.sh` on the server).
3. **Free services only.** No API keys, no tracking, no third-party services;
   anything the app needs lives on their server.
4. **No dev server in the checkout.** For checks use the production build
   and `astro preview` on port 4329 (the Playwright config does this).
5. **Don't invent official rules.** Rule and card texts are the rulebook's,
   embedded in the app. Never mention or link lifack.ch anywhere; the
   project is independent. If a rule is unknown, ask in `docs/questions.md`.
6. If an install or command needs them (sudo, server, secrets), say exactly
   what to run instead of guessing.

## How feedback arrives, and what to do with it

- A numbered list of points after a real game, often with screenshots, and a
  note on how much session budget is left ("do it in sections, ask at the
  end"). Work through all points in sections; don't stop to ask mid-way
  unless truly blocked; put questions at the end.
- Each round gets a section in `docs/plan.md` ("Round N … ✅ (date)") that
  restates the points and says what was done. Never mark something done
  before it is.
- Settled matters go into `docs/questions.md` → "Decisions already made" as
  one round bullet. New open questions are `**Q34.** …` paragraphs there;
  the owner answers inline (`Answer: …`) or in chat.
- Say plainly what you couldn't verify (anything on a real phone: GPS,
  pinch-zoom, touch).

## Before handing over

```
npm run lint:check && npm run typecheck && npx vitest run
npm run build && npm run build:server && npx playwright test
```

The e2e API runs from `server/dist`, so `build:server` is not optional. If a
test fails, say so with the output; don't paper over it.

## Code and copy style

- Match the surrounding code; comments say *why*; UI copy is short, plain
  English (no jargon, no hedging), written for people on a phone mid-game.
- Keep the domain rules the owner decided (hiding zones are about the
  station's own position; the hider's station never leaves the hider's
  phone; saved settings don't sync between tabs; …) — they're in
  `docs/plan.md` and `docs/questions.md`.
- Questions are never changed in place: go through `updateQuestion(key,
  patch)` (`src/lib/context.ts`), which replaces the question with a new
  object. The map's result cache and the game sync rely on that. "Is this
  the hider's phone?" is `hiderPhone` in `src/lib/game/session.ts`, nowhere
  else.

## Hand-over message

Sections mapping each numbered point to what changed, with file links; a
"Next steps for you" block (commit, push, deploy); "Questions for you" last.
