import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    additionalMapGeoLocations,
    mapGeoJSON,
    mapGeoLocation,
    polyGeoJSON,
} from "@/lib/context";

type Area = FeatureCollection<Polygon | MultiPolygon>;

/** One pending boundary load per call, resolved by the test. */
const loads: { resolve: (area: Area) => void; osmId: number }[] = [];
vi.mock("@/maps/api", () => ({
    determineMapBoundaries: () =>
        new Promise<Area>((resolve) =>
            loads.push({
                resolve,
                osmId: mapGeoLocation.get().properties.osm_id,
            }),
        ),
}));

const { loadPlayArea } = await import("@/maps/playArea");

const area = (name: string): Area => ({
    type: "FeatureCollection",
    features: [
        {
            type: "Feature",
            properties: { name },
            geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        [8, 47],
                        [9, 47],
                        [9, 48],
                        [8, 47],
                    ],
                ],
            },
        },
    ],
});

const place = (osmId: number) => ({
    ...mapGeoLocation.get(),
    properties: { ...mapGeoLocation.get().properties, osm_id: osmId },
});

/** Lets pending promise callbacks run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("loadPlayArea", () => {
    beforeEach(() => {
        loads.length = 0;
        mapGeoJSON.set(null);
        polyGeoJSON.set(null);
        additionalMapGeoLocations.set([]);
        mapGeoLocation.set(place(1));
    });

    it("loads the place's boundary once and keeps it", async () => {
        const loading = loadPlayArea();
        loads[0].resolve(area("one"));
        expect(await loading).toEqual(area("one"));
        expect(mapGeoJSON.get()).toEqual(area("one"));
        expect(await loadPlayArea()).toEqual(area("one"));
        expect(loads).toHaveLength(1);
    });

    it("drops a boundary for a place that was replaced while it loaded", async () => {
        // A fresh phone loads its own default area; the game's arrives.
        const loading = loadPlayArea();
        mapGeoLocation.set(place(2));
        mapGeoJSON.set(null);
        loads[0].resolve(area("default"));
        await settle();
        // The stale boundary is never kept: the game's place loads instead.
        expect(mapGeoJSON.get()).toBeNull();
        expect(loads).toHaveLength(2);
        expect(loads[1].osmId).toBe(2);
        loads[1].resolve(area("game"));
        expect(await loading).toEqual(area("game"));
        expect(mapGeoJSON.get()).toEqual(area("game"));
    });

    it("uses a drawn play area that arrived while a boundary loaded", async () => {
        const loading = loadPlayArea();
        polyGeoJSON.set(area("drawn"));
        mapGeoJSON.set(null);
        loads[0].resolve(area("default"));
        expect(await loading).toEqual(area("drawn"));
        expect(mapGeoJSON.get()).toEqual(area("drawn"));
        expect(loads).toHaveLength(1);
    });
});
