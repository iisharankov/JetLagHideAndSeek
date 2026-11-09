# JetLagHideAndSeek: rules for agents

Follows the owner's standard v0.3, copied at agentic_docs/standard/ (read its README.md first; never edit it). Differs from it in:

- The round counter continues the commit log (Round 29 next), not the old plan's section numbers, which lagged by two. Why: the commit messages are what the owner sees in `git log`.
- A plan may be a folder under `agentic_docs/plans/<name>/` when it has mock-ups or several parts (nov-game-fixes has 8 files and 17 PNGs). Why: one 2,000-line file would be unreadable on a phone.
- Deploy docs live at `docs/deployment.md` and `docs/guides/first-deploy.md`; `deploy/README.md` is a pointer. Why: the standard's fixed name, and the deploy folder is what the server runs.

## Read first

1. agentic_docs/agents/notes.md: the State and the traps.
2. agentic_docs/questions.md: new answers.
3. The newest three files in agentic_docs/rounds/; agentic_docs/agents/decisions.md before changing behaviour.

## What this is

A private, self-hosted fork of the Jet Lag: The Game "Hide and Seek" map tool, for the owner and friends, Switzerland first, played on phones. Astro 5 + React 19 islands + Leaflet + nanostores; a Hono API with SQLite for shared games; reference data built from OpenStreetMap. Runs on the owner's server behind nginx at jetlag.sharankov.com.

## Rules for this project

1. **Test first.** New behaviour and bug fixes come with a test seen failing before the change (`tests/`, `server/` with Vitest; `e2e/` with Playwright, Firefox, desktop and phone projects). Why: the owner asked for it in round 1 and every fix since has one.
2. **No dev server in the checkout.** Checks use the production build and `astro preview` on port 4329 (the Playwright config does it). Why: a dev server once clobbered the owner's `node_modules/.vite`.
3. **Rule and card texts are the rulebook's**, embedded in `src/content/rules/`. Never invent a rule; never mention or link the site the texts came from (the project is independent). Unknown rules become questions.
4. **Metric only** (decided 2026-11-09, plan nov-game-fixes 03): no imperial option.
5. **Domain rules the owner decided**, in `agentic_docs/agents/decisions.md`: a hiding zone is in or out by the station's own position (whole circles, no clipping); the hider's station and pin are shared between the hider's phones and never shown to seekers; answers come from the station until the end game, then from the pin; saved settings don't sync between tabs (`persistentAtom` from `@/lib/persist`, never from `@nanostores/persistent`).
6. **Questions are never changed in place**: go through `updateQuestion(key, patch)` in `src/lib/context.ts`. "Is this the hider's phone?" is `hiderPhone` in `src/lib/game/session.ts`, nowhere else. Why: the map's result cache and the game sync rely on object identity.
7. **UI copy** is short, plain English for people on a phone mid-game. The owner judges by screenshot: check UI changes in Playwright at phone and desktop width and look at the pictures.
8. **Free services only**: no API keys, no tracking, nothing third-party; everything the app needs lives on the owner's server.

## Commands

```
pnpm install                                   # or npm; pnpm 10, Node 22
npm run lint:check && npm run typecheck && npx vitest run
npm run build && npm run build:server && npx playwright test   # build:server is not optional: the e2e API runs from server/dist
```

All four lines must pass before a hand-back; judge by exit code. Never run `pnpm dev` here. The laptop can't reach the Docker daemon and has no nginx, osmium or sqlite3: the Docker build, `deploy/test-nginx.sh` and a real data build are verified only by CI or on the server. Temp files go in the session scratchpad.

## Where it runs

The owner's Hetzner server, Docker Compose (`web`, `api`, an updater) behind the host nginx, at jetlag.sharankov.com. Deploy: on the server, `~/jetlag/deploy/deploy.sh`, then `deploy/check.sh` a minute later. Details: docs/deployment.md; first setup: docs/guides/first-deploy.md.

## Neighbours

None. The rulebook texts in `src/content/rules/` are the game's; keep them as the source has them.

## Flag these files when changed

`deploy/docker-compose.yml`, `deploy/Dockerfile`, `deploy/nginx/*.conf`, `deploy/*.sh`, `.github/workflows/ci.yml`, `server/src/app.ts` (the API's limits and auth), `server/src/codes.ts` (who may make games).
