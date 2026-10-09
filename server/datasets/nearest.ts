// "Which place is nearest?" maps, computed once at build time instead of in
// the browser. For a set of places (all zoos, all commercial airports…) each
// place gets its Voronoi cell: the part of the core region (where games are
// played) that is nearer to it than to any other place. A matching question
// then only has to find the cell containing the seeker.
import * as turf from "@turf/turf";
import { geoDistance, geoInterpolate } from "d3-geo";
// @ts-expect-error No type declaration
import { geoVoronoi } from "d3-geo-voronoi";
import type { Feature, Polygon, Position } from "geojson";

import {
    type DatasetElement,
    NEAREST_SETS,
    type NearestCellProperties,
} from "@/maps/datasets/categories";

type Bbox = [number, number, number, number];

const EARTH_RADIUS_KM = 6371.0088;
/** Cell edges are great-circle arcs; they're drawn as steps of this length. */
const EDGE_STEP_KM = 5;
/**
 * Distant "ghost" places in a ring around the core. Without them the
 * outermost places get cells wrapping around the whole globe; with them every
 * real cell is bounded, and no ghost is ever nearest anywhere in the core.
 */
const GHOST_COUNT = 24;
const GHOST_DISTANCE_KM = 2500;

/** Points along a ring's great-circle edges, at most EDGE_STEP_KM apart. */
const densify = (ring: Position[]): Position[] => {
    const points: Position[] = [];
    for (let i = 0; i < ring.length - 1; i++) {
        const a = ring[i] as [number, number];
        const b = ring[i + 1] as [number, number];
        const steps = Math.max(
            1,
            Math.ceil((geoDistance(a, b) * EARTH_RADIUS_KM) / EDGE_STEP_KM),
        );
        const along = geoInterpolate(a, b);
        for (let step = 0; step < steps; step++)
            points.push(along(step / steps));
    }
    points.push(points[0]);
    return points;
};

const round = (value: number) => Math.round(value * 1e5) / 1e5;

const overlaps = (a: Bbox, b: Bbox) =>
    a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];

/**
 * The Voronoi cell of every place that is nearest somewhere in `core`,
 * clipped to `core`. `kept` lists those places (indexes into `places`), and
 * `cells[i]` is the cell of place `kept[i]`. Of several places at the same
 * position only the first is kept.
 */
export const nearestCells = (
    places: Position[],
    core: Bbox,
): { kept: number[]; cells: Feature<Polygon>[] } => {
    const sites: number[] = [];
    const seen = new Set<string>();
    places.forEach((place, index) => {
        const key = `${place[0].toFixed(6)},${place[1].toFixed(6)}`;
        if (!seen.has(key)) {
            seen.add(key);
            sites.push(index);
        }
    });

    const center = [(core[0] + core[2]) / 2, (core[1] + core[3]) / 2];
    const ghosts = Array.from(
        { length: GHOST_COUNT },
        (_, k) =>
            turf.destination(
                center,
                GHOST_DISTANCE_KM,
                (360 * k) / GHOST_COUNT - 180,
            ).geometry.coordinates,
    );
    const polygons = geoVoronoi([
        ...sites.map((index) => places[index]),
        ...ghosts,
    ]).polygons().features as Feature<Polygon>[];

    // Great-circle edges can bulge a little beyond their corners.
    const near: Bbox = [core[0] - 1, core[1] - 1, core[2] + 1, core[3] + 1];
    const kept: number[] = [];
    const cells: Feature<Polygon>[] = [];
    sites.forEach((placeIndex, siteIndex) => {
        const ring = polygons[siteIndex]?.geometry?.coordinates?.[0];
        if (!ring || ring.length < 4) return;
        if (!overlaps(turf.bbox(turf.lineString(ring)) as Bbox, near)) return;

        const clipped = turf.bboxClip(turf.polygon([densify(ring)]), core);
        const outer = clipped.geometry.coordinates[0] as Position[] | undefined;
        if (!outer || outer.length < 4 || turf.area(clipped) < 1) return;

        const cell = turf.polygon([
            outer.map(([lng, lat]) => [round(lng), round(lat)]),
        ]);
        kept.push(placeIndex);
        cells.push(turf.rewind(cell) as Feature<Polygon>);
    });
    return { kept, cells };
};

const positionOf = (element: DatasetElement): [number, number] =>
    element.center
        ? [element.center.lon, element.center.lat]
        : [element.lon!, element.lat!];

const keyOf = (element: DatasetElement) => `${element.type}/${element.id}`;

/**
 * Adds the places from the wider area that are nearest somewhere in the core
 * to the category files, and builds the "nearest place" map of every set.
 */
export const buildNearestMaps = (
    places: Map<string, DatasetElement[]>,
    farPlaces: Map<string, DatasetElement[]> | null,
    core: Bbox,
) => {
    const added = new Map<string, Map<string, DatasetElement>>();
    const maps = new Map<string, any>();

    for (const set of NEAREST_SETS) {
        const near = places.get(set.file) ?? [];
        const nearKeys = new Set(near.map(keyOf));
        const candidates = [
            ...near,
            ...(farPlaces?.get(set.file) ?? []).filter(
                (element) => !nearKeys.has(keyOf(element)),
            ),
        ].filter((element) => !set.accept || set.accept(element.tags));
        const seen = new Set<string>();
        const unique = candidates.filter((element) => {
            const identity = set.identity?.(element.tags);
            if (!identity) return true;
            if (seen.has(identity)) return false;
            seen.add(identity);
            return true;
        });

        const { kept, cells } = nearestCells(unique.map(positionOf), core);
        const features = kept.map((index, i) => {
            const element = unique[index];
            const [lon, lat] = positionOf(element);
            if (!nearKeys.has(keyOf(element))) {
                if (!added.has(set.file)) added.set(set.file, new Map());
                added.get(set.file)!.set(keyOf(element), element);
            }
            const properties: NearestCellProperties = {
                key: keyOf(element),
                name: element.tags.name ?? element.tags["name:en"],
                lat,
                lon,
            };
            return { ...cells[i], bbox: turf.bbox(cells[i]), properties };
        });
        maps.set(set.name, { type: "FeatureCollection", features });
    }

    for (const [file, extra] of added) {
        places.set(file, [...(places.get(file) ?? []), ...extra.values()]);
    }
    return maps;
};
