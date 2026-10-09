import { describe, expect, it, vi } from "vitest";

import { NotApplicableError } from "@/maps/errors";
import { DEFAULT_STATION_FILTERS, expandingSearch } from "@/maps/hidingZones";

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

describe("station kinds", () => {
    it("counts railway halts as train stations by default", () => {
        expect(DEFAULT_STATION_FILTERS).toEqual([
            "[railway=station]",
            "[railway=halt]",
        ]);
    });
});
