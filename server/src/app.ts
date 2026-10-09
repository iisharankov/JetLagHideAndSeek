import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";

import type { ShareStore } from "./shareStore";

const MAX_GAME_BYTES = 2 * 1024 * 1024;

export const createApp = ({ shares }: { shares: ShareStore }) => {
    const app = new Hono().basePath("/api");

    app.get("/health", (c) => c.json({ ok: true }));

    app.post(
        "/share",
        bodyLimit({
            maxSize: MAX_GAME_BYTES,
            onError: (c) => c.json({ error: "The game is too large." }, 413),
        }),
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

    return app;
};
