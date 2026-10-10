import { describe, expect, it } from "vitest";

import { ranking, scoreRows } from "@/lib/game/scoreboard";
import type { PastRound, RoundClock } from "@/lib/game/types";

const clock = (
    startedAt: number,
    stoppedAt: number | null,
    bonusMinutes?: number,
): RoundClock => ({
    startedAt,
    pausedAt: null,
    pausedMs: 0,
    stoppedAt,
    ...(bonusMinutes !== undefined ? { bonusMinutes } : {}),
});

const round = (
    hiderName: string | undefined,
    roundClock: RoundClock | null,
): PastRound => ({
    endedAt: 0,
    questions: [],
    photoRequests: [],
    curses: [],
    powerups: [],
    clock: roundClock,
    hiderName,
});

describe("scoreboard", () => {
    it("lists each round's hiding time plus bonuses, the current round last", () => {
        const rows = scoreRows(
            {
                rounds: [
                    round("Ben", clock(0, 30 * 60_000, 10)),
                    round("Ana", null),
                    round(undefined, clock(0, 20 * 60_000)),
                ],
                clock: clock(100_000, null),
                hiderName: "Cem",
            },
            400_000,
        );
        expect(
            rows.map((r) => [r.round, r.hider, r.totalMs, r.current]),
        ).toEqual([
            [1, "Ben", 40 * 60_000, false],
            [3, "The hider", 20 * 60_000, false],
            [4, "Cem", 300_000, true],
        ]);
    });

    it("ranks hiders by their best finished round", () => {
        const rows = scoreRows(
            {
                rounds: [
                    round("Ben", clock(0, 30 * 60_000)),
                    round("Ana", clock(0, 45 * 60_000)),
                    round("Ben", clock(0, 50 * 60_000, 5)),
                ],
                clock: clock(0, null),
                hiderName: "Ana",
            },
            10_000_000,
        );
        expect(ranking(rows).map((r) => [r.hider, r.round])).toEqual([
            ["Ben", 3],
            ["Ana", 2],
        ]);
    });
});
