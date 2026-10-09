import * as turf from "@turf/turf";
import { describe, expect, it, vi } from "vitest";

import { applyQuestionsToMapGeoData } from "@/maps";
import { NotApplicableError } from "@/maps/errors";
import { adjustPerMatching } from "@/maps/questions/matching";
import { type Question, questionSchema } from "@/maps/schema";

vi.mock("@/maps/questions/matching", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/maps/questions/matching")>()),
    adjustPerMatching: vi.fn(),
}));

// Roughly the canton of Zürich, as a box.
const playArea = turf.featureCollection([
    turf.bboxPolygon([8.35, 47.15, 8.99, 47.7]),
]);

const radius = (overrides: object = {}) =>
    questionSchema.parse({
        id: "radius",
        data: {
            lat: 47.378,
            lng: 8.54,
            radius: 5,
            unit: "kilometers",
            within: true,
            drag: false,
            ...overrides,
        },
    }) as Question;

const zone = () =>
    questionSchema.parse({
        id: "matching",
        data: { lat: 47.378, lng: 8.54, type: "zone", drag: false },
    }) as Question;

const areaKm2 = (data: any) => turf.area(data) / 1e6;

describe("applyQuestionsToMapGeoData", () => {
    it("narrows the play area to a radius answer", async () => {
        const q = radius();
        const { mapGeoData, statuses } = await applyQuestionsToMapGeoData(
            [q],
            playArea,
            false,
        );

        // A 5 km circle is about 78.5 km².
        expect(areaKm2(mapGeoData)).toBeCloseTo(Math.PI * 25, 0);
        expect(statuses.get(q.key)).toEqual({ state: "ok" });
    });

    it("reports a failing question and still applies the others", async () => {
        vi.mocked(adjustPerMatching).mockRejectedValueOnce(
            new Error("Map data unavailable (own: HTTP 504)"),
        );
        const broken = zone();
        const working = radius();

        const { mapGeoData, statuses } = await applyQuestionsToMapGeoData(
            [broken, working],
            playArea,
            false,
        );

        expect(statuses.get(broken.key)).toEqual({
            state: "error",
            message: "Map data unavailable (own: HTTP 504)",
        });
        expect(statuses.get(working.key)).toEqual({ state: "ok" });
        expect(areaKm2(mapGeoData)).toBeCloseTo(Math.PI * 25, 0);
    });

    it("reports questions that don't apply at their location", async () => {
        vi.mocked(adjustPerMatching).mockRejectedValueOnce(
            new NotApplicableError("There are no districts here."),
        );
        const q = zone();

        const { statuses, mapGeoData } = await applyQuestionsToMapGeoData(
            [q],
            playArea,
            false,
        );

        expect(statuses.get(q.key)).toEqual({
            state: "not-applicable",
            message: "There are no districts here.",
        });
        expect(areaKm2(mapGeoData)).toBeCloseTo(areaKm2(playArea), 0);
    });

    it("skips hidden questions", async () => {
        const q = radius({ hidden: true });

        const { statuses, mapGeoData } = await applyQuestionsToMapGeoData(
            [q],
            playArea,
            false,
        );

        expect(statuses.get(q.key)).toEqual({
            state: "skipped",
            reason: "hidden",
        });
        expect(areaKm2(mapGeoData)).toBeCloseTo(areaKm2(playArea), 0);
    });

    it("in planning mode, draws unlocked questions instead of applying them", async () => {
        const q = radius({ drag: true });
        const drawn: unknown[] = [];

        const { statuses } = await applyQuestionsToMapGeoData(
            [q],
            playArea,
            true,
            (polygon) => drawn.push(polygon),
        );

        expect(drawn).toHaveLength(1);
        expect(statuses.get(q.key)).toEqual({
            state: "skipped",
            reason: "planning",
        });
    });

    it("reports when no area is left", async () => {
        const inside = radius();
        const outside = radius({ within: false });

        const { statuses } = await applyQuestionsToMapGeoData(
            [inside, outside],
            playArea,
            false,
        );

        expect(statuses.get(outside.key)).toEqual({
            state: "error",
            message:
                "This answer contradicts the earlier ones: no area is left.",
        });
    });
});
