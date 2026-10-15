import { describe, expect, it } from "vitest";

import {
    categoriesFor,
    isLake,
    normalizePopulation,
    osmIdentity,
    toElement,
} from "./elements";

const feature = (
    id: string,
    geometry: object,
    properties: Record<string, unknown>,
) => ({
    type: "Feature",
    id,
    geometry,
    properties,
});

describe("osmIdentity", () => {
    it("reads osmium export ids", () => {
        expect(osmIdentity("n42")).toEqual({ type: "node", id: 42 });
        expect(osmIdentity("w42")).toEqual({ type: "way", id: 42 });
        // Areas: way areas get even ids (2 × way id), relations odd ids.
        expect(osmIdentity("a84")).toEqual({ type: "way", id: 42 });
        expect(osmIdentity("a85")).toEqual({ type: "relation", id: 42 });
    });
});

describe("categoriesFor", () => {
    it("files places by what they are", () => {
        expect(categoriesFor({ tourism: "zoo", name: "Zoo Zürich" })).toEqual([
            "poi-zoo",
        ]);
        expect(categoriesFor({ railway: "halt" })).toEqual(["stations-rail"]);
        expect(categoriesFor({ highway: "bus_stop" })).toEqual([
            "stations-bus",
        ]);
        expect(categoriesFor({ "brand:wikidata": "Q38076" })).toEqual([
            "brand-mcdonalds",
        ]);
    });

    it("only keeps airports on the commercial airport list", () => {
        expect(categoriesFor({ aeroway: "aerodrome", iata: "ZRH" })).toEqual([
            "airports",
        ]);
        // EuroAirport Basel-Mulhouse goes by several codes.
        expect(categoriesFor({ aeroway: "aerodrome", iata: "MLH" })).toEqual([
            "airports",
        ]);
        // Airports people think of as airports count, flights or not.
        expect(categoriesFor({ aeroway: "aerodrome", iata: "LUG" })).toEqual([
            "airports",
        ]);
        expect(categoriesFor({ aeroway: "aerodrome", iata: "SIR" })).toEqual([
            "airports",
        ]);
        // Airfields and military bases with an IATA code don't.
        expect(categoriesFor({ aeroway: "aerodrome", iata: "BXO" })).toEqual(
            [],
        );
        expect(categoriesFor({ aeroway: "aerodrome" })).toEqual([]);
    });

    it("ignores everything else", () => {
        expect(categoriesFor({ highway: "crossing" })).toEqual([]);
    });
});

describe("toElement", () => {
    it("turns a node into an Overpass-style node with only useful tags", () => {
        expect(
            toElement(
                feature(
                    "n1",
                    { type: "Point", coordinates: [8.5403, 47.3779] },
                    {
                        name: "Zürich HB",
                        railway: "station",
                        operator: "SBB",
                        wheelchair: "yes",
                    },
                ),
            ),
        ).toEqual({
            type: "node",
            id: 1,
            lat: 47.3779,
            lon: 8.5403,
            tags: { name: "Zürich HB", railway: "station" },
        });
    });

    it("gives areas a centre point, like Overpass's `out center`", () => {
        expect(
            toElement(
                feature(
                    "a85",
                    {
                        type: "MultiPolygon",
                        coordinates: [
                            [
                                [
                                    [8, 47],
                                    [8.2, 47],
                                    [8.2, 47.2],
                                    [8, 47.2],
                                    [8, 47],
                                ],
                            ],
                        ],
                    },
                    { tourism: "zoo", name: "Zoo" },
                ),
            ),
        ).toEqual({
            type: "relation",
            id: 42,
            center: { lat: 47.1, lon: 8.1 },
            tags: {
                tourism: "zoo",
                name: "Zoo",
                area_m2: expect.stringMatching(/^\d+$/),
            },
        });
    });
});

describe("normalizePopulation", () => {
    it("reads thousands separators people use in OSM", () => {
        expect(normalizePopulation("122’937")).toBe("122937");
        expect(normalizePopulation("122'937")).toBe("122937");
        expect(normalizePopulation("1,371,498")).toBe("1371498");
        expect(normalizePopulation("128 848")).toBe("128848");
        expect(normalizePopulation("128848")).toBe("128848");
    });

    it("leaves anything else alone", () => {
        expect(normalizePopulation("about 5000")).toBe("about 5000");
        expect(normalizePopulation("12.5")).toBe("12.5");
    });

    it("is applied when building elements", () => {
        expect(
            toElement(
                feature(
                    "n1",
                    { type: "Point", coordinates: [8.72, 47.5] },
                    {
                        name: "Winterthur",
                        place: "city",
                        population: "122’937",
                    },
                ),
            ).tags.population,
        ).toBe("122937");
    });
});

describe("isLake", () => {
    it("accepts lakes and reservoirs, and water with no kind given", () => {
        expect(isLake({ natural: "water", water: "lake" })).toBe(true);
        expect(isLake({ natural: "water", water: "reservoir" })).toBe(true);
        expect(isLake({ natural: "water" })).toBe(true);
    });

    it("rejects rivers, canals and other water", () => {
        expect(isLake({ natural: "water", water: "river" })).toBe(false);
        expect(isLake({ natural: "water", water: "canal" })).toBe(false);
        expect(isLake({ natural: "wetland" })).toBe(false);
    });
});
