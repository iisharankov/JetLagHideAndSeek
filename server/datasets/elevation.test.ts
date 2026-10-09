import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { decodePng, decodeTerrarium, tileRange } from "./elevation";

// A real elevation tile around Zürich (zoom 10, x 536, y 358). Expected
// values were read with an independent PNG decoder (Python's PIL).
const tile = readFileSync(
    new URL("./fixtures/terrarium-10-536-358.png", import.meta.url),
);

describe("decodePng", () => {
    it("decodes an RGB PNG using the Sub, Up and Paeth filters", () => {
        const png = decodePng(tile);
        expect(png.width).toBe(256);
        expect(png.height).toBe(256);
        expect(png.channels).toBe(3);
        const pixel = (x: number, y: number) => {
            const i = (y * png.width + x) * 3;
            return [...png.data.slice(i, i + 3)];
        };
        expect(pixel(0, 0)).toEqual([130, 18, 35]);
        expect(pixel(255, 255)).toEqual([129, 246, 244]);
        expect(pixel(128, 64)).toEqual([130, 17, 65]);
        expect(pixel(17, 200)).toEqual([130, 19, 60]);
        expect(pixel(200, 17)).toEqual([129, 200, 106]);
    });
});

describe("decodeTerrarium", () => {
    it("turns colours into metres above sea level", () => {
        const metres = decodeTerrarium(tile);
        expect(metres).toHaveLength(256 * 256);
        expect(metres[0]).toBe(530); // 530.14
        expect(metres[255 * 256 + 255]).toBe(503); // 502.95
        expect(metres[17 * 256 + 200]).toBe(456); // 456.41
    });
});

describe("tileRange", () => {
    it("lists the tiles covering a box", () => {
        // Zürich's tile at zoom 10.
        expect(tileRange([8.54, 47.37, 8.54, 47.37], 10)).toEqual({
            minX: 536,
            maxX: 536,
            minY: 358,
            maxY: 358,
        });
        const swiss = tileRange([5.5, 45.6, 11.0, 48.1], 10);
        expect(swiss.maxX - swiss.minX + 1).toBe(17);
        expect(swiss.maxY - swiss.minY + 1).toBe(11);
    });
});
