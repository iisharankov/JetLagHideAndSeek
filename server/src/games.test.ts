import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { defaultGameSettings } from "@/lib/game/settings";

import { GameRuleError } from "./gameOps";
import { createGameStore, type GameStore } from "./games";

let dir: string;
let games: GameStore;

beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "jetlag-games-"));
    games = createGameStore(":memory:", dir);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const settings = defaultGameSettings("medium", "switzerland");
const start = () =>
    games.create(
        { playArea: { kind: "place" }, zone: {}, settings },
        [],
        "Ana",
    );

describe("game store", () => {
    it("creates a game with a short id and finds it again", () => {
        const game = start();
        expect(game.id).toMatch(/^[A-Za-z0-9]{8}$/);
        expect(games.get(game.id)?.version).toBe(1);
        expect(games.get("nope")).toBeUndefined();
    });

    it("imports questions from a game played alone as answered", () => {
        const game = games.create(
            { playArea: {}, zone: {}, settings },
            [{ id: "radius", key: 7, data: { lat: 47, lng: 8, within: true } }],
            "Ana",
        );
        expect(game.questions["7"]).toMatchObject({
            state: "answered",
            createdBy: "Ana",
        });
    });

    it("applies changes and tells subscribers", () => {
        const game = start();
        const seen: number[] = [];
        const unsubscribe = games.subscribe(game.id, (state) =>
            seen.push(state.version),
        );
        games.apply(
            game.id,
            { type: "askPhoto", name: "Tree" },
            {
                name: "Ana",
                role: "seeker",
            },
        );
        unsubscribe();
        games.apply(
            game.id,
            { type: "askPhoto", name: "Sky" },
            {
                name: "Ana",
                role: "seeker",
            },
        );
        expect(seen).toEqual([2]);
        expect(games.get(game.id)?.photoRequests).toHaveLength(2);
    });

    it("lets the first hider set a password, and later ones need it", () => {
        const game = start();
        const token = games.claimHider(game.id, "secret");
        expect(games.isHider(game.id, token)).toBe(true);
        expect(games.get(game.id)?.hasHider).toBe(true);

        expect(games.claimHider(game.id, "secret")).toBe(token);
        expect(() => games.claimHider(game.id, "wrong")).toThrow(GameRuleError);
        expect(games.isHider(game.id, "made-up")).toBe(false);
    });

    it("a new round frees the hider role for the next hider", () => {
        const game = start();
        const token = games.claimHider(game.id, "secret");
        games.apply(
            game.id,
            { type: "newRound" },
            {
                name: "Ana",
                role: "seeker",
            },
        );
        expect(games.isHider(game.id, token)).toBe(false);
        expect(games.get(game.id)?.hasHider).toBe(false);
        expect(games.claimHider(game.id, "other")).not.toBe(token);
    });

    it("stores photos and links an answer to its photo question", () => {
        const game = start();
        const asked = games.apply(
            game.id,
            { type: "askPhoto", name: "Tree" },
            {
                name: "Ana",
                role: "seeker",
            },
        );
        const request = asked.photoRequests[0];

        const bytes = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]);
        const { state, photoId } = games.addPhoto(
            game.id,
            bytes,
            "image/jpeg",
            { name: "Ben", role: "hider" },
            { requestId: request.id },
        );
        expect(state.photos[0]).toMatchObject({ id: photoId, by: "Ben" });
        expect(state.photoRequests[0].photoId).toBe(photoId);
        expect(games.readPhoto(game.id, photoId)).toEqual({
            bytes: Buffer.from(bytes),
            type: "image/jpeg",
        });
        expect(games.readPhoto(game.id, "../../etc/passwd")).toBeUndefined();
    });

    it("deletes games (and their photos) nobody has touched for a year", () => {
        const old = start();
        games.addPhoto(old.id, new Uint8Array([1]), "image/jpeg", {
            name: "Ana",
            role: "seeker",
        });
        const later = Date.now() + 366 * 24 * 3600 * 1000;
        expect(games.cleanup(later)).toBe(1);
        expect(games.get(old.id)).toBeUndefined();
    });
});

describe("games from before the settings update", () => {
    it("get the defaults for settings they don't have", () => {
        const db = new DatabaseSync(":memory:");
        const store = createGameStore(db, dir);
        const old = JSON.stringify({
            ...start(),
            id: "oldgame1",
            settings: { size: "large", seekersCanAnswer: true },
        });
        db.prepare(
            "INSERT INTO games (id, state, updated_at) VALUES (?, ?, ?)",
        ).run("oldgame1", old, Date.now());

        const loaded = store.get("oldgame1")!;
        expect(loaded.settings.size).toBe("large");
        expect(loaded.settings.seekersCanAnswer).toBe(true);
        expect(loaded.settings.stationKinds).toEqual({
            halts: true,
            trams: false,
            boats: false,
        });
        expect(loaded.settings.hidingRadiusKm).toBe(1);
        expect(loaded.settings.disabledQuestions).toContain(
            "measuring:coastline",
        );
    });
});
