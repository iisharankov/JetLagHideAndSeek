import { describe, expect, it, vi } from "vitest";

import { memoize, unique, uniqueBy } from "@/lib/unique";

// Small stand-ins for the three lodash functions the app used (round 49:
// lodash whole was 71 KB of the first page load).
describe("unique, uniqueBy, memoize", () => {
    it("keeps the first of each, in order", () => {
        expect(unique([3, 1, 3, 2, 1])).toEqual([3, 1, 2]);
        expect(
            uniqueBy(
                [
                    { id: 1, n: "a" },
                    { id: 2, n: "b" },
                    { id: 1, n: "c" },
                ],
                (x) => x.id,
            ),
        ).toEqual([
            { id: 1, n: "a" },
            { id: 2, n: "b" },
        ]);
    });

    it("computes once per key", () => {
        const work = vi.fn((x: { v: number }) => x.v * 2);
        const twice = memoize(work, (x) => String(x.v));
        expect(twice({ v: 2 })).toBe(4);
        expect(twice({ v: 2 })).toBe(4);
        expect(twice({ v: 3 })).toBe(6);
        expect(work).toHaveBeenCalledTimes(2);
        // No key: one result (lodash's memoize of a function of nothing).
        const once = vi.fn(() => ({}));
        const opened = memoize(once);
        expect(opened()).toBe(opened());
        expect(once).toHaveBeenCalledTimes(1);
    });
});
