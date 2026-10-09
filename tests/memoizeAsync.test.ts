import { describe, expect, it, vi } from "vitest";

import { memoizeAsync } from "@/lib/memoizeAsync";

describe("memoizeAsync", () => {
    it("reuses results for the same key", async () => {
        const fn = vi.fn(async (x: number) => x * 2);
        const memo = memoizeAsync(fn, (x) => String(x));

        await expect(memo(2)).resolves.toBe(4);
        await expect(memo(2)).resolves.toBe(4);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("forgets failures, so the next call tries again", async () => {
        const fn = vi
            .fn()
            .mockRejectedValueOnce(new Error("HTTP 504"))
            .mockResolvedValueOnce("boundary");
        const memo = memoizeAsync(fn, () => "same key");

        await expect(memo()).rejects.toThrow("HTTP 504");
        await expect(memo()).resolves.toBe("boundary");
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it("shares one call between concurrent requests", async () => {
        const fn = vi.fn(async () => "x");
        const memo = memoizeAsync(fn, () => "k");

        await Promise.all([memo(), memo(), memo()]);
        expect(fn).toHaveBeenCalledTimes(1);
    });
});
