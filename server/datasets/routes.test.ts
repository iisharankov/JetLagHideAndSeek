import { describe, expect, it } from "vitest";

import { linesByStation, parseOplLine, type RailStation } from "./routes";

describe("parseOplLine", () => {
    it("reads nodes, ways and relations without metadata", () => {
        expect(parseOplLine("n12 T x8.5403 y47.3779")).toEqual({
            kind: "node",
            id: 12,
            lon: 8.5403,
            lat: 47.3779,
        });
        expect(
            parseOplLine("n13 Tname=Lugano,railway=stop x8.946 y46.005"),
        ).toEqual({
            kind: "node",
            id: 13,
            lon: 8.946,
            lat: 46.005,
            name: "Lugano",
        });
        expect(parseOplLine("w7 Thighway=platform Nn1,n2,n3")).toEqual({
            kind: "way",
            id: 7,
            nodes: [1, 2, 3],
        });
        expect(
            parseOplLine(
                "r5 Tname=S2:%20%Langnau%20%%3d%>%20%Laupen,ref=S2,route=train Mn1@stop,w7@platform,w9@,r3@platform",
            ),
        ).toEqual({
            kind: "relation",
            id: 5,
            tags: {
                name: "S2: Langnau => Laupen",
                ref: "S2",
                route: "train",
            },
            members: [
                { type: "n", id: 1, role: "stop" },
                { type: "w", id: 7, role: "platform" },
                { type: "w", id: 9, role: "" },
                { type: "r", id: 3, role: "platform" },
            ],
        });
    });

    it("skips nodes without a location", () => {
        expect(parseOplLine("n12 T x y")).toBeNull();
    });
});

describe("linesByStation", () => {
    const stations: RailStation[] = [
        { key: "node/100", lon: 8.54, lat: 47.378 }, // Zürich HB
        { key: "node/200", lon: 8.724, lat: 47.5 }, // Winterthur
        { key: "node/300", lon: 7.439, lat: 46.949 }, // Bern
        { key: "way/400", lon: 9.0, lat: 46.0 }, // Lugano, an area
    ];
    const lines = (lines: Parameters<typeof linesByStation>[0]) =>
        linesByStation(lines, stations);

    it("puts a station on every line stopping within reach of it", () => {
        const result = lines([
            {
                name: "S12",
                stops: [
                    [8.5405, 47.3782], // ~40 m from Zürich HB
                    [8.7238, 47.5003], // Winterthur
                ],
            },
            { name: "IC 1", stops: [[8.5398, 47.3775]] },
        ]);
        expect(result.lines).toEqual([{ name: "S12" }, { name: "IC 1" }]);
        expect(result.stations).toEqual({
            "node/100": [0, 1],
            "node/200": [0],
        });
    });

    it("ignores stops far from any station", () => {
        const result = lines([{ name: "Freight", stops: [[8.0, 47.0]] }]);
        expect(result.stations).toEqual({});
    });

    it("prefers the station with the stop's name", () => {
        const twoStations: RailStation[] = [
            { key: "node/1", lon: 8.0, lat: 47.0, name: "Lugano FLP" },
            { key: "node/2", lon: 8.002, lat: 47.0, name: "Lugano" },
        ];
        const result = linesByStation(
            [{ name: "S10", stops: [[8.0001, 47.0]], stopNames: ["Lugano"] }],
            twoStations,
        );
        expect(result.stations).toEqual({ "node/2": [0] });
    });

    it("matches a stop to the nearest station only", () => {
        const close: RailStation[] = [
            { key: "node/1", lon: 8.0, lat: 47.0 },
            { key: "node/2", lon: 8.002, lat: 47.0 }, // ~150 m east
        ];
        const result = linesByStation(
            [{ name: "R", stops: [[8.0019, 47.0]] }],
            close,
        );
        expect(result.stations).toEqual({ "node/2": [0] });
    });
});
