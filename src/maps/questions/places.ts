import * as turf from "@turf/turf";
import type {
    Feature,
    FeatureCollection,
    MultiPolygon,
    Point,
    Polygon,
} from "geojson";
import _ from "lodash";

import { mapGeoJSON, regionRules } from "@/lib/context";
import type { RejectedPlace } from "@/lib/game/types";
import {
    applyPlaceRules,
    fitsKind,
    mergeDuplicates,
    rejections,
} from "@/lib/placeRules";
import {
    findPlacesInZone,
    LOCATION_FIRST_TAG,
    prettifyLocation,
} from "@/maps/api";
import { isCommercialAirport } from "@/maps/datasets/airports";
import { populationOf } from "@/maps/datasets/categories";
import { datasets } from "@/maps/datasets/load";
import { NotApplicableError } from "@/maps/errors";
import {
    majorCityPopulation,
    populationAtLeastRegex,
} from "@/maps/regionRules";
import type { APILocations, PlaceQuery } from "@/maps/schema";

// Places that matching and measuring questions compare against ("the
// nearest commercial airport", "the nearest museum"). The rulebook: places
// outside the play area don't exist, so only those inside count: from the
// pre-built pack when it covers the area, else from Overpass. No place of a
// kind inside the area makes the question a null answer (the hider still
// draws), and the reason shows on the question card.

const toPoint = (element: any) => {
    const tags = element.tags ?? {};
    const area = Number(tags.area_m2);
    return turf.point(
        [
            element.center ? element.center.lon : element.lon,
            element.center ? element.center.lat : element.lat,
        ],
        {
            name: tags.name ?? tags["name:en"],
            ...(Number.isFinite(area) && area > 0 ? { areaM2: area } : {}),
            ...(tags.access ? { access: tags.access } : {}),
        },
    );
};

export const commercialAirports = async () => {
    const { elements } = await findPlacesInZone(
        '["aeroway"="aerodrome"]["iata"]',
        "Finding airports...",
    );
    const airports = _.uniqBy(
        elements.filter((e: any) => isCommercialAirport(e.tags.iata)),
        (e: any) => e.tags.iata,
    ).map(toPoint);
    if (airports.length === 0) {
        throw new NotApplicableError(
            "There are no commercial airports in the play area.",
        );
    }
    return airports;
};

export const majorCities = async () => {
    const minimum = majorCityPopulation(regionRules.get());
    const { elements } = await findPlacesInZone(
        `[place=city]["population"~"${populationAtLeastRegex(minimum)}"]`,
        "Finding cities...",
    );
    if (elements.length === 0) {
        throw new NotApplicableError(
            `There are no cities with ${minimum.toLocaleString("en-US")}+ people in the play area.`,
        );
    }
    return elements.map(toPoint);
};

/** Above this, nearest-place maps get too slow to compute in the browser. */
const MAX_PLACES = 5000;

/** Every place of a type in the play area, from Overpass. */
export const allPlacesOfType = async (location: APILocations) => {
    const plural = prettifyLocation(location, true).toLowerCase();
    const { elements } = await findPlacesInZone(
        `[${LOCATION_FIRST_TAG[location]}=${location}]`,
        `Finding ${plural}...`,
        "nwr",
        "center",
        [],
        60,
    );
    if (elements.length >= MAX_PLACES) {
        throw new NotApplicableError(
            `Too many ${plural} (${elements.length}) for this question in so large a play area.`,
        );
    }
    if (elements.length === 0) {
        throw new NotApplicableError(
            `There are no ${plural} in the play area.`,
        );
    }
    return elements.map(toPoint);
};

/** What a question compares: commercial airports, major cities or a type. */
export type PlaceKind = "airport" | "city" | APILocations;

interface PlaceSet {
    /** The Overpass-style filter the pack answers (see datasets/index.ts). */
    filters: string[];
    accept?: (tags: Record<string, string>) => boolean;
    plural: string;
    /** The same places from the play area only, from Overpass. */
    inPlayArea: () => Promise<Feature<Point>[]>;
}

const placeSet = (kind: PlaceKind): PlaceSet => {
    if (kind === "airport") {
        return {
            filters: ['["aeroway"="aerodrome"]["iata"]'],
            accept: (tags) => isCommercialAirport(tags.iata),
            plural: "commercial airports",
            inPlayArea: commercialAirports,
        };
    }
    if (kind === "city") {
        const minimum = majorCityPopulation(regionRules.get());
        return {
            filters: ["[place=city]"],
            accept: (tags) => populationOf(tags) >= minimum,
            plural: `cities with ${minimum.toLocaleString("en-US")}+ people`,
            inPlayArea: majorCities,
        };
    }
    return {
        filters: [`[${LOCATION_FIRST_TAG[kind]}=${kind}]`],
        plural: prettifyLocation(kind, true).toLowerCase(),
        inPlayArea: () => allPlacesOfType(kind),
    };
};

const playArea = () =>
    mapGeoJSON.get() as FeatureCollection<Polygon | MultiPolygon> | null;

/** Every place of a kind inside the play area, as the map data lists it. */
const rawPlaces = async (kind: PlaceKind): Promise<Feature<Point>[]> => {
    const places = placeSet(kind);
    const area = playArea();
    if (!area) return [];
    const elements = await datasets.placesInZone(places.filters, area);
    if (elements) {
        return elements
            .filter((element) => !places.accept || places.accept(element.tags))
            .map(toPoint);
    }
    try {
        return await places.inPlayArea();
    } catch (error) {
        if (error instanceof NotApplicableError) return [];
        throw error;
    }
};

/**
 * The places of a kind the questions count: those inside the play area,
 * mis-tagged and unnamed ones dropped, duplicates merged, rejected places
 * left out.
 */
export const placesInPlayArea = async (
    kind: PlaceKind,
    rejected: RejectedPlace[] = rejections(),
) => applyPlaceRules(kind, await rawPlaces(kind), rejected);

/** Places to draw on the map for a question. */
export const placesToShow = placesInPlayArea;

/** The places a question needs, or the rulebook's null answer. */
export const requirePlaces = async (kind: PlaceKind) => {
    const points = await placesInPlayArea(kind);
    if (points.length === 0) {
        throw new NotApplicableError(
            `No ${placeSet(kind).plural} inside the play area: the rulebook makes this a null answer.`,
        );
    }
    return points;
};

/** Places for "closer to / further from the nearest X than me?". */
export const placesForMeasuring = (kind: PlaceKind) => requirePlaces(kind);

/**
 * The place of a type nearest to a point, among those that count (with its
 * `distanceToPoint` in km); the rulebook's null answer when there's none.
 */
export const nearestToQuestion = async (question: PlaceQuery) => {
    const places = await requirePlaces(question.type);
    const from = turf.point([question.lng, question.lat]);
    const nearest = turf.nearestPoint(from, turf.featureCollection(places));
    return turf.point(nearest.geometry.coordinates, {
        name: nearest.properties.name as string | undefined,
        distanceToPoint: nearest.properties.distanceToPoint as number,
    });
};

/** The kinds of place the players can review before a game. */
export const REVIEW_KINDS: PlaceKind[] = [
    "airport",
    "city",
    "zoo",
    "theme_park",
    "aquarium",
    "museum",
    "hospital",
    "cinema",
    "library",
    "golf_course",
    "consulate",
    "park",
];

export const reviewKindLabel = (kind: PlaceKind) => {
    const plural = placeSet(kind).plural;
    return plural.charAt(0).toUpperCase() + plural.slice(1);
};

/**
 * For the review: every place of a kind inside the play area that fits
 * its kind, duplicates merged, rejected ones included.
 */
export const reviewPlaces = async (kind: PlaceKind) => {
    const raw = (await rawPlaces(kind)).filter((point) =>
        fitsKind(kind, point),
    );
    const places = mergeDuplicates(raw);
    return { places, merged: raw.length - places.length };
};

/**
 * Above this many places a voronoi diagram on the phone is too slow. The
 * seeker's cell is decided by the places near them, so those are enough.
 */
export const MAX_VORONOI_SITES = 400;

/** The places nearest a point, at most `max` of them. */
export const nearestSites = <F extends Feature<Point>>(
    points: F[],
    seeker: { lat: number; lng: number },
    max = MAX_VORONOI_SITES,
): F[] => {
    if (points.length <= max) return points;
    const from = turf.point([seeker.lng, seeker.lat]);
    return [...points]
        .map((point) => ({ point, km: turf.distance(from, point) }))
        .sort((a, b) => a.km - b.km)
        .slice(0, max)
        .map((entry) => entry.point);
};
