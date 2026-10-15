import * as turf from "@turf/turf";
import { describe, expect, it, vi } from "vitest";

import {
    createDatasets,
    matchesTagFilter,
    parseTagFilter,
} from "@/maps/datasets";

const square = (
    minLng: number,
    minLat: number,
    maxLng: number,
    maxLat: number,
) => turf.bboxPolygon([minLng, minLat, maxLng, maxLat]);

const zone = (id: number, level: number, name: string, poly: any) => ({
    type: "Feature",
    id,
    bbox: turf.bbox(poly),
    properties: { id, admin_level: level, name },
    geometry: poly.geometry,
});

// Two cantons side by side, inside a country, covering lng 8–10, lat 46–47.
const files: Record<string, unknown> = {
    manifest: { version: 1, built: "", bbox: [7, 45, 11, 48], files: {} },
    "admin-2": {
        type: "FeatureCollection",
        features: [zone(51701, 2, "Schweiz", square(7, 45, 11, 48))],
    },
    "admin-4": {
        type: "FeatureCollection",
        features: [
            zone(1, 4, "Westkanton", square(8, 46, 9, 47)),
            zone(2, 4, "Ostkanton", square(9, 46, 10, 47)),
        ],
    },
    "poi-zoo": {
        elements: [
            {
                type: "node",
                id: 1,
                lat: 46.5,
                lon: 8.5,
                tags: { tourism: "zoo", name: "West Zoo" },
            },
            {
                type: "way",
                id: 2,
                center: { lat: 46.5, lon: 9.5 },
                tags: { tourism: "zoo", name: "East Zoo" },
            },
        ],
    },
    "stations-rail": {
        elements: [
            {
                type: "node",
                id: 10,
                lat: 46.5,
                lon: 8.5,
                tags: { railway: "station", name: "A" },
            },
            {
                type: "node",
                id: 11,
                lat: 46.6,
                lon: 8.6,
                tags: { railway: "station", subway: "yes", name: "B" },
            },
            {
                type: "node",
                id: 12,
                lat: 46.7,
                lon: 9.7,
                tags: { railway: "halt", name: "C" },
            },
        ],
    },
    cities: {
        elements: [
            {
                type: "node",
                id: 20,
                lat: 46.5,
                lon: 8.5,
                tags: { place: "city", population: "421878", name: "Big" },
            },
            {
                type: "node",
                id: 21,
                lat: 46.5,
                lon: 9.5,
                tags: { place: "city", population: "35000", name: "Small" },
            },
        ],
    },
};

files["train-lines"] = {
    lines: [{ name: "S1" }, { name: "S2" }],
    stations: { "node/10": [0], "node/11": [0, 1], "node/12": [1] },
};
files.lakes = {
    type: "FeatureCollection",
    features: [
        {
            type: "Feature",
            bbox: [8.2, 46.2, 8.3, 46.3],
            properties: { name: "Small Lake", areaKm2: 12 },
            geometry: square(8.2, 46.2, 8.3, 46.3).geometry,
        },
        {
            type: "Feature",
            bbox: [9.2, 46.2, 9.6, 46.4],
            properties: { name: "Big Lake", areaKm2: 60 },
            geometry: square(9.2, 46.2, 9.6, 46.4).geometry,
        },
    ],
};

const datasets = () => {
    const load = vi.fn(async (file: string) => files[file] ?? null);
    return { load, data: createDatasets(load) };
};

const westCanton = turf.featureCollection([square(8, 46, 9, 47)]);

describe("parseTagFilter / matchesTagFilter", () => {
    it("understands the Overpass filters the app uses", () => {
        const tags = {
            railway: "station",
            subway: "yes",
            population: "421878",
        };
        const matches = (filter: string) =>
            matchesTagFilter(tags, parseTagFilter(filter));

        expect(matches("[railway=station]")).toBe(true);
        expect(matches('["railway"="station"]')).toBe(true);
        expect(matches("[railway=station][subway!=yes]")).toBe(false);
        expect(matches("[subway]")).toBe(true);
        expect(matches("[iata]")).toBe(false);
        expect(matches('[population~"^[1-9][0-9]{5,}$"]')).toBe(true);
    });
});

describe("placesInZone", () => {
    it("returns matching places inside the play area", async () => {
        const { data } = datasets();
        const result = await data.placesInZone(
            ["[railway=station][subway!=yes]"],
            westCanton,
        );
        expect(result?.map((e) => e.id)).toEqual([10]);
    });

    it("applies every filter, e.g. a population threshold", async () => {
        const { data } = datasets();
        const result = await data.placesInZone(
            ['[place=city]["population"~"^[1-9][0-9]{5,}$"]'],
            turf.featureCollection([square(7, 45, 11, 48)]),
        );
        expect(result?.map((e) => e.tags.name)).toEqual(["Big"]);
    });

    it("combines alternative filters", async () => {
        const { data } = datasets();
        const result = await data.placesInZone(
            ["[railway=station]", "[railway=halt]"],
            turf.featureCollection([square(7, 45, 11, 48)]),
        );
        expect(result?.map((e) => e.id)).toEqual([10, 11, 12]);
    });

    it("gives up (null) for filters it has no data for", async () => {
        const { data } = datasets();
        expect(
            await data.placesInZone(
                ["[public_transport=platform][platform=ferry]"],
                westCanton,
            ),
        ).toBeNull();
    });

    it("gives up (null) for areas outside the data", async () => {
        const { data } = datasets();
        expect(
            await data.placesInZone(
                ["[railway=station]"],
                turf.featureCollection([square(20, 50, 21, 51)]),
            ),
        ).toBeNull();
    });
});

describe("placesAround", () => {
    it("returns places of a type within a radius", async () => {
        const { data } = datasets();
        const result = await data.placesAround("zoo", 46.5, 8.6, 20);
        expect(result?.map((e) => e.tags.name)).toEqual(["West Zoo"]);
    });
});

describe("admin zones", () => {
    it("finds the zone containing a point", async () => {
        const { data } = datasets();
        const found = await data.adminZoneAt(46.5, 9.5, 4);
        expect(found?.properties?.name).toBe("Ostkanton");
    });

    it("reports a missing level as null, not as 'no data'", async () => {
        const { data } = datasets();
        expect(await data.adminZoneAt(46.5, 9.5, 6)).toBeNull();
    });

    it("lists every level present at a point", async () => {
        const { data } = datasets();
        expect(await data.adminLevelsAt(46.5, 8.5)).toEqual([
            { level: 2, name: "Schweiz" },
            { level: 4, name: "Westkanton" },
        ]);
    });

    it("finds a boundary by its relation id", async () => {
        const { data } = datasets();
        const found = await data.boundaryById(2);
        expect(found?.properties?.name).toBe("Ostkanton");
    });

    it("returns the border lines of a level in a box", async () => {
        const { data } = datasets();
        const lines = await data.adminBorderLines(4, [8.9, 46.4, 9.1, 46.6]);
        expect(lines).toHaveLength(2);
        expect(lines![0].geometry.type).toMatch(/LineString/);
    });
});

describe("search", () => {
    it("finds zones by name, exact matches and big zones first", async () => {
        const { data } = datasets();
        expect(
            (await data.searchZones("ostk"))?.map((z) => z.properties.name),
        ).toEqual(["Ostkanton"]);
        expect(
            (await data.searchZones("KANTON"))?.map((z) => z.properties.name),
        ).toEqual(["Westkanton", "Ostkanton"]);
        expect(await data.searchZones("  ")).toEqual([]);
    });

    it("finds stations and places by name", async () => {
        const { data } = datasets();
        const found = await data.searchPlaces("zoo");
        expect(found?.map((f) => f.element.tags.name)).toEqual([
            "West Zoo",
            "East Zoo",
        ]);
        expect(found?.[0].file).toBe("poi-zoo");
        expect(await data.searchPlaces("z")).toEqual([]);
    });

    it("answers null without data", async () => {
        const data = createDatasets(async () => null);
        expect(await data.searchZones("zoo")).toBeNull();
        expect(await data.searchPlaces("zoo")).toBeNull();
    });
});

describe("train lines", () => {
    it("lists the stations sharing a line with a station", async () => {
        const { data } = datasets();
        const found = await data.stationsOnSameLine("node/10");
        expect(found?.lines).toEqual(["S1"]);
        expect([...found!.stations].sort()).toEqual(["node/10", "node/11"]);
    });

    it("knows when a station has no lines", async () => {
        const { data } = datasets();
        const found = await data.stationsOnSameLine("node/99");
        expect(found?.lines).toEqual([]);
        expect(found?.stations.size).toBe(0);
    });
});

describe("lakes", () => {
    it("returns lakes of at least a size", async () => {
        const { data } = datasets();
        expect((await data.lakes(10))?.map((l) => l.properties.name)).toEqual([
            "Small Lake",
            "Big Lake",
        ]);
        expect((await data.lakes(50))?.map((l) => l.properties.name)).toEqual([
            "Big Lake",
        ]);
    });
});

describe("without data", () => {
    it("answers null everywhere when no manifest exists", async () => {
        const data = createDatasets(async () => null);
        expect(await data.adminZoneAt(46.5, 9.5, 4)).toBeUndefined();
        expect(await data.placesAround("zoo", 46.5, 8.6, 20)).toBeNull();
        expect(await data.stationsOnSameLine("node/10")).toBeUndefined();
        expect(await data.lakes(10)).toBeUndefined();
    });
});
