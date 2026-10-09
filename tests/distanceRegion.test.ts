import * as turf from "@turf/turf";
import { describe, expect, it } from "vitest";

import { ruledOutInZones, withinDistanceOfLines } from "@/maps/distanceRegion";

// Two borders running north–south near Zürich, 20 km apart.
const west = turf.lineString([
    [8.4, 47.2],
    [8.4, 47.6],
]);
const east = turf.lineString([
    [8.665, 47.2],
    [8.665, 47.6],
]);
const area: [number, number, number, number] = [8.3, 47.25, 8.8, 47.55];

const inside = (region: any, lng: number, lat: number) =>
    turf.booleanPointInPolygon(turf.point([lng, lat]), region);

describe("withinDistanceOfLines", () => {
    it("covers everything within the distance of any line, and nothing else", () => {
        const region = withinDistanceOfLines([west, east], 3, area);

        expect(inside(region, 8.42, 47.4)).toBe(true); // ~1.5 km from west
        expect(inside(region, 8.65, 47.4)).toBe(true); // ~1.1 km from east
        expect(inside(region, 8.53, 47.4)).toBe(false); // ~10 km from both
        expect(inside(region, 8.75, 47.4)).toBe(false); // ~6.4 km from east
    });

    it("is accurate to within about one grid cell", () => {
        const distanceKm = 2;
        const region = withinDistanceOfLines([west, east], distanceKm, area);

        // Sample a line of points across the area and compare with the
        // exact distance; disagreements may only happen near the boundary.
        for (let lng = 8.3; lng <= 8.8; lng += 0.002) {
            const point = turf.point([lng, 47.4]);
            const exact = Math.min(
                turf.pointToLineDistance(point, west),
                turf.pointToLineDistance(point, east),
            );
            if (Math.abs(exact - distanceKm) < 0.1) continue;
            expect(inside(region, lng, 47.4)).toBe(exact < distanceKm);
        }
    });

    it("handles a whole country quickly", () => {
        const many = Array.from({ length: 400 }, (_, i) =>
            turf.lineString([
                [6 + (i % 20) * 0.22, 46 + Math.floor(i / 20) * 0.09],
                [6.1 + (i % 20) * 0.22, 46.05 + Math.floor(i / 20) * 0.09],
            ]),
        );
        const start = performance.now();
        withinDistanceOfLines(many, 1, [5.95, 45.8, 10.5, 47.8]);
        expect(performance.now() - start).toBeLessThan(5000);
    });
});

describe("ruledOutInZones", () => {
    // Hiding zones: 1 km around a station 1 km from the west border, and
    // around one in the middle, ~10 km from both borders.
    const nearWest: [number, number] = [8.413, 47.4];
    const middle: [number, number] = [8.53, 47.4];
    const zones = {
        stations: [nearWest, middle],
        zoneRadiusKm: 1,
        lines: [west, east],
        distanceKm: 3,
        bbox: area,
    };

    it("rules out the parts of zones further from a border than the seeker", () => {
        const region = ruledOutInZones({ ...zones, hiderCloser: true });

        expect(inside(region, ...middle)).toBe(true); // whole middle zone
        expect(inside(region, 8.413, 47.4)).toBe(false); // 1 km from west
        expect(inside(region, 8.6, 47.45)).toBe(false); // not in a zone
    });

    it("rules out the parts of zones closer to a border than the seeker", () => {
        const region = ruledOutInZones({ ...zones, hiderCloser: false });

        expect(inside(region, 8.413, 47.4)).toBe(true);
        expect(inside(region, ...middle)).toBe(false);
        expect(inside(region, 8.42, 47.3)).toBe(false); // near the border, no zone
    });
});
