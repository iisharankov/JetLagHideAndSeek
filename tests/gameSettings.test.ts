import { describe, expect, it } from "vitest";

import {
    ALWAYS_OFF,
    defaultGameSettings,
    describeStations,
    hidingRadiusDefaultKm,
    normalizeGameSettings,
    radarDefaultKm,
    radarDefaults,
    stationFilters,
    stationKindsFromFilters,
} from "@/lib/game/settings";

describe("game settings", () => {
    it("has the defaults the players asked for", () => {
        expect(radarDefaultKm("small")).toBe(2);
        expect(radarDefaultKm("medium")).toBe(10);
        expect(radarDefaultKm("large")).toBe(40);
        // Each size's radar distances include its default.
        for (const size of ["small", "medium", "large"] as const) {
            expect(radarDefaults(size)).toContain(radarDefaultKm(size));
        }
        expect(radarDefaults("small")).not.toContain(160);
        expect(radarDefaults("medium")).not.toContain(160);
        expect(hidingRadiusDefaultKm("medium")).toBe(0.5);
        expect(hidingRadiusDefaultKm("large")).toBe(1);

        const swiss = defaultGameSettings("medium", "switzerland");
        expect(swiss.disabledQuestions).toEqual([
            ...ALWAYS_OFF,
            "measuring:coastline",
            "measuring:seven11",
        ]);
        expect(swiss.stationKinds).toEqual({ trams: false, boats: false });
        expect(
            defaultGameSettings("large", "standard").disabledQuestions,
        ).toEqual([...ALWAYS_OFF, "measuring:lake"]);
    });

    it("turns station kinds into hiding-zone filters and back", () => {
        // Halts are train stations too: always in.
        const filters = stationFilters({ trams: true, boats: false });
        expect(filters).toEqual([
            "[railway=station]",
            "[railway=halt]",
            "[railway=tram_stop]",
        ]);
        expect(stationKindsFromFilters(filters)).toEqual({
            trams: true,
            boats: false,
        });
        expect(describeStations({ trams: false, boats: true })).toBe(
            "trains, boats",
        );
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
        expect(fixed.stationKinds).toEqual({ trams: false, boats: false });
        expect(fixed.minLakeAreaKm2).toBe(10);
        expect(fixed.disabledQuestions).toEqual(["measuring:lake"]);
        expect(fixed.seekersCanAnswer).toBe(false);
    });

    it("keeps the deck's composition within reason", () => {
        const fixed = normalizeGameSettings({
            deckCounts: { curse_cairn: 3, powerup_move: -1, time_bonus_5: "x" },
            customCards: [
                {
                    id: "c1",
                    kind: "time",
                    name: "  Bonus of doom  ",
                    text: "Ten minutes, why not.",
                    count: 2,
                    minutes: [5, 10, 15],
                    photo: "not a data url",
                },
                { kind: "curse" },
            ],
            cardPopups: "all",
        });
        expect(fixed.deckCounts).toEqual({ curse_cairn: 3 });
        expect(fixed.customCards).toEqual([
            {
                id: "c1",
                kind: "time",
                name: "Bonus of doom",
                text: "Ten minutes, why not.",
                count: 2,
                minutes: [5, 10, 15],
            },
        ]);
        expect(fixed.cardPopups).toBe("all");
    });

    it("keeps valid settings as they are", () => {
        const settings = {
            ...defaultGameSettings("large", "standard"),
            hidingRadiusKm: 1.5,
            stationKinds: { trams: true, boats: true },
            minLakeAreaKm2: 25,
            seekersCanAnswer: true,
        };
        expect(normalizeGameSettings(settings)).toEqual(settings);
    });
});

describe("rejected places", () => {
    it("keeps the sensible ones and drops the rest", () => {
        const settings = normalizeGameSettings({
            rejectedPlaces: [
                { kind: "zoo", name: "Pet shop", lat: 47.37, lng: 8.54 },
                { kind: "zoo", name: "No position", lat: "x", lng: 8.54 },
                "nonsense",
                { kind: 5, name: "Bad kind", lat: 47, lng: 8 },
            ],
        });
        expect(settings.rejectedPlaces).toEqual([
            { kind: "zoo", name: "Pet shop", lat: 47.37, lng: 8.54 },
        ]);
        expect(normalizeGameSettings({}).rejectedPlaces).toEqual([]);
    });
});

describe("radar distances", () => {
    it("are tidied up, or fall back to the size's own", () => {
        expect(
            normalizeGameSettings({
                size: "small",
                radarKm: [5, "2", 5, -1, 0],
            }).radarKm,
        ).toEqual([2, 5]);
        expect(
            normalizeGameSettings({ size: "large", radarKm: [] }).radarKm,
        ).toEqual(radarDefaults("large"));
        expect(normalizeGameSettings({ size: "medium" }).radarKm).toEqual(
            radarDefaults("medium"),
        );
    });
});
