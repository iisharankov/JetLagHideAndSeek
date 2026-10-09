import * as turf from "@turf/turf";
import type { Feature, Point } from "geojson";

import type { StationCircle, StationPlace } from "@/maps/api/types";
import { NotApplicableError } from "@/maps/errors";

// Rules for the station-name questions ("same first letter", "same length"):
// - the name is the one on the station sign (OSM `name`), English only as a
//   fallback: "Genève", not "Geneva";
// - the whole name counts, including spaces and punctuation:
//   "Biel/Bienne" is 11 characters;
// - accents don't make a different letter: "Écublens" starts with E.

export const STATION_NAME_RULES =
    'Uses the name on the station sign (e.g. "Genève", not "Geneva"). The whole name counts, spaces and punctuation included ("Biel/Bienne" = 11). Accents are ignored for first letters ("É" = "E").';

export const stationSignName = (
    tags: Record<string, unknown> | undefined,
): string | undefined => {
    const name = tags?.name ?? tags?.["name:en"];
    return typeof name === "string" && name.trim() !== "" ? name : undefined;
};

/** Characters as a person counts them ("Zürich" is 6, however it's encoded). */
export const nameLength = (name: string) => [...name.normalize("NFC")].length;

/** First letter, upper-cased, without accents ("écublens" -> "E"). */
export const firstLetter = (name: string) =>
    name.normalize("NFD").replace(/\p{M}/gu, "").charAt(0).toUpperCase();

export interface StationNameQuestion {
    type: "same-first-letter-station" | "same-length-station";
    same: boolean;
    lengthComparison?: "shorter" | "longer" | "same";
}

export const nearestStation = (
    stations: StationPlace[],
    point: Feature<Point>,
): StationPlace =>
    turf.nearestPoint(
        point,
        turf.featureCollection(stations) as any,
    ) as unknown as StationPlace;

/**
 * Narrows the hiding zones by a station-name answer. The seeker's station is
 * the one nearest to them among *all* stations, since seekers often stand in
 * areas earlier answers already ruled out.
 */
export const applyStationNameQuestion = ({
    question,
    allStations,
    remaining,
    seeker,
}: {
    question: StationNameQuestion;
    allStations: StationPlace[];
    remaining: StationCircle[];
    seeker: Feature<Point>;
}): StationCircle[] => {
    const seekerName = stationSignName(
        nearestStation(allStations, seeker).properties,
    );
    if (!seekerName) {
        throw new NotApplicableError(
            "The station nearest the seeker has no name in the map data.",
        );
    }

    return remaining.filter((circle) => {
        const name = stationSignName(circle.properties.properties);
        if (!name) return false;

        if (question.type === "same-first-letter-station") {
            const same = firstLetter(name) === firstLetter(seekerName);
            return question.same ? same : !same;
        }

        const difference = nameLength(name) - nameLength(seekerName);
        switch (question.lengthComparison ?? "same") {
            case "shorter":
                return difference < 0;
            case "longer":
                return difference > 0;
            default:
                return difference === 0;
        }
    });
};
