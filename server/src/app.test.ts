import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "./app";
import { createGameStore } from "./games";
import { createPushService, type PushMessage, type PushService } from "./push";

let app: ReturnType<typeof createApp>;
let push: PushService;
let sentPushes: { to: string; message: PushMessage }[];

beforeEach(() => {
    const db = new DatabaseSync(":memory:");
    sentPushes = [];
    push = createPushService(
        db,
        { publicKey: "pub", privateKey: "priv" },
        {
            appUrl: (id) => `/?game=${id}`,
            send: async (to, message) => {
                sentPushes.push({ to: to.endpoint, message });
            },
        },
    );
    const games = createGameStore(
        db,
        mkdtempSync(join(tmpdir(), "jetlag-api-")),
        { onChange: (before, after) => void push.notify(before, after) },
    );
    app = createApp({ games, push });
});

describe("health", () => {
    it("reports ok", async () => {
        const response = await app.request("/api/health");
        expect(await response.json()).toEqual({ ok: true });
    });
});

const json = (body: unknown, headers: Record<string, string> = {}) => ({
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
});

const newGame = async () => {
    const response = await app.request(
        "/api/games",
        json({
            playArea: { kind: "place" },
            zone: {},
            questions: [],
            by: "Ana",
        }),
    );
    expect(response.status).toBe(201);
    return (await response.json()).state.id as string;
};

const op = (id: string, body: unknown, token?: string) =>
    app.request(
        `/api/games/${id}/ops`,
        json(body, token ? { "X-Hider-Token": token } : {}),
    );

const claim = async (id: string, password = "secret") => {
    const response = await app.request(
        `/api/games/${id}/hider`,
        json({ password }),
    );
    return { status: response.status, ...(await response.json()) };
};

describe("shared games", () => {
    it("creates a game anyone with the link can open", async () => {
        const id = await newGame();
        const response = await app.request(`/api/games/${id}`);
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.role).toBe("seeker");
        expect(body.state.id).toBe(id);
        // Settings not sent get defaults.
        expect(body.state.settings.size).toBe("medium");
        expect(body.state.settings.hidingRadiusKm).toBe(0.5);
        // The server's clock, so phones can correct their own.
        expect(typeof body.now).toBe("number");
        expect((await app.request("/api/games/nope")).status).toBe(404);
    });

    it("a game being played is the hider's to delete", async () => {
        const id = await newGame();
        const { token } = await claim(id);
        const asSeeker = await app.request(`/api/games/${id}`, {
            method: "DELETE",
        });
        expect(asSeeker.status).toBe(403);
        expect((await asSeeker.json()).error).toMatch(/Only the hider/);
        const asHider = await app.request(`/api/games/${id}`, {
            method: "DELETE",
            headers: { "X-Hider-Token": token },
        });
        expect(asHider.status).toBe(200);
        expect((await app.request(`/api/games/${id}`)).status).toBe(404);
    });

    it("takes the hider's token only from the header, the live stream included", async () => {
        const id = await newGame();
        await op(id, {
            by: "Ana",
            op: {
                type: "putQuestion",
                question: { id: "radius", key: 1, data: {} },
            },
        });
        const { token } = await claim(id);
        // Neither the URL (logged by servers) nor a cookie (shared by tabs).
        const inUrl = await app.request(`/api/games/${id}?hider=${token}`);
        expect((await inUrl.json()).role).toBe("seeker");
        const inCookie = await app.request(`/api/games/${id}`, {
            headers: { Cookie: `hider_${id}=${token}` },
        });
        expect((await inCookie.json()).role).toBe("seeker");
        // The stream with the header: the hider's view, without the draft.
        const events = await app.request(`/api/games/${id}/events`, {
            headers: { "X-Hider-Token": token },
        });
        const reader = events.body!.getReader();
        const { value } = await reader.read();
        expect(new TextDecoder().decode(value)).not.toContain('"key":1');
        await reader.cancel();
    });

    it("deletes a game on request", async () => {
        const id = await newGame();
        const gone = await app.request(`/api/games/${id}`, {
            method: "DELETE",
        });
        expect(gone.status).toBe(200);
        expect((await app.request(`/api/games/${id}`)).status).toBe(404);
        expect(
            (await app.request(`/api/games/${id}`, { method: "DELETE" }))
                .status,
        ).toBe(404);
    });

    it("applies a change and returns the game as that player sees it", async () => {
        const id = await newGame();
        const response = await op(id, {
            by: "Ana",
            op: {
                type: "putQuestion",
                question: { id: "radius", key: 1, data: { lat: 47, lng: 8 } },
            },
        });
        expect(response.status).toBe(200);
        const { state } = await response.json();
        expect(state.questions["1"].state).toBe("draft");
    });

    it("gives the hider a token, and hides the seekers' drafts from them", async () => {
        const id = await newGame();
        await op(id, {
            by: "Ana",
            op: {
                type: "putQuestion",
                question: { id: "radius", key: 1, data: {} },
            },
        });
        const { token } = await claim(id);
        expect(typeof token).toBe("string");
        expect((await claim(id, "wrong")).status).toBe(403);

        const asHider = await app.request(`/api/games/${id}`, {
            headers: { "X-Hider-Token": token },
        });
        const body = await asHider.json();
        expect(body.role).toBe("hider");
        expect(body.state.questions["1"]).toBeUndefined();
        expect(body.state.hasHider).toBe(true);
    });

    it("refuses changes the rules don't allow, with a reason", async () => {
        const id = await newGame();
        const response = await op(id, {
            by: "Ana",
            op: { type: "castCurse", name: "Curse of the Cairn" },
        });
        expect(response.status).toBe(403);
        expect((await response.json()).error).toMatch(/Only the hider/);
    });

    it("streams the game to every phone as it changes", async () => {
        const id = await newGame();
        const events = await app.request(`/api/games/${id}/events`);
        expect(events.headers.get("content-type")).toContain(
            "text/event-stream",
        );
        const reader = events.body!.getReader();
        const decoder = new TextDecoder();
        const next = async () => {
            let text = "";
            while (!text.includes("\n\n")) {
                const { value } = await reader.read();
                text += decoder.decode(value);
            }
            return text;
        };

        const first = await next();
        expect(first).toContain('"version":1');
        expect(first).toContain('"now":');
        await op(id, { by: "Ana", op: { type: "askPhoto", name: "Tree" } });
        const update = await next();
        expect(update).toContain("event: state");
        expect(update).toContain('"version":2');
        await reader.cancel();
    });

    it("stores photos up to 6 MB and serves them back", async () => {
        const id = await newGame();
        const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]);
        const upload = await app.request(`/api/games/${id}/photos`, {
            method: "POST",
            headers: { "Content-Type": "image/jpeg", "X-Player": "Ana" },
            body: bytes,
        });
        expect(upload.status).toBe(201);
        const { photoId, state } = await upload.json();
        expect(state.photos[0].by).toBe("Ana");

        const photo = await app.request(`/api/games/${id}/photos/${photoId}`);
        expect(photo.headers.get("content-type")).toBe("image/jpeg");
        expect(new Uint8Array(await photo.arrayBuffer())).toEqual(bytes);

        const huge = await app.request(`/api/games/${id}/photos`, {
            method: "POST",
            headers: { "Content-Type": "image/jpeg" },
            body: new Uint8Array(6 * 1024 * 1024 + 1),
        });
        expect(huge.status).toBe(413);
    });
});

describe("push notifications", () => {
    const subscription = {
        endpoint: "https://push.example/abc",
        keys: { p256dh: "p", auth: "a" },
    };

    it("hands out the server's key and keeps a phone's subscription per game", async () => {
        const id = await newGame();
        const key = await (await app.request("/api/push/key")).json();
        expect(typeof key.key).toBe("string");
        const saved = await app.request(
            `/api/games/${id}/push`,
            json({ subscription }),
        );
        expect(saved.status).toBe(200);
        expect(push.count(id)).toBe(1);
        const bad = await app.request(
            `/api/games/${id}/push`,
            json({ subscription: { endpoint: "nope" } }),
        );
        expect(bad.status).toBe(400);
        const gone = await app.request(`/api/games/${id}/push`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        expect(gone.status).toBe(200);
        expect(push.count(id)).toBe(0);
    });

    it("sends what happened to the phones in the game", async () => {
        const id = await newGame();
        await app.request(`/api/games/${id}/push`, json({ subscription }));
        await op(id, { by: "Ana", op: { type: "askPhoto", name: "Tree" } });
        // Seekers aren't told about their own photo questions; a curse they are.
        const { token } = await claim(id);
        await op(
            id,
            {
                by: "Ben",
                op: { type: "castCurse", name: "Curse of the Cairn" },
            },
            token,
        );
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(sentPushes.map((p) => p.message.title)).toEqual([
            "The hider cast Curse of the Cairn",
        ]);
    });
});
