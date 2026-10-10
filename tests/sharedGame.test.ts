import { describe, expect, it } from "vitest";

import { parsePlayArea, playAreaName, playAreaParts } from "@/lib/sharedGame";

describe("playAreaName", () => {
    const place = (name: string, osm_id: number) => ({
        type: "Feature",
        properties: {
            osm_type: "R",
            osm_id,
            osm_key: "place",
            osm_value: "city",
            type: "city",
            name,
            country: "Switzerland",
            countrycode: "CH",
        },
        geometry: { type: "Point", coordinates: [47.37, 8.54] },
    });

    it("names the place, then what was added and cut out", () => {
        const area = parsePlayArea({
            kind: "place",
            location: place("Zürich", 1),
            alternateLocations: [
                { added: true, base: false, location: place("Kilchberg", 2) },
                { added: false, base: false, location: place("Zürichsee", 3) },
                { added: true, base: false, location: place("Adliswil", 4) },
            ],
        });
        expect(playAreaName(area)).toBe(
            "Zürich, Switzerland + Kilchberg + Adliswil − Zürichsee",
        );
        expect(playAreaParts(area)).toEqual({
            base: "Zürich, Switzerland",
            added: ["Kilchberg", "Adliswil"],
            removed: ["Zürichsee"],
        });
    });

    it("calls a polygon a drawn play area", () => {
        expect(
            playAreaName({
                kind: "polygon",
                polygon: { type: "FeatureCollection", features: [] },
            }),
        ).toBe("a drawn play area");
    });
});
