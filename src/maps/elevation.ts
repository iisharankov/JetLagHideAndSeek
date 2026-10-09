// Ground height for the altitude question ("are you higher or lower than
// me?"), from the elevation tiles the server builds (server/datasets/
// elevation.ts): web-map tiles of 256 × 256 whole metres.
import * as turf from "@turf/turf";
import { contours } from "d3-contour";
import type { Feature, MultiPolygon } from "geojson";

import { DATA_URL } from "@/lib/config";
import { memoizeAsync } from "@/lib/memoizeAsync";

import { NotApplicableError } from "./errors";

const TILE = 256;
/** Above this many tiles the next coarser zoom is used (memory, speed). */
const MAX_TILES = 64;

type Bbox = [number, number, number, number];

const worldPixels = (zoom: number) => 2 ** zoom * TILE;

const lngToPixel = (lng: number, zoom: number) =>
    ((lng + 180) / 360) * worldPixels(zoom);

const latToPixel = (lat: number, zoom: number) => {
    const rad = (lat * Math.PI) / 180;
    return (
        ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
        worldPixels(zoom)
    );
};

/** A point of the web map pixel grid (at a zoom) as [lng, lat]. */
export const pixelToLngLat = (
    x: number,
    y: number,
    zoom: number,
): [number, number] => {
    const n = Math.PI * (1 - (2 * y) / worldPixels(zoom));
    return [
        (x / worldPixels(zoom)) * 360 - 180,
        (Math.atan(Math.sinh(n)) * 180) / Math.PI,
    ];
};

export interface ElevationGrid {
    zoom: number;
    /** World pixel of the grid's top-left corner. */
    left: number;
    top: number;
    width: number;
    height: number;
    /** Metres, row by row from the top. */
    values: Float32Array;
}

const NO_DATA = "There's no elevation data for this area on the server.";

/** A ring that still encloses something once straight runs are merged. */
const hasArea = (ring: [number, number][]) => {
    try {
        const cleaned = turf.cleanCoords(turf.polygon([ring]));
        return cleaned.geometry.coordinates[0].length >= 4;
    } catch {
        return false;
    }
};

export const createElevation = (
    loadTile: (z: number, x: number, y: number) => Promise<Int16Array | null>,
    zooms: number[],
) => {
    const tile = memoizeAsync(
        async (z: number, x: number, y: number) => {
            const data = await loadTile(z, x, y);
            if (!data) throw new NotApplicableError(NO_DATA);
            return data;
        },
        (z, x, y) => `${z}/${x}/${y}`,
    );
    const finest = Math.max(...zooms);

    return {
        /** Ground height in metres at a point. */
        elevationAt: async (lat: number, lng: number) => {
            const px = Math.floor(lngToPixel(lng, finest));
            const py = Math.floor(latToPixel(lat, finest));
            const data = await tile(
                finest,
                Math.floor(px / TILE),
                Math.floor(py / TILE),
            );
            return data[(py % TILE) * TILE + (px % TILE)];
        },

        /** Heights covering a box, from the most detailed zoom that fits. */
        elevationGrid: async (bbox: Bbox): Promise<ElevationGrid> => {
            const sorted = [...zooms].sort((a, b) => b - a);
            const ranges = sorted.map((zoom) => ({
                zoom,
                minX: Math.floor(lngToPixel(bbox[0], zoom) / TILE),
                maxX: Math.floor(lngToPixel(bbox[2], zoom) / TILE),
                minY: Math.floor(latToPixel(bbox[3], zoom) / TILE),
                maxY: Math.floor(latToPixel(bbox[1], zoom) / TILE),
            }));
            const count = (r: (typeof ranges)[number]) =>
                (r.maxX - r.minX + 1) * (r.maxY - r.minY + 1);
            const range =
                ranges.find((r) => count(r) <= MAX_TILES) ??
                ranges[ranges.length - 1];

            const columns = range.maxX - range.minX + 1;
            const rows = range.maxY - range.minY + 1;
            const width = columns * TILE;
            const values = new Float32Array(width * rows * TILE);
            await Promise.all(
                Array.from({ length: columns * rows }, async (_, i) => {
                    const tx = i % columns;
                    const ty = Math.floor(i / columns);
                    const data = await tile(
                        range.zoom,
                        range.minX + tx,
                        range.minY + ty,
                    );
                    for (let row = 0; row < TILE; row++) {
                        values.set(
                            data.subarray(row * TILE, (row + 1) * TILE),
                            (ty * TILE + row) * width + tx * TILE,
                        );
                    }
                }),
            );
            return {
                zoom: range.zoom,
                left: range.minX * TILE,
                top: range.minY * TILE,
                width,
                height: rows * TILE,
                values,
            };
        },

        /** Where the ground is at least `metres` high, inside the grid. */
        regionAbove: (
            grid: ElevationGrid,
            metres: number,
        ): Feature<MultiPolygon> => {
            const [shape] = contours()
                .size([grid.width, grid.height])
                .thresholds([metres])(grid.values as unknown as number[]);
            const polygons = shape.coordinates.flatMap((polygon) => {
                const rings = polygon.map((ring) =>
                    ring.map(([x, y]) =>
                        pixelToLngLat(grid.left + x, grid.top + y, grid.zoom),
                    ),
                );
                // Contours of real terrain include flat slivers with no area,
                // which turf can't handle (e.g. when simplifying): drop them.
                if (!hasArea(rings[0])) return [];
                return [[rings[0], ...rings.slice(1).filter(hasArea)]];
            });
            return turf.rewind(
                turf.multiPolygon(polygons),
            ) as Feature<MultiPolygon>;
        },
    };
};

/** The app's elevation data, served next to the other reference data. */
export const elevation = createElevation(
    async (z, x, y) => {
        const response = await fetch(
            `${DATA_URL}/elevation/${z}/${x}/${y}.i16`,
        );
        if (!response.ok) return null;
        return new Int16Array(await response.arrayBuffer());
    },
    [9, 10, 11],
);
