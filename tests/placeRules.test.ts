import * as turf from "@turf/turf";
import { describe, expect, it } from "vitest";

import {
    applyPlaceRules,
    isRejected,
    mergeDuplicates,
    toggleRejection,
} from "@/lib/placeRules";

const place = (name: string, lat: number, lng: number) =>
    turf.point([lng, lat], { name });

describe("place rules", () => {
    it("merges the same place listed several times, close together", () => {
        const merged = mergeDuplicates([
            place("Stadtpark", 47.37, 8.54),
            place("Stadtpark", 47.371, 8.541),
            place("stadtpark ", 47.3705, 8.5405),
            place("Stadtpark", 47.4, 8.6),
            place("Seepark", 47.37, 8.54),
        ]);
        expect(merged.map((p) => p.properties.name)).toEqual([
            "Stadtpark",
            "Stadtpark",
            "Seepark",
        ]);
    });

    it("rejects a place by name near where it was rejected", () => {
        const list = [
            { kind: "zoo", name: "Zoo Zürich", lat: 47.385, lng: 8.574 },
        ];
        expect(isRejected("zoo", "zoo zürich", 47.386, 8.575, list)).toBe(true);
        expect(isRejected("zoo", "Zoo Zürich", 47.5, 8.574, list)).toBe(false);
        expect(isRejected("park", "Zoo Zürich", 47.385, 8.574, list)).toBe(
            false,
        );
        expect(isRejected("zoo", undefined, 47.385, 8.574, list)).toBe(false);
    });

    it("drops rejected places and merges duplicates in one go", () => {
        const list = [{ kind: "zoo", name: "Pet shop", lat: 47.37, lng: 8.54 }];
        const kept = applyPlaceRules(
            "zoo",
            [
                place("Pet shop", 47.37, 8.54),
                place("Zoo Zürich", 47.385, 8.574),
                place("Zoo Zürich", 47.3851, 8.5741),
            ],
            list,
        );
        expect(kept.map((p) => p.properties.name)).toEqual(["Zoo Zürich"]);
    });

    it("toggles a rejection", () => {
        const zoo = { kind: "zoo", name: "Pet shop", lat: 47.37, lng: 8.54 };
        const on = toggleRejection([], zoo);
        expect(on).toEqual([zoo]);
        expect(toggleRejection(on, { ...zoo, lat: 47.3701 })).toEqual([]);
    });
});
