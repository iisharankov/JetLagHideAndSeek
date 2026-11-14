// Several areas on one server (round 49): the main pack at the data's root
// (Switzerland and its borders), and small packs for far cities (Munich,
// Toronto) in areas/<id>/, listed in areas.json, each with its own basemap
// tiles (<id>.pmtiles next to the main file). Every question goes to the
// pack that covers it, so a game in Toronto reads Toronto's pack and nothing
// else; searches look in every pack.
import * as turf from "@turf/turf";

import {
    type Bbox,
    type createDatasets,
    fold,
    nameRank,
    within,
} from "./index";

type Datasets = ReturnType<typeof createDatasets>;

/** An area pack, as areas.json lists it. */
export interface DataArea {
    id: string;
    /** "Munich", "Toronto": for the people choosing. */
    name: string;
    bbox: Bbox;
    /** The country it was built for (ISO), when its pack can't say. */
    country?: string;
}

export interface AreasFile {
    areas: DataArea[];
}

/** Where an area's reference data is served. */
export const areaDataUrl = (dataUrl: string, id: string) =>
    `${dataUrl}/areas/${id}`;

/** An area's basemap: <id>.pmtiles next to the main tile file. */
export const areaTilesUrl = (mainTilesUrl: string, id: string) =>
    mainTilesUrl.replace(/[^/]*$/, `${id}.pmtiles`);

/** The middle of a map tile, as [lng, lat]. */
export const tileCenter = (z: number, x: number, y: number) => {
    const n = 2 ** z;
    const lng = ((x + 0.5) / n) * 360 - 180;
    const lat =
        (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / n))) * 180) /
        Math.PI;
    return [lng, lat] as [number, number];
};

/**
 * The datasets of every pack behind one face (the same calls as one pack's,
 * plus `manifestFor`). The first pack is the main one: it answers what no
 * pack covers, as a single pack did before.
 */
export const createAreaDatasets = (
    packs: () => Promise<{ id: string; datasets: Datasets }[]>,
) => {
    const withBoxes = async () =>
        Promise.all(
            (await packs()).map(async (pack) => ({
                ...pack,
                bbox: (await pack.datasets.manifest())?.bbox ?? null,
            })),
        );
    /** The pack whose box holds this one, else the main pack. */
    const packFor = async (bbox: Bbox) => {
        const all = await withBoxes();
        return (
            all.find((pack) => pack.bbox && within(bbox, pack.bbox)) ?? all[0]
        ).datasets;
    };
    const at = (lat: number, lng: number): Bbox => [lng, lat, lng, lat];
    const each = async () => (await packs()).map((pack) => pack.datasets);
    const main = async () => (await packs())[0].datasets;

    return {
        /** The main pack's manifest. */
        manifest: async () => (await main()).manifest(),

        /** The manifest of the pack whose box holds the middle of `bbox`. */
        manifestFor: async (bbox: Bbox) => {
            const middle = at((bbox[1] + bbox[3]) / 2, (bbox[0] + bbox[2]) / 2);
            return (await packFor(middle)).manifest();
        },

        covers: async (bbox: Bbox) => {
            for (const datasets of await each()) {
                if (await datasets.covers(bbox)) return true;
            }
            return false;
        },

        placesInZone: async (...args: Parameters<Datasets["placesInZone"]>) => {
            const [, area] = args;
            return (await packFor(turf.bbox(area) as Bbox)).placesInZone(
                ...args,
            );
        },

        placesAround: async (
            type: string,
            lat: number,
            lng: number,
            radiusKm: number,
        ) =>
            (await packFor(at(lat, lng))).placesAround(
                type,
                lat,
                lng,
                radiusKm,
            ),

        /** Zones matching a name in every pack, best matches first. */
        searchZones: async (query: string, limit = 12) => {
            const lists = await Promise.all(
                (await each()).map((datasets) =>
                    datasets.searchZones(query, limit),
                ),
            );
            if (lists.every((list) => list === null)) return null;
            const needle = fold(query.trim());
            return lists
                .flatMap((list) => list ?? [])
                .map((zone) => ({
                    zone,
                    rank: nameRank(
                        [zone.properties.name, zone.properties["name:en"]],
                        needle,
                    ),
                }))
                .sort(
                    (a, b) =>
                        a.rank - b.rank ||
                        Number(a.zone.properties.admin_level) -
                            Number(b.zone.properties.admin_level),
                )
                .slice(0, limit)
                .map((entry) => entry.zone);
        },

        /** Places matching a name in every pack, best matches first. */
        searchPlaces: async (query: string, limit = 12) => {
            const lists = await Promise.all(
                (await each()).map((datasets) =>
                    datasets.searchPlaces(query, limit),
                ),
            );
            if (lists.every((list) => list === null)) return null;
            const needle = fold(query.trim());
            return lists
                .flatMap((list) => list ?? [])
                .map((found) => ({
                    found,
                    rank: nameRank(
                        [
                            found.element.tags.name,
                            found.element.tags["name:en"],
                        ],
                        needle,
                    ),
                }))
                .sort((a, b) => a.rank - b.rank)
                .slice(0, limit)
                .map((entry) => entry.found);
        },

        /** A station's lines, from the pack that knows the station. */
        stationsOnSameLine: async (stationKey: string) => {
            let first: Awaited<ReturnType<Datasets["stationsOnSameLine"]>> =
                undefined;
            for (const datasets of await each()) {
                const found = await datasets.stationsOnSameLine(stationKey);
                if (found && found.lines.length > 0) return found;
                first ??= found;
            }
            return first;
        },

        /** The lakes of every pack. */
        lakes: async (minAreaKm2: number) => {
            const lists = await Promise.all(
                (await each()).map((datasets) => datasets.lakes(minAreaKm2)),
            );
            if (lists.every((list) => list === undefined)) return undefined;
            return lists.flatMap((list) => list ?? []);
        },

        adminZoneAt: async (lat: number, lng: number, level: number) =>
            (await packFor(at(lat, lng))).adminZoneAt(lat, lng, level),

        adminLevelsAt: async (lat: number, lng: number) =>
            (await packFor(at(lat, lng))).adminLevelsAt(lat, lng),

        /** An admin area by its OSM relation id, in whichever pack has it. */
        boundaryById: async (id: number) => {
            let first: Awaited<ReturnType<Datasets["boundaryById"]>> =
                undefined;
            for (const datasets of await each()) {
                const zone = await datasets.boundaryById(id);
                if (zone) return zone;
                first ??= zone;
            }
            return first;
        },

        adminZonesIn: async (level: number, bbox: Bbox) =>
            (await packFor(bbox)).adminZonesIn(level, bbox),

        adminBorderLines: async (level: number, bbox: Bbox) =>
            (await packFor(bbox)).adminBorderLines(level, bbox),

        highSpeedLines: async (bbox: Bbox) =>
            (await packFor(bbox)).highSpeedLines(bbox),
    };
};

/**
 * The basemap tile files to draw: the main one, then each area's, each only
 * inside its box (no requests for tiles a file doesn't have; round 49).
 */
export const basemaps = (
    mainTilesUrl: string,
    mainBbox: Bbox | null,
    areas: DataArea[],
) => [
    { url: mainTilesUrl, bbox: mainBbox },
    ...areas.map((area) => ({
        url: areaTilesUrl(mainTilesUrl, area.id),
        bbox: area.bbox,
    })),
];

/** Which area's pack a point is in: a far area's id, or "main". */
export const areaOf = ([lng, lat]: [number, number], areas: DataArea[]) =>
    areas.find(
        ({ bbox: [w, s, e, n] }) =>
            lng >= w && lng <= e && lat >= s && lat <= n,
    )?.id ?? "main";

/**
 * Two points in the same area's pack. A place searched in another area
 * starts a new play area (round 49): nobody plays Zürich + Toronto.
 */
export const sameArea = (
    a: [number, number],
    b: [number, number],
    areas: DataArea[],
) => areaOf(a, areas) === areaOf(b, areas);
