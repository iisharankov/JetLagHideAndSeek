import * as turf from "@turf/turf";
import { describe, expect, it } from "vitest";

import type { StationCircle, StationPlace } from "@/maps/api";
import {
    applyStationNameQuestion,
    firstLetter,
    nameLength,
    stationSignName,
} from "@/maps/stationNames";

const station = (
    id: string,
    lng: number,
    lat: number,
    tags: Record<string, string>,
): StationPlace =>
    turf.point([lng, lat], { id, ...tags }) as unknown as StationPlace;

const zone = (place: StationPlace): StationCircle =>
    turf.circle(place.geometry.coordinates, 0.5, {
        units: "kilometers",
        properties: place,
    }) as unknown as StationCircle;

describe("stationSignName", () => {
    it("uses the local name, as on the sign", () => {
        expect(stationSignName({ name: "Genève", "name:en": "Geneva" })).toBe(
            "Genève",
        );
    });

    it("falls back to the English name", () => {
        expect(stationSignName({ "name:en": "Geneva" })).toBe("Geneva");
    });

    it("returns undefined without any name", () => {
        expect(stationSignName({})).toBeUndefined();
    });
});

describe("nameLength", () => {
    it("counts characters the way a person would", () => {
        expect(nameLength("Zürich")).toBe(6);
        expect(nameLength("Zürich")).toBe(6); // decomposed ü
        expect(nameLength("Biel/Bienne")).toBe(11);
    });
});

describe("firstLetter", () => {
    it("ignores accents and case", () => {
        expect(firstLetter("Écublens")).toBe("E");
        expect(firstLetter("zürich HB")).toBe("Z");
    });
});

describe("applyStationNameQuestion", () => {
    // The seeker stands at Bern, which earlier questions already eliminated.
    // The nearest station *still in play* is Bümpliz, which starts with the
    // same letter but has a different length.
    const bern = station("node/1", 7.4391, 46.9489, { name: "Bern" });
    const buempliz = station("node/2", 7.3946, 46.9449, {
        name: "Bümpliz Nord",
    });
    const brig = station("node/3", 7.988, 46.3192, { name: "Brig" });
    const thun = station("node/4", 7.6297, 46.7548, { name: "Thun" });
    const all = [bern, buempliz, brig, thun];
    const remaining = [buempliz, brig, thun].map(zone);
    const seeker = turf.point([7.4392, 46.949]);

    const names = (circles: StationCircle[]) =>
        circles.map((c) => stationSignName(c.properties.properties));

    it("compares with the seeker's actual station, even if it's eliminated", () => {
        const result = applyStationNameQuestion({
            question: {
                type: "same-length-station",
                same: true,
                lengthComparison: "same",
            },
            allStations: all,
            remaining,
            seeker,
        });

        // "Bern" has 4 letters: Brig and Thun, not Bümpliz Nord.
        expect(names(result)).toEqual(["Brig", "Thun"]);
    });

    it("keeps stations with the same first letter", () => {
        const result = applyStationNameQuestion({
            question: { type: "same-first-letter-station", same: true },
            allStations: all,
            remaining,
            seeker,
        });

        expect(names(result)).toEqual(["Bümpliz Nord", "Brig"]);
    });

    it("keeps stations with a different first letter", () => {
        const result = applyStationNameQuestion({
            question: { type: "same-first-letter-station", same: false },
            allStations: all,
            remaining,
            seeker,
        });

        expect(names(result)).toEqual(["Thun"]);
    });

    it("keeps longer names for 'longer'", () => {
        const result = applyStationNameQuestion({
            question: {
                type: "same-length-station",
                same: false,
                lengthComparison: "longer",
            },
            allStations: all,
            remaining,
            seeker,
        });

        expect(names(result)).toEqual(["Bümpliz Nord"]);
    });
});
