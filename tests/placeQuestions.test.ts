import * as turf from "@turf/turf";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { mapGeoJSON } from "@/lib/context";
import { adjustPerMatching } from "@/maps/questions/matching";
import { adjustPerMeasuring } from "@/maps/questions/measuring";
import {
    type MatchingQuestion,
    type MeasuringQuestion,
    questionSchema,
} from "@/maps/schema";

// Reference data around Basel: the EuroAirport is in France, just outside a
// play area drawn around the city; Zürich's airport is far to the east.
// (The made-up "nearest airport" map splits the area at 7.8°E.)
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
        "voronoi-airports": {
            type: "FeatureCollection",
            features: [
                {
                    type: "Feature",
                    bbox: [5.5, 45.6, 7.8, 48.1],
                    properties: {
                        key: "way/1",
                        name: "EuroAirport",
                        lat: 47.59,
                        lon: 7.529,
                    },
                    geometry: box(5.5, 45.6, 7.8, 48.1),
                },
                {
                    type: "Feature",
                    bbox: [7.8, 45.6, 11, 48.1],
                    properties: {
                        key: "way/2",
                        name: "Zürich",
                        lat: 47.458,
                        lon: 8.555,
                    },
                    geometry: box(7.8, 45.6, 11, 48.1),
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

describe("airport questions count airports outside the play area", () => {
    it("measuring: closer to the nearest airport, which is in France", async () => {
        const q = question<MeasuringQuestion>("measuring", {
            type: "airport",
            lat: 47.55,
            lng: 7.75, // ~17 km from the EuroAirport
            hiderCloser: true,
        });
        const result = await adjustPerMeasuring(q, playArea);

        expect(contains(result, 7.56, 47.6)).toBe(true); // ~2 km from it
        expect(contains(result, 7.94, 47.51)).toBe(false); // ~32 km
    });

    it("matching: same nearest airport, from the pre-computed map", async () => {
        const q = question<MatchingQuestion>("matching", {
            type: "airport",
            lat: 47.55,
            lng: 7.75,
            same: true,
        });
        const result = await adjustPerMatching(q, playArea);

        expect(contains(result, 7.7, 47.6)).toBe(true); // EuroAirport side
        expect(contains(result, 7.9, 47.6)).toBe(false); // Zürich side
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

    it("ignores lakes smaller than the chosen size", async () => {
        const q = question<MeasuringQuestion>("measuring", {
            type: "lake",
            lat: 47.53,
            lng: 7.65,
            minLakeAreaKm2: 20,
        });
        await expect(adjustPerMeasuring(q, playArea)).rejects.toThrow(
            "There are no lakes of 20 km² or more.",
        );
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
