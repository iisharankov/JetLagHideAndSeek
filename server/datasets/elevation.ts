// Elevation data for the altitude question ("are you higher or lower than
// me?"). The source is the free AWS Terrain Tiles dataset (no key needed:
// https://registry.opendata.aws/terrain-tiles/), as "terrarium" PNG map
// tiles. Each tile is decoded once into a small grid of whole metres
// (256 × 256 little-endian Int16, `<z>/<x>/<y>.i16`) that the app reads
// directly, so phones never decode PNGs.
import {
    copyFileSync,
    existsSync,
    linkSync,
    mkdirSync,
    readFileSync,
    writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { inflateSync } from "node:zlib";

export const TERRAIN_TILES_URL =
    "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

/** Zoom levels kept: 11 ≈ 50 m per cell, 10 ≈ 100 m, 9 ≈ 200 m. */
export const ELEVATION_ZOOMS = [9, 10, 11];

export interface DecodedPng {
    width: number;
    height: number;
    channels: number;
    data: Uint8Array;
}

/** Decodes an 8-bit, non-interlaced RGB or RGBA PNG. */
export const decodePng = (png: Uint8Array): DecodedPng => {
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    let width = 0;
    let height = 0;
    let channels = 0;
    const idat: Uint8Array[] = [];
    for (let offset = 8; offset < png.length; ) {
        const length = view.getUint32(offset);
        const type = String.fromCharCode(
            ...png.subarray(offset + 4, offset + 8),
        );
        const body = png.subarray(offset + 8, offset + 8 + length);
        if (type === "IHDR") {
            const header = new DataView(body.buffer, body.byteOffset, 13);
            width = header.getUint32(0);
            height = header.getUint32(4);
            const [bitDepth, colorType, , , interlace] = body.subarray(8, 13);
            if (
                bitDepth !== 8 ||
                interlace !== 0 ||
                ![2, 6].includes(colorType)
            ) {
                throw new Error("Unsupported PNG (need 8-bit RGB or RGBA)");
            }
            channels = colorType === 2 ? 3 : 4;
        } else if (type === "IDAT") {
            idat.push(body);
        } else if (type === "IEND") {
            break;
        }
        offset += 12 + length;
    }

    const raw = inflateSync(Buffer.concat(idat));
    const stride = width * channels;
    const data = new Uint8Array(height * stride);
    for (let row = 0; row < height; row++) {
        const filter = raw[row * (stride + 1)];
        const line = raw.subarray(
            row * (stride + 1) + 1,
            (row + 1) * (stride + 1),
        );
        const out = row * stride;
        for (let i = 0; i < stride; i++) {
            const left = i >= channels ? data[out + i - channels] : 0;
            const up = row > 0 ? data[out - stride + i] : 0;
            const upLeft =
                row > 0 && i >= channels
                    ? data[out - stride + i - channels]
                    : 0;
            let predicted = 0;
            if (filter === 1) predicted = left;
            else if (filter === 2) predicted = up;
            else if (filter === 3) predicted = (left + up) >> 1;
            else if (filter === 4) {
                const p = left + up - upLeft;
                const pa = Math.abs(p - left);
                const pb = Math.abs(p - up);
                const pc = Math.abs(p - upLeft);
                predicted =
                    pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
            }
            data[out + i] = (line[i] + predicted) & 0xff;
        }
    }
    return { width, height, channels, data };
};

/** A terrarium tile as whole metres above sea level, row by row. */
export const decodeTerrarium = (png: Uint8Array): Int16Array => {
    const { width, height, channels, data } = decodePng(png);
    const metres = new Int16Array(width * height);
    for (let i = 0; i < metres.length; i++) {
        const [r, g, b] = data.subarray(i * channels, i * channels + 3);
        metres[i] = Math.round(r * 256 + g + b / 256 - 32768);
    }
    return metres;
};

const tileX = (lng: number, zoom: number) =>
    Math.floor(((lng + 180) / 360) * 2 ** zoom);

const tileY = (lat: number, zoom: number) => {
    const rad = (lat * Math.PI) / 180;
    return Math.floor(
        ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
            2 ** zoom,
    );
};

/** The tiles of a zoom level covering a box ([min lng, min lat, max lng, max lat]). */
export const tileRange = (
    [minLng, minLat, maxLng, maxLat]: [number, number, number, number],
    zoom: number,
) => ({
    minX: tileX(minLng, zoom),
    maxX: tileX(maxLng, zoom),
    minY: tileY(maxLat, zoom),
    maxY: tileY(minLat, zoom),
});

/**
 * Makes sure every elevation tile for the box is in `cacheDir` (downloading
 * only missing ones), then puts them into `<output>/elevation/`.
 * Returns the number of tiles.
 */
export const buildElevation = async ({
    bbox,
    cacheDir,
    output,
    zooms = ELEVATION_ZOOMS,
    url = TERRAIN_TILES_URL,
}: {
    bbox: [number, number, number, number];
    cacheDir: string;
    output: string;
    zooms?: number[];
    url?: string;
}) => {
    const tiles: [number, number, number][] = [];
    for (const zoom of zooms) {
        const range = tileRange(bbox, zoom);
        for (let x = range.minX; x <= range.maxX; x++) {
            for (let y = range.minY; y <= range.maxY; y++) {
                tiles.push([zoom, x, y]);
            }
        }
    }

    const fetchTile = async ([z, x, y]: [number, number, number]) => {
        const cached = join(cacheDir, `${z}/${x}/${y}.i16`);
        if (!existsSync(cached)) {
            const address = url
                .replace("{z}", `${z}`)
                .replace("{x}", `${x}`)
                .replace("{y}", `${y}`);
            let lastError: unknown;
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    const response = await fetch(address);
                    if (!response.ok)
                        throw new Error(`HTTP ${response.status}`);
                    const metres = decodeTerrarium(
                        new Uint8Array(await response.arrayBuffer()),
                    );
                    mkdirSync(dirname(cached), { recursive: true });
                    writeFileSync(cached, Buffer.from(metres.buffer));
                    lastError = undefined;
                    break;
                } catch (error) {
                    lastError = error;
                }
            }
            if (lastError) {
                throw new Error(`Elevation tile ${address}: ${lastError}`);
            }
        }
        const target = join(output, "elevation", `${z}/${x}/${y}.i16`);
        mkdirSync(dirname(target), { recursive: true });
        try {
            linkSync(cached, target); // same disk: no extra space
        } catch {
            copyFileSync(cached, target);
        }
    };

    // A few downloads at a time.
    const queue = [...tiles];
    await Promise.all(
        Array.from({ length: 8 }, async () => {
            for (let tile = queue.shift(); tile; tile = queue.shift()) {
                await fetchTile(tile);
            }
        }),
    );
    return tiles.length;
};

/** Reads a tile written by buildElevation (for tests and tools). */
export const readElevationTile = (path: string) => {
    const bytes = readFileSync(path);
    return new Int16Array(bytes.buffer, bytes.byteOffset, bytes.length / 2);
};
