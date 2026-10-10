// What the seekers' question refers to, worked out for the hider: the
// station the seekers are at, their zone, the nearest zoo… The question
// itself only carries a point, and the hider must be told what it means.
import * as turf from "@turf/turf";
import type { FeatureCollection, Point } from "geojson";
import osmtogeojson from "osmtogeojson";

import { mapGeoLocation } from "@/lib/context";
import { memoizeAsync } from "@/lib/memoizeAsync";
import { TYPES } from "@/lib/questionInfo";
import { adminLevelLabel } from "@/maps/adminBorders";
import {
    findAdminBoundary,
    findPlacesInZone,
    nearestToQuestion,
} from "@/maps/api";
import { DEFAULT_STATION_FILTERS } from "@/maps/hidingZones";
import type {
    HomeGameMatchingQuestions,
    HomeGameMeasuringQuestions,
    Question,
} from "@/maps/schema";
import { stationSignName } from "@/maps/stationNames";

const HOME_GAME = [
    "aquarium",
    "zoo",
    "theme_park",
    "peak",
    "museum",
    "hospital",
    "cinema",
    "library",
    "golf_course",
    "consulate",
    "park",
];
const STATION_TYPES = [
    "same-first-letter-station",
    "same-length-station",
    "same-train-line",
];

/** The station nearest a point, named as on its sign (halts count too). */
const nearestStationName = memoizeAsync(
    async (lat: number, lng: number) => {
        const places = osmtogeojson(
            await findPlacesInZone(
                DEFAULT_STATION_FILTERS[0],
                "Finding train stations...",
                "nwr",
                "center",
                DEFAULT_STATION_FILTERS.slice(1),
            ),
        ) as FeatureCollection<Point>;
        if (places.features.length === 0) return null;
        const nearest = turf.nearestPoint(turf.point([lng, lat]), places);
        return stationSignName(nearest.properties) ?? null;
    },
    (lat, lng) => `${lat.toFixed(5)},${lng.toFixed(5)}`,
);

const typeLabel = (category: "matching" | "measuring", type: string) =>
    (TYPES[category] as Record<string, { label: string }>)[type]?.label ??
    type.replace(/[-_]/g, " ");

/**
 * One line for the hider about what the seekers' question is measured
 * against, or null when the question says it all (radar, thermometer).
 */
export const questionReference = async (
    question: Question,
): Promise<string | null> => {
    const data = question.data as Record<string, any>;
    if (question.id === "matching") {
        if (STATION_TYPES.includes(data.type)) {
            const name = await nearestStationName(data.lat, data.lng);
            return name ? `The seekers' station: ${name}` : null;
        }
        if (HOME_GAME.includes(data.type)) {
            const nearest = await nearestToQuestion(
                question.data as HomeGameMatchingQuestions,
            );
            const name = nearest?.properties?.name;
            return name
                ? `The seekers' nearest of "${typeLabel("matching", data.type)}": ${name}`
                : null;
        }
        if (data.type === "zone" || data.type === "letter-zone") {
            const zone = await findAdminBoundary(
                data.lat,
                data.lng,
                data.cat.adminLevel,
            );
            const name =
                zone?.properties?.name ?? zone?.properties?.["name:en"];
            const kind = adminLevelLabel(
                data.cat.adminLevel,
                mapGeoLocation.get().properties.countrycode,
            );
            return name ? `The seekers' ${kind}: ${name}` : null;
        }
        return null;
    }
    if (question.id === "measuring" && HOME_GAME.includes(data.type)) {
        const nearest = await nearestToQuestion(
            question.data as HomeGameMeasuringQuestions,
        );
        const name = nearest?.properties?.name;
        const km = nearest?.properties?.distanceToPoint;
        return name
            ? `The seekers' nearest of "${typeLabel("measuring", data.type)}": ${name}${
                  typeof km === "number" ? ` (${km.toFixed(1)} km away)` : ""
              }`
            : null;
    }
    return null;
};
