import { beforeEach, describe, expect, it } from "vitest";

import { questionsToReference } from "@/lib/activeQuestion";
import { activeQuestionKey, addQuestion, questions } from "@/lib/context";
import { type Question, questionSchema } from "@/maps/schema";

const radius = (key: number, hidden = false) =>
    questionSchema.parse({
        id: "radius",
        key,
        data: { lat: 47.37, lng: 8.54, hidden },
    }) as Question;

describe("questionsToReference", () => {
    const all = [radius(1), radius(2), radius(3, true)];

    it("shows only the active question by default", () => {
        expect(
            questionsToReference(all, "active", 2).map((q) => q.key),
        ).toEqual([2]);
        expect(questionsToReference(all, "active", null)).toEqual([]);
    });

    it("can show every question that isn't hidden, or none", () => {
        expect(questionsToReference(all, "all", 2).map((q) => q.key)).toEqual([
            1, 2,
        ]);
        expect(questionsToReference(all, "off", 2)).toEqual([]);
    });

    it("never shows a hidden question, even when active", () => {
        expect(questionsToReference(all, "active", 3)).toEqual([]);
    });
});

describe("the active question", () => {
    beforeEach(() => {
        questions.set([]);
        activeQuestionKey.set(null);
    });

    it("is the one just added", () => {
        addQuestion({ id: "radius", data: { lat: 47.37, lng: 8.54 } });
        expect(activeQuestionKey.get()).toBe(questions.get()[0].key);
    });
});
