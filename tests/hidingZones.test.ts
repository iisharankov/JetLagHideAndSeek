import * as turf from "@turf/turf";
import { describe, expect, it, vi } from "vitest";

import { NotApplicableError } from "@/maps/errors";
import {
    clipZonesToRemaining,
    DEFAULT_STATION_FILTERS,
    expandingSearch,
    measuringCouldMatch,
    placesNearStation,
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
});

describe("clipZonesToRemaining", () => {
    const remaining = turf.featureCollection([
        turf.bboxPolygon([8.5, 47.3, 8.6, 47.4]),
    ]);
    const zone = (lng: number, lat: number) =>
        turf.circle([lng, lat], 1, {
            units: "kilometers",
            properties: { id: `${lng}` },
        });

    it("keeps the part of each zone still in play, and drops the rest", () => {
        const inside = zone(8.55, 47.35);
        const edge = zone(8.5, 47.35); // half in, half out
        const outside = zone(8.8, 47.35);
        const clipped = clipZonesToRemaining(
            [inside, edge, outside],
            remaining,
        );

        expect(clipped.map((z) => z.properties.id)).toEqual(["8.55", "8.5"]);
        expect(turf.area(clipped[0])).toBeCloseTo(turf.area(inside), -3);
        expect(turf.area(clipped[1]) / turf.area(edge)).toBeCloseTo(0.5, 1);
    });

    it("gives nothing when no area is left", () => {
        expect(
            clipZonesToRemaining(
                [zone(8.55, 47.35)],
                turf.featureCollection([]),
            ),
        ).toEqual([]);
    });
});
