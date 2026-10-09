import { describe, expect, it } from "vitest";

import {
    defaultGameSettings,
    describeStations,
    hidingRadiusDefaultKm,
    normalizeGameSettings,
    radarDefaultKm,
    stationFilters,
    stationKindsFromFilters,
} from "@/lib/game/settings";

describe("game settings", () => {
    it("has the defaults the players asked for", () => {
        expect(radarDefaultKm("small")).toBe(2);
        expect(radarDefaultKm("medium")).toBe(10);
        expect(radarDefaultKm("large")).toBe(50);
        expect(hidingRadiusDefaultKm("medium")).toBe(0.5);
        expect(hidingRadiusDefaultKm("large")).toBe(1);

        const swiss = defaultGameSettings("medium", "switzerland");
        expect(swiss.disabledQuestions).toEqual([
            "measuring:coastline",
            "measuring:seven11",
        ]);
        expect(swiss.stationKinds).toEqual({
            halts: true,
            trams: false,
            boats: false,
        });
        expect(
            defaultGameSettings("large", "standard").disabledQuestions,
        ).toEqual(["measuring:lake"]);
    });

    it("turns station kinds into hiding-zone filters and back", () => {
        const filters = stationFilters({
            halts: true,
            trams: true,
            boats: false,
        });
        expect(filters).toEqual([
            "[railway=station]",
            "[railway=halt]",
            "[railway=tram_stop]",
        ]);
        expect(stationKindsFromFilters(filters)).toEqual({
            halts: true,
            trams: true,
            boats: false,
        });
        expect(
            describeStations({ halts: true, trams: false, boats: true }),
        ).toBe("trains, halts, boats");
    });

    it("repairs settings from an old game or a bad request", () => {
        expect(normalizeGameSettings(undefined)).toEqual(
            defaultGameSettings("medium", "switzerland"),
        );
        const fixed = normalizeGameSettings({
            size: "huge",
            region: "mars",
            hidingRadiusKm: -3,
            stationKinds: { trams: "yes" },
            minLakeAreaKm2: "lots",
            disabledQuestions: ["measuring:lake", 42],
            seekersCanAnswer: "true",
        });
        expect(fixed.size).toBe("medium");
        expect(fixed.region).toBe("switzerland");
        expect(fixed.hidingRadiusKm).toBe(0.5);
        expect(fixed.stationKinds).toEqual({
            halts: true,
            trams: false,
            boats: false,
        });
        expect(fixed.minLakeAreaKm2).toBe(10);
        expect(fixed.disabledQuestions).toEqual(["measuring:lake"]);
        expect(fixed.seekersCanAnswer).toBe(false);
    });

    it("keeps valid settings as they are", () => {
        const settings = {
            ...defaultGameSettings("large", "standard"),
            hidingRadiusKm: 1.5,
            stationKinds: { halts: false, trams: true, boats: true },
            minLakeAreaKm2: 25,
            seekersCanAnswer: true,
        };
        expect(normalizeGameSettings(settings)).toEqual(settings);
    });
});
