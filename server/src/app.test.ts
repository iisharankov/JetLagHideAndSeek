import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "./app";
import { createGameStore } from "./games";
import { createShareStore } from "./shareStore";

let app: ReturnType<typeof createApp>;

beforeEach(() => {
    app = createApp({
        shares: createShareStore(":memory:"),
        games: createGameStore(
            ":memory:",
            mkdtempSync(join(tmpdir(), "jetlag-api-")),
        ),
    });
});

const share = (body: string) =>
    app.request("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
    });

describe("share links", () => {
    it("stores a game and hands it back by id", async () => {
        const game = JSON.stringify({
            type: "FeatureCollection",
            features: [],
        });

        const created = await share(game);
        expect(created.status).toBe(201);
        const { id } = await created.json();
        expect(id).toMatch(/^[A-Za-z0-9]{10}$/);

        const fetched = await app.request(`/api/share/${id}`);
        expect(fetched.status).toBe(200);
        expect(fetched.headers.get("content-type")).toContain(
            "application/json",
        );
        expect(await fetched.text()).toBe(game);
    });

    it("gives every game its own id", async () => {
        const a = await (await share("{}")).json();
        const b = await (await share("{}")).json();
        expect(a.id).not.toBe(b.id);
    });

    it("rejects anything that isn't a JSON object", async () => {
        expect((await share("not json")).status).toBe(400);
        expect((await share("[1,2]")).status).toBe(400);
        expect((await share("42")).status).toBe(400);
    });

    it("rejects games over 2 MB", async () => {
        const huge = JSON.stringify({ padding: "x".repeat(2 * 1024 * 1024) });
        expect((await share(huge)).status).toBe(413);
    });

    it("answers 404 for unknown ids", async () => {
        expect((await app.request("/api/share/doesNotExist")).status).toBe(404);
    });
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
        expect((await app.request("/api/games/nope")).status).toBe(404);
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

        expect(await next()).toContain('"version":1');
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
