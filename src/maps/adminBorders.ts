import * as turf from "@turf/turf";
import type {
    Feature,
    LineString,
    MultiLineString,
    MultiPolygon,
    Polygon,
} from "geojson";

import { withinDistanceOfLines } from "@/maps/distanceRegion";

export type BorderLine = Feature<LineString | MultiLineString>;

/**
 * A zone's outline as line features. A zone made of several pieces (a
 * canton with exclaves, say) gives one feature per piece.
 */
export const boundaryLines = (
    zone: Feature<Polygon | MultiPolygon>,
): BorderLine[] => {
    const outline = turf.polygonToLine(zone);
    return outline.type === "FeatureCollection"
        ? (outline.features as BorderLine[])
        : [outline as BorderLine];
};

/** Distance in km from a point to the nearest of the borders. */
export const nearestBorderKm = (
    borders: BorderLine[],
    point: { lat: number; lng: number },
) =>
    Math.min(
        ...borders
            .flatMap((line) => turf.flatten(line).features)
            .map((line) =>
                turf.pointToLineDistance(
                    turf.point([point.lng, point.lat]),
                    line,
                    {
                        units: "kilometers",
                    },
                ),
            ),
    );

/**
 * Where someone is closer to a border of this level than the seeker: the
 * area within the seeker's distance of *any* of the borders, inside `bbox`.
 *
 * All borders are needed, not just the seeker's own zone's. The border
 * nearest to anyone is always on the edge of the zone they're in, so a hider
 * in another zone measures to that zone's edge.
 */
export const adminBorderRegion = (
    borders: BorderLine[],
    seeker: { lat: number; lng: number },
    bbox: [number, number, number, number],
) => withinDistanceOfLines(borders, nearestBorderKm(borders, seeker), bbox);

const SWISS_LEVELS: Record<number, string> = {
    2: "country",
    4: "canton",
    6: "district",
    8: "municipality",
    9: "city district",
    10: "quarter",
};

/** What a player calls an admin level, e.g. "canton" in Switzerland. */
export const adminLevelLabel = (level: number, countryCode?: string) => {
    if (level === 2) return "country";
    if (countryCode?.toUpperCase() === "CH" && SWISS_LEVELS[level]) {
        return SWISS_LEVELS[level];
    }
    return `level-${level} region`;
};
