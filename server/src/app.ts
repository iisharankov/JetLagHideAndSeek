import { type Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { streamSSE } from "hono/streaming";

import { playerStale, roleOfPlayer } from "@/lib/game/players";
import { normalizeGameSettings } from "@/lib/game/settings";
import type { GameState, Player, PlayerId, Role } from "@/lib/game/types";

import {
    ADMIN_GAMES_PER_DAY,
    CREATOR_GAMES_PER_DAY,
    sameSecret,
} from "./codes";
import { type Actor, GameRuleError, viewFor } from "./gameOps";
import type { GameStore } from "./games";
import { opProblem, parseOp, parseQuestions } from "./opSchema";
import {
    createPositionStore,
    type PositionStore,
    type SeekerPosition,
} from "./positions";
import { parseSubscription, type PushService } from "./push";
import { createRateLimiter } from "./rateLimit";
import { legacyId, publicId, validKey } from "./rules/players";
import { WrongGuessError } from "./rules/shared";

const MAX_GAME_BYTES = 2 * 1024 * 1024;
/** Phones shrink photos to at most 5 MB before uploading. */
const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
const KEEPALIVE_MS = 25_000;
/** A play area or zone description can't be bigger than this. */
const MAX_PART_BYTES = 300_000;
/** An older game with a hider is theirs to delete, until it has been quiet this long. */
export const DELETE_AFTER_MS = 24 * 3600 * 1000;
/** A game nobody has changed for this long is abandoned: anyone may delete it. */
export const ABANDONED_MS = 30 * 24 * 3600 * 1000;

/**
 * Whoever started a game deletes it; anyone may once it has been abandoned.
 * Games from before organisers (`organised` false) keep the old rule: the
 * hider's, anyone's without a hider or after a quiet day.
 */
export const mayDelete = (
    state: Pick<GameState, "hasHider" | "updatedAt">,
    who: { hider: boolean; organiser: boolean },
    now: number,
    organised: boolean,
) =>
    organised
        ? who.organiser || now - state.updatedAt > ABANDONED_MS
        : who.hider ||
          !state.hasHider ||
          now - state.updatedAt > DELETE_AFTER_MS;

const tooLarge = (what: string) => (c: Context) =>
    c.json({ error: `The ${what} is too large.` }, 413);

/** The player's name for "changed by …" notes. */
const playerName = (value: unknown) => {
    const name = typeof value === "string" ? value.trim().slice(0, 40) : "";
    return name || "Someone";
};

/**
 * The name a change is signed with: the player's own (a rename joins
 * again), or for phones from before players the one they send.
 */
const nameOf = (sent: unknown, player: Player | undefined) =>
    player && !player.left ? player.name : playerName(sent);

/** The phone's private key (a random id it made once), if it sent one. */
const keyOf = (c: Context) => {
    const key = c.req.header("X-Player-Key");
    return validKey(key) ? key : null;
};

/**
 * The phone's player: by its key, or for phones from before players (no
 * key) by the name it signs with, as before.
 */
const playerOf = (c: Context, name?: unknown): PlayerId => {
    const key = keyOf(c);
    return key ? publicId(key) : legacyId(playerName(name));
};

const text = (value: unknown, max: number) =>
    typeof value === "string" ? value.slice(0, max) : undefined;

export const createApp = ({
    games,
    push,
    positions = createPositionStore(),
    adminCode,
}: {
    games: GameStore;
    /** Push notifications; without it the phones get none. */
    push?: PushService;
    /** Where the seekers are (in memory). */
    positions?: PositionStore;
    /** ADMIN_CODE from the server's .env; without it nobody makes games. */
    adminCode?: string;
}) => {
    const app = new Hono().basePath("/api");

    app.onError((error, c) => {
        if (error instanceof GameRuleError) {
            return c.json({ error: error.message }, error.status);
        }
        console.error(error);
        return c.json({ error: "Something went wrong on the server." }, 500);
    });

    app.get("/health", (c) => c.json({ ok: true }));

    // Shared games ------------------------------------------------------

    /**
     * The player's role: their team's, or (without teams) whether they said
     * they hide. Phones that became the hider with the password before
     * players still are, by the token in their header (kept for one
     * release; never in the URL, which servers log, nor a cookie, which
     * tabs share).
     */
    const roleOf = (
        state: GameState,
        player: PlayerId,
        hiderToken: string | null,
    ): Role =>
        roleOfPlayer(state, state.players[player]) === "hider" ||
        games.isHider(state.id, hiderToken)
            ? "hider"
            : "seeker";
    const tokenOf = (c: Context) => c.req.header("X-Hider-Token") ?? null;

    /** Wrong team passwords and player codes: five a minute per game (Q50). */
    const guesses = createRateLimiter();
    const guarded = <T>(key: string, run: () => T): T => {
        if (!guesses.allow(key)) {
            throw new GameRuleError(
                "Too many wrong tries. Wait a minute, then try again.",
                429,
            );
        }
        try {
            return run();
        } catch (error) {
            if (error instanceof WrongGuessError) guesses.failed(key);
            throw error;
        }
    };

    /** The admin code, compared in constant time; never stored. */
    const isAdmin = (typed: string | undefined) =>
        !!adminCode && !!typed && sameSecret(typed.trim(), adminCode);

    /** Admin routes: the admin code in a header, five wrong tries a minute. */
    const requireAdmin = (c: Context) =>
        guarded("admin", () => {
            if (!isAdmin(c.req.header("X-Admin-Code"))) {
                throw new WrongGuessError("Not allowed.");
            }
        });

    /**
     * The code a phone sent to make a game: the admin code, or a creator
     * code the admin made. Wrong ones count towards five a minute.
     */
    const codeOf = (c: Context) => {
        if (!adminCode) {
            throw new GameRuleError(
                "This server has no admin code set: see docs/deployment.md.",
            );
        }
        const typed = c.req.header("X-Creator-Code")?.trim() ?? "";
        return guarded("code", () => {
            if (!typed) {
                throw new GameRuleError(
                    "Ask the organiser for a creator code.",
                );
            }
            if (isAdmin(typed)) {
                return {
                    who: "admin",
                    kind: "admin" as const,
                    name: "Admin",
                    limit: ADMIN_GAMES_PER_DAY,
                };
            }
            const found = games.codes.find(typed);
            if (!found) {
                throw new WrongGuessError(
                    "That code doesn't work. Ask the organiser for a creator code.",
                );
            }
            if (found.revokedAt) {
                throw new GameRuleError(
                    "This creator code no longer works. Ask the organiser for a new one.",
                );
            }
            return {
                who: found.id,
                kind: "creator" as const,
                name: found.name,
                limit: CREATOR_GAMES_PER_DAY,
            };
        });
    };

    /** A player's answer: who they are, their role, and the game as they see it. */
    const playerAnswer = (c: Context, state: GameState, player: Player) => {
        const role = roleOf(state, player.id, tokenOf(c));
        return c.json({
            player,
            role,
            you: player.id,
            state: viewFor(state, role, player.id),
            now: Date.now(),
        });
    };

    /** Joining needs a phone with a key (an app from after players). */
    const requiredKey = (c: Context) => {
        const key = keyOf(c);
        if (!key) {
            throw new GameRuleError(
                "Reload the page to join: the app was updated.",
                400,
            );
        }
        return publicId(key);
    };

    const found = (id: string) => {
        const state = games.get(id);
        if (!state) throw new GameRuleError("This game doesn't exist.", 404);
        return state;
    };

    app.post(
        "/games",
        bodyLimit({ maxSize: MAX_GAME_BYTES, onError: tooLarge("game") }),
        async (c) => {
            // Only the admin and holders of a creator code make games (Q49).
            const code = codeOf(c);
            if (games.codes.gamesToday(code.who) >= code.limit) {
                throw new GameRuleError(
                    `This code has made its ${code.limit} games today. Try again tomorrow.`,
                    429,
                );
            }
            const body = await c.req.json();
            const questions = parseQuestions(body?.questions ?? []);
            if (!questions) {
                throw new GameRuleError(
                    "The questions aren't in a shape the game knows.",
                    400,
                );
            }
            const sized = (value: unknown) =>
                JSON.stringify(value ?? null).length <= MAX_PART_BYTES;
            if (!sized(body?.playArea) || !sized(body?.zone)) {
                throw new GameRuleError("The play area is too large.", 400);
            }
            const state = games.create(
                {
                    playArea: body?.playArea ?? null,
                    zone: body?.zone ?? null,
                    settings: normalizeGameSettings(body?.settings),
                },
                questions,
                playerName(body?.by),
                code.who,
            );
            games.codes.countGame(code.who);
            // Only the phone that started the game gets its key.
            const organiserToken = games.issueOrganiser(state.id);
            return c.json({ state, organiserToken }, 201);
        },
    );

    app.get("/games/:id", (c) => {
        const id = c.req.param("id");
        const state = found(id);
        const key = keyOf(c);
        const you = key ? publicId(key) : null;
        if (you) games.touch(id, you);
        const role = roleOf(state, you ?? legacyId("Someone"), tokenOf(c));
        return c.json({
            role,
            you,
            state: viewFor(state, role, you),
            now: Date.now(),
        });
    });

    // Joining: a name, a team (with its password) when the game has
    // teams, and "I hide". Again with the same phone: the same player.
    app.post("/games/:id/join", async (c) => {
        const id = c.req.param("id");
        found(id);
        const you = requiredKey(c);
        const body = await c.req.json().catch(() => ({}));
        const name = playerName(body?.name);
        if (name === "Someone") {
            throw new GameRuleError("Give your name first.", 400);
        }
        const team =
            body?.team && typeof body.team === "object"
                ? {
                      id: text(body.team.id, 80),
                      name: text(body.team.name, 60),
                      password: text(body.team.password, 200),
                  }
                : undefined;
        const hider = typeof body?.hider === "boolean" ? body.hider : undefined;
        const join = () => games.join(id, you, { name, team, hider });
        const { state, player } = team ? guarded(`team:${id}`, join) : join();
        return playerAnswer(c, state, player);
    });

    // Another phone (or wiped storage): the player's code makes this phone
    // that player.
    app.post("/games/:id/rejoin", async (c) => {
        const id = c.req.param("id");
        found(id);
        const you = requiredKey(c);
        const body = await c.req.json().catch(() => ({}));
        const { state, player, replaced } = guarded(`code:${id}`, () =>
            games.rejoin(id, you, String(body?.code ?? "")),
        );
        if (replaced !== you) positions.drop(id, replaced);
        return playerAnswer(c, state, player);
    });

    // A player gone quiet (a phone that died, a stray tab): whoever started
    // the game removes anyone; anyone removes a player not seen for an hour.
    app.delete("/games/:id/players/:player", (c) => {
        const id = c.req.param("id");
        const target = c.req.param("player");
        const state = found(id);
        const seenAt = games.lastSeen(id, target);
        if (seenAt === undefined || state.players[target]?.left) {
            throw new GameRuleError("That player isn't in the game.", 404);
        }
        const organiser = games.isOrganiser(
            id,
            c.req.header("X-Organiser-Token") ?? null,
        );
        if (!organiser && !playerStale({ lastSeen: seenAt }, Date.now())) {
            throw new GameRuleError(
                "Only whoever started the game can remove a player who was here in the last hour.",
            );
        }
        games.removePlayer(id, target);
        positions.drop(id, target);
        return c.json({ ok: true });
    });

    app.post(
        "/games/:id/ops",
        bodyLimit({ maxSize: MAX_GAME_BYTES, onError: tooLarge("change") }),
        async (c) => {
            const id = c.req.param("id");
            const body = await c.req.json();
            const current = found(id);
            const player = playerOf(c, body?.by);
            const actor: Actor = {
                id: player,
                name: nameOf(body?.by, current.players[player]),
                role: roleOf(current, player, tokenOf(c)),
            };
            const op = parseOp(body?.op);
            if (!op) {
                throw new GameRuleError(
                    `That change isn't well-formed: ${opProblem(body?.op)}.`,
                    400,
                );
            }
            const apply = () => games.apply(id, op, actor);
            const state =
                op.type === "joinTeam" ? guarded(`team:${id}`, apply) : apply();
            // Joining the hiding team, a new round: the role may change.
            const role = roleOf(state, player, tokenOf(c));
            return c.json({
                state: viewFor(state, role, player),
                role,
                now: Date.now(),
            });
        },
    );

    // The phones confirm first; a game is its organiser's to delete.
    app.delete("/games/:id", (c) => {
        const id = c.req.param("id");
        const state = found(id);
        // The admin deletes any game.
        if (c.req.header("X-Admin-Code")) {
            requireAdmin(c);
            games.delete(id);
            positions.forget(id);
            return c.json({ ok: true });
        }
        const organised = games.hasOrganiser(id);
        const who = {
            hider: roleOf(state, playerOf(c), tokenOf(c)) === "hider",
            organiser: games.isOrganiser(
                id,
                c.req.header("X-Organiser-Token") ?? null,
            ),
        };
        if (!mayDelete(state, who, Date.now(), organised)) {
            throw new GameRuleError(
                organised
                    ? "Only whoever started the game can delete it. After 30 days without changes anyone can."
                    : "Only the hider can delete a game that's being played. After a day without changes anyone can.",
            );
        }
        games.delete(id);
        positions.forget(id);
        return c.json({ ok: true });
    });

    app.post("/games/:id/hider", async (c) => {
        const id = c.req.param("id");
        const body = await c.req.json().catch(() => ({}));
        const token = guarded(`hider:${id}`, () =>
            games.claimHider(
                id,
                String(body?.password ?? ""),
                playerName(body?.by),
            ),
        );
        return c.json({ token });
    });

    // Codes ---------------------------------------------------------------

    /** What a code typed on a phone is: the admin's, or a creator code. */
    app.get("/codes/mine", (c) => {
        const { kind, name } = codeOf(c);
        return c.json({ kind, name });
    });

    app.get("/admin/codes", (c) => {
        requireAdmin(c);
        return c.json({ codes: games.codes.list() });
    });

    app.post("/admin/codes", async (c) => {
        requireAdmin(c);
        const body = await c.req.json().catch(() => ({}));
        const name = typeof body?.name === "string" ? body.name.trim() : "";
        if (!name || name.length > 40) {
            throw new GameRuleError(
                "Give the code a name (whose it is), 40 characters at most.",
                400,
            );
        }
        return c.json(games.codes.create(name), 201);
    });

    app.delete("/admin/codes/:code", (c) => {
        requireAdmin(c);
        if (!games.codes.revoke(c.req.param("code"))) {
            throw new GameRuleError("No such code, or revoked already.", 404);
        }
        return c.json({ ok: true });
    });

    app.get("/admin/games", (c) => {
        requireAdmin(c);
        return c.json({ games: games.summaries() });
    });

    app.get("/games/:id/events", (c) => {
        const id = c.req.param("id");
        const first = found(id);
        const key = keyOf(c);
        const you = key ? publicId(key) : null;
        const player = you ?? legacyId("Someone");
        const token = tokenOf(c);
        if (you) games.touch(id, you);
        // nginx: don't buffer the stream.
        c.header("X-Accel-Buffering", "no");
        return streamSSE(c, async (stream) => {
            // The role per state: a new round may hand it to another team.
            const send = (state: GameState | null) => {
                if (!state)
                    return stream.writeSSE({ event: "deleted", data: "" });
                const role = roleOf(state, player, token);
                return stream.writeSSE({
                    event: "state",
                    data: JSON.stringify({
                        state: viewFor(state, role, you),
                        role,
                        now: Date.now(),
                    }),
                });
            };
            const sendPositions = (list: SeekerPosition[]) =>
                stream.writeSSE({
                    event: "positions",
                    data: JSON.stringify({ positions: list, now: Date.now() }),
                });
            const unsubscribe = games.subscribe(
                id,
                (state) => void send(state),
            );
            const unsubscribePositions = positions.subscribe(
                id,
                (list) => void sendPositions(list),
            );
            stream.onAbort(() => {
                unsubscribe();
                unsubscribePositions();
            });
            await send(first);
            const known = positions.list(id);
            if (known.length > 0) await sendPositions(known);
            while (!stream.aborted) {
                await stream.sleep(KEEPALIVE_MS);
                if (!stream.aborted) {
                    await stream.writeSSE({ event: "ping", data: "" });
                    // Still here: for the players list's "last seen".
                    if (you) games.touch(id, you);
                }
            }
            unsubscribe();
            unsubscribePositions();
        });
    });

    // A seeker's position, for the hider's map (the rulebook: the seekers
    // keep a tracker on). The hider's own position stays with the hider.
    app.post(
        "/games/:id/position",
        bodyLimit({ maxSize: 2000, onError: tooLarge("position") }),
        async (c) => {
            const id = c.req.param("id");
            const state = found(id);
            const body = await c.req.json().catch(() => null);
            const player = playerOf(c, body?.by);
            if (state.players[player]?.left) {
                throw new GameRuleError(
                    "This player continued on another phone.",
                );
            }
            if (roleOf(state, player, tokenOf(c)) === "hider") {
                throw new GameRuleError(
                    "Only the seekers' positions are shared, not the hider's.",
                );
            }
            const { latitude, longitude, accuracy } = body ?? {};
            const number = (value: unknown, limit: number) =>
                typeof value === "number" &&
                Number.isFinite(value) &&
                Math.abs(value) <= limit;
            if (!number(latitude, 90) || !number(longitude, 180)) {
                throw new GameRuleError("That isn't a position.", 400);
            }
            if (keyOf(c)) games.touch(id, player);
            positions.set(id, {
                playerId: player,
                name: nameOf(body.by, state.players[player]),
                latitude,
                longitude,
                accuracy:
                    number(accuracy, 1e6) && accuracy >= 0
                        ? Math.round(accuracy)
                        : null,
            });
            return c.json({ ok: true });
        },
    );

    app.post(
        "/games/:id/photos",
        bodyLimit({ maxSize: MAX_PHOTO_BYTES, onError: tooLarge("photo") }),
        async (c) => {
            const id = c.req.param("id");
            const current = found(id);
            const sentName = decodeURIComponent(c.req.header("X-Player") ?? "");
            const player = playerOf(c, sentName);
            const actor: Actor = {
                id: player,
                name: nameOf(sentName, current.players[player]),
                role: roleOf(current, player, tokenOf(c)),
            };
            const bytes = new Uint8Array(await c.req.arrayBuffer());
            const { state, photoId } = games.addPhoto(
                id,
                bytes,
                (c.req.header("Content-Type") ?? "").split(";")[0],
                actor,
                {
                    requestId: c.req.query("request") || undefined,
                    caption: c.req.query("caption")?.slice(0, 200) || undefined,
                },
            );
            return c.json(
                {
                    photoId,
                    state: viewFor(state, actor.role, player),
                    role: actor.role,
                    now: Date.now(),
                },
                201,
            );
        },
    );

    // Push notifications -----------------------------------------------

    /** The server's public key, for the browser's subscription. */
    app.get("/push/key", (c) =>
        push ? c.json({ key: push.publicKey }) : c.json({ key: null }),
    );

    app.post("/games/:id/push", async (c) => {
        if (!push) throw new GameRuleError("No push notifications here.", 404);
        const id = c.req.param("id");
        const state = found(id);
        const body = await c.req.json().catch(() => ({}));
        const subscription = parseSubscription(body?.subscription);
        if (!subscription) {
            throw new GameRuleError("That isn't a push subscription.", 400);
        }
        push.subscribe(
            id,
            roleOf(state, playerOf(c), tokenOf(c)),
            subscription,
        );
        return c.json({ ok: true });
    });

    app.delete("/games/:id/push", async (c) => {
        if (!push) throw new GameRuleError("No push notifications here.", 404);
        const id = c.req.param("id");
        const body = await c.req.json().catch(() => ({}));
        if (typeof body?.endpoint === "string") {
            push.unsubscribe(id, body.endpoint);
        }
        return c.json({ ok: true });
    });

    app.get("/games/:id/photos/:photoId", (c) => {
        const photo = games.readPhoto(
            c.req.param("id"),
            c.req.param("photoId"),
        );
        if (!photo) return c.json({ error: "Not found." }, 404);
        return c.body(new Uint8Array(photo.bytes), 200, {
            "Content-Type": photo.type,
            "Cache-Control": "private, max-age=31536000, immutable",
        });
    });

    return app;
};
