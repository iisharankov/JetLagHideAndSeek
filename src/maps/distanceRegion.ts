import * as turf from "@turf/turf";
import { contours } from "d3-contour";
import type {
    Feature,
    LineString,
    MultiLineString,
    MultiPolygon,
    Position,
} from "geojson";

// "Everything within X km of these lines", computed on a grid instead of by
// buffering each line. Buffering thousands of border lines takes minutes;
// this takes about a second however many lines there are. The result is
// accurate to about one grid cell: at most ~150 m for all of Switzerland,
// and tens of metres for a city or canton.

const KM_PER_DEGREE_LAT = 110.57;
const MAX_CELLS = 4_000_000;
const FAR = 1e20;

/**
 * One pass of the exact Euclidean distance transform (Felzenszwalb &
 * Huttenlocher): squared distances along a single row or column.
 */
const transformLine = (
    f: Float64Array,
    n: number,
    d: Float64Array,
    v: Int32Array,
    z: Float64Array,
) => {
    let k = 0;
    v[0] = 0;
    z[0] = -Infinity;
    z[1] = Infinity;
    for (let q = 1; q < n; q++) {
        let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        while (s <= z[k]) {
            k--;
            s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        }
        k++;
        v[k] = q;
        z[k] = s;
        z[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
        while (z[k + 1] < q) k++;
        d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
    }
};

const linePaths = (
    line: Feature<LineString | MultiLineString>,
): Position[][] =>
    line.geometry.type === "LineString"
        ? [line.geometry.coordinates]
        : line.geometry.coordinates;

type Bbox = [number, number, number, number];

interface Grid {
    minLng: number;
    minLat: number;
    cellLng: number;
    cellLat: number;
    cellKm: number;
    width: number;
    height: number;
}

/** A grid over `bbox` padded by `padKm`, with cells of at least `cellKm`. */
const gridOver = (bbox: Bbox, padKm: number, cellKm: number): Grid => {
    const latMid = (bbox[1] + bbox[3]) / 2;
    const kmPerLng = 111.32 * Math.cos((latMid * Math.PI) / 180);
    const minLng = bbox[0] - padKm / kmPerLng;
    const maxLng = bbox[2] + padKm / kmPerLng;
    const minLat = bbox[1] - padKm / KM_PER_DEGREE_LAT;
    const maxLat = bbox[3] + padKm / KM_PER_DEGREE_LAT;

    const widthKm = (maxLng - minLng) * kmPerLng;
    const heightKm = (maxLat - minLat) * KM_PER_DEGREE_LAT;
    const size = Math.max(
        cellKm,
        Math.sqrt((widthKm * heightKm) / MAX_CELLS),
        0.01,
    );
    return {
        minLng,
        minLat,
        cellLng: size / kmPerLng,
        cellLat: size / KM_PER_DEGREE_LAT,
        cellKm: size,
        width: Math.ceil(widthKm / size) + 1,
        height: Math.ceil(heightKm / size) + 1,
    };
};

/** Distance in km from every cell to the nearest of the lines (or points). */
const distanceField = (
    grid: Grid,
    lines: Feature<LineString | MultiLineString>[],
    points: Position[] = [],
) => {
    const { width, height, minLng, minLat, cellLng, cellLat } = grid;

    // Mark every cell a line passes through.
    const field = new Float64Array(width * height).fill(FAR);
    const mark = (x: number, y: number) => {
        const col = Math.floor(x);
        const row = Math.floor(y);
        if (col >= 0 && col < width && row >= 0 && row < height) {
            field[row * width + col] = 0;
        }
    };
    for (const line of lines) {
        for (const path of linePaths(line)) {
            for (let i = 1; i < path.length; i++) {
                const ax = (path[i - 1][0] - minLng) / cellLng;
                const ay = (path[i - 1][1] - minLat) / cellLat;
                const bx = (path[i][0] - minLng) / cellLng;
                const by = (path[i][1] - minLat) / cellLat;
                const steps = Math.ceil(
                    Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 2,
                );
                for (let step = 0; step <= steps; step++) {
                    const t = steps === 0 ? 0 : step / steps;
                    mark(ax + (bx - ax) * t, ay + (by - ay) * t);
                }
            }
        }
    }
    for (const [lng, lat] of points) {
        mark((lng - minLng) / cellLng, (lat - minLat) / cellLat);
    }

    // Distance from every cell to the nearest marked cell: columns, then rows.
    const n = Math.max(width, height);
    const f = new Float64Array(n);
    const d = new Float64Array(n);
    const v = new Int32Array(n);
    const z = new Float64Array(n + 1);
    for (let col = 0; col < width; col++) {
        for (let row = 0; row < height; row++)
            f[row] = field[row * width + col];
        transformLine(f, height, d, v, z);
        for (let row = 0; row < height; row++)
            field[row * width + col] = d[row];
    }
    for (let row = 0; row < height; row++) {
        const offset = row * width;
        for (let col = 0; col < width; col++) f[col] = field[offset + col];
        transformLine(f, width, d, v, z);
        for (let col = 0; col < width; col++) field[offset + col] = d[col];
    }

    for (let i = 0; i < field.length; i++) {
        field[i] = Math.sqrt(field[i]) * grid.cellKm;
    }
    return field;
};

/** The area where `values` (one per cell) is positive. */
const traceRegion = (grid: Grid, values: number[]): Feature<MultiPolygon> => {
    const [shape] = contours().size([grid.width, grid.height]).thresholds([0])(
        values,
    );

    return turf.rewind(
        turf.multiPolygon(
            shape.coordinates.map((polygon) =>
                polygon.map((ring) =>
                    ring.map(([x, y]) => [
                        grid.minLng + x * grid.cellLng,
                        grid.minLat + y * grid.cellLat,
                    ]),
                ),
            ),
        ),
    ) as Feature<MultiPolygon>;
};

/**
 * The area within `distanceKm` of any of the lines, inside `bbox`
 * ([min lng, min lat, max lng, max lat]).
 */
export const withinDistanceOfLines = (
    lines: Feature<LineString | MultiLineString>[],
    distanceKm: number,
    bbox: Bbox,
): Feature<MultiPolygon> => {
    // Pad the grid so lines just outside the box still count.
    const grid = gridOver(bbox, distanceKm, distanceKm / 25);
    const field = distanceField(grid, lines);

    // Positive inside the distance, negative outside; trace the zero line.
    const values = new Array<number>(field.length);
    for (let i = 0; i < values.length; i++) values[i] = distanceKm - field[i];
    return traceRegion(grid, values);
};

/**
 * For "closer to / further from the nearest line than the seeker?" with
 * hiding zones: the parts of the zones (within `zoneRadiusKm` of a station)
 * that the answer rules out. Nothing outside the zones is ruled out.
 */
export const ruledOutInZones = ({
    lines,
    distanceKm,
    hiderCloser,
    stations,
    zoneRadiusKm,
    bbox,
}: {
    lines: Feature<LineString | MultiLineString>[];
    distanceKm: number;
    hiderCloser: boolean;
    stations: Position[];
    zoneRadiusKm: number;
    bbox: Bbox;
}): Feature<MultiPolygon> => {
    const grid = gridOver(
        bbox,
        Math.max(distanceKm, zoneRadiusKm),
        Math.min(distanceKm, zoneRadiusKm) / 25,
    );
    const toLines = distanceField(grid, lines);
    const toStations = distanceField(grid, [], stations);

    // Positive where both hold: inside a zone, and on the wrong side of the
    // seeker's distance.
    const values = new Array<number>(toLines.length);
    for (let i = 0; i < values.length; i++) {
        const wrongSide = hiderCloser
            ? toLines[i] - distanceKm
            : distanceKm - toLines[i];
        values[i] = Math.min(zoneRadiusKm - toStations[i], wrongSide);
    }
    return traceRegion(grid, values);
};
