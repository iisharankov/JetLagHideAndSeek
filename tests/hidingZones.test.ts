import * as turf from "@turf/turf";
import { describe, expect, it, vi } from "vitest";

import { NotApplicableError } from "@/maps/errors";
import {
    BOAT_STOPS,
    DEFAULT_STATION_FILTERS,
    expandingSearch,
    measuringCouldMatch,
    placesNearStation,
    TRAM_STOPS,
    withStationKind,
} from "@/maps/hidingZones";

describe("measuringCouldMatch", () => {
    const seekerDistanceKm = 2;

    it("converts the hiding radius instead of assuming miles", () => {
        // 500 m, not 500 miles: a station 2.6 km away can't be within 2 km.
        expect(
            measuringCouldMatch({
                stationDistanceKm: 2.6,
                seekerDistanceKm,
                hidingRadius: 500,
                hidingRadiusUnit: "meters",
                hiderCloser: true,
            }),
        ).toBe(false);

        expect(
            measuringCouldMatch({
                stationDistanceKm: 2.3,
                seekerDistanceKm,
                hidingRadius: 500,
                hidingRadiusUnit: "meters",
                hiderCloser: true,
            }),
        ).toBe(true);
    });

    it("handles 'further' answers", () => {
        expect(
            measuringCouldMatch({
                stationDistanceKm: 1.4,
                seekerDistanceKm,
                hidingRadius: 0.5,
                hidingRadiusUnit: "kilometers",
                hiderCloser: false,
            }),
        ).toBe(false);

        expect(
            measuringCouldMatch({
                stationDistanceKm: 1.6,
                seekerDistanceKm,
                hidingRadius: 0.5,
                hidingRadiusUnit: "kilometers",
                hiderCloser: false,
            }),
        ).toBe(true);
    });
});

describe("expandingSearch", () => {
    it("returns the first non-empty result", async () => {
        const search = vi
            .fn()
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce(["zoo"]);

        await expect(
            expandingSearch(search, { startKm: 50, maxKm: 400 }),
        ).resolves.toEqual({ found: ["zoo"], radiusKm: 100 });
        expect(search.mock.calls).toEqual([[50], [100]]);
    });

    it("gives up at the maximum radius instead of searching forever", async () => {
        const search = vi.fn().mockResolvedValue([]);

        await expect(
            expandingSearch(search, {
                startKm: 50,
                maxKm: 400,
                what: "zoos",
            }),
        ).rejects.toThrow(new NotApplicableError("No zoos within 400 km."));
        expect(search.mock.calls).toEqual([[50], [100], [200], [400]]);
    });
});

describe("placesNearStation", () => {
    const station = turf.point([8.54, 47.378]);
    const at = (km: number, name: string) =>
        turf.destination(station, km, 90, {
            units: "kilometers",
            properties: { name },
        });

    it("returns every place that could be nearest to someone in the zone", async () => {
        const search = vi.fn(async () => [
            at(10, "A"),
            at(10.8, "B"),
            at(12, "C"),
        ]);

        const places = await placesNearStation(search, station, {
            hidingRadiusKm: 0.5,
            startKm: 50,
            maxKm: 400,
        });

        // Anyone in the zone is within 1 km of the station, so places up to
        // 10 + 2 × 0.5 = 11 km away can be their nearest.
        expect(places.map((p) => p.properties?.name)).toEqual(["A", "B"]);
    });

    it("searches again when the nearest place is close to the edge of the search", async () => {
        const search = vi
            .fn()
            .mockResolvedValueOnce([at(49.8, "far")])
            .mockResolvedValueOnce([at(49.8, "far"), at(50.5, "farther")]);

        const places = await placesNearStation(search, station, {
            hidingRadiusKm: 0.5,
            startKm: 50,
            maxKm: 400,
        });

        expect(search).toHaveBeenCalledTimes(2);
        expect(search.mock.calls[1][0]).toBeCloseTo(50.8, 1);
        expect(places.map((p) => p.properties?.name)).toEqual([
            "far",
            "farther",
        ]);
    });
});

describe("station kinds", () => {
    it("counts railway halts as train stations by default", () => {
        expect(DEFAULT_STATION_FILTERS).toEqual([
            "[railway=station]",
            "[railway=halt]",
        ]);
    });

    it("switches trams and boats on and off without duplicates", () => {
        const withTrams = withStationKind(
            DEFAULT_STATION_FILTERS,
            TRAM_STOPS,
            true,
        );
        expect(withTrams).toEqual([...DEFAULT_STATION_FILTERS, TRAM_STOPS]);
        expect(withStationKind(withTrams, TRAM_STOPS, true)).toBe(withTrams);

        const both = withStationKind(withTrams, BOAT_STOPS, true);
        expect(withStationKind(both, TRAM_STOPS, false)).toEqual([
            ...DEFAULT_STATION_FILTERS,
            BOAT_STOPS,
        ]);
    });
});
