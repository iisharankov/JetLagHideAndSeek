import { describe, expect, it } from "vitest";

import { applyClockAction, hidingTimeMs } from "@/lib/game/clock";
import {
    applyRest,
    describeRest,
    inRest,
    normalizeRest,
    resting,
    restRefusal,
    restWindowKey,
} from "@/lib/game/rest";
import { defaultGameSettings } from "@/lib/game/settings";
import type { GameState, RestPeriod } from "@/lib/game/types";

const night: RestPeriod = {
    from: "22:00",
    until: "07:00",
    timeZone: "Europe/Zurich",
};
// Zürich is at UTC+2 in October.
const at = (local: string) => Date.parse(`${local}:00+02:00`);

const game = (
    clock: GameState["clock"],
    rest: RestPeriod | null = night,
    restWindow: string | null = null,
): GameState => ({
    id: "g1",
    version: 1,
    createdAt: 0,
    updatedAt: 0,
    playArea: null,
    zone: null,
    settings: { ...defaultGameSettings("medium", "switzerland"), rest },
    questions: {},
    photoRequests: [],
    photos: [],
    curses: [],
    powerups: [],
    endgame: null,
    clock,
    deck: null,
    move: null,
    moves: [],
    hider: null,
    hasHider: true,
    hiderReadyAt: null,
    teams: [],
    hiderTeamId: null,
    nextHiderTeamId: null,
    lateAnswers: 0,
    freeQuestions: 0,
    clockRequest: null,
    restRequest: null,
    restWindow,
    deleteRequests: {},
    revealedPin: null,
    hiderName: null,
    awards: [],
    rounds: [],
});

describe("rest periods", () => {
    it("take two clock times and a zone", () => {
        expect(normalizeRest(night)).toEqual(night);
        expect(normalizeRest({ ...night, timeZone: "Mars/Olympus" })).toEqual({
            ...night,
            timeZone: "UTC",
        });
        expect(normalizeRest({ from: "22:00", until: "22:00" })).toBeNull();
        expect(normalizeRest({ from: "25:00", until: "07:00" })).toBeNull();
        expect(normalizeRest(null)).toBeNull();
        expect(describeRest(night)).toBe("22:00–07:00");
        expect(describeRest(null)).toBe("none");
    });

    it("know when it's rest time, past midnight too", () => {
        expect(inRest(night, at("2026-10-15T21:59"))).toBe(false);
        expect(inRest(night, at("2026-10-15T22:00"))).toBe(true);
        expect(inRest(night, at("2026-10-16T03:00"))).toBe(true);
        expect(inRest(night, at("2026-10-16T06:59"))).toBe(true);
        expect(inRest(night, at("2026-10-16T07:00"))).toBe(false);
        const lunch: RestPeriod = { ...night, from: "12:00", until: "13:00" };
        expect(inRest(lunch, at("2026-10-15T12:30"))).toBe(true);
        expect(inRest(lunch, at("2026-10-15T13:00"))).toBe(false);
        // The same rest, seen from the morning after, is the one that started the night before.
        expect(restWindowKey(night, at("2026-10-15T23:00"))).toBe(
            "2026-10-15T22:00",
        );
        expect(restWindowKey(night, at("2026-10-16T03:00"))).toBe(
            "2026-10-15T22:00",
        );
    });

    it("pause the clock once per rest and resume it at the end", () => {
        const started = applyClockAction(null, "start", at("2026-10-15T20:00"));
        expect(applyRest(game(started), at("2026-10-15T21:59"))).toBeNull();

        const paused = applyRest(game(started), at("2026-10-15T22:00"))!;
        expect(paused.clock?.pausedBy).toBe("rest");
        expect(paused.restWindow).toBe("2026-10-15T22:00");
        expect(resting(paused)).toBe(true);
        expect(restRefusal(paused)).toMatch(/Rest period until 07:00/);
        // Nothing more to do while it rests.
        expect(applyRest(paused, at("2026-10-16T02:00"))).toBeNull();

        const morning = applyRest(paused, at("2026-10-16T07:00"))!;
        expect(morning.clock?.pausedAt).toBeNull();
        expect(morning.clock?.pausedBy).toBeUndefined();
        // The night is left out of the hiding time: 2 h before, 1 h after.
        expect(hidingTimeMs(morning.clock, at("2026-10-16T08:00"))).toBe(
            3 * 3600_000,
        );
        expect(restRefusal(morning)).toBeNull();

        // Resumed early by agreement: it stays running for that rest…
        const early = {
            ...applyClockAction(
                paused.clock,
                "resume",
                at("2026-10-16T00:00"),
            )!,
            pausedBy: undefined,
        };
        expect(
            applyRest(
                game(early, night, paused.restWindow),
                at("2026-10-16T01:00"),
            ),
        ).toBeNull();
        // …but the next night pauses again.
        expect(
            applyRest(
                game(early, night, paused.restWindow),
                at("2026-10-16T22:00"),
            )?.restWindow,
        ).toBe("2026-10-16T22:00");

        // Dropping the rest period while resting resumes the clock.
        expect(
            applyRest(game(paused.clock, null), at("2026-10-16T02:00"))?.clock
                ?.pausedAt,
        ).toBeNull();
    });
});
