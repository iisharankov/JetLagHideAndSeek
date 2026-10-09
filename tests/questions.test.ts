import { beforeEach, describe, expect, it } from "vitest";

import { clearQuestions, deleteQuestion, questions } from "@/lib/context";
import { type Question, questionSchema } from "@/maps/schema";

const radius = (key: number) =>
    questionSchema.parse({
        id: "radius",
        key,
        data: { lat: 47.37, lng: 8.54 },
    }) as Question;

describe("deleting questions", () => {
    beforeEach(() => questions.set([radius(1), radius(2), radius(3)]));

    it("removes the question, and undo puts it back where it was", () => {
        const undo = deleteQuestion(2);
        expect(questions.get().map((q) => q.key)).toEqual([1, 3]);

        undo();
        expect(questions.get().map((q) => q.key)).toEqual([1, 2, 3]);
    });

    it("undo is harmless if run twice", () => {
        const undo = deleteQuestion(2);
        undo();
        undo();
        expect(questions.get().map((q) => q.key)).toEqual([1, 2, 3]);
    });

    it("clearing everything can be undone too", () => {
        const undo = clearQuestions();
        expect(questions.get()).toEqual([]);

        undo();
        expect(questions.get().map((q) => q.key)).toEqual([1, 2, 3]);
    });
});
