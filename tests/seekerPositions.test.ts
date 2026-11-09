import { describe, expect, it } from "vitest";

import { positionDue, positionsShown } from "@/lib/game/positions";
import type { SeekerPosition } from "@/lib/game/types";

/** `metres` north of Zürich HB, at a time. */
const fix = (metres: number, at: number) => ({
    latitude: 47.3779 + metres / 111_320,
    longitude: 8.5403,
    at,
});

describe("sending a seeker's position", () => {
    it("sends the first fix at once", () => {
        expect(positionDue(null, fix(0, 1000))).toBe(true);
    });

    it("sends a move of 25 m or more, at most every 10 s", () => {
        const last = fix(0, 0);
        expect(positionDue(last, fix(30, 5000))).toBe(false);
        expect(positionDue(last, fix(30, 10_000))).toBe(true);
        expect(positionDue(last, fix(10, 20_000))).toBe(false);
    });

    it("says it's still there once a minute, moving or not", () => {
        expect(positionDue(fix(0, 0), fix(0, 60_000))).toBe(true);
    });
});

describe("the seekers on the map", () => {
    const at = (name: string): SeekerPosition => ({
        playerId: `id-${name}`,
        name,
        latitude: 47.38,
        longitude: 8.54,
        accuracy: 10,
        at: 0,
    });
    const all = [at("Ana"), at("Ben"), at("Cleo")];

    it("are all on the hider's map", () => {
        expect(positionsShown(all, { hider: true, me: "id-Ben" })).toEqual(all);
    });

    it("are the others on a seeker's (their own is the blue dot), by player not name", () => {
        const twoAnas = [...all, { ...at("Ana"), playerId: "id-Ana-2" }];
        expect(
            positionsShown(twoAnas, { hider: false, me: "id-Ana" }).map(
                (p) => p.playerId,
            ),
        ).toEqual(["id-Ben", "id-Cleo", "id-Ana-2"]);
    });
});
