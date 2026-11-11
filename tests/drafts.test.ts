import { describe, expect, it } from "vitest";

import { draftsKey, draftsToApply, pinShown } from "@/lib/game/drafts";

describe("drafts on the map", () => {
    it("shows all drafts, or only the active card's", () => {
        const drafts = [{ key: 1 }, { key: 2 }];
        expect(draftsToApply(drafts, "all", 2)).toEqual(drafts);
        expect(draftsToApply(drafts, "active", 2)).toEqual([{ key: 2 }]);
        expect(draftsToApply(drafts, "active", null)).toEqual([]);
    });

    it("redraws the map when the mode changes, and with the active card only when that matters (round 48)", () => {
        expect(draftsKey("all", 1)).toBe(draftsKey("all", 2));
        expect(draftsKey("active", 1)).not.toBe(draftsKey("active", 2));
        expect(draftsKey("all", 1)).not.toBe(draftsKey("active", 1));
    });
});

describe("question pins on the map (round 48)", () => {
    it("shows every question's pin, or only the active question's", () => {
        expect(pinShown(1, "all", 2)).toBe(true);
        expect(pinShown(2, "active", 2)).toBe(true);
        expect(pinShown(1, "active", 2)).toBe(false);
        expect(pinShown(1, "active", null)).toBe(false);
    });
});
