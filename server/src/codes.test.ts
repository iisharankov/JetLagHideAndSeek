// Who may make games (the owner's Q49 and Q56 answers): the admin code from
// the server's .env, creator codes the admin hands out and revokes, five
// games a day per creator code. Everyone else joins by link.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "./app";
import { createGameStore } from "./games";

const ADMIN = "admin-code-for-tests-123";

let app: ReturnType<typeof createApp>;
let time = Date.UTC(2026, 10, 9, 10);

const build = (adminCode = ADMIN) => {
    const db = new DatabaseSync(":memory:");
    const games = createGameStore(
        db,
        mkdtempSync(join(tmpdir(), "jetlag-codes-")),
    );
    return createApp({ games, adminCode });
};

beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    time = Date.UTC(2026, 10, 9, 10);
    vi.setSystemTime(time);
    app = build();
});

afterEach(() => {
    vi.useRealTimers();
});

const later = (ms: number) => {
    time += ms;
    vi.setSystemTime(time);
};

const call = (
    path: string,
    {
        method = "POST",
        body,
        headers = {},
    }: {
        method?: string;
        body?: unknown;
        headers?: Record<string, string>;
    } = {},
) =>
    app.request(`/api${path}`, {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
    });

const asAdmin = { "X-Admin-Code": ADMIN };

const newGame = (code?: string) =>
    call("/games", {
        body: { playArea: { kind: "place" }, zone: {}, by: "Ana" },
        headers: code ? { "X-Creator-Code": code } : {},
    });

const makeCode = async (name: string) => {
    const response = await call("/admin/codes", {
        body: { name },
        headers: asAdmin,
    });
    expect(response.status).toBe(201);
    return (await response.json()) as {
        id: string;
        code: string;
        name: string;
    };
};

describe("making games", () => {
    it("needs a code: without one, ask the organiser", async () => {
        const response = await newGame();
        expect(response.status).toBe(403);
        expect((await response.json()).error).toBe(
            "Ask the organiser for a creator code.",
        );
        expect((await newGame("NOT-A-CODE-1")).status).toBe(403);
    });

    it("is refused altogether on a server without an admin code", async () => {
        app = build("");
        const response = await newGame("anything-at-all");
        expect(response.status).toBe(403);
        expect((await response.json()).error).toMatch(/no admin code set/);
    });

    it("works with a creator code, five games a day each", async () => {
        const { code, name } = await makeCode("Ana's code");
        expect(name).toBe("Ana's code");
        expect(code).toMatch(
            /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/,
        );
        for (let i = 0; i < 5; i++) {
            // Typed any old way.
            const made = await newGame(
                i === 0 ? code.toLowerCase().replace(/-/g, " ") : code,
            );
            expect(made.status).toBe(201);
            const body = await made.json();
            expect(body.organiserToken).toMatch(/^[\w-]{20,}$/);
        }
        const sixth = await newGame(code);
        expect(sixth.status).toBe(429);
        expect((await sixth.json()).error).toMatch(/5 games today/);
        // The admin sees how many it made today.
        const list = await (
            await call("/admin/codes", { method: "GET", headers: asAdmin })
        ).json();
        expect(list.codes).toEqual([
            expect.objectContaining({
                name: "Ana's code",
                gamesToday: 5,
                revokedAt: null,
            }),
        ]);
        // The plain code is shown once, never listed again.
        expect(JSON.stringify(list)).not.toContain(code);
        // A new day in Zürich, five more.
        later(14 * 3600_000);
        expect((await newGame(code)).status).toBe(201);
    });

    it("stops for a revoked code; its games stay", async () => {
        const { id, code } = await makeCode("Ben's code");
        const made = await newGame(code);
        const { state } = await made.json();
        const revoked = await call(`/admin/codes/${id}`, {
            method: "DELETE",
            headers: asAdmin,
        });
        expect(revoked.status).toBe(200);
        const refused = await newGame(code);
        expect(refused.status).toBe(403);
        expect((await refused.json()).error).toMatch(/no longer works/);
        expect(
            (await call(`/games/${state.id}`, { method: "GET" })).status,
        ).toBe(200);
    });

    it("works with the admin code, twenty a day", async () => {
        for (let i = 0; i < 20; i++) {
            expect((await newGame(ADMIN)).status).toBe(201);
        }
        expect((await newGame(ADMIN)).status).toBe(429);
    });

    it("limits wrong codes to five a minute", async () => {
        for (let i = 0; i < 5; i++) {
            expect((await newGame(`WRONG-CODE-${i}`)).status).toBe(403);
        }
        const { code } = await makeCode("Cleo's code");
        expect((await newGame(code)).status).toBe(429);
        later(61_000);
        expect((await newGame(code)).status).toBe(201);
    });
});

describe("a code typed on a phone", () => {
    it("says what it is, so the phone shows Start or the Admin section", async () => {
        const { code } = await makeCode("Dan's code");
        const check = async (typed: string) => {
            const response = await call("/codes/mine", {
                method: "GET",
                headers: { "X-Creator-Code": typed },
            });
            return { status: response.status, body: await response.json() };
        };
        expect(await check(ADMIN)).toEqual({
            status: 200,
            body: { kind: "admin", name: "Admin" },
        });
        expect(await check(code)).toEqual({
            status: 200,
            body: { kind: "creator", name: "Dan's code" },
        });
        const wrong = await check("NOPE-NOPE-NOPE");
        expect(wrong.status).toBe(403);
    });
});

describe("the admin", () => {
    it("is refused with a wrong code, with no hint, five tries a minute", async () => {
        for (let i = 0; i < 5; i++) {
            const response = await call("/admin/codes", {
                method: "GET",
                headers: { "X-Admin-Code": `${ADMIN}x` },
            });
            expect(response.status).toBe(403);
            expect(await response.json()).toEqual({ error: "Not allowed." });
        }
        const blocked = await call("/admin/codes", {
            method: "GET",
            headers: asAdmin,
        });
        expect(blocked.status).toBe(429);
        expect(
            (await call("/admin/codes", { body: { name: "x" } })).status,
        ).toBe(429);
    });

    it("sees every game with who made it, and deletes any", async () => {
        const { code } = await makeCode("Ana's code");
        const made = await (await newGame(code)).json();
        const response = await call("/admin/games", {
            method: "GET",
            headers: asAdmin,
        });
        expect(response.status).toBe(200);
        const { games } = await response.json();
        expect(games).toEqual([
            expect.objectContaining({
                id: made.state.id,
                creator: "Ana's code",
                by: "Ana",
                area: "a place",
                players: 0,
            }),
        ]);
        expect(
            (
                await call(`/games/${made.state.id}`, {
                    method: "DELETE",
                    headers: { "X-Organiser-Token": "nope" },
                })
            ).status,
        ).toBe(403);
        expect(
            (
                await call(`/games/${made.state.id}`, {
                    method: "DELETE",
                    headers: asAdmin,
                })
            ).status,
        ).toBe(200);
    });

    it("names each new code; a code needs a name", async () => {
        const response = await call("/admin/codes", {
            body: { name: "  " },
            headers: asAdmin,
        });
        expect(response.status).toBe(400);
    });
});

describe("the hider password from before players", () => {
    it("is 6 characters or more, five wrong tries a minute per game", async () => {
        const made = await (await newGame(ADMIN)).json();
        const id = made.state.id;
        const claim = (password: string) =>
            call(`/games/${id}/hider`, { body: { password, by: "Ben" } });
        const short = await claim("12345");
        expect(short.status).toBe(400);
        expect((await short.json()).error).toMatch(/at least 6 characters/);
        expect((await claim("secret")).status).toBe(200);
        for (let i = 0; i < 5; i++) {
            expect((await claim(`wrong-${i}`)).status).toBe(403);
        }
        expect((await claim("secret")).status).toBe(429);
        later(61_000);
        expect((await claim("secret")).status).toBe(200);
    });
});
