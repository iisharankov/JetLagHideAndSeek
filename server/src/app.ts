import { type Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { streamSSE } from "hono/streaming";

import { normalizeGameSettings } from "@/lib/game/settings";
import type { GameState } from "@/lib/game/types";

import { type Actor, GameRuleError, viewFor } from "./gameOps";
import type { GameStore } from "./games";
import { opProblem, parseOp, parseQuestions } from "./opSchema";
import { parseSubscription, type PushService } from "./push";

const MAX_GAME_BYTES = 2 * 1024 * 1024;
/** Phones shrink photos to at most 5 MB before uploading. */
const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
const KEEPALIVE_MS = 25_000;
/** A play area or zone description can't be bigger than this. */
const MAX_PART_BYTES = 300_000;
/** A game with a hider is theirs to delete, until it has been quiet this long. */
export const DELETE_AFTER_MS = 24 * 3600 * 1000;

/** Anyone may delete a game without a hider, or one nobody has touched for a day. */
export const mayDelete = (
    state: Pick<GameState, "hasHider" | "updatedAt">,
    role: "hider" | "seeker",
    now: number,
) =>
    role === "hider" ||
    !state.hasHider ||
    now - state.updatedAt > DELETE_AFTER_MS;

const tooLarge = (what: string) => (c: Context) =>
    c.json({ error: `The ${what} is too large.` }, 413);

/** The player's name for "changed by …" notes. */
const playerName = (value: unknown) => {
    const name = typeof value === "string" ? value.trim().slice(0, 40) : "";
    return name || "Someone";
};

export const createApp = ({
    games,
    push,
}: {
    games: GameStore;
    /** Push notifications; without it the phones get none. */
    push?: PushService;
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
     * Hider if the request carries this game's hider token in its header
     * (the live stream too: the phones read it over fetch). Never in the
     * URL, which servers log, and never a cookie, which tabs share.
     */
    const roleOf = (c: Context, id: string) =>
        games.isHider(id, c.req.header("X-Hider-Token") ?? null)
            ? ("hider" as const)
            : ("seeker" as const);

    const found = (id: string) => {
        const state = games.get(id);
        if (!state) throw new GameRuleError("This game doesn't exist.", 404);
        return state;
    };

    app.post(
        "/games",
        bodyLimit({ maxSize: MAX_GAME_BYTES, onError: tooLarge("game") }),
        async (c) => {
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
            );
            return c.json({ state }, 201);
        },
    );

    app.get("/games/:id", (c) => {
        const id = c.req.param("id");
        const role = roleOf(c, id);
        return c.json({
            role,
            state: viewFor(found(id), role),
            now: Date.now(),
        });
    });

    app.post(
        "/games/:id/ops",
        bodyLimit({ maxSize: MAX_GAME_BYTES, onError: tooLarge("change") }),
        async (c) => {
            const id = c.req.param("id");
            const body = await c.req.json();
            const actor: Actor = {
                name: playerName(body?.by),
                role: roleOf(c, id),
            };
            const op = parseOp(body?.op);
            if (!op) {
                throw new GameRuleError(
                    `That change isn't well-formed: ${opProblem(body?.op)}.`,
                    400,
                );
            }
            const state = games.apply(id, op, actor);
            return c.json({
                state: viewFor(state, actor.role),
                now: Date.now(),
            });
        },
    );

    // The phones confirm first; a game being played is the hider's to delete.
    app.delete("/games/:id", (c) => {
        const id = c.req.param("id");
        const state = found(id);
        if (!mayDelete(state, roleOf(c, id), Date.now())) {
            throw new GameRuleError(
                "Only the hider can delete a game that's being played. After a day without changes anyone can.",
            );
        }
        games.delete(id);
        return c.json({ ok: true });
    });

    app.post("/games/:id/hider", async (c) => {
        const id = c.req.param("id");
        const body = await c.req.json().catch(() => ({}));
        const token = games.claimHider(
            id,
            String(body?.password ?? ""),
            playerName(body?.by),
        );
        return c.json({ token });
    });

    app.get("/games/:id/events", (c) => {
        const id = c.req.param("id");
        const role = roleOf(c, id);
        const first = found(id);
        // nginx: don't buffer the stream.
        c.header("X-Accel-Buffering", "no");
        return streamSSE(c, async (stream) => {
            const send = (state: GameState | null) =>
                state
                    ? stream.writeSSE({
                          event: "state",
                          data: JSON.stringify({
                              state: viewFor(state, role),
                              now: Date.now(),
                          }),
                      })
                    : stream.writeSSE({ event: "deleted", data: "" });
            const unsubscribe = games.subscribe(
                id,
                (state) => void send(state),
            );
            stream.onAbort(unsubscribe);
            await send(first);
            while (!stream.aborted) {
                await stream.sleep(KEEPALIVE_MS);
                if (!stream.aborted) {
                    await stream.writeSSE({ event: "ping", data: "" });
                }
            }
            unsubscribe();
        });
    });

    app.post(
        "/games/:id/photos",
        bodyLimit({ maxSize: MAX_PHOTO_BYTES, onError: tooLarge("photo") }),
        async (c) => {
            const id = c.req.param("id");
            const actor: Actor = {
                name: playerName(
                    decodeURIComponent(c.req.header("X-Player") ?? ""),
                ),
                role: roleOf(c, id),
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
                { photoId, state: viewFor(state, actor.role), now: Date.now() },
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
        found(id);
        const body = await c.req.json().catch(() => ({}));
        const subscription = parseSubscription(body?.subscription);
        if (!subscription) {
            throw new GameRuleError("That isn't a push subscription.", 400);
        }
        push.subscribe(id, roleOf(c, id), subscription);
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
