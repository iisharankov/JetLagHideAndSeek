import * as turf from "@turf/turf";
import type { Feature, MultiPolygon, Point, Polygon } from "geojson";
import _ from "lodash";

import { mapGeoJSON, regionRules } from "@/lib/context";
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
import type { APILocations } from "@/maps/schema";

// Places that matching and measuring questions compare against ("the
// nearest commercial airport", "the nearest museum"). Someone's nearest place
// can be outside the play area, even in another country, so these come from
// the reference data, which includes places around Switzerland. Without it
// they fall back to the places inside the play area.
//
// An empty or unusable list is "not applicable", not an error, and the
// reason shows on the question card.

type Bbox = [number, number, number, number];

const toPoint = (element: any) =>
    turf.point(
        [
            element.center ? element.center.lon : element.lon,
            element.center ? element.center.lat : element.lat,
        ],
        { name: element.tags?.name ?? element.tags?.["name:en"] },
    );

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

/** Every place of a type in the play area (small/medium-game questions). */
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
            `Too many ${plural} (${elements.length}) for this version of the question. Turn on hiding zones and use the large-game version instead.`,
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
    /** Dataset file and "nearest place" map (see NEAREST_SETS). */
    file: string;
    set: string;
    accept?: (tags: Record<string, string>) => boolean;
    plural: string;
    /** The same places from the play area only (Overpass). */
    inPlayArea: () => Promise<Feature<Point>[]>;
}

const placeSet = (kind: PlaceKind): PlaceSet => {
    if (kind === "airport") {
        return {
            file: "airports",
            set: "airports",
            accept: (tags) => isCommercialAirport(tags.iata),
            plural: "commercial airports",
            inPlayArea: commercialAirports,
        };
    }
    if (kind === "city") {
        const minimum = majorCityPopulation(regionRules.get());
        return {
            file: "cities",
            set: `cities-${minimum}`,
            accept: (tags) => populationOf(tags) >= minimum,
            plural: `cities with ${minimum.toLocaleString("en-US")}+ people`,
            inPlayArea: majorCities,
        };
    }
    return {
        file: `poi-${kind}`,
        set: `poi-${kind}`,
        plural: prettifyLocation(kind, true).toLowerCase(),
        inPlayArea: () => allPlacesOfType(kind),
    };
};

const playAreaBbox = () => {
    const area = mapGeoJSON.get();
    return area ? (turf.bbox(area) as Bbox) : null;
};

/** Places for "closer to / further from the nearest X than me?". */
export const placesForMeasuring = async (
    kind: PlaceKind,
    seeker: { lat: number; lng: number },
): Promise<Feature<Point>[]> => {
    const places = placeSet(kind);
    const bbox = playAreaBbox();
    const elements = bbox
        ? await datasets.placesForMeasuring(
              places.file,
              places.accept,
              bbox,
              seeker,
          )
        : null;
    if (elements === null) return places.inPlayArea();
    if (elements.length === 0) {
        throw new NotApplicableError(
            `There are no ${places.plural} in or near the play area.`,
        );
    }
    return elements.map(toPoint);
};

/**
 * Where the seeker's nearest X is also the nearest one ("is your nearest X
 * the same as mine?"), from the pre-computed maps. Undefined when there's no
 * map for this area, so the caller computes it from `placesInPlayArea`.
 */
export const seekerNearestCell = async (
    kind: PlaceKind,
    seeker: { lat: number; lng: number },
): Promise<Feature<Polygon | MultiPolygon> | undefined> => {
    const places = placeSet(kind);
    const bbox = playAreaBbox();
    if (!bbox || !(await datasets.covers(bbox))) return undefined;
    const cell = await datasets.nearestCell(places.set, seeker.lat, seeker.lng);
    if (cell === null) {
        throw new NotApplicableError(
            `There are no ${places.plural} in or near the play area.`,
        );
    }
    return cell;
};

/** The places of a kind in the play area, as the fallback computes them. */
export const placesInPlayArea = (kind: PlaceKind) =>
    placeSet(kind).inPlayArea();

/**
 * Places to draw on the map for a question: every place whose "nearest"
 * area reaches into the play area, or else those inside it.
 */
export const placesToShow = async (
    kind: PlaceKind,
): Promise<Feature<Point>[]> => {
    const places = placeSet(kind);
    const bbox = playAreaBbox();
    const cells =
        bbox && (await datasets.covers(bbox))
            ? await datasets.cellsIn(places.set, bbox)
            : undefined;
    if (cells) {
        return cells.map((cell) =>
            turf.point([cell.properties.lon, cell.properties.lat], {
                name: cell.properties.name,
            }),
        );
    }
    return places.inPlayArea();
};
