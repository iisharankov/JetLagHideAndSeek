import { describe, expect, it } from "vitest";

import {
    applyClockAction,
    clockState,
    formatDuration,
    hidingTimeMs,
} from "@/lib/game/clock";

describe("the hiding clock", () => {
    it("counts hiding time, leaves out pauses, and stops when found", () => {
        let clock = applyClockAction(null, "start", 1000);
        expect(clockState(clock)).toBe("running");
        expect(hidingTimeMs(clock, 61_000)).toBe(60_000);

        // A Move: the clock pauses.
        clock = applyClockAction(clock, "pause", 61_000);
        expect(clockState(clock)).toBe("paused");
        expect(hidingTimeMs(clock, 500_000)).toBe(60_000);
        clock = applyClockAction(clock, "resume", 121_000);
        expect(hidingTimeMs(clock, 181_000)).toBe(120_000);

        // Found.
        clock = applyClockAction(clock, "stop", 181_000);
        expect(clockState(clock)).toBe("stopped");
        expect(hidingTimeMs(clock, 999_999)).toBe(120_000);

        // Actions that don't apply change nothing; reset clears.
        expect(applyClockAction(clock, "start", 5)).toEqual(clock);
        expect(applyClockAction(clock, "reset", 5)).toBeNull();
    });

    it("stops a paused clock without counting the pause", () => {
        let clock = applyClockAction(null, "start", 0);
        clock = applyClockAction(clock, "pause", 10_000);
        clock = applyClockAction(clock, "stop", 50_000);
        expect(hidingTimeMs(clock)).toBe(10_000);
    });

    it("formats durations", () => {
        expect(formatDuration(0)).toBe("0:00");
        expect(formatDuration(42 * 60_000 + 13_000)).toBe("42:13");
        expect(formatDuration(3_723_000)).toBe("1:02:03");
    });
});
