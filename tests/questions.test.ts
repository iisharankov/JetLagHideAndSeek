import { beforeEach, describe, expect, it } from "vitest";

import {
    activeQuestionKey,
    addQuestion,
    clearQuestions,
    deleteQuestion,
    questions,
    updateQuestion,
    updateQuestions,
} from "@/lib/context";
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

describe("changing questions", () => {
    beforeEach(() => questions.set([radius(1), radius(2), radius(3)]));

    it("replaces the changed question with a new object and keeps the rest", () => {
        const before = questions.get();

        updateQuestion(2, { radius: 7, unit: "miles" });

        const after = questions.get();
        expect(after).not.toBe(before);
        expect(after[1]).not.toBe(before[1]);
        expect(after[1].data).toMatchObject({
            radius: 7,
            unit: "miles",
            lat: 47.37,
            lng: 8.54,
        });
        // The old object is left alone: nothing is changed in place.
        expect(before[1].data).not.toMatchObject({ radius: 7 });
        expect(after[0]).toBe(before[0]);
        expect(after[2]).toBe(before[2]);
    });

    it("leaves the list alone when nothing would change", () => {
        const before = questions.get();
        updateQuestion(2, { lat: 47.37, collapsed: false });
        expect(questions.get()).toBe(before);
    });

    it("ignores a question that is gone", () => {
        const before = questions.get();
        updateQuestion(9, { radius: 7 });
        expect(questions.get()).toBe(before);
    });

    it("can change several questions at once", () => {
        updateQuestions([1, 3], { collapsed: true });
        expect(questions.get().map((q) => q.data.collapsed)).toEqual([
            true,
            false,
            true,
        ]);
    });

    it("adding a question makes a new list and makes it the active one", () => {
        const before = questions.get();

        addQuestion({ id: "radius", key: 4, data: { lat: 1, lng: 2 } });

        expect(before).toHaveLength(3);
        expect(questions.get().map((q) => q.key)).toEqual([1, 2, 3, 4]);
        expect(activeQuestionKey.get()).toBe(4);
    });
});
