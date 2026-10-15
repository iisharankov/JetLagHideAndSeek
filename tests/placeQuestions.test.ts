import * as turf from "@turf/turf";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { gameSettings, mapGeoJSON } from "@/lib/context";
import { adjustPerMatching } from "@/maps/questions/matching";
import { adjustPerMeasuring } from "@/maps/questions/measuring";
import {
    type MatchingQuestion,
    type MeasuringQuestion,
    questionSchema,
} from "@/maps/schema";

// Reference data around Basel: the EuroAirport is in France, just outside a
// play area drawn around the city; Zürich's airport is far to the east.
const files = vi.hoisted(() => {
    const box = (
        minLng: number,
        minLat: number,
        maxLng: number,
        maxLat: number,
    ) => ({
        type: "Polygon",
        coordinates: [
            [
                [minLng, minLat],
                [maxLng, minLat],
                [maxLng, maxLat],
                [minLng, maxLat],
                [minLng, minLat],
            ],
        ],
    });
    return {
        manifest: {
            version: 1,
            built: "",
            bbox: [5.5, 45.6, 11, 48.1],
            files: {},
        },
        airports: {
            elements: [
                {
                    type: "way",
                    id: 1,
                    center: { lat: 47.59, lon: 7.529 },
                    tags: {
                        aeroway: "aerodrome",
                        iata: "BSL",
                        name: "EuroAirport",
                    },
                },
                {
                    type: "way",
                    id: 2,
                    center: { lat: 47.458, lon: 8.555 },
                    tags: { aeroway: "aerodrome", iata: "ZRH", name: "Zürich" },
                },
            ],
        },
        lakes: {
            type: "FeatureCollection",
            features: [
                {
                    type: "Feature",
                    bbox: [7.6, 47.52, 7.62, 47.54],
                    properties: { name: "Test Lake", areaKm2: 12 },
                    geometry: box(7.6, 47.52, 7.62, 47.54),
                },
            ],
        },
    } as Record<string, unknown>;
});

vi.mock("@/maps/datasets/load", async () => {
    const { createDatasets } = await import("@/maps/datasets");
    return {
        datasets: createDatasets(async (name: string) => files[name] ?? null),
    };
});

// Fake terrain for the altitude question: 1 km higher per degree east of 7°E.
vi.mock("@/maps/elevation", async (importOriginal) => {
    const real = await importOriginal<typeof import("@/maps/elevation")>();
    const tile = (z: number, x: number) => {
        const data = new Int16Array(256 * 256);
        for (let row = 0; row < 256; row++) {
            for (let col = 0; col < 256; col++) {
                const lng =
                    ((x * 256 + col + 0.5) / (2 ** z * 256)) * 360 - 180;
                data[row * 256 + col] = Math.round((lng - 7) * 1000);
            }
        }
        return data;
    };
    return {
        ...real,
        elevation: real.createElevation(
            async (z, x) => tile(z, x),
            [9, 10, 11],
        ),
    };
});

const playArea = turf.featureCollection([
    turf.bboxPolygon([7.55, 47.5, 7.95, 47.65]),
]);

const question = <T>(id: "matching" | "measuring", data: object) =>
    questionSchema.parse({ id, data: { drag: false, ...data } }).data as T;

const contains = (region: any, lng: number, lat: number) =>
    turf.booleanPointInPolygon(turf.point([lng, lat]), region);

beforeEach(() => mapGeoJSON.set(playArea as any));

describe("airport questions count only airports inside the play area", () => {
    it("measuring: no airport inside the play area is a null answer", async () => {
        const q = question<MeasuringQuestion>("measuring", {
            type: "airport",
            lat: 47.55,
            lng: 7.75,
            hiderCloser: true,
        });
        await expect(adjustPerMeasuring(q, playArea)).rejects.toThrow(
            /null answer/,
        );
    });

    it("measuring: closer to the nearest airport inside the area", async () => {
        const area = turf.featureCollection([
            turf.bboxPolygon([7.5, 47.3, 8.8, 47.7]),
        ]);
        mapGeoJSON.set(area as any);
        // ~17 km from the EuroAirport (inside), ~60 km from Zürich's.
        const q = question<MeasuringQuestion>("measuring", {
            type: "airport",
            lat: 47.55,
            lng: 7.75,
            hiderCloser: true,
        });
        const result = await adjustPerMeasuring(q, area);

        expect(contains(result, 7.56, 47.6)).toBe(true); // ~2 km from it
        expect(contains(result, 8.0, 47.55)).toBe(false); // ~36 km
    });

    it("matching: same nearest airport, from the airports inside the area", async () => {
        const area = turf.featureCollection([
            turf.bboxPolygon([7.5, 47.3, 8.8, 47.7]),
        ]);
        mapGeoJSON.set(area as any);
        const q = question<MatchingQuestion>("matching", {
            type: "airport",
            lat: 47.55,
            lng: 7.75,
            same: true,
        });
        const result = await adjustPerMatching(q, area);

        expect(contains(result, 7.7, 47.6)).toBe(true); // EuroAirport side
        expect(contains(result, 8.5, 47.5)).toBe(false); // Zürich side
    });
});

describe("lake shore question", () => {
    it("keeps where the hider is closer to a lake shore than the seeker", async () => {
        const q = question<MeasuringQuestion>("measuring", {
            type: "lake",
            lat: 47.53,
            lng: 7.65, // ~2.3 km east of the lake
            hiderCloser: true,
        });
        const result = await adjustPerMeasuring(q, playArea);

        expect(contains(result, 7.63, 47.53)).toBe(true); // ~0.8 km
        expect(contains(result, 7.61, 47.53)).toBe(true); // on the lake
        expect(contains(result, 7.75, 47.6)).toBe(false); // ~11 km
    });

    it("is a null answer when no big lake reaches into the play area", async () => {
        const area = turf.featureCollection([
            turf.bboxPolygon([7.7, 47.5, 7.95, 47.65]),
        ]);
        mapGeoJSON.set(area as any);
        const q = question<MeasuringQuestion>("measuring", {
            type: "lake",
            lat: 47.53,
            lng: 7.75,
            hiderCloser: true,
        });
        await expect(adjustPerMeasuring(q, area)).rejects.toThrow(
            /null answer/,
        );
    });

    it("ignores lakes smaller than the size set for the game", async () => {
        const before = gameSettings.get();
        gameSettings.set({ ...before, minLakeAreaKm2: 20 });
        try {
            const q = question<MeasuringQuestion>("measuring", {
                type: "lake",
                lat: 47.53,
                lng: 7.65,
            });
            await expect(adjustPerMeasuring(q, playArea)).rejects.toThrow(
                "There are no lakes of 20 km² or more.",
            );
        } finally {
            gameSettings.set(before);
        }
    });
});

describe("altitude question", () => {
    it("keeps where the hider is lower than the seeker (closer to sea level)", async () => {
        const q = question<MeasuringQuestion>("measuring", {
            type: "sea-level",
            lat: 47.55,
            lng: 7.75, // the ground is ~750 m high there
            hiderCloser: true,
        });
        const result = await adjustPerMeasuring(q, playArea);

        expect(contains(result, 7.6, 47.6)).toBe(true); // ~600 m
        expect(contains(result, 7.9, 47.6)).toBe(false); // ~900 m
    });

    it("uses the seeker's own altitude reading when given", async () => {
        const q = question<MeasuringQuestion>("measuring", {
            type: "sea-level",
            lat: 47.55,
            lng: 7.75,
            seekerAltitude: 850, // e.g. on a tower
            hiderCloser: false, // hider is higher
        });
        const result = await adjustPerMeasuring(q, playArea);

        expect(contains(result, 7.9, 47.6)).toBe(true); // ~900 m
        expect(contains(result, 7.8, 47.6)).toBe(false); // ~800 m
    });
});
