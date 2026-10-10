import { describe, expect, it } from "vitest";

import { draftsToApply } from "@/lib/game/drafts";

describe("drafts on the map", () => {
    it("shows all drafts, or only the active card's", () => {
        const drafts = [{ key: 1 }, { key: 2 }];
        expect(draftsToApply(drafts, "all", 2)).toEqual(drafts);
        expect(draftsToApply(drafts, "active", 2)).toEqual([{ key: 2 }]);
        expect(draftsToApply(drafts, "active", null)).toEqual([]);
    });
});
