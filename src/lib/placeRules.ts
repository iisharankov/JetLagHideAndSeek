// Which places count. The players reject places while setting up the game
// (a "zoo" that is a pet shop, a mis-tagged museum); those are out of every
// question. And the same place listed several times in the map data (a
// park with three pins) counts once.
import * as turf from "@turf/turf";
import type { Feature, Point } from "geojson";
import { atom } from "nanostores";

import { gameSettings, playAreaKey } from "@/lib/context";
import type { RejectedPlace } from "@/lib/game/types";
import { persistentAtom } from "@/lib/persist";

const json = { encode: JSON.stringify, decode: JSON.parse };
/** A rejection matches a place of the same name within this distance. */
const REJECT_KM = 1;
/** Pins of the same name this close together are one place. */
const DUPLICATE_KM = 0.3;

const nameKey = (name: string) => name.trim().toLowerCase();

const km = (aLat: number, aLng: number, bLat: number, bLng: number) =>
    turf.distance([aLng, aLat], [bLng, bLat], { units: "kilometers" });

/**
 * Rejections by play area, on this phone: what the players decided while
 * setting up a game here comes back for the next game in the same area.
 */
export const rejectedPlacesByArea = persistentAtom<
    Record<string, RejectedPlace[]>
>("rejectedPlaces", {}, json);

export const localRejections = () =>
    rejectedPlacesByArea.get()[playAreaKey()] ?? [];

export const setLocalRejections = (list: RejectedPlace[]) =>
    rejectedPlacesByArea.set({
        ...rejectedPlacesByArea.get(),
        [playAreaKey()]: list,
    });

/** The rejections in force: the game's (every phone has the same). */
export const rejections = () => gameSettings.get().rejectedPlaces ?? [];

export const isRejected = (
    kind: string,
    name: string | undefined,
    lat: number,
    lng: number,
    list: RejectedPlace[] = rejections(),
) =>
    !!name &&
    list.some(
        (entry) =>
            entry.kind === kind &&
            nameKey(entry.name) === nameKey(name) &&
            km(lat, lng, entry.lat, entry.lng) <= REJECT_KM,
    );

export const hasRejections = (
    kind: string,
    list: RejectedPlace[] = rejections(),
) => list.some((entry) => entry.kind === kind);

/** Toggles a place's rejection in a list. */
export const toggleRejection = (
    list: RejectedPlace[],
    place: RejectedPlace,
): RejectedPlace[] =>
    isRejected(place.kind, place.name, place.lat, place.lng, list)
        ? list.filter(
              (entry) =>
                  !(
                      entry.kind === place.kind &&
                      nameKey(entry.name) === nameKey(place.name) &&
                      km(place.lat, place.lng, entry.lat, entry.lng) <=
                          REJECT_KM
                  ),
          )
        : [...list, place];

/** The same place listed several times (same name, close together) once. */
export const mergeDuplicates = <F extends Feature<Point>>(points: F[]): F[] => {
    const kept: F[] = [];
    for (const point of points) {
        const name = point.properties?.name as string | undefined;
        const [lng, lat] = point.geometry.coordinates;
        const twin =
            !!name &&
            kept.some((other) => {
                const otherName = other.properties?.name as string | undefined;
                const [otherLng, otherLat] = other.geometry.coordinates;
                return (
                    !!otherName &&
                    nameKey(otherName) === nameKey(name) &&
                    km(lat, lng, otherLat, otherLng) <= DUPLICATE_KM
                );
            });
        if (!twin) kept.push(point);
    }
    return kept;
};

/** Duplicates merged, rejected places dropped. */
export const applyPlaceRules = <F extends Feature<Point>>(
    kind: string,
    points: F[],
    list: RejectedPlace[] = rejections(),
): F[] =>
    mergeDuplicates(points).filter((point) => {
        const [lng, lat] = point.geometry.coordinates;
        return !isRejected(kind, point.properties?.name, lat, lng, list);
    });

/** What the review on the map found, for its bar. */
export const reviewCounts = atom<{
    loading: boolean;
    total: number;
    rejected: number;
    merged: number;
}>({ loading: false, total: 0, rejected: 0, merged: 0 });
