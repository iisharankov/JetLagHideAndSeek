import { readFileSync } from "node:fs";

import * as turf from "@turf/turf";
import { describe, expect, it, vi } from "vitest";

import { createElevation, pixelToLngLat } from "@/maps/elevation";
import { NotApplicableError } from "@/maps/errors";

// Fake terrain: the ground rises 1 km per degree of longitude east of 8°E,
// so the height at any point is known.
const heightAt = (lng: number) => (lng - 8) * 1000;

const rising = (z: number, x: number) => {
    const tile = new Int16Array(256 * 256);
    for (let row = 0; row < 256; row++) {
        for (let col = 0; col < 256; col++) {
            const lng = ((x * 256 + col + 0.5) / (2 ** z * 256)) * 360 - 180;
            tile[row * 256 + col] = Math.round(heightAt(lng));
        }
    }
    return tile;
};

describe("elevation", () => {
    const load = vi.fn(async (z: number, x: number) => rising(z, x));
    const elevation = createElevation(load, [9, 10, 11]);

    it("reads the height at a point from the most detailed tile", async () => {
        const metres = await elevation.elevationAt(47.37, 8.54);
        expect(Math.abs(metres - heightAt(8.54))).toBeLessThan(1);
        expect(load).toHaveBeenCalledWith(
            11,
            expect.any(Number),
            expect.any(Number),
        );
    });

    it("finds where the ground is higher than a given height", async () => {
        const box: [number, number, number, number] = [8.3, 47.2, 8.8, 47.6];
        const grid = await elevation.elevationGrid(box);
        const threshold = heightAt(8.55);
        const higher = elevation.regionAbove(grid, threshold);

        const inside = (lng: number) =>
            turf.booleanPointInPolygon(turf.point([lng, 47.4]), higher);
        expect(inside(8.7)).toBe(true); // further east: higher
        expect(inside(8.4)).toBe(false); // further west: lower
    });

    it("uses coarser tiles for big areas", async () => {
        const small = await elevation.elevationGrid([8.5, 47.3, 8.6, 47.4]);
        const big = await elevation.elevationGrid([5.9, 45.8, 10.5, 47.8]);
        expect(small.zoom).toBe(11);
        expect(big.zoom).toBe(9);
    });

    it("says so when there is no elevation data for the area", async () => {
        const none = createElevation(async () => null, [9, 10, 11]);
        await expect(none.elevationAt(47.37, 8.54)).rejects.toBeInstanceOf(
            NotApplicableError,
        );
        await expect(
            none.elevationGrid([8.5, 47.3, 8.6, 47.4]),
        ).rejects.toBeInstanceOf(NotApplicableError);
    });
});

describe("real terrain", () => {
    // A real elevation tile (zoom 11, x 1057, y 723, in the Jura) whose
    // 500 m contour includes flat slivers that once made simplifying fail
    // with "invalid polygon".
    const bytes = readFileSync(
        new URL("./fixtures/elevation-11-1057-723.i16", import.meta.url),
    );
    const tile = new Int16Array(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
    );

    it("gives a region turf can simplify", async () => {
        const real = createElevation(async () => tile, [11]);
        const box: [number, number, number, number] = [
            5.82, 46.63, 5.95, 46.74,
        ];
        const higher = real.regionAbove(await real.elevationGrid(box), 500);
        expect(() =>
            turf.simplify(higher, { tolerance: 0.0003 }),
        ).not.toThrow();
    });
});

describe("rough terrain", () => {
    // Every pixel a different height: thousands of tiny contour rings, like
    // single trees or buildings in real elevation data.
    const noisy = (z: number, x: number, y: number) => {
        const tile = new Int16Array(256 * 256);
        for (let i = 0; i < tile.length; i++) {
            tile[i] = ((i * 7919 + x * 104729 + y * 1299709 + z) % 997) + 1;
        }
        return tile;
    };

    it("gives a region that can be simplified and cut like any other", async () => {
        const rough = createElevation(async (z, x, y) => noisy(z, x, y), [11]);
        const box: [number, number, number, number] = [8.5, 47.35, 8.52, 47.37];
        const higher = rough.regionAbove(await rough.elevationGrid(box), 500);
        const simplified = turf.simplify(higher, { tolerance: 0.0003 });
        expect(() =>
            turf.intersect(
                turf.featureCollection([
                    turf.bboxPolygon(box),
                    simplified as any,
                ]),
            ),
        ).not.toThrow();
    });
});

describe("pixelToLngLat", () => {
    it("inverts the web map tile grid", () => {
        // Top-left corner of Zürich's zoom-10 tile (536, 358).
        const [lng, lat] = pixelToLngLat(536 * 256, 358 * 256, 10);
        expect(lng).toBeCloseTo(8.4375, 4);
        expect(lat).toBeCloseTo(47.5172, 3);
    });
});
