// How many places of a kind the play area has, for the tentacle tiles (a
// kind with none is dimmed). Counted once per play area and kind.
import type { PlaceKind } from "@/maps/questions/places";

const counts = new WeakMap<object, Map<string, Promise<number | null>>>();

/** The count, or null when the data can't be loaded (nothing to dim). */
export const placeCount = (area: object, kind: PlaceKind) => {
    let byKind = counts.get(area);
    if (!byKind) {
        byKind = new Map();
        counts.set(area, byKind);
    }
    let count = byKind.get(kind);
    if (!count) {
        count = import("@/maps/questions/places")
            .then(({ placesInPlayArea }) => placesInPlayArea(kind))
            .then((places) => places.length)
            .catch(() => null);
        byKind.set(kind, count);
    }
    return count;
};
