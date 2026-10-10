import * as turf from "@turf/turf";
import type { Feature, MultiPolygon } from "geojson";
import _ from "lodash";
import osmtogeojson from "osmtogeojson";

import {
    displayHidingZones,
    displayHidingZonesOptions,
    gameSettings,
    hidingRadius,
    hidingRadiusUnits,
    mapGeoJSON,
    mapGeoLocation,
    playAreaKey,
    regionRules,
    trainStations,
} from "@/lib/context";
import { hiderAnswerPosition } from "@/lib/hiderSpot";
import { memoizeAsync } from "@/lib/memoizeAsync";
import {
    adminLevelLabel,
    boundaryLines,
    nearestBorderKm,
} from "@/maps/adminBorders";
import {
    fetchCoastline,
    findAdminBorderLines,
    findAdminBoundary,
    findPlacesInZone,
    findPlacesSpecificInZone,
    nearestToQuestion,
    QuestionSpecificLocation,
} from "@/maps/api";
import { datasets } from "@/maps/datasets/load";
import { ruledOutInZones, withinDistanceOfLines } from "@/maps/distanceRegion";
import { elevation } from "@/maps/elevation";
import { NotApplicableError } from "@/maps/errors";
import {
    arcBufferToPoint,
    arcDistance,
    connectToSeparateLines,
    groupObjects,
    holedMask,
    modifyMapData,
} from "@/maps/geo-utils";
import { loadStationPlaces } from "@/maps/hidingZoneStations";
import type {
    APILocations,
    HomeGameMeasuringQuestions,
    MeasuringQuestion,
} from "@/maps/schema";

import { type PlaceKind, placesForMeasuring } from "./places";

export interface AdminZoneInfo {
    name: string;
    boundary: any;
}

export const findAdminZoneInfo = memoizeAsync(
    async (
        lat: number,
        lng: number,
        adminLevel: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
    ): Promise<AdminZoneInfo | null> => {
        const boundary = await findAdminBoundary(lat, lng, adminLevel);

        if (!boundary) {
            return null;
        }

        const name =
            boundary.properties?.name ??
            boundary.properties?.["name:en"] ??
            "Unknown";

        return { name, boundary };
    },
    (lat, lng, adminLevel) =>
        `${lat.toFixed(6)},${lng.toFixed(6)},${adminLevel}`,
);

const highSpeedBase = _.memoize(
    (features: Feature[]) => {
        const grouped = groupObjects(features);

        const neighbored = grouped
            .map((group) => {
                return turf.multiLineString(
                    connectToSeparateLines(
                        group
                            .filter((x) => turf.getType(x) === "LineString")
                            .map((x) => x.geometry.coordinates),
                    ),
                );
            })
            .filter((x) => x.geometry.coordinates.length > 0);

        return turf.combine(
            turf.buffer(
                turf.simplify(turf.featureCollection(neighbored), {
                    tolerance: 0.001,
                }),
                0.001,
            )!,
        ).features[0];
    },
    (features) => `${JSON.stringify(features.map((x) => x.geometry))}`,
);

const bboxExtension = (
    bBox: [number, number, number, number],
    distance: number,
): [number, number, number, number] => {
    const buffered = turf.bbox(
        turf.buffer(turf.bboxPolygon(bBox), Math.abs(distance), {
            units: "miles",
        })!,
    );

    const originalDeltaLat = bBox[3] - bBox[1];
    const originalDeltaLng = bBox[2] - bBox[0];

    return [
        buffered[0] - originalDeltaLng,
        buffered[1] - originalDeltaLat,
        buffered[2] + originalDeltaLng,
        buffered[3] + originalDeltaLat,
    ];
};

type Bbox = [number, number, number, number];

/**
 * The borders of the question's admin level around an area, plus the
 * seeker's distance to the nearest one (their own zone's edge).
 */
const adminBordersAround = memoizeAsync(
    async (question: MeasuringQuestion, bbox: Bbox) => {
        const adminLevel = (question as any).cat?.adminLevel ?? 4;
        const zoneInfo = await findAdminZoneInfo(
            question.lat,
            question.lng,
            adminLevel,
        );
        if (!zoneInfo) {
            const label = adminLevelLabel(
                adminLevel,
                mapGeoLocation.get().properties.countrycode,
            );
            throw new NotApplicableError(
                `There's no ${label} at the seeker's location.`,
            );
        }

        const ownBorder = boundaryLines(zoneInfo.boundary);
        const seekerDistanceKm = nearestBorderKm(ownBorder, question);
        // From the datasets, the zones overlapping the area are enough:
        // anyone in the area is in one of them, and their nearest border is
        // that zone's edge. Overpass needs a margin to find the same zones.
        const borders =
            (await datasets.adminBorderLines(adminLevel, bbox)) ??
            (await findAdminBorderLines(
                adminLevel,
                turf.bbox(
                    turf.buffer(turf.bboxPolygon(bbox), seekerDistanceKm + 5, {
                        units: "kilometers",
                    })!,
                ) as Bbox,
            ));

        return { borders: [...borders, ...ownBorder], seekerDistanceKm };
    },
    (question, bbox) =>
        JSON.stringify({
            lat: question.lat,
            lng: question.lng,
            level: (question as any).cat?.adminLevel ?? 4,
            area: playAreaKey(),
            bbox: bbox.map((value) => value.toFixed(3)),
        }),
);

/** Whether hiding zones are on and there are stations to draw them around. */
const hidingZonesActive = () =>
    displayHidingZones.get() && displayHidingZonesOptions.get().length > 0;

/**
 * Admin-border question with hiding zones on: only the parts of the zones
 * the answer rules out, so the rest of the map isn't covered in shading
 * around every municipality.
 */
const adminRuledOutInZones = async (
    question: MeasuringQuestion,
    bbox: Bbox,
) => {
    const { borders, seekerDistanceKm } = await adminBordersAround(
        question,
        bbox,
    );
    const stations = await loadStationPlaces();
    return ruledOutInZones({
        lines: borders,
        distanceKm: seekerDistanceKm,
        hiderCloser: question.hiderCloser,
        stations: stations.map((station) => turf.getCoord(station)),
        zoneRadiusKm: turf.convertLength(
            hidingRadius.get(),
            hidingRadiusUnits.get(),
            "kilometers",
        ),
        bbox,
    });
};

/** The seeker's altitude: as typed in, or the ground height at their pin. */
export const seekerAltitude = async (question: MeasuringQuestion) =>
    (question as any).seekerAltitude ??
    (await elevation.elevationAt(question.lat, question.lng));

/**
 * Altitude question: where the ground is higher than the seeker. The hider
 * is "closer to sea level" when lower, as in the rulebook's wording.
 */
const higherGroundIn = async (question: MeasuringQuestion, bbox: Bbox) => {
    const metres = await seekerAltitude(question);
    const grid = await elevation.elevationGrid(bbox);
    return turf.simplify(elevation.regionAbove(grid, metres), {
        tolerance: 0.0003,
    });
};

/** Lake shore question: the lake sizes players can choose from (km²). */
export const LAKE_AREA_CHOICES = [10, 20, 25, 50] as const;
export const DEFAULT_MIN_LAKE_AREA_KM2 = 10;

const minLakeArea = (question: MeasuringQuestion) =>
    gameSettings.get().minLakeAreaKm2 ??
    (question as any).minLakeAreaKm2 ??
    DEFAULT_MIN_LAKE_AREA_KM2;

/** The shores of the big lakes, and the seeker's distance to the nearest. */
const lakeShoresAround = memoizeAsync(
    async (question: MeasuringQuestion) => {
        const minimum = minLakeArea(question);
        const covered = await datasets.covers([
            question.lng,
            question.lat,
            question.lng,
            question.lat,
        ]);
        const lakes = covered ? await datasets.lakes(minimum) : undefined;
        if (!lakes) {
            throw new NotApplicableError(
                "There's no lake data for this area on the server.",
            );
        }
        if (lakes.length === 0) {
            throw new NotApplicableError(
                `There are no lakes of ${minimum} km² or more.`,
            );
        }
        const shores = lakes.flatMap((lake) => boundaryLines(lake));
        return { shores, seekerDistanceKm: nearestBorderKm(shores, question) };
    },
    (question) =>
        JSON.stringify({
            lat: question.lat,
            lng: question.lng,
            minimum: minLakeArea(question),
        }),
);

/** Where someone is closer to a big lake's shore than the seeker. */
const lakeShoreRegionIn = async (question: MeasuringQuestion, bbox: Bbox) => {
    const { shores, seekerDistanceKm } = await lakeShoresAround(question);
    return turf.simplify(
        withinDistanceOfLines(shores, seekerDistanceKm, bbox),
        {
            tolerance: 0.0003,
        },
    );
};

/** Where someone is closer to a border of the level than the seeker. */
const adminBorderRegionIn = async (question: MeasuringQuestion, bbox: Bbox) => {
    const { borders, seekerDistanceKm } = await adminBordersAround(
        question,
        bbox,
    );
    return turf.simplify(
        withinDistanceOfLines(borders, seekerDistanceKm, bbox),
        { tolerance: 0.0003 },
    );
};

/** What a "closer to the nearest X?" question compares, if it's places. */
export const measuringPlaceKind = (
    question: MeasuringQuestion,
): PlaceKind | null => {
    switch (question.type) {
        case "airport":
            return "airport";
        case "city":
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

export const determineMeasuringBoundary = async (
    question: MeasuringQuestion,
) => {
    const bBox = turf.bbox(mapGeoJSON.get()!);

    switch (question.type) {
        case "highspeed-measure-shinkansen": {
            const features =
                (await datasets.highSpeedLines(
                    bBox as [number, number, number, number],
                )) ??
                osmtogeojson(
                    await findPlacesInZone(
                        "[highspeed=yes]",
                        "Finding high-speed lines...",
                        "nwr",
                        "geom",
                    ),
                ).features;
            if (features.length === 0) {
                throw new NotApplicableError(
                    "There's no high-speed rail in or near the play area.",
                );
            }

            return [highSpeedBase(features)];
        }
        case "admin-measure": {
            const { borders } = await adminBordersAround(
                question,
                bBox as Bbox,
            );
            return borders.map((line) =>
                turf.simplify(line, { tolerance: 0.0002 }),
            );
        }
        case "lake":
            return (await lakeShoresAround(question)).shores;
        case "sea-level":
            return false;
        case "coastline": {
            const coastline = turf.lineToPolygon(
                await fetchCoastline(),
            ) as Feature<MultiPolygon>;

            const distanceToCoastline = turf.pointToPolygonDistance(
                turf.point([question.lng, question.lat]),
                coastline,
                {
                    units: "miles",
                    method: "geodesic",
                },
            );

            return [
                turf.difference(
                    turf.featureCollection([
                        turf.bboxPolygon(bBox),
                        turf.buffer(
                            turf.bboxClip(
                                coastline,
                                bBox
                                    ? bboxExtension(
                                          bBox as any,
                                          distanceToCoastline,
                                      )
                                    : [-180, -90, 180, 90],
                            ),
                            distanceToCoastline,
                            {
                                units: "miles",
                                steps: 64,
                            },
                        )!,
                    ]),
                )!,
            ];
        }
        case "airport":
        case "city":
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
        case "park-full": {
            const places = await placesForMeasuring(
                measuringPlaceKind(question)!,
                question,
            );
            return [turf.combine(turf.featureCollection(places)).features[0]];
        }
        case "custom-measure":
            return turf.combine(
                turf.featureCollection((question as any).geo.features),
            ).features;
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
        case "mcdonalds":
        case "seven11":
        case "rail-measure":
            return false;
    }
};

const bufferedDeterminer = memoizeAsync(
    async (question: MeasuringQuestion) => {
        const placeData = await determineMeasuringBoundary(question);

        if (placeData === false || placeData === undefined) return false;

        return arcBufferToPoint(
            turf.featureCollection(placeData as any),
            question.lat,
            question.lng,
        );
    },
    (question) =>
        JSON.stringify({
            type: question.type,
            lat: question.lat,
            lng: question.lng,
            area: playAreaKey(),
            geo: (question as any).geo,
            adminLevel: (question as any).cat?.adminLevel,
            // The "major city" threshold depends on the rules.
            rules: regionRules.get().region,
        }),
);

export const adjustPerMeasuring = async (
    question: MeasuringQuestion,
    mapData: any,
    inHidingZonesOnly = hidingZonesActive(),
) => {
    if (mapData === null) return;

    if (question.type === "sea-level") {
        const higher = await higherGroundIn(
            question,
            turf.bbox(mapData) as Bbox,
        );
        // Closer to sea level = lower = outside the higher ground.
        return modifyMapData(mapData, higher, !question.hiderCloser);
    }

    if (question.type === "admin-measure" && inHidingZonesOnly) {
        const ruledOut = await adminRuledOutInZones(
            question,
            turf.bbox(mapData) as Bbox,
        );
        if (ruledOut.geometry.coordinates.length === 0) return mapData;
        return modifyMapData(mapData, ruledOut, false);
    }

    // Only the area still in play needs computing, which keeps this fast.
    const buffer =
        question.type === "admin-measure"
            ? await adminBorderRegionIn(question, turf.bbox(mapData) as Bbox)
            : question.type === "lake"
              ? await lakeShoreRegionIn(question, turf.bbox(mapData) as Bbox)
              : await bufferedDeterminer(question);

    if (buffer === false) return mapData;

    return modifyMapData(mapData, buffer, question.hiderCloser);
};

export const hiderifyMeasuring = async (question: MeasuringQuestion) => {
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
            question as HomeGameMeasuringQuestions,
        );
        const hiderNearest = await nearestToQuestion({
            lat: $hiderMode.latitude,
            lng: $hiderMode.longitude,
            hiderCloser: true,
            research: false,
            type: (question as HomeGameMeasuringQuestions).type,
            drag: false,
            color: "black",
            collapsed: false,
            hidden: false,
        });

        question.hiderCloser =
            questionNearest.properties.distanceToPoint >
            hiderNearest.properties.distanceToPoint;

        return question;
    }

    if (question.type === "rail-measure") {
        const stations = trainStations.get();

        if (stations.length === 0) {
            return question;
        }

        const location = turf.point([question.lng, question.lat]);

        const nearestTrainStation = turf.nearestPoint(
            location,
            turf.featureCollection(stations.map((x) => x.properties)),
        );

        const distance = await arcDistance(location, nearestTrainStation);

        const hider = turf.point([$hiderMode.longitude, $hiderMode.latitude]);

        const hiderNearest = turf.nearestPoint(
            hider,
            turf.featureCollection(stations.map((x) => x.properties)),
        );

        const hiderDistance = await arcDistance(hider, hiderNearest);

        question.hiderCloser = hiderDistance < distance;
    }

    if (question.type === "mcdonalds" || question.type === "seven11") {
        const points = await findPlacesSpecificInZone(
            question.type === "mcdonalds"
                ? QuestionSpecificLocation.McDonalds
                : QuestionSpecificLocation.Seven11,
        );

        const seeker = turf.point([question.lng, question.lat]);
        const nearest = turf.nearestPoint(seeker, points as any);

        const distance = await arcDistance(seeker, nearest, "miles");

        const hider = turf.point([$hiderMode.longitude, $hiderMode.latitude]);
        const hiderNearest = turf.nearestPoint(hider, points as any);

        const hiderDistance = await arcDistance(hider, hiderNearest, "miles");

        question.hiderCloser = hiderDistance < distance;
        return question;
    }

    const $mapGeoJSON = mapGeoJSON.get();
    if ($mapGeoJSON === null) return question;

    let feature = null;

    // The hider's answer uses the whole map, not just the hiding zones.
    try {
        feature = holedMask(
            (await adjustPerMeasuring(question, $mapGeoJSON, false))!,
        );
    } catch {
        try {
            feature = await adjustPerMeasuring(
                question,
                {
                    type: "FeatureCollection",
                    features: [holedMask($mapGeoJSON)],
                },
                false,
            );
        } catch {
            return question;
        }
    }

    if (feature === null || feature === undefined) return question;

    const hiderPoint = turf.point([$hiderMode.longitude, $hiderMode.latitude]);

    if (turf.booleanPointInPolygon(hiderPoint, feature)) {
        question.hiderCloser = !question.hiderCloser;
    }

    return question;
};

export const measuringPlanningPolygon = async (question: MeasuringQuestion) => {
    try {
        const playArea = turf.bbox(mapGeoJSON.get()!) as Bbox;
        const buffered =
            question.type === "admin-measure"
                ? await adminBorderRegionIn(question, playArea)
                : question.type === "lake"
                  ? await lakeShoreRegionIn(question, playArea)
                  : question.type === "sea-level"
                    ? await higherGroundIn(question, playArea)
                    : await bufferedDeterminer(question);

        if (buffered === false) return false;

        return turf.polygonToLine(buffered);
    } catch {
        return false;
    }
};
