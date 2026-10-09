import * as turf from "@turf/turf";
import { describe, expect, it } from "vitest";

import type { DatasetElement } from "@/maps/datasets/categories";

import { buildNearestMaps, nearestCells } from "./nearest";

// Core region: roughly Switzerland plus a margin.
const core: [number, number, number, number] = [5.5, 45.6, 11.0, 48.1];

const inside = (cell: any, lng: number, lat: number) =>
    turf.booleanPointInPolygon(turf.point([lng, lat]), cell);

describe("nearestCells", () => {
    const places: [number, number][] = [
        [8.55, 47.45], // Zürich
        [6.11, 46.24], // Geneva
        [7.53, 47.59], // Basel (just over the border)
        [8.72, 45.63], // Milan Malpensa
        [11.79, 48.35], // Munich, outside the core
        [2.55, 49.0], // Paris, far away
    ];

    it("keeps only places that are nearest somewhere in the core", () => {
        const { kept } = nearestCells(places, core);
        expect(kept).toEqual([0, 1, 2, 3, 4]);
        expect(kept).not.toContain(5); // nearer places everywhere in the core
    });

    it("gives every kept place the part of the core nearest to it", () => {
        const { kept, cells } = nearestCells(places, core);
        const cellOf = (index: number) => cells[kept.indexOf(index)];

        expect(inside(cellOf(0), 8.54, 47.38)).toBe(true); // Zürich city
        expect(inside(cellOf(1), 6.63, 46.52)).toBe(true); // Lausanne
        expect(inside(cellOf(2), 7.59, 47.56)).toBe(true); // Basel city
        expect(inside(cellOf(3), 8.95, 46.0)).toBe(true); // Lugano
        expect(inside(cellOf(4), 10.9, 48.0)).toBe(true); // near Munich
        expect(inside(cellOf(0), 6.63, 46.52)).toBe(false);
    });

    it("splits the core between the places with no gaps or overlaps", () => {
        const { cells } = nearestCells(places, core);
        for (let lng = 5.6; lng < 11; lng += 0.37) {
            for (let lat = 45.7; lat < 48.1; lat += 0.29) {
                const point = turf.point([lng, lat]);
                const containing = cells.filter((cell) =>
                    turf.booleanPointInPolygon(point, cell),
                );
                expect(containing.length).toBeGreaterThanOrEqual(1);
                // Exactly one, except on a shared edge.
                expect(containing.length).toBeLessThanOrEqual(2);
            }
        }
    });

    it("matches the true nearest place (great-circle distance)", () => {
        const { kept, cells } = nearestCells(places, core);
        for (let lng = 5.6; lng < 11; lng += 0.41) {
            for (let lat = 45.7; lat < 48.1; lat += 0.23) {
                const point = turf.point([lng, lat]);
                const distances = places.map((place) =>
                    turf.distance(point, turf.point(place)),
                );
                const nearest = distances.indexOf(Math.min(...distances));
                const sorted = [...distances].sort((a, b) => a - b);
                // Skip points almost on a boundary.
                if (sorted[1] - sorted[0] < 1) continue;
                const cell = cells[kept.indexOf(nearest)];
                expect(inside(cell, lng, lat)).toBe(true);
            }
        }
    });

    it("handles a single place and duplicate positions", () => {
        const one = nearestCells([[8.5, 47.4]], core);
        expect(one.kept).toEqual([0]);
        expect(inside(one.cells[0], 6, 46)).toBe(true);

        const twice = nearestCells(
            [
                [8.5, 47.4],
                [8.5, 47.4],
                [6.1, 46.2],
            ],
            core,
        );
        expect(twice.kept).toEqual([0, 2]);
    });
});

describe("buildNearestMaps", () => {
    const airport = (
        id: number,
        iata: string,
        lon: number,
        lat: number,
        type: DatasetElement["type"] = "way",
    ): DatasetElement => ({
        type,
        id,
        center: type === "node" ? undefined : { lat, lon },
        ...(type === "node" ? { lat, lon } : {}),
        tags: { aeroway: "aerodrome", iata, name: iata },
    });

    it("adds the far places that are someone's nearest, and only those", () => {
        const places = new Map([
            [
                "airports",
                [
                    airport(1, "ZRH", 8.55, 47.45),
                    airport(4, "GVA", 6.11, 46.24),
                ],
            ],
        ]);
        const far = new Map([
            [
                "airports",
                [
                    airport(2, "MXP", 8.72, 45.63), // nearest in Ticino
                    airport(3, "CDG", 2.55, 49.0), // never nearest
                ],
            ],
        ]);
        const maps = buildNearestMaps(places, far, core);

        expect(
            maps.get("airports").features.map((f: any) => f.properties.key),
        ).toEqual(["way/1", "way/4", "way/2"]);
        expect(places.get("airports")!.map((a) => a.tags.iata)).toEqual([
            "ZRH",
            "GVA",
            "MXP",
        ]);
    });

    it("gives an airport mapped twice a single cell", () => {
        const places = new Map([
            [
                "airports",
                [
                    airport(1, "BSL", 7.529, 47.59),
                    airport(9, "BSL", 7.52, 47.6, "node"),
                    airport(2, "ZRH", 8.55, 47.45),
                ],
            ],
        ]);
        const maps = buildNearestMaps(places, null, core);
        expect(
            maps.get("airports").features.map((f: any) => f.properties.name),
        ).toEqual(["BSL", "ZRH"]);
    });
});
