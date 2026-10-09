import * as turf from "@turf/turf";
import { beforeEach, describe, expect, it } from "vitest";

import {
    customPresets,
    disabledStations,
    hidingRadius,
    hidingRadiusUnits,
    mapGeoLocation,
    polyGeoJSON,
    questions,
} from "@/lib/context";
import {
    applySharedGame,
    parseSharedGame,
    summarizeSharedGame,
} from "@/lib/sharedGame";

const polygon = turf.featureCollection([
    turf.bboxPolygon([8.45, 47.32, 8.62, 47.43]),
]);

const zurich = {
    type: "Feature",
    properties: {
        osm_type: "R",
        osm_id: 1682248,
        osm_key: "place",
        osm_value: "city",
        type: "city",
        name: "Zürich",
        country: "Switzerland",
        countrycode: "CH",
        isHidingZone: true,
        questions: [
            { id: "radius", data: { lat: 47.37, lng: 8.54, radius: 3 } },
        ],
    },
    geometry: { type: "Point", coordinates: [47.37, 8.54] },
    hidingRadius: 600,
    hidingRadiusUnits: "meters",
    disabledStations: ["node/1"],
    presets: [{ id: "p2", name: "Shared preset", type: "custom", data: {} }],
};

describe("parseSharedGame", () => {
    it("loads a plain GeoJSON polygon as the play area", () => {
        const game = parseSharedGame(JSON.stringify(polygon));

        expect(game.playArea).toEqual({ kind: "polygon", polygon });
        expect(game.questions).toEqual([]);
        expect(game.settings).toEqual({});
    });

    it("loads a game exported from the app, filling question defaults", () => {
        const game = parseSharedGame(JSON.stringify(zurich));

        expect(game.playArea.kind).toBe("place");
        expect(game.questions).toHaveLength(1);
        expect(game.questions[0].data).toMatchObject({
            radius: 3,
            within: true,
        });
        expect(game.settings).toMatchObject({
            hidingRadius: 600,
            hidingRadiusUnits: "meters",
            disabledStations: ["node/1"],
        });
    });

    it("rejects text that isn't JSON", () => {
        expect(() => parseSharedGame("not json")).toThrow(/isn't valid/);
    });

    it("rejects questions this version can't read", () => {
        const broken = {
            ...polygon,
            questions: [{ id: "radius", data: { lat: "north" } }],
        };
        expect(() => parseSharedGame(JSON.stringify(broken))).toThrow(
            /questions/,
        );
    });
});

describe("summarizeSharedGame", () => {
    it("describes what the link contains", () => {
        expect(
            summarizeSharedGame(parseSharedGame(JSON.stringify(zurich))),
        ).toBe("1 question in Zürich, Switzerland");
        expect(
            summarizeSharedGame(parseSharedGame(JSON.stringify(polygon))),
        ).toBe("no questions in a drawn play area");
    });
});

describe("applySharedGame", () => {
    beforeEach(() => {
        customPresets.set([
            {
                id: "p1",
                name: "My preset",
                type: "custom",
                data: {},
                createdAt: "2026-01-01T00:00:00.000Z",
            },
        ]);
        hidingRadius.set(0.5);
        hidingRadiusUnits.set("kilometers");
    });

    it("replaces the game but keeps the player's own presets", () => {
        applySharedGame(parseSharedGame(JSON.stringify(zurich)));

        expect(questions.get()).toHaveLength(1);
        expect(mapGeoLocation.get().properties.name).toBe("Zürich");
        expect(polyGeoJSON.get()).toBeNull();
        expect(hidingRadius.get()).toBe(600);
        expect(hidingRadiusUnits.get()).toBe("meters");
        expect(disabledStations.get()).toEqual(["node/1"]);
        expect(
            customPresets
                .get()
                .map((p) => p.id)
                .sort(),
        ).toEqual(["p1", "p2"]);
    });

    it("leaves settings alone that a plain polygon doesn't include", () => {
        applySharedGame(parseSharedGame(JSON.stringify(polygon)));

        expect(polyGeoJSON.get()).toEqual(polygon);
        expect(hidingRadius.get()).toBe(0.5);
        expect(hidingRadiusUnits.get()).toBe("kilometers");
    });
});
