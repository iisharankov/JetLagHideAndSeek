import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ENDGAME_DELAY_MS, endgameDelayMs, schedule } from "@/lib/game/delayed";

describe("an action that waits a few seconds, to undo (the end game)", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("runs once the time is up", () => {
        const run = vi.fn();
        schedule(run, 5000);
        vi.advanceTimersByTime(4999);
        expect(run).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(run).toHaveBeenCalledTimes(1);
    });

    it("never runs once cancelled (Undo)", () => {
        const run = vi.fn();
        const cancel = schedule(run, 5000);
        vi.advanceTimersByTime(3000);
        cancel();
        vi.advanceTimersByTime(10_000);
        expect(run).not.toHaveBeenCalled();
        // Cancelling again is harmless.
        cancel();
    });

    it("waits 5 s for the end game, unless the browser tests shorten it", () => {
        expect(ENDGAME_DELAY_MS).toBe(5000);
        expect(endgameDelayMs(null)).toBe(5000);
        expect(endgameDelayMs("300")).toBe(300);
        expect(endgameDelayMs("nonsense")).toBe(5000);
        expect(endgameDelayMs("-1")).toBe(5000);
    });
});
