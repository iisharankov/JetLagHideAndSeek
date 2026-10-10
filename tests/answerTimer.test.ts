import { describe, expect, it } from "vitest";

import {
    ANSWER_TIME_MS,
    answerTimeLeft,
    answerTimerText,
    answerTimerTone,
} from "@/lib/game/answerTimer";

describe("answer timer", () => {
    it("counts five minutes from when the question was sent", () => {
        const entry = {
            state: "asked" as const,
            askedAt: 1000,
            updatedAt: 1000,
        };
        expect(answerTimeLeft(entry, 1000)).toBe(ANSWER_TIME_MS);
        expect(answerTimeLeft(entry, 1000 + 4 * 60_000)).toBe(60_000);
        expect(answerTimeLeft(entry, 1000 + 6 * 60_000)).toBe(-60_000);
    });

    it("has no timer for drafts and answered questions", () => {
        expect(
            answerTimeLeft({ state: "draft", updatedAt: 1000 }, 2000),
        ).toBeNull();
        expect(
            answerTimeLeft({ state: "answered", updatedAt: 1000 }, 2000),
        ).toBeNull();
    });

    it("falls back to the last change for questions from before the timer", () => {
        expect(answerTimeLeft({ state: "asked", updatedAt: 5000 }, 5000)).toBe(
            ANSWER_TIME_MS,
        );
    });

    it("is amber in the last minute and red when over", () => {
        expect(answerTimerTone(2 * 60_000)).toBe("ok");
        expect(answerTimerTone(59_000)).toBe("warning");
        expect(answerTimerTone(0)).toBe("overdue");
        expect(answerTimerTone(-5)).toBe("overdue");
    });

    it("says what's left or by how much it's over", () => {
        expect(answerTimerText(4 * 60_000 + 12_000)).toBe("4:12 to answer");
        expect(answerTimerText(-65_000)).toBe("1:05 over time");
        expect(answerTimerText(500)).toBe("0:01 to answer");
    });
});
