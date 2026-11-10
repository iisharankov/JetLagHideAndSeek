import { describe, expect, it } from "vitest";

import {
    atMyPosition,
    nextChoice,
    questionBounds,
    summaryTitle,
} from "@/lib/cardText";
import { type Question, questionSchema } from "@/maps/schema";

// The question card's words and sums (round 46): the summary line (option
// C), whether the pin is where the phone is ("me" or "the pin"), what the
// map frames when a card opens over it, and the What if chip's cycle.

const question = (id: string, data: object) =>
    questionSchema.parse({ id, key: 1, data }) as Question;
const ZURICH = { lat: 47.3706, lng: 8.55 };

describe("summaryTitle", () => {
    it("says each kind's question in one line", () => {
        expect(
            summaryTitle(
                question("radius", {
                    ...ZURICH,
                    radius: 10,
                    unit: "kilometers",
                }),
                "me",
            ),
        ).toBe("Within 10 km of me?");
        expect(
            summaryTitle(
                question("radius", {
                    ...ZURICH,
                    radius: 0.5,
                    unit: "kilometers",
                }),
                "the pin",
            ),
        ).toBe("Within 500 m of the pin?");
        expect(
            summaryTitle(
                question("matching", { ...ZURICH, type: "airport" }),
                "me",
            ),
        ).toBe("Same commercial airport as me?");
        expect(
            summaryTitle(
                question("matching", {
                    ...ZURICH,
                    type: "zone",
                    cat: { adminLevel: 4 },
                }),
                "me",
            ),
        ).toBe("Same zone as me?");
        expect(
            summaryTitle(
                question("measuring", { ...ZURICH, type: "coastline" }),
                "the pin",
            ),
        ).toBe("Closer to coastline than the pin?");
        expect(
            summaryTitle(
                question("measuring", { ...ZURICH, type: "sea-level" }),
                "me",
            ),
        ).toBe("Higher or lower than me?");
        expect(
            summaryTitle(
                question("tentacles", {
                    ...ZURICH,
                    locationType: "museum",
                    radius: 2,
                    unit: "kilometers",
                }),
                "me",
            ),
        ).toBe("Which of the museums within 2 km of me?");
    });

    it("a thermometer: the distance to travel, or the two ends", () => {
        const thermometer = question("thermometer", {
            latA: 47.37,
            lngA: 8.54,
            latB: null,
            lngB: null,
            distanceKm: 5,
        });
        expect(summaryTitle(thermometer, "me")).toBe(
            "After 5 km: hotter or colder?",
        );
        const ends = question("thermometer", {
            latA: 47.37,
            lngA: 8.54,
            latB: 47.4,
            lngB: 8.6,
        });
        expect(summaryTitle(ends, "me")).toBe(
            "Hotter at the end than at the start?",
        );
    });
});

describe("atMyPosition", () => {
    it("is the phone's position within its accuracy, at least 30 m", () => {
        const here = { latitude: 47.3706, longitude: 8.55, accuracy: 12 };
        expect(atMyPosition(ZURICH, here)).toBe(true);
        // About 22 m north: still "me".
        expect(atMyPosition({ lat: 47.3708, lng: 8.55 }, here)).toBe(true);
        // About 110 m: the pin.
        expect(atMyPosition({ lat: 47.3716, lng: 8.55 }, here)).toBe(false);
        // A poor fix (±200 m) covers it.
        expect(
            atMyPosition(
                { lat: 47.3716, lng: 8.55 },
                { ...here, accuracy: 200 },
            ),
        ).toBe(true);
        expect(atMyPosition(ZURICH, null)).toBe(false);
    });
});

describe("questionBounds", () => {
    it("a radar: its whole circle", () => {
        const [[south, west], [north, east]] = questionBounds(
            question("radius", { ...ZURICH, radius: 10, unit: "kilometers" }),
        )!;
        // 10 km is about 0.09° of latitude, and 0.13° of longitude here.
        expect(north - ZURICH.lat).toBeCloseTo(0.0898, 3);
        expect(ZURICH.lat - south).toBeCloseTo(0.0898, 3);
        expect(east - ZURICH.lng).toBeCloseTo(0.1326, 3);
        expect(ZURICH.lng - west).toBeCloseTo(0.1326, 3);
    });

    it("a thermometer: the distance around its start, and its end", () => {
        const [[south], [north, east]] = questionBounds(
            question("thermometer", {
                latA: 47.37,
                lngA: 8.54,
                latB: 47.6,
                lngB: 8.9,
                distanceKm: 5,
            }),
        )!;
        expect(north).toBeCloseTo(47.6, 5);
        expect(east).toBeCloseTo(8.9, 5);
        expect(south).toBeCloseTo(47.37 - 0.0449, 3);
    });

    it("the other kinds: a few kilometres around the pin", () => {
        const [[south], [north]] = questionBounds(
            question("matching", { ...ZURICH, type: "airport" }),
        )!;
        expect(north - south).toBeCloseTo(0.0539, 3);
    });
});

describe("nextChoice", () => {
    it("cycles through the answers", () => {
        expect(nextChoice(["inside", "outside"], "inside")).toBe("outside");
        expect(nextChoice(["inside", "outside"], "outside")).toBe("inside");
        expect(nextChoice(["shorter", "same", "longer"], "longer")).toBe(
            "shorter",
        );
    });
});
