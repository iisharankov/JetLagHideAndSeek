import * as turf from "@turf/turf";
import { describe, expect, it } from "vitest";

import type { StationPlace } from "@/maps/api";
import { dedupeStations } from "@/maps/geo-utils/stationManipulations";

const stop = (
    id: string,
    name: string | undefined,
    lng: number,
    lat: number,
    tags: Record<string, string> = { railway: "station" },
) => turf.point([lng, lat], { id, name, ...tags }) as unknown as StationPlace;

describe("dedupeStations", () => {
    it("keeps one entry for a station that is also a tram and bus stop", () => {
        const stations = [
            stop("node/1", "Zürich HB", 8.5403, 47.378, {
                railway: "tram_stop",
            }),
            stop("node/2", "Zürich HB", 8.5399, 47.3779, {
                highway: "bus_stop",
            }),
            stop("node/3", "Zürich HB", 8.5402, 47.3782), // the railway station
            stop("node/4", "Zürich HB", 8.5401, 47.3783, { railway: "halt" }),
        ];
        const kept = dedupeStations(stations);
        expect(kept.map((s) => s.properties.id)).toEqual(["node/3"]);
    });

    it("keeps same-named stops that are far apart", () => {
        const kept = dedupeStations([
            stop("node/1", "Bahnhofstrasse", 8.54, 47.37, {
                railway: "tram_stop",
            }),
            stop("node/2", "Bahnhofstrasse", 8.72, 47.5, {
                railway: "tram_stop",
            }),
        ]);
        expect(kept).toHaveLength(2);
    });

    it("keeps every unnamed stop and the original order", () => {
        const stations = [
            stop("node/1", undefined, 8.54, 47.37),
            stop("node/2", "A", 8.55, 47.37),
            stop("node/3", undefined, 8.5401, 47.3701),
            stop("node/4", "A", 8.5501, 47.3701, { railway: "halt" }),
        ];
        expect(dedupeStations(stations).map((s) => s.properties.id)).toEqual([
            "node/1",
            "node/2",
            "node/3",
        ]);
    });
});
