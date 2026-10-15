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

/** What the players call each OSM admin level, by country. */
const LEVEL_NAMES: Record<string, Record<number, string>> = {
    CH: {
        4: "canton",
        6: "district",
        8: "municipality",
        9: "city district",
        10: "quarter",
    },
    DE: {
        4: "state",
        5: "region",
        6: "district",
        8: "municipality",
        9: "borough",
        10: "quarter",
    },
    AT: { 4: "state", 6: "district", 8: "municipality", 9: "district" },
    FR: { 4: "region", 6: "department", 7: "arrondissement", 8: "commune" },
    IT: { 4: "region", 6: "province", 8: "municipality" },
    LI: { 8: "municipality" },
};

/** What a player calls an admin level, e.g. "canton" in Switzerland. */
export const adminLevelLabel = (level: number, countryCode?: string) => {
    if (level === 2) return "country";
    const name = LEVEL_NAMES[countryCode?.toUpperCase() ?? ""]?.[level];
    return name ?? `level-${level} region`;
};
