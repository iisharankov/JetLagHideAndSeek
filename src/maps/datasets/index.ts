// Answers map-data questions from the pre-built reference datasets (see
// categories.ts), so most questions need no live Overpass query.
//
// Every function returns `null`/`undefined` when the datasets can't answer
// (no data installed, an area outside what the data covers, a filter there's
// no file for): callers then fall back to Overpass.
import * as turf from "@turf/turf";
import type {
    Feature,
    FeatureCollection,
    LineString,
    MultiLineString,
    MultiPolygon,
    Polygon,
} from "geojson";

import { memoizeAsync } from "@/lib/memoizeAsync";

import {
    ADMIN_LEVELS,
    DATASET_CATEGORIES,
    type DatasetElement,
    type DatasetManifest,
    type LakeProperties,
    type NearestCellProperties,
    type TrainLinesFile,
} from "./categories";

export type {
    DatasetElement,
    DatasetManifest,
    LakeProperties,
    NearestCellProperties,
} from "./categories";

type Bbox = [number, number, number, number];
type Zone = Feature<Polygon | MultiPolygon, Record<string, any>>;
type Cell = Feature<Polygon | MultiPolygon, NearestCellProperties>;
type Lake = Feature<Polygon | MultiPolygon, LakeProperties>;
type Condition =
    | { key: string; op: "=" | "!=" | "~"; value: string }
    | { key: string; op: "exists" };

/** The `[...]` parts of a filter; brackets inside quotes don't count. */
const filterParts = (filter: string) => {
    const parts: string[] = [];
    let current: string | null = null;
    let quoted = false;
    for (const char of filter) {
        if (current === null) {
            if (char === "[") current = "";
            continue;
        }
        if (char === '"') quoted = !quoted;
        if (char === "]" && !quoted) {
            parts.push(current);
            current = null;
        } else {
            current += char;
        }
    }
    return parts;
};

/** Parses Overpass tag filters like `[railway=station]["iata"][k!=v][k~"re"]`. */
export const parseTagFilter = (filter: string): Condition[] =>
    filterParts(filter).map((body) => {
        const match = body.match(
            /^\s*"?([^"!=~]+)"?\s*(!=|=|~)\s*"?(.*?)"?\s*$/,
        );
        if (!match) {
            return { key: body.trim().replace(/^"|"$/g, ""), op: "exists" };
        }
        const [, key, op, value] = match;
        return { key: key.trim(), op: op as "=" | "!=" | "~", value };
    });

export const matchesTagFilter = (
    tags: Record<string, string>,
    conditions: Condition[],
) =>
    conditions.every((condition) => {
        const value = tags[condition.key];
        switch (condition.op) {
            case "exists":
                return value !== undefined;
            case "=":
                return value === condition.value;
            case "!=":
                return value !== condition.value;
            case "~":
                return (
                    value !== undefined &&
                    new RegExp(condition.value).test(value)
                );
        }
    });

/** The dataset file holding everything a filter can match, if there is one. */
const fileFor = (conditions: Condition[]) => {
    for (const category of DATASET_CATEGORIES) {
        const selects = conditions.some(
            (c) =>
                c.op === "=" &&
                c.key === category.key &&
                category.values.includes(c.value),
        );
        const complete =
            !category.requires ||
            conditions.some((c) => c.key === category.requires);
        if (selects && complete) return category.file;
    }
    return null;
};

const pointOf = (element: DatasetElement): [number, number] =>
    element.center
        ? [element.center.lon, element.center.lat]
        : [element.lon!, element.lat!];

const within = (inner: Bbox, outer: Bbox, slack = 0.01) =>
    inner[0] >= outer[0] - slack &&
    inner[1] >= outer[1] - slack &&
    inner[2] <= outer[2] + slack &&
    inner[3] <= outer[3] + slack;

const bboxesOverlap = (a: Bbox, b: Bbox) =>
    a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];

const matchesSearchType = (element: DatasetElement, searchType: string) =>
    searchType === "nwr" || searchType.includes(element.type[0]);

export const createDatasets = (load: (file: string) => Promise<any | null>) => {
    const file = memoizeAsync(
        async (name: string) => load(name),
        (name) => name,
    );
    const manifest = () => file("manifest") as Promise<DatasetManifest | null>;

    const covers = async (bbox: Bbox) => {
        const info = await manifest();
        return !!info && within(bbox, info.bbox);
    };

    const elements = async (name: string) =>
        ((await file(name)) as { elements: DatasetElement[] } | null)
            ?.elements ?? null;

    const zones = async (level: number) =>
        (
            (await file(`admin-${level}`)) as FeatureCollection<
                Polygon | MultiPolygon
            > | null
        )?.features as Zone[] | undefined;

    const zoneAt = async (lat: number, lng: number, level: number) => {
        const point = turf.point([lng, lat]);
        return (
            (await zones(level))?.find((zone) =>
                turf.booleanPointInPolygon(point, zone),
            ) ?? null
        );
    };

    const circleBbox = (lat: number, lng: number, radiusKm: number): Bbox => {
        const dLat = radiusKm / 111;
        const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
        return [lng - dLng, lat - dLat, lng + dLng, lat + dLat];
    };

    const expandBbox = (bbox: Bbox, km: number): Bbox => {
        const latMid = (bbox[1] + bbox[3]) / 2;
        const dLat = km / 110.57;
        const dLng = km / (111.32 * Math.cos((latMid * Math.PI) / 180));
        return [bbox[0] - dLng, bbox[1] - dLat, bbox[2] + dLng, bbox[3] + dLat];
    };

    const cells = async (set: string) =>
        (
            (await file(`voronoi-${set}`)) as FeatureCollection<
                Polygon | MultiPolygon,
                NearestCellProperties
            > | null
        )?.features as Cell[] | undefined;

    return {
        manifest,

        /** Places matching any of the Overpass filters inside an area. */
        placesInZone: async (
            filters: string[],
            area:
                | FeatureCollection<Polygon | MultiPolygon>
                | Feature<Polygon | MultiPolygon>,
            searchType = "nwr",
        ): Promise<DatasetElement[] | null> => {
            const polygons = ("features" in area ? area.features : [area]).map(
                (polygon) => ({ ...polygon, bbox: turf.bbox(polygon) }),
            );
            const areaBbox = turf.bbox(
                turf.featureCollection(polygons),
            ) as Bbox;
            if (!(await covers(areaBbox))) return null;

            const found = new Map<string, DatasetElement>();
            for (const filter of filters) {
                const conditions = parseTagFilter(filter);
                const name = fileFor(conditions);
                const candidates = name ? await elements(name) : null;
                if (!candidates) return null;

                for (const element of candidates) {
                    if (!matchesSearchType(element, searchType)) continue;
                    if (!matchesTagFilter(element.tags, conditions)) continue;
                    const point = turf.point(pointOf(element));
                    if (
                        polygons.some((polygon) =>
                            turf.booleanPointInPolygon(point, polygon),
                        )
                    ) {
                        found.set(`${element.type}/${element.id}`, element);
                    }
                }
            }
            return [...found.values()];
        },

        /** Places of a type (zoo, museum…) within a radius of a point. */
        placesAround: async (
            type: string,
            lat: number,
            lng: number,
            radiusKm: number,
        ): Promise<DatasetElement[] | null> => {
            if (!(await covers(circleBbox(lat, lng, radiusKm)))) return null;
            const candidates = await elements(`poi-${type}`);
            if (!candidates) return null;

            const center = turf.point([lng, lat]);
            return candidates.filter(
                (element) =>
                    turf.distance(center, turf.point(pointOf(element)), {
                        units: "kilometers",
                    }) <= radiusKm,
            );
        },

        /**
         * The nearest place of a type. Only answers when no place outside the
         * data could be nearer than the one found.
         */
        nearestPlace: async (
            type: string,
            lat: number,
            lng: number,
            accept?: (element: DatasetElement) => boolean,
        ): Promise<DatasetElement | undefined> => {
            const info = await manifest();
            if (!info || !within([lng, lat, lng, lat], info.bbox, 0)) {
                return undefined;
            }
            // Unnamed places can't be compared ("same nearest zoo?").
            const candidates = (await elements(`poi-${type}`))?.filter(
                (element) =>
                    (element.tags.name || element.tags["name:en"]) &&
                    (!accept || accept(element)),
            );
            if (!candidates?.length) return undefined;

            const center = turf.point([lng, lat]);
            // With the wider-area data, every place that is nearest
            // somewhere in the covered area is included.
            const complete = !!info.far;
            let nearest: DatasetElement | undefined;
            let nearestKm = Infinity;
            for (const element of candidates) {
                const km = turf.distance(center, turf.point(pointOf(element)), {
                    units: "kilometers",
                });
                if (km < nearestKm) {
                    nearest = element;
                    nearestKm = km;
                }
            }

            const [minLng, minLat, maxLng, maxLat] = info.bbox;
            const kmPerLng = 111.32 * Math.cos((lat * Math.PI) / 180);
            const toEdgeKm = Math.min(
                (lng - minLng) * kmPerLng,
                (maxLng - lng) * kmPerLng,
                (lat - minLat) * 110.57,
                (maxLat - lat) * 110.57,
            );
            return complete || nearestKm <= toEdgeKm ? nearest : undefined;
        },

        /**
         * The pre-computed cell of the place of a set (see NEAREST_SETS)
         * nearest to a point: null if the set is empty, undefined if there's
         * no map for it or the point is outside the data.
         */
        nearestCell: async (
            set: string,
            lat: number,
            lng: number,
        ): Promise<Cell | null | undefined> => {
            const info = await manifest();
            if (!info || !within([lng, lat, lng, lat], info.bbox, 0)) {
                return undefined;
            }
            const all = await cells(set);
            if (!all) return undefined;
            const point = turf.point([lng, lat]);
            return (
                all.find(
                    (cell) =>
                        within([lng, lat, lng, lat], cell.bbox as Bbox, 0) &&
                        turf.booleanPointInPolygon(point, cell),
                ) ?? null
            );
        },

        /** The pre-computed cells of a set that overlap a box. */
        cellsIn: async (set: string, bbox: Bbox) =>
            (await cells(set))?.filter((cell) =>
                bboxesOverlap(cell.bbox as Bbox, bbox),
            ),

        /**
         * Places of a file that a "closer to the nearest X" question needs
         * for an area: every place that could be someone's nearest, which
         * includes places outside the area. Null if the data can't answer.
         */
        placesForMeasuring: async (
            name: string,
            accept: ((tags: Record<string, string>) => boolean) | undefined,
            bbox: Bbox,
            seeker: { lat: number; lng: number },
        ): Promise<DatasetElement[] | null> => {
            if (!(await covers(bbox))) return null;
            const candidates = (await elements(name))?.filter(
                (element) => !accept || accept(element.tags),
            );
            if (!candidates) return null;
            if (candidates.length === 0) return [];

            // The answer splits the area at the seeker's distance from a
            // place, so places further than that from the area's box don't
            // change anything inside it.
            const from = turf.point([seeker.lng, seeker.lat]);
            const seekerKm = Math.min(
                ...candidates.map((element) =>
                    turf.distance(from, turf.point(pointOf(element))),
                ),
            );
            const reach = expandBbox(bbox, seekerKm + 1);
            return candidates.filter((element) => {
                const [lon, lat] = pointOf(element);
                return within([lon, lat, lon, lat], reach, 0);
            });
        },

        /**
         * The train lines stopping at a station and every station on one of
         * them; undefined without train line data.
         */
        stationsOnSameLine: async (stationKey: string) => {
            const data = (await file("train-lines")) as TrainLinesFile | null;
            if (!data) return undefined;
            const own = new Set(data.stations[stationKey] ?? []);
            const stations = new Set(
                Object.entries(data.stations)
                    .filter(([, lines]) => lines.some((line) => own.has(line)))
                    .map(([key]) => key),
            );
            return {
                lines: [...own].map((line) => data.lines[line].name),
                stations,
            };
        },

        /** Lakes of at least `minAreaKm2`; undefined without lake data. */
        lakes: async (minAreaKm2: number) =>
            (
                (await file("lakes")) as FeatureCollection<
                    Polygon | MultiPolygon,
                    LakeProperties
                > | null
            )?.features.filter(
                (lake) => lake.properties.areaKm2 >= minAreaKm2,
            ) as Lake[] | undefined,

        /** Whether the data covers a box (e.g. a play area). */
        covers,

        /** The zone of a level containing a point; null if none exists there. */
        adminZoneAt: async (lat: number, lng: number, level: number) => {
            if (!(await covers([lng, lat, lng, lat]))) return undefined;
            return zoneAt(lat, lng, level);
        },

        /** Every admin level present at a point, lowest first. */
        adminLevelsAt: async (lat: number, lng: number) => {
            if (!(await covers([lng, lat, lng, lat]))) return undefined;
            const found: { level: number; name: string }[] = [];
            for (const level of ADMIN_LEVELS) {
                const zone = await zoneAt(lat, lng, level);
                if (zone) {
                    found.push({
                        level,
                        name:
                            zone.properties?.name ??
                            zone.properties?.["name:en"] ??
                            "",
                    });
                }
            }
            return found;
        },

        /** An admin area by its OSM relation id. */
        boundaryById: async (id: number) => {
            if (!(await manifest())) return undefined;
            for (const level of ADMIN_LEVELS) {
                const zone = (await zones(level))?.find(
                    (z) => z.properties?.id === id,
                );
                if (zone) return zone;
            }
            return null;
        },

        /** All admin areas of a level that overlap a box. */
        adminZonesIn: async (level: number, bbox: Bbox) => {
            if (!(await covers(bbox))) return undefined;
            return ((await zones(level)) ?? []).filter((zone) =>
                bboxesOverlap(zone.bbox as Bbox, bbox),
            );
        },

        /** Border lines of every admin area of a level that overlaps a box. */
        adminBorderLines: async (
            level: number,
            bbox: Bbox,
        ): Promise<Feature<LineString | MultiLineString>[] | undefined> => {
            if (!(await covers(bbox))) return undefined;
            return ((await zones(level)) ?? [])
                .filter((zone) => bboxesOverlap(zone.bbox as Bbox, bbox))
                .flatMap((zone) => {
                    const outline = turf.polygonToLine(zone);
                    return (
                        outline.type === "FeatureCollection"
                            ? outline.features
                            : [outline]
                    ) as Feature<LineString | MultiLineString>[];
                });
        },

        /** High-speed rail lines overlapping a box. */
        highSpeedLines: async (bbox: Bbox) => {
            if (!(await covers(bbox))) return undefined;
            const lines = (await file(
                "highspeed",
            )) as FeatureCollection<LineString> | null;
            return (lines?.features ?? []).filter((line) =>
                bboxesOverlap(turf.bbox(line) as Bbox, bbox),
            );
        },
    };
};
