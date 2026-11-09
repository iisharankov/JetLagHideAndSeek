import { describe, expect, it } from "vitest";

import { createRateLimiter } from "./rateLimit";

describe("wrong tries", () => {
    it("allow five a minute per key, then wait for the minute to pass", () => {
        let now = 1_000_000;
        const limiter = createRateLimiter({ now: () => now });
        for (let i = 0; i < 5; i++) {
            expect(limiter.allow("team:g1")).toBe(true);
            limiter.failed("team:g1");
        }
        expect(limiter.allow("team:g1")).toBe(false);
        // Another game, or another kind of guess, has its own count.
        expect(limiter.allow("team:g2")).toBe(true);
        expect(limiter.allow("code:g1")).toBe(true);
        now += 59_000;
        expect(limiter.allow("team:g1")).toBe(false);
        now += 2_000;
        expect(limiter.allow("team:g1")).toBe(true);
    });

    it("count only wrong tries: right ones never use up the limit", () => {
        const limiter = createRateLimiter();
        for (let i = 0; i < 20; i++) expect(limiter.allow("admin")).toBe(true);
    });
});
