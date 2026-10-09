import * as turf from "@turf/turf";
import type {
    Feature,
    FeatureCollection,
    MultiPolygon,
    Point,
    Polygon,
} from "geojson";

import { NotApplicableError } from "./errors";
import { safeUnion } from "./geo-utils/operators";
import type { Units } from "./schema";

/**
 * Zones cut down to the area still in play, so the map shows only where in
 * each zone the hider could still be. Zones entirely outside are dropped.
 */
export const clipZonesToRemaining = <Z extends Feature<Polygon, any>>(
    zones: Z[],
    remaining: FeatureCollection<Polygon | MultiPolygon>,
): Feature<Polygon | MultiPolygon, Z["properties"]>[] => {
    if (remaining.features.length === 0) return [];
    const area = safeUnion(remaining);
    if (area.geometry.coordinates.length === 0) return [];
    const areaBbox = turf.bbox(area);
    return zones.flatMap((zone) => {
        const box = turf.bbox(zone);
        if (
            box[2] < areaBbox[0] ||
            box[0] > areaBbox[2] ||
            box[3] < areaBbox[1] ||
            box[1] > areaBbox[3]
        ) {
            return [];
        }
        const clipped = turf.intersect(turf.featureCollection([zone, area]));
        if (!clipped) return [];
        return [{ ...clipped, properties: zone.properties }];
    });
};

/** Hiding-zone stations by default: train stations and the smaller halts. */
export const DEFAULT_STATION_FILTERS = ["[railway=station]", "[railway=halt]"];
export const TRAM_STOPS = "[railway=tram_stop]";
export const BOAT_STOPS = "[amenity=ferry_terminal]";

/** Adds or removes one kind of station from the hiding-zone filters. */
export const withStationKind = (
    filters: string[],
    kind: string,
    included: boolean,
): string[] => {
    if (included) return filters.includes(kind) ? filters : [...filters, kind];
    return filters.filter((filter) => filter !== kind);
};

/**
 * Can someone hiding within `hidingRadius` of a station be closer to (or, if
 * not `hiderCloser`, further from) the nearest place than the seeker is?
 */
export const measuringCouldMatch = ({
    stationDistanceKm,
    seekerDistanceKm,
    hidingRadius,
    hidingRadiusUnit,
    hiderCloser,
}: {
    stationDistanceKm: number;
    seekerDistanceKm: number;
    hidingRadius: number;
    hidingRadiusUnit: Units;
    hiderCloser: boolean;
}) => {
    const radiusKm = turf.convertLength(
        hidingRadius,
        hidingRadiusUnit,
        "kilometers",
    );
    return hiderCloser
        ? stationDistanceKm < seekerDistanceKm + radiusKm
        : stationDistanceKm > seekerDistanceKm - radiusKm;
};

/**
 * Runs `search` with a doubling radius until something is found, up to
 * `maxKm`. Throws NotApplicableError when nothing exists within reach,
 * instead of searching forever.
 */
export const expandingSearch = async <T>(
    search: (radiusKm: number) => Promise<T[]>,
    {
        startKm,
        maxKm,
        what = "matching places",
    }: { startKm: number; maxKm: number; what?: string },
) => {
    for (let radiusKm = startKm; ; radiusKm = Math.min(radiusKm * 2, maxKm)) {
        const found = await search(radiusKm);
        if (found.length > 0) return { found, radiusKm };
        if (radiusKm >= maxKm) break;
    }
    throw new NotApplicableError(`No ${what} within ${maxKm} km.`);
};

/**
 * All places that could be the nearest one for someone hiding in a station's
 * zone: anything within (distance to the nearest place + 2 × hiding radius)
 * of the station. Searches again with a bigger radius when that reach goes
 * past the first search.
 */
export const placesNearStation = async <F extends Feature<Point>>(
    search: (radiusKm: number) => Promise<F[]>,
    station: Feature<Point>,
    {
        hidingRadiusKm,
        startKm,
        maxKm,
        what,
    }: {
        hidingRadiusKm: number;
        startKm: number;
        maxKm: number;
        what?: string;
    },
): Promise<F[]> => {
    let { found, radiusKm } = await expandingSearch(search, {
        startKm,
        maxKm,
        what,
    });

    for (;;) {
        const measured = found.map((place) => ({
            place,
            km: turf.distance(station, place, { units: "kilometers" }),
        }));
        const reachKm =
            Math.min(...measured.map((m) => m.km)) + 2 * hidingRadiusKm;

        if (reachKm <= radiusKm || radiusKm >= maxKm) {
            return measured.filter((m) => m.km < reachKm).map((m) => m.place);
        }

        radiusKm = Math.min(reachKm, maxKm);
        found = await search(radiusKm);
    }
};
