# Run C — Who may make games: admin and creator codes, password limits

For the agent that executes this. Read `CLAUDE.md`, `agentic_docs/agents/notes.md`, then this file and [08-admin-and-gates.md](08-admin-and-gates.md). **Q56 (the design) was blank on 2026-11-09**: check `agentic_docs/questions.md` first; if still blank, build nothing here and say so. Q50 (6 characters, 5 tries a minute) is answered and can be built regardless.

**After Run A (round 32):** `server/src/rateLimit.ts` exists (`createRateLimiter({ limit, windowMs, now })` → `allow(key)`, `failed(key)`: it counts wrong tries only), used in `app.ts` through `guarded(key, run)` for `team:<id>` and `code:<id>`; `GameRuleError` takes 429; a `WrongGuessError` is what counts. `hashPassword`/`passwordMatches` are in `server/src/rules/passwords.ts`. Team passwords are already 6–64 characters. New games have no hider password: `claimHider` is the old path, kept one release (refused in Teams games).

## The code today

- `POST /games` (`server/src/app.ts` ~l.95) is open to anyone; it issues an organiser token (`games.issueOrganiser`), kept on the phone in `organiserTokens` (`session.ts`) and sent as `X-Organiser-Token` to delete.
- The hider password: `games.claimHider` requires 4 characters; no rate limit beyond nginx's `limit_req zone=jetlag_api rate=5r/s burst=40` (`deploy/nginx/jetlag.sharankov.com.noauth.conf` l.10, l.54).
- Env: `server/src/index.ts` reads `PORT`, `DATA_DIR`, `SITE_URL`, `PUSH_CONTACT`; `deploy/docker-compose.yml` passes `environment:` to `api`; `deploy/.env.example` documents the variables.
- The Start button: `src/components/game/GamePanel.tsx` ~l.560 `Start a shared game` → `setupDialog.set("start")`; `GameSetupDialog.finish()` → `startGame()` → `createGame()`.

## Changes

### C1. Rate limiting (Q50) — build first, it's shared

`server/src/rateLimit.ts`: `createRateLimiter(limit, windowMs)` → `{ allow(key): boolean }`, in memory, a sliding count per key, old entries pruned. Keys: `hider:<gameId>`, `team:<gameId>`, `rejoin:<gameId>`, `admin`, `code`. On refusal throw `GameRuleError("Too many tries: wait a minute.", 429)` — add `429` to the error's status union.

Apply to: `claimHider` (while it exists), Run A's team password and rejoin code, and the admin/creator code checks below. Minimum password length 6 in `claimHider` and `joinTeam` (message "at least 6 characters"); `JoinDialog` says so.

### C2. Codes on the server

Env `ADMIN_CODE` (12+ chars). `index.ts` reads it; `createApp({ adminCode })`. If unset, log a warning and refuse every `POST /games` with "This server has no admin code set: see docs/deployment.md" (safer than open).

Table `creator_codes (code_hash TEXT PRIMARY KEY, name TEXT, created_at INTEGER, revoked_at INTEGER, games_today INTEGER, day TEXT)` in `games.ts` (same `db`), with store methods: `createCode(name) → plainCode`, `listCodes()`, `revokeCode(id)`, `useCode(plain) → { ok, reason }` (checks hash, revoked, the daily count: 5 per code, 20 for the admin code; `day` resets by `toISOString().slice(0,10)` in Europe/Zurich — simpler: by UTC date, say so). Hash with the scrypt helper (move `hashPassword`/`passwordMatches` to `server/src/rules/passwords.ts` if Run A hasn't).

Routes:
- `POST /games` requires header `X-Creator-Code` (a creator code or the admin code); else 403 "Ask the organiser for a creator code." Keeps issuing the organiser token.
- `POST /admin/codes { name }`, `GET /admin/codes`, `DELETE /admin/codes/:id` with header `X-Admin-Code` (constant-time compare; limiter `admin`).
- `GET /admin/games` lists id, area name, created, by, updated (the admin sees who made what); `DELETE /games/:id` also allowed with a valid admin code.

### C3. Phone

- `src/lib/game/codes.ts`: `creatorCode` and `adminCode` persistent atoms (localStorage; the code is a secret the owner typed on purpose, like the hider token was).
- Menu → Game (`GamePanel.tsx`, no game): a field "Have a code? Creator or admin code" that stores it; **Start a shared game** is shown only when a code is stored; `createGame` sends it; a 403 clears the stored code and shows the message.
- Menu → **Admin** (new section in `OptionDrawers.tsx` when `adminCode` is set): codes list with name, created, games today, **Revoke**; "New code" with a name → shows the plain code once with Copy; the games list with Delete.
- Setup/joining unchanged.

### C4. Deploy

- `deploy/.env.example`: `ADMIN_CODE=` with a comment; `docker-compose.yml` passes it to `api`; `docs/deployment.md` gets a "Who may make games" section and the step for the owner (S5 in `questions.md`); `deploy/check.sh` warns when `ADMIN_CODE` is empty.
- The nginx limit stays; mention in the doc that the server now limits password tries itself.

## Tests first

Server (`app.test.ts`): no code → 403; creator code → 201 and the token; 6th game in a day on one code → 429 with a clear message; revoked code → 403 for new games, its games still load; admin routes with the wrong code → 403, no body hint; `claimHider` 5-char → 400; 6th wrong try in a minute → 429 (and the 7th a minute later ok — fake the clock via an injected `now`).
Unit: `createRateLimiter` allows 5, refuses the 6th, allows after the window.
Browser (`e2e/sharedGame.spec.ts` and a new `e2e/admin.spec.ts`): the Start button is absent without a code; with a creator code (made through the API in the test) the game starts; the admin phone revokes it and the friend's next Start shows the message. Update the existing e2e that start games (`sharedGame.spec.ts` five tests, `tutorial.spec.ts` organiser tour's setup screens open without starting — fine) to seed a creator code in `localStorage` via `addInitScript`.

## What the owner does

- S5: `ADMIN_CODE` in `deploy/.env` before deploying; then make a creator code per friend in Menu → Admin.
