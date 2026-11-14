import * as turf from "@turf/turf";
import { describe, expect, it } from "vitest";

import { createDatasets } from "@/maps/datasets";
import {
    areaDataUrl,
    areaOf,
    areaTilesUrl,
    basemaps,
    createAreaDatasets,
    sameArea,
    tileCenter,
} from "@/maps/datasets/areas";

// One server, several areas (round 49): the main pack (Switzerland) at the
// data's root, small packs for far cities (Munich, Toronto) next to it,
// listed in areas.json. Each question goes to the pack that covers it.

const zone = (id: number, level: number, name: string, box: number[]) => {
    const polygon = turf.bboxPolygon(box as [number, number, number, number]);
    return {
        type: "Feature",
        id,
        bbox: box,
        properties: { id, admin_level: level, name },
        geometry: polygon.geometry,
    };
};
const zoo = (id: number, lat: number, lon: number, name: string) => ({
    type: "node",
    id,
    lat,
    lon,
    tags: { tourism: "zoo", name },
});

const main = createDatasets(
    async (name) =>
        ({
            manifest: {
                version: 1,
                built: "",
                bbox: [5.5, 45.6, 11, 48.1],
                files: {},
            },
            "admin-4": {
                type: "FeatureCollection",
                features: [zone(1, 4, "Zürich", [8.3, 47.1, 8.9, 47.7])],
            },
            "poi-zoo": { elements: [zoo(10, 47.38, 8.57, "Zoo Zürich")] },
        })[name] ?? null,
);
const toronto = createDatasets(
    async (name) =>
        ({
            manifest: {
                version: 1,
                built: "",
                bbox: [-79.7, 43.55, -79.05, 43.9],
                files: {},
            },
            "admin-6": {
                type: "FeatureCollection",
                features: [
                    zone(2, 6, "Toronto", [-79.64, 43.58, -79.12, 43.86]),
                ],
            },
            "admin-8": {
                type: "FeatureCollection",
                features: [
                    zone(3, 8, "Zürichstrasse", [-79.4, 43.6, -79.3, 43.7]),
                ],
            },
            "poi-zoo": {
                elements: [zoo(20, 43.82, -79.18, "Toronto Zoo")],
            },
        })[name] ?? null,
);
const both = createAreaDatasets(async () => [
    { id: "main", datasets: main },
    { id: "toronto", datasets: toronto },
]);

describe("several areas on one server", () => {
    it("answers each place from the pack that covers it", async () => {
        const inZurich = await both.placesAround("zoo", 47.38, 8.55, 3);
        expect(inZurich?.map((z) => z.tags.name)).toEqual(["Zoo Zürich"]);
        const inToronto = await both.placesAround("zoo", 43.8, -79.2, 5);
        expect(inToronto?.map((z) => z.tags.name)).toEqual(["Toronto Zoo"]);
        // Nowhere: no pack, so null (the app falls back as before).
        expect(await both.placesAround("zoo", 40, 0, 1)).toBeNull();
        expect(await both.covers([-79.5, 43.6, -79.4, 43.7])).toBe(true);
        expect(await both.covers([0, 40, 0.1, 40.1])).toBe(false);
    });

    it("finds zones by point and by id in any pack", async () => {
        expect((await both.adminZoneAt(43.7, -79.4, 6))?.properties.name).toBe(
            "Toronto",
        );
        expect((await both.adminZoneAt(47.4, 8.5, 4))?.properties.name).toBe(
            "Zürich",
        );
        expect((await both.boundaryById(2))?.properties.name).toBe("Toronto");
        expect((await both.boundaryById(1))?.properties.name).toBe("Zürich");
    });

    it("searches every pack's zones, best matches first", async () => {
        const found = await both.searchZones("zürich");
        expect(found?.map((z) => z.properties.name)).toEqual([
            "Zürich",
            "Zürichstrasse",
        ]);
        expect(
            (await both.searchZones("toronto"))?.map((z) => z.properties.name),
        ).toEqual(["Toronto"]);
    });

    it("tells which pack's box a view is in", async () => {
        expect(
            (await both.manifestFor([-79.5, 43.6, -79.4, 43.7]))?.bbox,
        ).toEqual([-79.7, 43.55, -79.05, 43.9]);
        expect((await both.manifestFor([8.5, 47.3, 8.6, 47.4]))?.bbox).toEqual([
            5.5, 45.6, 11, 48.1,
        ]);
    });

    it("puts an area's data and tiles next to the main ones", () => {
        expect(areaDataUrl("/data", "toronto")).toBe("/data/areas/toronto");
        expect(areaTilesUrl("/tiles/basemap.pmtiles", "toronto")).toBe(
            "/tiles/toronto.pmtiles",
        );
        // The middle of an elevation tile (z 10: about 0.35° wide).
        const [lng, lat] = tileCenter(10, 286, 373);
        expect(lng).toBeCloseTo(-79.28, 1);
        expect(lat).toBeCloseTo(43.7, 1);
    });
});

describe("the basemaps", () => {
    it("draws each area's tiles only inside its box (round 49)", () => {
        expect(
            basemaps(
                "/tiles/basemap.pmtiles",
                [5.5, 45.6, 11, 48.1],
                [
                    {
                        id: "toronto",
                        name: "Toronto",
                        bbox: [-79.7, 43.55, -79.05, 43.9],
                    },
                ],
            ),
        ).toEqual([
            { url: "/tiles/basemap.pmtiles", bbox: [5.5, 45.6, 11, 48.1] },
            {
                url: "/tiles/toronto.pmtiles",
                bbox: [-79.7, 43.55, -79.05, 43.9],
            },
        ]);
        // No manifest (a dev machine without data): the main tiles, unbounded.
        expect(basemaps("/tiles/basemap.pmtiles", null, [])).toEqual([
            { url: "/tiles/basemap.pmtiles", bbox: null },
        ]);
    });
});

describe("a place in another area (round 49)", () => {
    const areas = [
        {
            id: "toronto",
            name: "Toronto",
            bbox: [-79.7, 43.55, -79.05, 43.9] as [
                number,
                number,
                number,
                number,
            ],
        },
    ];
    it("is a new play area, not an addition", () => {
        // Zürich, then Toronto: different areas.
        expect(areaOf([8.54, 47.37], areas)).toBe("main");
        expect(areaOf([-79.38, 43.65], areas)).toBe("toronto");
        expect(sameArea([8.54, 47.37], [-79.38, 43.65], areas)).toBe(false);
        // Zürich and Geneva: both the main area's.
        expect(sameArea([8.54, 47.37], [6.14, 46.2], areas)).toBe(true);
    });
});
