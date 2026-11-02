// The play area's shape for the map's refresh: the drawn polygon, or the
// boundaries of the chosen place (and the places added or taken away).
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { toast } from "react-toastify";

import {
    additionalMapGeoLocations,
    mapGeoJSON,
    mapGeoLocation,
    polyGeoJSON,
} from "@/lib/context";
import { determineMapBoundaries } from "@/maps/api";

/** What the play area is made from; a change replaces the store's value. */
const inputs = () => [
    mapGeoLocation.get(),
    additionalMapGeoLocations.get(),
    polyGeoJSON.get(),
    mapGeoJSON.get(),
];

/**
 * The play area, loaded once and kept in `mapGeoJSON` until it changes.
 * Boundaries take a while to load; if the play area changes meanwhile (a
 * phone opening a game's link starts with its own area, then the game's
 * arrives), the loaded one is out of date: it is dropped, never kept, and
 * the current one is loaded instead.
 */
export const loadPlayArea = async (): Promise<
    FeatureCollection<Polygon | MultiPolygon>
> => {
    const loaded = mapGeoJSON.get();
    if (loaded) return loaded;

    const drawn = polyGeoJSON.get();
    if (drawn) {
        mapGeoJSON.set(drawn);
        return drawn;
    }

    const before = inputs();
    const boundaries = await toast.promise(determineMapBoundaries(), {
        pending: "Loading the play area...",
    });
    if (inputs().some((value, index) => value !== before[index])) {
        return loadPlayArea();
    }
    mapGeoJSON.set(boundaries);
    return boundaries;
};
