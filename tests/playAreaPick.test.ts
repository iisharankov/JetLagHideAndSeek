import { describe, expect, it } from "vitest";

import {
    flipPlace,
    placeStatus,
    type PlayAreaPlaces,
    removePlace,
    tapPlace,
} from "@/lib/playAreaPick";
import type { OpenStreetMap } from "@/maps/api/types";

const place = (id: number, name: string): OpenStreetMap =>
    ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [47.4, 8.5] },
        properties: { osm_type: "R", osm_id: id, name },
    }) as unknown as OpenStreetMap;

const CH = place(1, "Switzerland");
const ZH_CANTON = place(4, "Zürich (canton)");
const ZURICH = place(8, "Zürich");
const DUBENDORF = place(9, "Dübendorf");
const LAKE = place(99, "Lake");

const only = (base: OpenStreetMap): PlayAreaPlaces => ({ base, extra: [] });
const names = (area: PlayAreaPlaces | null) =>
    area && [
        area.base.properties.name,
        ...area.extra.map(
            (x) => `${x.added ? "+" : "−"}${x.location.properties.name}`,
        ),
    ];

describe("picking the play area on the map", () => {
    it("a municipality tapped inside the area chosen before replaces it", () => {
        // The default whole country, then Zürich: just Zürich.
        const zurich = tapPlace(only(CH), ZURICH, "add", [1, 4]);
        expect(names(zurich)).toEqual(["Zürich"]);
        // Then a neighbour: both.
        const both = tapPlace(zurich!, DUBENDORF, "add", [1, 4]);
        expect(names(both)).toEqual(["Zürich", "+Dübendorf"]);
    });

    it("a place outside the chosen areas is added to them", () => {
        expect(names(tapPlace(only(ZURICH), DUBENDORF, "add", [1, 4]))).toEqual(
            ["Zürich", "+Dübendorf"],
        );
    });

    it("tapping a chosen place again takes it out; the first one left leads", () => {
        const both = tapPlace(only(ZURICH), DUBENDORF, "add", [1, 4])!;
        expect(names(tapPlace(both, DUBENDORF, "add", []))).toEqual(["Zürich"]);
        expect(names(tapPlace(both, ZURICH, "add", []))).toEqual(["Dübendorf"]);
    });

    it("never leaves the play area empty", () => {
        expect(tapPlace(only(ZURICH), ZURICH, "add", [])).toBeNull();
        expect(removePlace(only(ZURICH), 8)).toBeNull();
        expect(tapPlace(only(ZURICH), ZURICH, "cut", [])).toBeNull();
    });

    it("cuts places out, and puts them back on a second tap", () => {
        const cut = tapPlace(only(ZH_CANTON), LAKE, "cut", [1, 4]);
        expect(names(cut)).toEqual(["Zürich (canton)", "−Lake"]);
        expect(placeStatus(cut!, 99)).toBe("cut");
        expect(names(tapPlace(cut!, LAKE, "cut", []))).toEqual([
            "Zürich (canton)",
        ]);
        // Adding a cut-out place takes it back in.
        expect(placeStatus(tapPlace(cut!, LAKE, "add", [])!, 99)).toBe("added");
    });

    it("cutting out the leading place hands the lead on", () => {
        const both = tapPlace(only(ZURICH), DUBENDORF, "add", [1, 4])!;
        expect(names(tapPlace(both, ZURICH, "cut", []))).toEqual([
            "Dübendorf",
            "−Zürich",
        ]);
    });

    it("the list flips a place between in and out, and removes it", () => {
        const both = tapPlace(only(ZURICH), DUBENDORF, "add", [1, 4])!;
        expect(names(flipPlace(both, 9))).toEqual(["Zürich", "−Dübendorf"]);
        expect(names(flipPlace(flipPlace(both, 9)!, 9))).toEqual([
            "Zürich",
            "+Dübendorf",
        ]);
        expect(names(removePlace(both, 9))).toEqual(["Zürich"]);
        expect(placeStatus(both, 12345)).toBeNull();
    });

    it("never changes the places it was given", () => {
        const both = tapPlace(only(ZURICH), DUBENDORF, "add", [1, 4])!;
        const before = JSON.stringify(both);
        flipPlace(both, 9);
        tapPlace(both, DUBENDORF, "cut", []);
        expect(JSON.stringify(both)).toBe(before);
    });
});
