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

/** Rejections by kind and name, built once per list (lists are replaced, never mutated). */
const indexes = new WeakMap<RejectedPlace[], Map<string, RejectedPlace[]>>();
const indexOf = (list: RejectedPlace[]) => {
    let index = indexes.get(list);
    if (!index) {
        index = new Map();
        for (const entry of list) {
            const key = `${entry.kind}|${nameKey(entry.name)}`;
            index.set(key, [...(index.get(key) ?? []), entry]);
        }
        indexes.set(list, index);
    }
    return index;
};

export const isRejected = (
    kind: string,
    name: string | undefined,
    lat: number,
    lng: number,
    list: RejectedPlace[] = rejections(),
) =>
    !!name &&
    (indexOf(list).get(`${kind}|${nameKey(name)}`) ?? []).some(
        (entry) => km(lat, lng, entry.lat, entry.lng) <= REJECT_KM,
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

/**
 * The same place listed several times (same name, close together) once.
 * Only places of the same name are compared, so thousands of parks stay
 * cheap.
 */
export const mergeDuplicates = <F extends Feature<Point>>(points: F[]): F[] => {
    const kept: F[] = [];
    const byName = new Map<string, F[]>();
    for (const point of points) {
        const name = point.properties?.name as string | undefined;
        if (!name) {
            kept.push(point);
            continue;
        }
        const key = nameKey(name);
        const [lng, lat] = point.geometry.coordinates;
        const twins = byName.get(key) ?? [];
        const twin = twins.some((other) => {
            const [otherLng, otherLat] = other.geometry.coordinates;
            return km(lat, lng, otherLat, otherLng) <= DUPLICATE_KM;
        });
        if (twin) continue;
        twins.push(point);
        byName.set(key, twins);
        kept.push(point);
    }
    return kept;
};

/** A place the questions can name. */
export const named = (point: Feature<Point>) => !!point.properties?.name;

/** Unnamed places dropped, duplicates merged, rejected places dropped. */
export const applyPlaceRules = <F extends Feature<Point>>(
    kind: string,
    points: F[],
    list: RejectedPlace[] = rejections(),
): F[] =>
    mergeDuplicates(points.filter(named)).filter((point) => {
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
