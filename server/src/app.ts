import { type Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { streamSSE } from "hono/streaming";

import { normalizeGameSettings } from "@/lib/game/settings";
import type { GameOp, GameState, SharedQuestion } from "@/lib/game/types";

import { type Actor, GameRuleError, viewFor } from "./gameOps";
import type { GameStore } from "./games";
import type { ShareStore } from "./shareStore";

const MAX_GAME_BYTES = 2 * 1024 * 1024;
/** Phones shrink photos to at most 5 MB before uploading. */
const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
const KEEPALIVE_MS = 25_000;

const tooLarge = (what: string) => (c: Context) =>
    c.json({ error: `The ${what} is too large.` }, 413);

/** The player's name for "changed by …" notes. */
const playerName = (value: unknown) => {
    const name = typeof value === "string" ? value.trim().slice(0, 40) : "";
    return name || "Someone";
};

export const createApp = ({
    shares,
    games,
}: {
    shares: ShareStore;
    games: GameStore;
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

    app.post(
        "/share",
        bodyLimit({ maxSize: MAX_GAME_BYTES, onError: tooLarge("game") }),
        async (c) => {
            const game = await c.req.text();
            let parsed: unknown;
            try {
                parsed = JSON.parse(game);
            } catch {
                parsed = null;
            }
            if (
                !parsed ||
                typeof parsed !== "object" ||
                Array.isArray(parsed)
            ) {
                return c.json({ error: "Expected a JSON object." }, 400);
            }

            // Set by nginx from Authelia; only used to see who shared what.
            const id = shares.save(game, c.req.header("Remote-User") ?? null);
            return c.json({ id }, 201);
        },
    );

    app.get("/share/:id", (c) => {
        const game = shares.load(c.req.param("id"));
        if (game === undefined) return c.json({ error: "Not found." }, 404);
        return c.body(game, 200, { "Content-Type": "application/json" });
    });

    // Shared games ------------------------------------------------------

    /** Hider if the request carries this game's hider token. */
    const roleOf = (c: Context, id: string) =>
        games.isHider(
            id,
            c.req.header("X-Hider-Token") ?? c.req.query("hider") ?? null,
        )
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
            const questions = Array.isArray(body?.questions)
                ? (body.questions as SharedQuestion[])
                : [];
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
        return c.json({ role, state: viewFor(found(id), role) });
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
            const state = games.apply(id, body?.op as GameOp, actor);
            return c.json({ state: viewFor(state, actor.role) });
        },
    );

    app.post("/games/:id/hider", async (c) => {
        const id = c.req.param("id");
        const body = await c.req.json().catch(() => ({}));
        const token = games.claimHider(id, String(body?.password ?? ""));
        return c.json({ token });
    });

    app.get("/games/:id/events", (c) => {
        const id = c.req.param("id");
        const role = roleOf(c, id);
        const first = found(id);
        // nginx: don't buffer the stream.
        c.header("X-Accel-Buffering", "no");
        return streamSSE(c, async (stream) => {
            const send = (state: GameState) =>
                stream.writeSSE({
                    event: "state",
                    data: JSON.stringify(viewFor(state, role)),
                });
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
            return c.json({ photoId, state: viewFor(state, actor.role) }, 201);
        },
    );

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
