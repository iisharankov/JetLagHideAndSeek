import { describe, expect, it } from "vitest";

import { questionGeometryKey, questionsMapKey } from "@/lib/questionKey";
import { type Question, questionSchema } from "@/maps/schema";

const radius = (data: object = {}) =>
    questionSchema.parse({
        id: "radius",
        key: 1,
        data: { lat: 47.37, lng: 8.54, radius: 5, color: "blue", ...data },
    }) as Question;

describe("questionGeometryKey", () => {
    it("is the same whatever the card looks like", () => {
        expect(questionGeometryKey(radius({ collapsed: true }))).toBe(
            questionGeometryKey(radius({ collapsed: false })),
        );
        expect(questionGeometryKey(radius({ hidden: true }))).toBe(
            questionGeometryKey(radius({ drag: false })),
        );
    });

    it("changes with the question", () => {
        expect(questionGeometryKey(radius({ radius: 5 }))).not.toBe(
            questionGeometryKey(radius({ radius: 7 })),
        );
        expect(questionGeometryKey(radius({ within: true }))).not.toBe(
            questionGeometryKey(radius({ within: false })),
        );
    });

    it("belongs to the object: questions are never changed in place", () => {
        const question = radius();
        const key = questionGeometryKey(question);
        (question.data as { radius: number }).radius = 99;
        expect(questionGeometryKey(question)).toBe(key);
        expect(questionGeometryKey({ ...question })).not.toBe(key);
    });
});

describe("questionsMapKey", () => {
    it("ignores folded cards but not hidden or locked ones", () => {
        const plain = questionsMapKey([radius()]);
        expect(questionsMapKey([radius({ collapsed: true })])).toBe(plain);
        expect(questionsMapKey([radius({ hidden: true })])).not.toBe(plain);
        expect(questionsMapKey([radius({ drag: false })])).not.toBe(plain);
    });

    it("sees the order and the number of questions", () => {
        const a = radius({ radius: 1 });
        const b = { ...radius({ radius: 2 }), key: 2 };
        expect(questionsMapKey([a, b])).not.toBe(questionsMapKey([b, a]));
        expect(questionsMapKey([a])).not.toBe(questionsMapKey([a, b]));
    });
});
