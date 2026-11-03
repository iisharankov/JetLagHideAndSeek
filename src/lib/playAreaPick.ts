// The play area as a list of admin areas, each added or cut out: the first
// added one leads (`mapGeoLocation`), the rest follow
// (`additionalMapGeoLocations`). Picking areas on the map or in the list
// changes it here, without touching the objects it was given (the map's
// refresh and the game's sync compare by value).
import { atom } from "nanostores";

import {
    additionalMapGeoLocations,
    mapGeoJSON,
    mapGeoLocation,
    polyGeoJSON,
} from "@/lib/context";
import type {
    AdditionalMapGeoLocations,
    OpenStreetMap,
} from "@/maps/api/types";

export interface PlayAreaPlaces {
    base: OpenStreetMap;
    extra: AdditionalMapGeoLocations[];
}

export type PickMode = "add" | "cut";

/** The admin levels offered for picking on the map: canton, district, municipality. */
export const PICK_LEVELS = [4, 6, 8] as const;
/** Which level's areas the map shows to tap while choosing the play area; null: none. */
export const pickLevel = atom<number | null>(8);
/** What a tap does. */
export const pickMode = atom<PickMode>("add");
/** Why no areas are shown ("Zoom in…"), or "". */
export const pickHint = atom("");
/**
 * A tap on the map changed the play area: the map stays where it is (the
 * next neighbour is right there), instead of zooming to the new area.
 */
export const holdMapView = atom(false);

/** "municipality" → "municipalities". */
export const plural = (label: string) =>
    label.endsWith("y") ? `${label.slice(0, -1)}ies` : `${label}s`;

const idOf = (place: OpenStreetMap) => place.properties.osm_id;

/** How a place is in the play area: added, cut out, or not at all. */
export const placeStatus = (
    area: PlayAreaPlaces,
    id: number,
): "added" | "cut" | null => {
    if (idOf(area.base) === id) return "added";
    const entry = area.extra.find((x) => idOf(x.location) === id);
    return entry ? (entry.added ? "added" : "cut") : null;
};

const entry = (
    location: OpenStreetMap,
    added: boolean,
): AdditionalMapGeoLocations => ({ added, location, base: false });

/** The place gone; the first added place left leads. Null: nothing left. */
export const removePlace = (
    area: PlayAreaPlaces,
    id: number,
): PlayAreaPlaces | null => {
    if (idOf(area.base) !== id) {
        return {
            base: area.base,
            extra: area.extra.filter((x) => idOf(x.location) !== id),
        };
    }
    const next = area.extra.find((x) => x.added);
    if (!next) return null;
    return { base: next.location, extra: area.extra.filter((x) => x !== next) };
};

/** In becomes cut out and back. Null: it was the only area in. */
export const flipPlace = (
    area: PlayAreaPlaces,
    id: number,
): PlayAreaPlaces | null => {
    const status = placeStatus(area, id);
    if (status === null) return area;
    if (idOf(area.base) === id) {
        const rest = removePlace(area, id);
        return (
            rest && { ...rest, extra: [...rest.extra, entry(area.base, false)] }
        );
    }
    return {
        base: area.base,
        extra: area.extra.map((x) =>
            idOf(x.location) === id ? entry(x.location, !x.added) : x,
        ),
    };
};

/**
 * A tap on a place on the map. Adding: a place not in yet joins, and one
 * inside an area added before (`inside`: the ids of the areas around it)
 * takes that area's place, so tapping Zürich after the canton gives Zürich;
 * tapping an added place again takes it out. Cutting out: the place is cut
 * out, or back in on a second tap. Null: the play area would be empty.
 */
export const tapPlace = (
    area: PlayAreaPlaces,
    place: OpenStreetMap,
    mode: PickMode,
    inside: number[],
): PlayAreaPlaces | null => {
    const id = idOf(place);
    const status = placeStatus(area, id);
    if (mode === "cut") {
        if (status === "cut") return removePlace(area, id);
        if (status === "added") return flipPlace(area, id);
        return { base: area.base, extra: [...area.extra, entry(place, false)] };
    }
    if (status === "added") return removePlace(area, id);
    if (status === "cut") return flipPlace(area, id);

    let next = area;
    for (const around of inside) {
        if (placeStatus(next, around) !== "added") continue;
        const rest = removePlace(next, around);
        // It was the only area in: the new place leads instead.
        if (!rest) return { base: place, extra: next.extra };
        next = rest;
    }
    return { base: next.base, extra: [...next.extra, entry(place, true)] };
};

/** The play area as the stores have it. */
export const currentPlaces = (): PlayAreaPlaces => ({
    base: mapGeoLocation.get(),
    extra: additionalMapGeoLocations.get(),
});

/** A new list of places becomes the play area (a drawn shape gives way). */
export const applyPlaces = (area: PlayAreaPlaces) => {
    mapGeoLocation.set(area.base);
    additionalMapGeoLocations.set(area.extra);
    polyGeoJSON.set(null);
    mapGeoJSON.set(null);
};
