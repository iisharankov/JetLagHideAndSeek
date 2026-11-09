import * as turf from "@turf/turf";
import { describe, expect, it } from "vitest";

import { questionIdentity } from "@/lib/game/questionIdentity";
import { thermometerDefaults } from "@/lib/game/settings";
import { roleOnMap } from "@/lib/game/sync";
import { canAsk, coveredKm, remainingKm } from "@/lib/game/thermometer";
import type { GameState, SharedQuestion } from "@/lib/game/types";
import {
    adjustPerThermometer,
    thermometerPlanningPolygon,
} from "@/maps/questions/thermometer";
import { questionSchema, type ThermometerQuestion } from "@/maps/schema";

const HB = { lat: 47.3779, lng: 8.5403 };
/** A spot `km` north of Zürich HB, as a phone's position. */
const north = (km: number) => {
    const [longitude, latitude] = turf.getCoord(
        turf.destination([HB.lng, HB.lat], km, 0, { units: "kilometers" }),
    );
    return { latitude, longitude };
};

const thermometer = (data: Record<string, unknown>) =>
    questionSchema.parse({
        id: "thermometer",
        key: 1,
        data: { latA: HB.lat, lngA: HB.lng, latB: null, lngB: null, ...data },
    }).data as ThermometerQuestion;

describe("the thermometer's distance", () => {
    it("is measured as the crow flies from the start", () => {
        expect(coveredKm(HB, north(1.2))).toBeCloseTo(1.2, 2);
    });

    it("can be asked once the whole distance is covered", () => {
        const question = thermometer({ distanceKm: 5 });
        expect(canAsk(question, north(4.9))).toBe(false);
        expect(canAsk(question, north(4.99))).toBe(false);
        expect(canAsk(question, north(5.0))).toBe(true);
        expect(remainingKm(question, north(2.3))).toBeCloseTo(2.7, 2);
        expect(remainingKm(question, north(6))).toBe(0);
        // No position: not yet.
        expect(canAsk(question, null)).toBe(false);
    });

    it("has the rulebook's distances per game size, in km", () => {
        expect(thermometerDefaults("small")).toEqual([1, 5]);
        expect(thermometerDefaults("medium")).toEqual([1, 5, 15]);
        expect(thermometerDefaults("large")).toEqual([1, 5, 15, 75]);
    });

    it("makes thermometers of different distances different questions (asked again costs double)", () => {
        const of = (distanceKm: number) =>
            ({
                id: "thermometer",
                key: 1,
                data: { distanceKm },
            }) as SharedQuestion;
        expect(questionIdentity(of(5))).toBe("thermometer:5");
        expect(questionIdentity(of(5))).not.toBe(questionIdentity(of(1)));
    });
});

describe("a thermometer under way", () => {
    it("waits on the map: nothing is ruled out", () => {
        const state = {
            questions: {
                "1": { state: "armed", question: { key: 1 } },
            },
        } as unknown as GameState;
        const question = questionSchema.parse({
            id: "thermometer",
            key: 1,
            data: { latA: HB.lat, lngA: HB.lng, latB: null, lngB: null },
        });
        expect(roleOnMap(question, state)).toBe("waiting");
    });

    it("rules nothing out without its end, and is drawn as the circle to leave", () => {
        const question = thermometer({ distanceKm: 1 });
        const area = turf.featureCollection([
            turf.polygon([
                [
                    [8.3, 47.2],
                    [8.8, 47.2],
                    [8.8, 47.6],
                    [8.3, 47.6],
                    [8.3, 47.2],
                ],
            ]),
        ]);
        expect(adjustPerThermometer(question, area)).toBe(area);
        const outline = thermometerPlanningPolygon(question);
        expect(outline.features).toHaveLength(1);
        const ring = outline.features[0];
        const edge = turf.getCoords(ring as never)[0] as number[];
        expect(
            turf.distance([HB.lng, HB.lat], edge, { units: "kilometers" }),
        ).toBeCloseTo(1, 1);
    });

    it("rules out the colder half once it has both pins", () => {
        const [lngB, latB] = [HB.lng, north(1).latitude];
        const question = thermometer({ distanceKm: 1, latB, lngB });
        const area = turf.featureCollection([
            turf.polygon([
                [
                    [8.3, 47.2],
                    [8.8, 47.2],
                    [8.8, 47.6],
                    [8.3, 47.6],
                    [8.3, 47.2],
                ],
            ]),
        ]);
        const kept = adjustPerThermometer({ ...question, warmer: true }, area);
        expect(kept).toBeTruthy();
        // Warmer: the half nearer the end (north) stays.
        expect(turf.booleanPointInPolygon([HB.lng, 47.5], kept as never)).toBe(
            true,
        );
        expect(turf.booleanPointInPolygon([HB.lng, 47.25], kept as never)).toBe(
            false,
        );
    });
});
