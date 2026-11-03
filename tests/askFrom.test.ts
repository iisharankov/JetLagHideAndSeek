import { describe, expect, it } from "vitest";

import { askedFrom, fromHere, pinAway } from "@/lib/game/askFrom";
import type { Question } from "@/maps/schema";

const HB = { lat: 47.3779, lng: 8.5403 };
/** `metres` north of Zürich HB. */
const north = (metres: number, accuracy?: number) => ({
    latitude: HB.lat + metres / 111_320,
    longitude: HB.lng,
    accuracy,
});
const question = (id: string, data: Record<string, unknown>) =>
    ({ id, key: 1, data }) as unknown as Question;

describe("where a question is asked from", () => {
    it("is its pin; a thermometer's is where the seekers ended up", () => {
        expect(askedFrom(question("radius", HB))).toMatchObject(HB);
        expect(
            askedFrom(
                question("thermometer", {
                    latA: 47.3,
                    lngA: 8.5,
                    latB: HB.lat,
                    lngB: HB.lng,
                }),
            ),
        ).toMatchObject(HB);
        for (const id of ["tentacles", "measuring", "matching"]) {
            expect(askedFrom(question(id, HB))).toMatchObject(HB);
        }
    });

    it("is nowhere for a custom zone, which has no seekers' pin", () => {
        expect(
            askedFrom(question("matching", { ...HB, type: "custom-zone" })),
        ).toBeNull();
    });
});

describe("checking it before it's sent", () => {
    const radius = question("radius", HB);

    it("asks when the pin is more than 50 m from the phone", () => {
        expect(pinAway(radius, north(30))).toBeNull();
        expect(pinAway(radius, north(400))).toBeCloseTo(400, -1);
    });

    it("allows for a rough fix: twice its accuracy", () => {
        expect(pinAway(radius, north(150, 100))).toBeNull();
        expect(pinAway(radius, north(250, 100))).toBeCloseTo(250, -1);
    });

    it("doesn't ask without a position", () => {
        expect(pinAway(radius, null)).toBeNull();
    });

    it("moves the right pin to the phone", () => {
        const here = north(400);
        expect(fromHere(radius, here)).toEqual({
            lat: here.latitude,
            lng: here.longitude,
        });
        expect(
            fromHere(
                question("thermometer", {
                    latA: 47.3,
                    lngA: 8.5,
                    latB: HB.lat,
                    lngB: HB.lng,
                }),
                here,
            ),
        ).toEqual({ latB: here.latitude, lngB: here.longitude });
    });
});
