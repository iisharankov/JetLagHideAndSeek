// Who you are in a shared game: a player per phone (its private key in a
// header), a six-character code to move to another phone, team passwords,
// and the role that follows the team (or, without teams, the hider flag).
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatCode } from "@/lib/game/players";
import type { GameState, Player } from "@/lib/game/types";

import { createApp } from "./app";
import { createGameStore, type GameStore } from "./games";
import { createPositionStore, type PositionStore } from "./positions";

const ADMIN = "admin-code-for-tests-123";

const KEY = {
    ana: "key-ana-00000000000001",
    ben: "key-ben-00000000000002",
    cleo: "key-cleo-0000000000003",
    dan: "key-dan-00000000000004",
};

let app: ReturnType<typeof createApp>;
let games: GameStore;
let positions: PositionStore;
let db: DatabaseSync;
let time = Date.UTC(2026, 10, 9, 12);

beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    time = Date.UTC(2026, 10, 9, 12);
    vi.setSystemTime(time);
    db = new DatabaseSync(":memory:");
    games = createGameStore(db, mkdtempSync(join(tmpdir(), "jetlag-players-")));
    positions = createPositionStore();
    app = createApp({ games, positions, adminCode: ADMIN });
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
        key,
        headers = {},
    }: {
        method?: string;
        body?: unknown;
        key?: string;
        headers?: Record<string, string>;
    } = {},
) =>
    app.request(`/api${path}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            ...(key ? { "X-Player-Key": key } : {}),
            ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });

const newGame = async (settings: Record<string, unknown> = {}) => {
    const response = await call("/games", {
        body: {
            playArea: { kind: "place" },
            zone: {},
            questions: [],
            by: "Ana",
            settings,
        },
        headers: { "X-Creator-Code": ADMIN },
    });
    expect(response.status).toBe(201);
    const { state, organiserToken } = await response.json();
    return { id: state.id as string, organiserToken: organiserToken as string };
};

type Joined = {
    player: Player;
    role: "hider" | "seeker";
    you: string;
    state: GameState;
};

const joinAs = (id: string, key: string, body: Record<string, unknown>) =>
    call(`/games/${id}/join`, { key, body });

const joined = async (
    id: string,
    key: string,
    body: Record<string, unknown>,
) => {
    const response = await joinAs(id, key, body);
    expect(response.status, await response.clone().text()).toBe(200);
    return (await response.json()) as Joined;
};

const look = async (id: string, key?: string) =>
    (await (await call(`/games/${id}`, { method: "GET", key })).json()) as {
        role: string;
        you: string | null;
        state: GameState;
    };

const op = (id: string, key: string | undefined, body: unknown) =>
    call(`/games/${id}/ops`, { key, body: { op: body, by: "Someone" } });

describe("players", () => {
    it("one player per phone: joining again is the same player, another phone another", async () => {
        const { id } = await newGame();
        const ana = await joined(id, KEY.ana, { name: "Ana" });
        expect(ana.player.name).toBe("Ana");
        expect(ana.role).toBe("seeker");
        expect(ana.you).toBe(ana.player.id);
        expect(ana.player.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
        // A reload, a closed tab: the same player, renamed if they like.
        const again = await joined(id, KEY.ana, { name: " Ana B " });
        expect(again.player.id).toBe(ana.player.id);
        expect(again.player.code).toBe(ana.player.code);
        expect(again.player.name).toBe("Ana B");
        expect(Object.keys(again.state.players)).toHaveLength(1);
        // Another phone with the same name is another player.
        const other = await joined(id, KEY.ben, { name: "Ana B" });
        expect(other.player.id).not.toBe(ana.player.id);
        expect(Object.keys(other.state.players)).toHaveLength(2);
        // Opening the game later knows who you are; the key itself is
        // never in the game, so nobody can act as someone else.
        const seen = await look(id, KEY.ana);
        expect(seen.you).toBe(ana.player.id);
        expect(JSON.stringify(seen.state)).not.toContain(KEY.ana);
        expect(JSON.stringify(seen.state)).not.toContain(KEY.ben);
        // Joining needs a phone that has a key (an updated app).
        expect((await joinAs(id, "", { name: "Cleo" })).status).toBe(400);
    });

    it("a player's code moves them to another phone; the old phone is out", async () => {
        const { id } = await newGame();
        const ana = await joined(id, KEY.ana, { name: "Ana", hider: true });
        expect(ana.role).toBe("hider");
        const typed = formatCode(ana.player.code!).toLowerCase();
        const moved = await call(`/games/${id}/rejoin`, {
            key: KEY.ben,
            body: { code: typed },
        });
        expect(moved.status).toBe(200);
        const ben = (await moved.json()) as Joined;
        expect(ben.role).toBe("hider");
        expect(ben.player.name).toBe("Ana");
        expect(ben.player.hider).toBe(true);
        // The same code, so a further swap works.
        expect(ben.player.code).toBe(ana.player.code);
        expect(ben.state.players[ana.player.id].left).toBe(time);
        // The old phone may look (and learns it was taken over) but not act.
        const refused = await op(id, KEY.ana, {
            type: "askPhoto",
            name: "Tree",
        });
        expect(refused.status).toBe(403);
        expect((await refused.json()).error).toMatch(
            /continued on another phone/,
        );
        const old = await look(id, KEY.ana);
        expect(old.role).toBe("seeker");
        expect(old.state.players[old.you!].left).toBe(time);
        // Five wrong codes a minute per game; the sixth try waits.
        for (let i = 0; i < 5; i++) {
            const wrong = await call(`/games/${id}/rejoin`, {
                key: KEY.cleo,
                body: { code: "AAAAAA" },
            });
            expect(wrong.status).toBe(403);
            expect((await wrong.json()).error).toMatch(/No player/);
        }
        const blocked = await call(`/games/${id}/rejoin`, {
            key: KEY.cleo,
            body: { code: ana.player.code },
        });
        expect(blocked.status).toBe(429);
        later(61_000);
        const back = await call(`/games/${id}/rejoin`, {
            key: KEY.ana,
            body: { code: ana.player.code },
        });
        expect(back.status).toBe(200);
        expect(((await back.json()) as Joined).role).toBe("hider");
        expect((await look(id, KEY.ben)).role).toBe("seeker");
    });

    it("a code carries the team along", async () => {
        const { id } = await newGame({ teams: true });
        const ana = await joined(id, KEY.ana, {
            name: "Ana",
            team: { name: "Owls", password: "owls-secret" },
        });
        const moved = (await (
            await call(`/games/${id}/rejoin`, {
                key: KEY.ben,
                body: { code: ana.player.code },
            })
        ).json()) as Joined;
        expect(moved.player.teamId).toBe(ana.player.teamId);
        expect(moved.state.teams[0].members).toEqual([moved.player.id]);
    });
});

describe("teams", () => {
    it("everyone is in a team; teams have passwords; the hiding team's members are the hiders", async () => {
        const { id } = await newGame({ teams: true, deck: "virtual" });
        // Q58: nobody plays outside a team.
        const alone = await joinAs(id, KEY.ana, { name: "Ana" });
        expect(alone.status).toBe(400);
        expect((await alone.json()).error).toMatch(/team/);
        const short = await joinAs(id, KEY.ana, {
            name: "Ana",
            team: { name: "Owls", password: "12345" },
        });
        expect(short.status).toBe(400);
        expect((await short.json()).error).toMatch(/6 characters/);
        const ana = await joined(id, KEY.ana, {
            name: "Ana",
            team: { name: "Owls", password: "owls-secret" },
            hider: true,
        });
        expect(ana.role).toBe("hider");
        const owls = ana.state.teams[0];
        expect(ana.state.hiderTeamId).toBe(owls.id);
        expect(owls.members).toEqual([ana.player.id]);
        // A wrong password keeps you out.
        const wrong = await joinAs(id, KEY.ben, {
            name: "Ben",
            team: { id: owls.id, password: "owls-secreT" },
        });
        expect(wrong.status).toBe(403);
        expect((await wrong.json()).error).toBe("Wrong team password.");
        // The right one: Ben hides with Ana, no other password, no token.
        const ben = await joined(id, KEY.ben, {
            name: "Ben",
            team: { name: "OWLS", password: "owls-secret" },
        });
        expect(ben.role).toBe("hider");
        expect(ben.state.hider).not.toBeNull();
        expect(ben.state.deck!.remaining.length).toBeGreaterThan(0);
        // Cleo makes Foxes and seeks; she can't hide: Owls do.
        const cleo = await joined(id, KEY.cleo, {
            name: "Cleo",
            team: { name: "Foxes", password: "foxes-pass" },
        });
        expect(cleo.role).toBe("seeker");
        expect(cleo.state.hider).toBeNull();
        expect(cleo.state.deck!.remaining).toEqual([]);
        const claim = await joinAs(id, KEY.cleo, { name: "Cleo", hider: true });
        expect(claim.status).toBe(409);
        expect((await claim.json()).error).toMatch(/Owls hide/);
        // Your own code only; no team's password, in anyone's view.
        expect(cleo.state.players[cleo.player.id].code).toBe(cleo.player.code);
        expect(cleo.state.players[ana.player.id].code).toBeUndefined();
        expect(ben.state.players[ana.player.id].code).toBeUndefined();
        for (const view of [ana.state, ben.state, cleo.state]) {
            expect(JSON.stringify(view)).not.toContain("passwordHash");
        }
        const stream = await look(id, KEY.cleo);
        expect(JSON.stringify(stream.state)).not.toContain("passwordHash");
        expect(stream.state.players[ben.player.id].code).toBeUndefined();
    });

    it("switching team asks its password, five wrong a minute; leaving a team isn't a thing", async () => {
        const { id } = await newGame({ teams: true });
        await joined(id, KEY.ana, {
            name: "Ana",
            team: { name: "Owls", password: "owls-secret" },
        });
        const cleo = await joined(id, KEY.cleo, {
            name: "Cleo",
            team: { name: "Foxes", password: "foxes-pass" },
        });
        const owls = cleo.state.teams.find((t) => t.name === "Owls")!;
        for (let i = 0; i < 5; i++) {
            const wrong = await op(id, KEY.cleo, {
                type: "joinTeam",
                name: "Owls",
                password: "guess-guess",
            });
            expect(wrong.status).toBe(403);
        }
        const blocked = await op(id, KEY.cleo, {
            type: "joinTeam",
            name: "Owls",
            password: "owls-secret",
        });
        expect(blocked.status).toBe(429);
        later(61_000);
        const right = await op(id, KEY.cleo, {
            type: "joinTeam",
            name: "Owls",
            password: "owls-secret",
        });
        expect(right.status).toBe(200);
        const { state } = (await right.json()) as { state: GameState };
        expect(state.teams.find((t) => t.id === owls.id)!.members).toContain(
            cleo.player.id,
        );
        // Foxes are empty now: gone.
        expect(state.teams.map((t) => t.name)).toEqual(["Owls"]);
        const leave = await op(id, KEY.cleo, { type: "leaveTeam" });
        expect(leave.status).toBe(409);
    });

    it("a game without teams has no team changes", async () => {
        const { id } = await newGame();
        await joined(id, KEY.ana, { name: "Ana" });
        const response = await op(id, KEY.ana, {
            type: "joinTeam",
            name: "Owls",
            password: "owls-secret",
        });
        expect(response.status).toBe(409);
        expect((await response.json()).error).toBe("This game has no teams.");
    });

    it("a new round hands the hider's role to the team that claimed it, with nobody typing anything", async () => {
        const { id } = await newGame({ teams: true });
        const ana = await joined(id, KEY.ana, {
            name: "Ana",
            team: { name: "Owls", password: "owls-secret" },
            hider: true,
        });
        await joined(id, KEY.ben, {
            name: "Ben",
            team: { name: "Owls", password: "owls-secret" },
        });
        const cleo = await joined(id, KEY.cleo, {
            name: "Cleo",
            team: { name: "Foxes", password: "foxes-pass" },
        });
        const foxes = cleo.state.teams.find((t) => t.name === "Foxes")!;
        const station = { id: "node/1", name: "Uster", lat: 47.3, lng: 8.7 };
        expect(
            (await op(id, KEY.ben, { type: "hiderReady", station })).status,
        ).toBe(200);
        expect(
            (await op(id, KEY.cleo, { type: "clock", action: "stop" })).status,
        ).toBe(200);
        expect(
            (
                await op(id, KEY.cleo, {
                    type: "claimNextRound",
                    teamId: foxes.id,
                })
            ).status,
        ).toBe(200);
        expect((await op(id, KEY.ana, { type: "newRound" })).status).toBe(200);
        expect((await look(id, KEY.ana)).role).toBe("seeker");
        expect((await look(id, KEY.ben)).role).toBe("seeker");
        const after = await look(id, KEY.cleo);
        expect(after.role).toBe("hider");
        expect(after.state.hiderTeamId).toBe(foxes.id);
        expect(after.state.hiderName).toBe("Foxes");
        void ana;
    });
});

describe("the hider without teams", () => {
    it("is the first to say so, by their player; a new round frees the role", async () => {
        const { id } = await newGame();
        const ana = await joined(id, KEY.ana, { name: "Ana", hider: true });
        expect(ana.role).toBe("hider");
        expect(ana.state.hasHider).toBe(true);
        expect(ana.state.hiderName).toBe("Ana");
        const ben = await joinAs(id, KEY.ben, { name: "Ben", hider: true });
        expect(ben.status).toBe(409);
        expect((await ben.json()).error).toMatch(
            /already the hider.*rejoin with your code/,
        );
        // Ben isn't in the game until he joins as a seeker.
        expect((await look(id, KEY.ben)).state.players).not.toHaveProperty(
            (await look(id, KEY.ben)).you!,
        );
        expect((await op(id, KEY.ben, { type: "newRound" })).status).toBe(200);
        const next = await look(id, KEY.ana);
        expect(next.role).toBe("seeker");
        expect(next.state.hasHider).toBe(false);
        expect(next.state.players[ana.player.id].hider).toBeFalsy();
        expect(
            (await joined(id, KEY.ben, { name: "Ben", hider: true })).role,
        ).toBe("hider");
        // Not hiding after all: the role is free again.
        expect(
            (await joined(id, KEY.ben, { name: "Ben", hider: false })).role,
        ).toBe("seeker");
        expect((await look(id, KEY.ben)).state.hasHider).toBe(false);
    });

    it("phones from before the update still act by name, and a hider by the old password", async () => {
        const { id } = await newGame();
        const claim = await call(`/games/${id}/hider`, {
            body: { password: "secret", by: "Ben" },
        });
        const { token } = await claim.json();
        const asHider = await call(`/games/${id}/ops`, {
            body: {
                op: { type: "setHiderPending", station: null },
                by: "Ben",
            },
            headers: { "X-Hider-Token": token },
        });
        expect(asHider.status).toBe(200);
        const seeker = await call(`/games/${id}/ops`, {
            body: { op: { type: "askPhoto", name: "Tree" }, by: "Ana" },
        });
        expect(seeker.status).toBe(200);
        const { state } = (await seeker.json()) as { state: GameState };
        expect(state.photoRequests[0].askedBy).toBe("Ana");
    });
});

describe("positions", () => {
    it("are the seekers' only, one per player whatever their name", async () => {
        const { id } = await newGame({ teams: true });
        await joined(id, KEY.ana, {
            name: "Ana",
            team: { name: "Owls", password: "owls-secret" },
            hider: true,
        });
        await joined(id, KEY.ben, {
            name: "Ben",
            team: { name: "Owls", password: "owls-secret" },
        });
        const cleo = await joined(id, KEY.cleo, {
            name: "Cleo",
            team: { name: "Foxes", password: "foxes-pass" },
        });
        const at = (latitude: number) => ({
            latitude,
            longitude: 8.5,
            by: "x",
        });
        // Ben hides with Ana: his phone's position stays with him.
        const ben = await call(`/games/${id}/position`, {
            key: KEY.ben,
            body: at(47.3),
        });
        expect(ben.status).toBe(403);
        for (const latitude of [47.3, 47.31]) {
            const sent = await call(`/games/${id}/position`, {
                key: KEY.cleo,
                body: at(latitude),
            });
            expect(sent.status).toBe(200);
        }
        const list = positions.list(id);
        expect(list).toHaveLength(1);
        expect(list[0]).toMatchObject({
            playerId: cleo.player.id,
            name: "Cleo",
            latitude: 47.31,
        });
    });
});

describe("removing a player", () => {
    it("is for whoever started the game, or anyone once the player has been away an hour", async () => {
        const { id, organiserToken } = await newGame();
        const ana = await joined(id, KEY.ana, { name: "Ana" });
        const ben = await joined(id, KEY.ben, { name: "Ben" });
        const cleo = await joined(id, KEY.cleo, { name: "Cleo" });
        const remove = (pid: string, headers: Record<string, string> = {}) =>
            call(`/games/${id}/players/${encodeURIComponent(pid)}`, {
                method: "DELETE",
                key: KEY.dan,
                headers,
            });
        const fresh = await remove(ben.player.id);
        expect(fresh.status).toBe(403);
        expect(
            (
                await remove(ben.player.id, {
                    "X-Organiser-Token": organiserToken,
                })
            ).status,
        ).toBe(200);
        // An hour later Cleo was gone all along; Ana kept the game open.
        later(30 * 60_000);
        await look(id, KEY.ana);
        later(31 * 60_000);
        await look(id, KEY.ana);
        expect((await remove(ana.player.id)).status).toBe(403);
        expect((await remove(cleo.player.id)).status).toBe(200);
        const { state } = await look(id, KEY.ana);
        expect(state.players[ben.player.id].left).toBeDefined();
        expect(state.players[cleo.player.id].left).toBeDefined();
        expect(state.players[ana.player.id].left).toBeUndefined();
        expect((await remove("nobody")).status).toBe(404);
    });
});

describe("games from before players", () => {
    it("load with a placeholder player per team member", () => {
        const state = games.create(
            {
                playArea: { kind: "place" },
                zone: {},
                settings: {} as never,
            },
            [],
            "Ana",
        );
        const old = JSON.parse(
            (
                db
                    .prepare("SELECT state FROM games WHERE id = ?")
                    .get(state.id) as { state: string }
            ).state,
        );
        delete old.players;
        delete old.settings.teams;
        old.teams = [{ id: "t1", name: "Owls", members: ["Ana", "Ben"] }];
        db.prepare("UPDATE games SET state = ? WHERE id = ?").run(
            JSON.stringify(old),
            state.id,
        );
        const loaded = games.get(state.id)!;
        expect(loaded.teams[0].members).toEqual(["legacy:Ana", "legacy:Ben"]);
        expect(loaded.players["legacy:Ana"]).toMatchObject({
            id: "legacy:Ana",
            name: "Ana",
            teamId: "t1",
        });
        // Their teams stay on the scoreboard; the game goes on without the
        // Teams setting (nobody joins or leaves those teams any more).
        expect(loaded.settings.teams).toBe(false);
    });
});
