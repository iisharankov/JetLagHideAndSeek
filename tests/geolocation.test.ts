import { describe, expect, it } from "vitest";

import { currentPosition, recentPosition } from "@/lib/geolocation";

describe("recentPosition", () => {
    it("is the phone's position while it's fresh", () => {
        currentPosition.set({ latitude: 47.37, longitude: 8.54, at: 1000 });
        expect(recentPosition(60_000)?.latitude).toBe(47.37);
        expect(recentPosition(1000 + 3 * 60_000)).toBeNull();
        currentPosition.set(null);
        expect(recentPosition(1000)).toBeNull();
    });
});
