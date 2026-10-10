import { describe, expect, it } from "vitest";

import {
    questionIdentity,
    timesAnsweredBefore,
    timesPhotoAnsweredBefore,
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

describe("timesPhotoAnsweredBefore", () => {
    it("counts answered photo questions with the same name, not the one being answered", () => {
        const state = {
            photoRequests: [
                {
                    id: "a",
                    name: "Tree",
                    askedBy: "Ana",
                    askedAt: 1,
                    photoId: "p1",
                },
                {
                    id: "b",
                    name: "tree ",
                    askedBy: "Ana",
                    askedAt: 2,
                    photoId: "p2",
                },
                { id: "c", name: "Tree", askedBy: "Ana", askedAt: 3 },
                {
                    id: "d",
                    name: "Sky",
                    askedBy: "Ana",
                    askedAt: 4,
                    photoId: "p4",
                },
            ],
        };
        expect(timesPhotoAnsweredBefore(state, "Tree", "c")).toBe(2);
        expect(timesPhotoAnsweredBefore(state, "Tree", "a")).toBe(1);
        expect(timesPhotoAnsweredBefore(state, "Sky")).toBe(1);
        expect(timesPhotoAnsweredBefore(state, "Bridge")).toBe(0);
    });
});
