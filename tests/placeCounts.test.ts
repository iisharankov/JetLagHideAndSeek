import { beforeEach, describe, expect, it, vi } from "vitest";

const placesInPlayArea = vi.fn();
vi.mock("@/maps/questions/places", () => ({ placesInPlayArea }));

const { placeCount } = await import("@/lib/game/placeCounts");

describe("how many places of a kind the play area has (the tentacle tiles)", () => {
    beforeEach(() => {
        placesInPlayArea.mockReset();
    });

    it("counts once per play area and kind", async () => {
        placesInPlayArea.mockResolvedValue([{}, {}]);
        const area = { type: "FeatureCollection" };
        expect(await placeCount(area, "zoo")).toBe(2);
        expect(await placeCount(area, "zoo")).toBe(2);
        expect(placesInPlayArea).toHaveBeenCalledTimes(1);
        // Another play area counts again.
        expect(await placeCount({ ...area }, "zoo")).toBe(2);
        expect(placesInPlayArea).toHaveBeenCalledTimes(2);
    });

    it("doesn't know when the data can't be loaded (nothing dimmed)", async () => {
        placesInPlayArea.mockImplementation(async () => {
            throw new Error("No map data");
        });
        expect(await placeCount({}, "museum")).toBeNull();
    });
});
