import { describe, expect, it } from "vitest";

import {
    questionIdentity,
    timesAnsweredBefore,
} from "@/lib/game/questionIdentity";
import type { QuestionEntry, SharedQuestion } from "@/lib/game/types";

const entry = (
    question: SharedQuestion,
    state: QuestionEntry["state"] = "answered",
): QuestionEntry => ({
    question,
    state,
    createdBy: "Ana",
    createdAt: 1,
    updatedBy: "Ana",
    updatedAt: 1,
});

const radar = (key: number, radius: number): SharedQuestion => ({
    id: "radius",
    key,
    data: { lat: 1, lng: 2, radius, unit: "kilometers" },
});
const matching = (key: number, type: string): SharedQuestion => ({
    id: "matching",
    key,
    data: { lat: 1, lng: 2, type },
});

describe("questionIdentity", () => {
    it("is the category and type, or the radar's radius", () => {
        expect(questionIdentity(matching(1, "zone"))).toBe("matching:zone");
        expect(questionIdentity(radar(1, 5))).toBe("radius:5kilometers");
        expect(questionIdentity(radar(1, 5))).not.toBe(
            questionIdentity(radar(2, 10)),
        );
    });
});

describe("timesAnsweredBefore", () => {
    it("counts the answered questions that are the same, not the question itself", () => {
        const state = {
            questions: {
                "1": entry(radar(1, 5)),
                "2": entry(radar(2, 5)),
                "3": entry(radar(3, 5), "asked"),
                "4": entry(radar(4, 10)),
            },
        };
        expect(timesAnsweredBefore(state, radar(5, 5))).toBe(2);
        expect(timesAnsweredBefore(state, radar(1, 5))).toBe(1);
        expect(timesAnsweredBefore(state, radar(6, 10))).toBe(1);
        expect(timesAnsweredBefore(state, matching(7, "zone"))).toBe(0);
    });
});
