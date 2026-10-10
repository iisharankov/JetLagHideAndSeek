import * as turf from "@turf/turf";
import type {
    Feature,
    FeatureCollection,
    MultiPolygon,
    Point,
    Polygon,
} from "geojson";
import osmtogeojson from "osmtogeojson";

import {
    mapGeoJSON,
    mapGeoLocation,
    playAreaKey,
    regionRules,
} from "@/lib/context";
import { hiderAnswerPosition } from "@/lib/hiderSpot";
import { memoizeAsync } from "@/lib/memoizeAsync";
import { adminLevelLabel } from "@/maps/adminBorders";
import {
    findAdminBoundary,
    findPlacesInZone,
    nearestToQuestion,
} from "@/maps/api";
import { datasets } from "@/maps/datasets/load";
import { NotApplicableError } from "@/maps/errors";
import { holedMask, modifyMapData, safeUnion } from "@/maps/geo-utils";
import { geoSpatialVoronoi } from "@/maps/geo-utils";
import { DEFAULT_STATION_FILTERS } from "@/maps/hidingZones";
import type {
    APILocations,
    HomeGameMatchingQuestions,
    MatchingQuestion,
} from "@/maps/schema";
import { firstLetter, nameLength, stationSignName } from "@/maps/stationNames";
import { sharesTrainLineWith } from "@/maps/trainLines";

import { type PlaceKind, placesInPlayArea, seekerNearestCell } from "./places";

const zoneLabel = (adminLevel: number) =>
    adminLevelLabel(adminLevel, mapGeoLocation.get().properties.countrycode);

const ACCENTED: Record<string, string> = {
    A: "AÀÁÂÄÃÅ",
    C: "CÇ",
    E: "EÉÈÊË",
    I: "IÌÍÎÏ",
    N: "NÑ",
    O: "OÒÓÔÖÕ",
    U: "UÙÚÛÜ",
    Y: "YÝŸ",
};

/** Overpass regex class for a letter and its accented forms ("E" -> "[EÉÈÊË]"). */
const letterPattern = (letter: string) =>
    ACCENTED[letter] ? `[${ACCENTED[letter]}]` : letter;

/** What a "same nearest X?" question compares, if it compares places. */
export const matchingPlaceKind = (
    question: MatchingQuestion,
): PlaceKind | null => {
    switch (question.type) {
        case "airport":
            return "airport";
        case "major-city":
            return "city";
        case "aquarium-full":
        case "zoo-full":
        case "theme_park-full":
        case "peak-full":
        case "museum-full":
        case "hospital-full":
        case "cinema-full":
        case "library-full":
        case "golf_course-full":
        case "consulate-full":
        case "park-full":
            return question.type.split("-full")[0] as APILocations;
        default:
            return null;
    }
};

export const findMatchingPlaces = async (question: MatchingQuestion) => {
    if (question.type === "custom-points") return question.geo!;
    const kind = matchingPlaceKind(question);
    return kind ? placesInPlayArea(kind) : undefined;
};

export const determineMatchingBoundary = memoizeAsync(
    async (question: MatchingQuestion) => {
        let boundary;

        switch (question.type) {
            case "aquarium":
            case "zoo":
            case "theme_park":
            case "peak":
            case "museum":
            case "hospital":
            case "cinema":
            case "library":
            case "golf_course":
            case "consulate":
            case "park":
            case "same-first-letter-station":
            case "same-length-station":
            case "same-train-line": {
                return false;
            }
            case "custom-zone": {
                boundary = question.geo;
                break;
            }
            case "zone": {
                boundary = await findAdminBoundary(
                    question.lat,
                    question.lng,
                    question.cat.adminLevel,
                );

                if (!boundary) {
                    throw new NotApplicableError(
                        `There's no ${zoneLabel(question.cat.adminLevel)} at the seeker's location.`,
                    );
                }
                break;
            }
            case "letter-zone": {
                const zone = await findAdminBoundary(
                    question.lat,
                    question.lng,
                    question.cat.adminLevel,
                );

                if (!zone) {
                    throw new NotApplicableError(
                        `There's no ${zoneLabel(question.cat.adminLevel)} at the seeker's location.`,
                    );
                }

                // Same naming rule as stations: the local name, accents ignored.
                const zoneName: string | undefined =
                    zone.properties?.name ?? zone.properties?.["name:en"];
                if (!zoneName) {
                    throw new NotApplicableError(
                        "The seeker's zone has no name in the map data.",
                    );
                }

                const letter = firstLetter(zoneName);

                const fromData = await datasets.adminZonesIn(
                    question.cat.adminLevel,
                    turf.bbox(mapGeoJSON.get()!) as [
                        number,
                        number,
                        number,
                        number,
                    ],
                );
                const sameLetter = fromData?.filter((candidate) => {
                    const name =
                        candidate.properties?.name ??
                        candidate.properties?.["name:en"];
                    return !!name && firstLetter(name) === letter;
                });

                boundary = turf.featureCollection<Polygon | MultiPolygon>(
                    sameLetter ??
                        osmtogeojson(
                            await findPlacesInZone(
                                `[admin_level=${question.cat.adminLevel}]["name:en"~"^${letterPattern(letter)}.+"]`, // Regex is faster than filtering afterward
                                `Finding zones that start with the same letter (${letter})...`,
                                "relation",
                                "geom",
                                [
                                    `[admin_level=${question.cat.adminLevel}]["name"~"^${letterPattern(letter)}.+"]`,
                                ], // Regex is faster than filtering afterward
                            ),
                        ).features.filter(
                            (x): x is Feature<Polygon | MultiPolygon> =>
                                x.geometry &&
                                (x.geometry.type === "Polygon" ||
                                    x.geometry.type === "MultiPolygon"),
                        ),
                );

                // It's either simplify or crash. Technically this could be bad if someone's hiding zone was inside multiple zones, but that's unlikely.
                boundary = safeUnion(
                    turf.simplify(boundary, {
                        tolerance: 0.001,
                        highQuality: true,
                        mutate: true,
                    }),
                );

                break;
            }
            case "airport":
            case "major-city":
            case "aquarium-full":
            case "zoo-full":
            case "theme_park-full":
            case "peak-full":
            case "museum-full":
            case "hospital-full":
            case "cinema-full":
            case "library-full":
            case "golf_course-full":
            case "consulate-full":
            case "park-full":
            case "custom-points": {
                const kind = matchingPlaceKind(question);
                const cell = kind
                    ? await seekerNearestCell(kind, question)
                    : undefined;
                if (cell) {
                    boundary = cell;
                    break;
                }

                const data = await findMatchingPlaces(question);

                const voronoi = geoSpatialVoronoi(data);
                const point = turf.point([question.lng, question.lat]);

                for (const feature of voronoi.features) {
                    if (turf.booleanPointInPolygon(point, feature)) {
                        boundary = feature;
                        break;
                    }
                }
                break;
            }
        }

        return boundary;
    },
    (question: MatchingQuestion & { geo?: unknown; cat?: unknown }) =>
        JSON.stringify({
            type: question.type,
            lat: question.lat,
            lng: question.lng,
            cat: question.cat,
            geo: question.geo,
            area: playAreaKey(),
            // The "major city" threshold depends on the rules.
            rules: regionRules.get().region,
        }),
);

export const adjustPerMatching = async (
    question: MatchingQuestion,
    mapData: any,
) => {
    if (mapData === null) return;

    const boundary = await determineMatchingBoundary(question);

    if (boundary === false) {
        return mapData;
    }

    return modifyMapData(mapData, boundary, question.same);
};

export const hiderifyMatching = async (question: MatchingQuestion) => {
    const $hiderMode = hiderAnswerPosition();
    if ($hiderMode === false) {
        return question;
    }

    if (
        [
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
        ].includes(question.type)
    ) {
        const questionNearest = await nearestToQuestion(
            question as HomeGameMatchingQuestions,
        );
        const hiderNearest = await nearestToQuestion({
            lat: $hiderMode.latitude,
            lng: $hiderMode.longitude,
            same: true,
            research: false,
            type: (question as HomeGameMatchingQuestions).type,
            drag: false,
            color: "black",
            collapsed: false,
            hidden: false,
        });

        question.same =
            questionNearest.properties.name === hiderNearest.properties.name;

        return question;
    }

    if (
        question.type === "same-first-letter-station" ||
        question.type === "same-length-station" ||
        question.type === "same-train-line"
    ) {
        const hiderPoint = turf.point([
            $hiderMode.longitude,
            $hiderMode.latitude,
        ]);
        const seekerPoint = turf.point([question.lng, question.lat]);

        // Train stations as for hiding zones: halts count too.
        const places = osmtogeojson(
            await findPlacesInZone(
                DEFAULT_STATION_FILTERS[0],
                "Finding train stations...",
                "nwr",
                "center",
                DEFAULT_STATION_FILTERS.slice(1),
            ),
        ) as FeatureCollection<Point>;

        const nearestHiderTrainStation = turf.nearestPoint(hiderPoint, places);
        const nearestSeekerTrainStation = turf.nearestPoint(
            seekerPoint,
            places,
        );

        if (question.type === "same-train-line") {
            const sharesLine = await sharesTrainLineWith(
                nearestSeekerTrainStation.properties.id,
                stationSignName(nearestSeekerTrainStation.properties),
            );
            question.same = sharesLine(nearestHiderTrainStation.properties.id);
            return question;
        }

        const hiderName = stationSignName(nearestHiderTrainStation.properties);
        const seekerName = stationSignName(
            nearestSeekerTrainStation.properties,
        );

        if (!hiderName || !seekerName) {
            return question;
        }

        if (question.type === "same-first-letter-station") {
            question.same = firstLetter(hiderName) === firstLetter(seekerName);
        } else if (question.type === "same-length-station") {
            const difference = nameLength(hiderName) - nameLength(seekerName);
            question.lengthComparison =
                difference === 0
                    ? "same"
                    : difference < 0
                      ? "shorter"
                      : "longer";
        }

        return question;
    }

    const $mapGeoJSON = mapGeoJSON.get();
    if ($mapGeoJSON === null) return question;

    let feature = null;

    try {
        feature = holedMask((await adjustPerMatching(question, $mapGeoJSON))!);
    } catch {
        try {
            feature = await adjustPerMatching(question, {
                type: "FeatureCollection",
                features: [holedMask($mapGeoJSON)],
            });
        } catch {
            return question;
        }
    }

    if (feature === null || feature === undefined) return question;

    const hiderPoint = turf.point([$hiderMode.longitude, $hiderMode.latitude]);

    if (turf.booleanPointInPolygon(hiderPoint, feature)) {
        question.same = !question.same;
    }

    return question;
};

export const matchingPlanningPolygon = async (question: MatchingQuestion) => {
    try {
        const boundary = await determineMatchingBoundary(question);

        if (boundary === false) {
            return false;
        }

        return turf.polygonToLine(boundary);
    } catch {
        return false;
    }
};
