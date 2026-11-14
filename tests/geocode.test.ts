import * as turf from "@turf/turf";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { determineName } from "@/maps/api/geo";
import { geocode } from "@/maps/api/geocode";

const square = (
    minLng: number,
    minLat: number,
    maxLng: number,
    maxLat: number,
) => turf.bboxPolygon([minLng, minLat, maxLng, maxLat]);
const zone = (
    id: number,
    level: number,
    name: string,
    poly: any,
    extra: Record<string, string> = {},
) => ({
    type: "Feature",
    id,
    bbox: turf.bbox(poly),
    properties: { id, admin_level: level, name, ...extra },
    geometry: poly.geometry,
});
const collection = (features: unknown[]) => ({
    type: "FeatureCollection",
    features,
});

// Two Kilchbergs, one per canton; the pack's ISO tags only on the country.
const files = vi.hoisted(
    () =>
        ({
            manifest: {
                version: 1,
                built: "",
                bbox: [5, 45, 11, 48],
                files: {},
            },
        }) as Record<string, unknown>,
);
const fill = () => {
    files.manifest = {
        version: 1,
        built: "",
        bbox: [5, 45, 11, 48],
        files: {},
    };
    files["admin-2"] = collection([
        zone(
            51701,
            2,
            "Schweiz/Suisse/Svizzera/Svizra",
            square(5, 45, 11, 48),
            {
                "name:en": "Switzerland",
                "ISO3166-1:alpha2": "CH",
            },
        ),
    ]);
    files["admin-4"] = collection([
        zone(1682248, 4, "Zürich", square(8, 47, 9, 48)),
        zone(1682251, 4, "Basel-Landschaft", square(7, 47, 8, 48)),
    ]);
    files["admin-8"] = collection([
        zone(1683904, 8, "Kilchberg", square(8.5, 47.3, 8.6, 47.4)),
        zone(1683905, 8, "Kilchberg", square(7.7, 47.4, 7.8, 47.5)),
        zone(1683900, 8, "Adliswil", square(8.5, 47.2, 8.6, 47.3)),
    ]);
    files["stations-rail"] = {
        elements: [
            {
                type: "node",
                id: 10,
                lat: 47.378,
                lon: 8.54,
                tags: { railway: "station", name: "Zürich HB" },
            },
        ],
    };
};

// A fresh dataset reader per test: it remembers the files it has loaded.
const holder = vi.hoisted(() => ({ current: null as any, areas: [] as any[] }));
vi.mock("@/maps/datasets/load", () => ({
    datasets: new Proxy(
        {},
        { get: (_target, prop) => holder.current?.[prop as string] },
    ),
    dataAreas: async () => holder.areas,
}));
beforeEach(async () => {
    const { createDatasets } = await import("@/maps/datasets");
    holder.current = createDatasets(
        async (name: string) => files[name] ?? null,
    );
    holder.areas = [];
});
vi.mock("@/lib/config", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/config")>()),
    GEOCODER_URL: "https://photon.test/api/",
}));

afterEach(() => vi.unstubAllGlobals());

describe("geocode", () => {
    it("knows a zone's country without a country outline: from its state, or the area's own (round 49)", async () => {
        // A far area's pack: no complete country or state outline (an
        // extract cut to a city can't hold one).
        files.manifest = {
            version: 1,
            built: "",
            bbox: [-79.7, 43.55, -79.05, 43.9],
            files: {},
        };
        files["admin-2"] = collection([]);
        files["admin-4"] = collection([]);
        files["admin-8"] = collection([]);
        files["admin-6"] = collection([
            zone(324211, 6, "Toronto", square(-79.64, 43.58, -79.12, 43.86)),
        ]);
        holder.areas = [
            {
                id: "toronto",
                name: "Toronto",
                bbox: [-79.7, 43.55, -79.05, 43.9],
                country: "CA",
            },
        ];
        const [toronto] = await geocode("toronto", "en");
        expect(toronto.properties.countrycode).toBe("CA");
        expect(toronto.properties.type).toBe("city or county");
        // A state outline with its ISO code says it first.
        files["admin-4"] = collection([
            zone(68841, 4, "Ontario", square(-80, 43, -79, 44), {
                "ISO3166-2": "CA-ON",
            }),
        ]);
        holder.areas = [];
        holder.current = (await import("@/maps/datasets")).createDatasets(
            async (name: string) => files[name] ?? null,
        );
        const [again] = await geocode("toronto", "en");
        expect(again.properties.countrycode).toBe("CA");
    });

    it("finds zones in the reference data, named with their canton and country", async () => {
        fill();
        const found = await geocode("kilch", "en");
        expect(found.map(determineName)).toEqual([
            "Kilchberg, Zürich, Switzerland",
            "Kilchberg, Basel-Landschaft, Switzerland",
        ]);
        expect(found[0].properties).toMatchObject({
            osm_type: "R",
            osm_id: 1683904,
            countrycode: "CH",
            type: "municipality",
        });
        // [lat, lng], inside the zone.
        const [lat, lng] = found[0].geometry.coordinates;
        expect(lat).toBeGreaterThan(47.3);
        expect(lat).toBeLessThan(47.4);
        expect(lng).toBeGreaterThan(8.5);
        expect(lng).toBeLessThan(8.6);
        // The exact match first, then the biggest zone.
        expect(
            (await geocode("Zürich", "en")).map((f) => f.properties.type),
        ).toEqual(["canton"]);
    });

    it("finds stations and places too, for a point on the map", async () => {
        fill();
        const found = await geocode("zurich hb", "en", false);
        expect(found).toHaveLength(1);
        expect(found[0].properties).toMatchObject({
            osm_type: "N",
            osm_id: 10,
            name: "Zürich HB",
            type: "Train station",
        });
        // Named with the municipality it's in (Kilchberg's square, here).
        expect(determineName(found[0])).toBe(
            "Zürich HB, Kilchberg, Switzerland",
        );
        expect(found[0].geometry.coordinates).toEqual([47.378, 8.54]);
    });

    it("falls back to a Photon server only without reference data", async () => {
        files.manifest = null;
        const fetch = vi.fn(async () =>
            Response.json({
                features: [
                    {
                        type: "Feature",
                        geometry: {
                            type: "Point",
                            coordinates: [8.5403, 47.3779],
                        },
                        properties: {
                            osm_type: "N",
                            osm_id: 1,
                            name: "Zürich HB",
                        },
                    },
                ],
            }),
        );
        vi.stubGlobal("fetch", fetch);
        const [place] = await geocode("Bahnhof & Co #1", "en", false);
        const url = new URL((fetch.mock.calls[0] as unknown as [string])[0]);
        expect(url.searchParams.get("q")).toBe("Bahnhof & Co #1");
        expect(place.geometry.coordinates).toEqual([47.3779, 8.5403]);

        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response("down", { status: 502 })),
        );
        await expect(geocode("Zürich", "en")).rejects.toThrow(/502/);
    });
});
