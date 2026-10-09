import * as turf from "@turf/turf";
import type { Feature, MultiPolygon, Point, Polygon } from "geojson";
import osmtogeojson from "osmtogeojson";

import { playAreaKey, regionRules } from "@/lib/context";
import { memoizeAsync } from "@/lib/memoizeAsync";
import { boundaryLines, nearestBorderKm } from "@/maps/adminBorders";
import {
    findAdminBoundary,
    findPlacesInZone,
    findPlacesSpecificInZone,
    nearestToQuestion,
    QuestionSpecificLocation,
} from "@/maps/api";
import { datasets } from "@/maps/datasets/load";
import { DEFAULT_STATION_FILTERS } from "@/maps/hidingZones";
import { matchingPlaceKind } from "@/maps/questions/matching";
import {
    DEFAULT_MIN_LAKE_AREA_KM2,
    measuringPlaceKind,
    seekerAltitude,
} from "@/maps/questions/measuring";
import {
    type PlaceKind,
    placesForMeasuring,
    placesToShow,
    seekerNearestCell,
} from "@/maps/questions/places";
import type {
    HomeGameMatchingQuestions,
    HomeGameMeasuringQuestions,
    Question,
} from "@/maps/schema";
import { stationSignName } from "@/maps/stationNames";

// What a question is measured against, to show on the map: a star on the
// seeker's reference place (their nearest airport, zoo…), small dots on the
// other candidates, and for zone questions the outline of the seeker's zone.

export interface ReferencePlace {
    lat: number;
    lng: number;
    name?: string;
}

export interface QuestionReference {
    star?: ReferencePlace;
    dots: ReferencePlace[];
    outline?: Feature<Polygon | MultiPolygon>;
}

const HOME_GAME_TYPES = [
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

const toPlace = (point: Feature<Point, any>): ReferencePlace => {
    const [lng, lat] = point.geometry.coordinates;
    return { lat, lng, name: point.properties?.name };
};

const nearestOf = (
    seeker: { lat: number; lng: number },
    points: Feature<Point>[],
) =>
    points.length === 0
        ? undefined
        : toPlace(
              turf.nearestPoint(
                  turf.point([seeker.lng, seeker.lat]),
                  turf.featureCollection(points),
              ) as Feature<Point>,
          );

/** "Same nearest X?": the seeker's X, from the pre-computed maps if any. */
const placeReference = async (
    kind: PlaceKind,
    seeker: { lat: number; lng: number },
    candidates: () => Promise<Feature<Point>[]>,
): Promise<QuestionReference> => {
    const points = await candidates();
    const cell = await seekerNearestCell(kind, seeker).catch(() => undefined);
    return {
        star: cell
            ? {
                  lat: cell.properties!.lat,
                  lng: cell.properties!.lon,
                  name: cell.properties!.name,
              }
            : nearestOf(seeker, points),
        dots: points.map(toPlace),
    };
};

const zoneReference = async (
    lat: number,
    lng: number,
    adminLevel: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
): Promise<QuestionReference> => {
    const zone = await findAdminBoundary(lat, lng, adminLevel);
    const isArea =
        zone?.geometry?.type === "Polygon" ||
        zone?.geometry?.type === "MultiPolygon";
    return {
        dots: [],
        outline: isArea ? (zone as Feature<Polygon | MultiPolygon>) : undefined,
    };
};

const lakeReference = async (
    seeker: { lat: number; lng: number },
    minAreaKm2: number,
): Promise<QuestionReference> => {
    const lakes = await datasets.lakes(minAreaKm2);
    if (!lakes?.length) return { dots: [] };
    const point = turf.point([seeker.lng, seeker.lat]);
    let best: { place: ReferencePlace; km: number } | undefined;
    for (const lake of lakes) {
        const shores = boundaryLines(lake);
        const km = nearestBorderKm(shores, seeker);
        if (!best || km < best.km) {
            const onShore = turf.nearestPointOnLine(
                turf.featureCollection(shores) as any,
                point,
            );
            best = {
                km,
                place: { ...toPlace(onShore), name: lake.properties.name },
            };
        }
    }
    return { star: best?.place, dots: [] };
};

const stationReference = async (seeker: {
    lat: number;
    lng: number;
}): Promise<QuestionReference> => {
    const stations = osmtogeojson(
        await findPlacesInZone(
            DEFAULT_STATION_FILTERS[0],
            "Finding train stations...",
            "nwr",
            "center",
            DEFAULT_STATION_FILTERS.slice(1),
        ),
    ).features.filter(
        (feature): feature is Feature<Point> =>
            feature.geometry?.type === "Point",
    );
    const nearest = nearestOf(seeker, stations);
    if (!nearest) return { dots: [] };
    const station = stations.find(
        (s) =>
            s.geometry.coordinates[0] === nearest.lng &&
            s.geometry.coordinates[1] === nearest.lat,
    );
    return {
        star: {
            ...nearest,
            name: stationSignName(station?.properties as any) ?? nearest.name,
        },
        dots: [],
    };
};

const homeGameReference = async (
    question: HomeGameMatchingQuestions | HomeGameMeasuringQuestions,
): Promise<QuestionReference> => ({
    star: toPlace(await nearestToQuestion(question)),
    dots: [],
});

const computeReference = async (
    question: Question,
): Promise<QuestionReference | null> => {
    if (question.id === "matching") {
        const data = question.data;
        const kind = matchingPlaceKind(data);
        if (kind) {
            return placeReference(kind, data, () => placesToShow(kind));
        }
        if (data.type === "zone" || data.type === "letter-zone") {
            return zoneReference(data.lat, data.lng, data.cat.adminLevel);
        }
        if (HOME_GAME_TYPES.includes(data.type)) {
            return homeGameReference(data as HomeGameMatchingQuestions);
        }
        if (
            data.type === "same-first-letter-station" ||
            data.type === "same-length-station" ||
            data.type === "same-train-line"
        ) {
            return stationReference(data);
        }
        return null;
    }

    if (question.id === "measuring") {
        const data = question.data;
        const kind = measuringPlaceKind(data);
        if (kind) {
            const points = await placesForMeasuring(kind, data);
            return { star: nearestOf(data, points), dots: points.map(toPlace) };
        }
        if (data.type === "admin-measure") {
            return zoneReference(
                data.lat,
                data.lng,
                (data as any).cat?.adminLevel ?? 4,
            );
        }
        if (data.type === "sea-level") {
            const metres = await seekerAltitude(data);
            return {
                star: {
                    lat: data.lat,
                    lng: data.lng,
                    name: `Seeker altitude: ${Math.round(metres)} m`,
                },
                dots: [],
            };
        }
        if (data.type === "lake") {
            return lakeReference(
                data,
                (data as any).minLakeAreaKm2 ?? DEFAULT_MIN_LAKE_AREA_KM2,
            );
        }
        if (data.type === "mcdonalds") {
            const points = (
                await findPlacesSpecificInZone(
                    QuestionSpecificLocation.McDonalds,
                )
            ).features as Feature<Point>[];
            return { star: nearestOf(data, points), dots: points.map(toPlace) };
        }
        if (HOME_GAME_TYPES.includes(data.type)) {
            return homeGameReference(data as HomeGameMeasuringQuestions);
        }
        return null;
    }

    return null;
};

/** The reference places of a question; null if it has none to show. */
export const questionReference = memoizeAsync(computeReference, (question) =>
    JSON.stringify({
        id: question.id,
        type: (question.data as any).type,
        lat: (question.data as any).lat,
        lng: (question.data as any).lng,
        cat: (question.data as any).cat,
        minLake: (question.data as any).minLakeAreaKm2,
        altitude: (question.data as any).seekerAltitude,
        area: playAreaKey(),
        rules: regionRules.get().region,
    }),
);
