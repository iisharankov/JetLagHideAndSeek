import * as turf from "@turf/turf";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyQuestionsToMapGeoData, clearGeometryCache } from "@/maps";
import { NotApplicableError } from "@/maps/errors";
import { adjustPerMatching } from "@/maps/questions/matching";
import { adjustPerRadius } from "@/maps/questions/radius";
import { type Question, questionSchema } from "@/maps/schema";

vi.mock("@/maps/questions/matching", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/maps/questions/matching")>()),
    adjustPerMatching: vi.fn(),
}));
// The real thing, but counted.
vi.mock("@/maps/questions/radius", async (importOriginal) => {
    const original =
        await importOriginal<typeof import("@/maps/questions/radius")>();
    return { ...original, adjustPerRadius: vi.fn(original.adjustPerRadius) };
});

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

describe("remembering results between refreshes", () => {
    const apply = (list: Question[], area = "zurich-box") =>
        applyQuestionsToMapGeoData(list, playArea, false, undefined, area);
    const computed = () => vi.mocked(adjustPerRadius).mock.calls.length;

    beforeEach(() => {
        clearGeometryCache();
        vi.mocked(adjustPerRadius).mockClear();
    });

    it("reuses the result when the questions and the area are the same", async () => {
        const q1 = radius();
        const q2 = radius({ radius: 3 });

        const first = await apply([q1, q2]);
        expect(computed()).toBe(2);
        const second = await apply([q1, q2]);

        expect(computed()).toBe(2);
        expect(second.mapGeoData).toBe(first.mapGeoData);
        expect(second.key).toBe(first.key);
        expect(second.statuses.get(q2.key)).toEqual({ state: "ok" });
    });

    it("recomputes from the first changed question on", async () => {
        const q1 = radius();
        const q2 = radius({ radius: 3 });
        await apply([q1, q2]);
        vi.mocked(adjustPerRadius).mockClear();

        const q2b = { ...q2, data: { ...q2.data, radius: 2 } } as Question;
        const result = await apply([q1, q2b]);

        expect(computed()).toBe(1);
        expect(areaKm2(result.mapGeoData)).toBeCloseTo(Math.PI * 4, 0);
    });

    it("doesn't mind how the card is shown", async () => {
        const q = radius();
        await apply([q]);
        vi.mocked(adjustPerRadius).mockClear();

        const folded = {
            ...q,
            data: { ...q.data, collapsed: true },
        } as Question;
        await apply([folded]);

        expect(computed()).toBe(0);
    });

    it("starts over for another play area", async () => {
        const q = radius();
        await apply([q], "zurich-box");
        await apply([q], "bern-box");
        expect(computed()).toBe(2);
    });

    it("doesn't remember failures", async () => {
        const q = radius();
        vi.mocked(adjustPerRadius).mockRejectedValueOnce(new Error("boom"));

        const first = await apply([q]);
        expect(first.statuses.get(q.key)).toEqual({
            state: "error",
            message: "boom",
        });
        const second = await apply([q]);

        expect(computed()).toBe(2);
        expect(second.statuses.get(q.key)).toEqual({ state: "ok" });
    });

    it("remembers nothing without an area key", async () => {
        const q = radius();
        const first = await applyQuestionsToMapGeoData([q], playArea, false);
        const second = await applyQuestionsToMapGeoData([q], playArea, false);

        expect(computed()).toBe(2);
        expect(second.mapGeoData).not.toBe(first.mapGeoData);
    });
});
