import { describe, expect, it } from "vitest";

import { noteServerTime, serverNow, serverOffset } from "@/lib/game/serverTime";
import { retryDelayMs } from "@/lib/game/session";

describe("the server's clock", () => {
    it("corrects this phone's clock by the server's answers", () => {
        noteServerTime(Date.now() + 90_000);
        expect(serverNow() - Date.now()).toBeGreaterThan(89_000);
        noteServerTime("later");
        expect(serverOffset.get()).toBeGreaterThan(89_000);
        noteServerTime(Date.now());
        expect(Math.abs(serverNow() - Date.now())).toBeLessThan(1000);
    });
});

describe("reconnecting", () => {
    it("waits longer after each failed try, up to a minute", () => {
        expect([0, 1, 2, 3, 4, 9].map(retryDelayMs)).toEqual([
            5000, 10_000, 20_000, 40_000, 60_000, 60_000,
        ]);
    });
});
