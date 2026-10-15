import * as turf from "@turf/turf";
import { describe, expect, it } from "vitest";

import {
    applyPlaceRules,
    fitsKind,
    isRejected,
    mergeDuplicates,
    passesKindRules,
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
            place("Seepark", 47.38, 8.56), // another block
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

describe("place rules at scale", () => {
    it("merges thousands of places without choking", () => {
        const many = Array.from({ length: 4000 }, (_, i) =>
            place(
                `Park ${i % 500}`,
                47 + (i % 40) * 0.01,
                8 + Math.floor(i / 40) * 0.01,
            ),
        );
        const started = Date.now();
        const merged = mergeDuplicates(many);
        expect(Date.now() - started).toBeLessThan(2000);
        expect(merged.length).toBeLessThanOrEqual(many.length);
    });
});

describe("the kinds' own rules", () => {
    it("keep real zoos, golf courses and theme parks and drop the mis-tagged", () => {
        expect(passesKindRules("zoo", "Zoo Zürich")).toBe(true);
        expect(passesKindRules("zoo", "Knie's Kinderzoo")).toBe(true);
        expect(passesKindRules("zoo", "Wildnispark Zürich Langenberg")).toBe(
            true,
        );
        expect(passesKindRules("zoo", "Streichelzoo")).toBe(false);
        expect(passesKindRules("zoo", "Volière")).toBe(false);
        expect(passesKindRules("zoo", "Fischotter-Gehege")).toBe(false);
        expect(passesKindRules("golf_course", "Golfpark Otelfingen")).toBe(
            true,
        );
        expect(passesKindRules("golf_course", "Swiss Golf Lounge")).toBe(false);
        expect(passesKindRules("golf_course", "Otelfingen SNAG course")).toBe(
            false,
        );
        expect(passesKindRules("theme_park", "Freizeitpark Ticiland")).toBe(
            true,
        );
        expect(passesKindRules("theme_park", "Trampolino")).toBe(false);
        expect(passesKindRules("library", "Ludothek")).toBe(false);
        expect(
            passesKindRules("consulate", "China Visa Application Center"),
        ).toBe(false);
        expect(passesKindRules("museum", "Ortsmuseum")).toBe(true);
    });

    it("drop parks known to be tiny, and keep those of unknown size", () => {
        expect(passesKindRules("park", "Josefwiese", 40_000)).toBe(true);
        expect(passesKindRules("park", "Pocket park", 900)).toBe(false);
        expect(passesKindRules("park", "Pocket park")).toBe(true);
        expect(passesKindRules("park", "Spielplatz Hard")).toBe(false);
    });

    it("merge the parts of one place, up to a kilometre apart", () => {
        const merged = mergeDuplicates([
            place("Wildnispark Zürich Langenberg West", 47.2903, 8.5249),
            place("Wildnispark Zürich Langenberg Ost", 47.2944, 8.5302),
            place("Riffraff 1 + 2", 47.3827, 8.5293),
            place("Riffraff 3 + 4", 47.3828, 8.529),
            place("Derma Medical Clinic AG", 47.3576, 8.5231),
            place("Derma Medical Clinic", 47.357, 8.5236),
        ]);
        expect(merged.map((p) => p.properties.name)).toEqual([
            "Wildnispark Zürich Langenberg West",
            "Riffraff 1 + 2",
            "Derma Medical Clinic AG",
        ]);
        // The same name 600 m apart is two places (two parks called Dorfpark).
        expect(
            mergeDuplicates([
                place("Dorfpark", 47.29, 8.53),
                place("Dorfpark", 47.2954, 8.53),
            ]),
        ).toHaveLength(2);
    });

    it("merge places within a block of each other, whatever their names", () => {
        const merged = mergeDuplicates([
            place("Universitätsspital Zürich", 47.3778, 8.5508),
            place("USZ Dermatologie", 47.3785, 8.5515), // ~90 m away
            place("Stadtspital Waid", 47.3984, 8.5204), // far away
        ]);
        expect(merged.map((p) => p.properties.name)).toEqual([
            "Universitätsspital Zürich",
            "Stadtspital Waid",
        ]);
        // 200 m apart is two places.
        expect(
            mergeDuplicates([
                place("Kino A", 47.37, 8.54),
                place("Kino B", 47.3718, 8.54),
            ]),
        ).toHaveLength(2);
        // With areas known, the big one keeps the dot whatever the order.
        const big = mergeDuplicates([
            turf.point([8.5515, 47.3785], {
                name: "USZ Dermatologie",
                areaM2: 900,
            }),
            turf.point([8.5508, 47.3778], {
                name: "Universitätsspital Zürich",
                areaM2: 80_000,
            }),
        ]);
        expect(big.map((p) => p.properties.name)).toEqual([
            "Universitätsspital Zürich",
        ]);
    });

    it("drop places not open to the public, and private 'zoos'", () => {
        expect(
            fitsKind(
                "park",
                turf.point([8.5, 47.4], {
                    name: "Villa garden",
                    access: "private",
                }),
            ),
        ).toBe(false);
        expect(
            fitsKind(
                "park",
                turf.point([8.5, 47.4], { name: "Stadtpark", access: "yes" }),
            ),
        ).toBe(true);
        expect(fitsKind("zoo", place("Privatzoo Müller", 47.4, 8.5))).toBe(
            false,
        );
        expect(fitsKind("zoo", place("Geflügelzucht Zoo", 47.4, 8.5))).toBe(
            false,
        );
    });

    it("drop the places looked at by hand, wherever the game is", () => {
        expect(
            fitsKind("zoo", place("Tierpark Waidberg", 47.40033, 8.517)),
        ).toBe(false);
        // The same name far away is another place.
        expect(fitsKind("zoo", place("Tierpark Waidberg", 46.9, 7.4))).toBe(
            true,
        );
        expect(
            fitsKind(
                "hospital",
                place("Notfallstation Spital Männedorf", 47.25, 8.69),
            ),
        ).toBe(false);
        expect(
            fitsKind("hospital", place("Spital Männedorf", 47.25, 8.69)),
        ).toBe(true);
        expect(fitsKind("zoo", turf.point([8.5, 47.4], {}))).toBe(false);
    });
});
