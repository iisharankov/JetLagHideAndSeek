import { describe, expect, it } from "vitest";

import {
    answerChoices,
    answerOf,
    describeAnswer,
    hasNullAnswer,
    isCurrentAnswer,
    NULL_ANSWER,
} from "@/lib/game/answers";
import { type Question, questionSchema } from "@/maps/schema";

const q = (id: string, data: object) =>
    questionSchema.parse({
        id,
        key: 1,
        data: { lat: 47, lng: 8, ...data },
    }) as Question;

describe("answerOf", () => {
    it("picks only the answer from a question", () => {
        expect(answerOf(q("radius", { radius: 5, within: false }))).toEqual({
            within: false,
        });
        expect(
            answerOf(q("measuring", { type: "airport", hiderCloser: true })),
        ).toEqual({ hiderCloser: true });
    });
});

describe("describeAnswer", () => {
    it("says the answer in the game's words", () => {
        expect(describeAnswer(q("radius", { within: true }))).toBe("Yes");
        expect(describeAnswer(q("radius", { within: false }))).toBe("No");
        expect(
            describeAnswer(
                q("thermometer", {
                    latA: 47,
                    lngA: 8,
                    latB: 47.1,
                    lngB: 8,
                    warmer: false,
                }),
            ),
        ).toBe("Colder");
        expect(
            describeAnswer(q("matching", { type: "airport", same: true })),
        ).toBe("Same");
        expect(
            describeAnswer(
                q("matching", {
                    type: "same-length-station",
                    lengthComparison: "longer",
                }),
            ),
        ).toBe("Longer");
        expect(
            describeAnswer(
                q("measuring", { type: "sea-level", hiderCloser: false }),
            ),
        ).toBe("Higher");
        expect(
            describeAnswer(
                q("measuring", { type: "airport", hiderCloser: true }),
            ),
        ).toBe("Closer");
        expect(
            describeAnswer(
                q("tentacles", {
                    radius: 15,
                    unit: "kilometers",
                    locationType: "zoo",
                    location: false,
                }),
            ),
        ).toBe("Not within reach");
    });
});

describe("the null answer", () => {
    it("comes first for place questions, and is its own answer", () => {
        const zoo = questionSchema.parse({
            id: "matching",
            data: { lat: 47, lng: 8, type: "zoo-full", same: true },
        });
        expect(answerChoices(zoo)[0]).toEqual(NULL_ANSWER);
        expect(describeAnswer(zoo)).toBe("Same");
        const nullAnswered = questionSchema.parse({
            id: "matching",
            data: {
                lat: 47,
                lng: 8,
                type: "zoo-full",
                same: true,
                nullAnswer: true,
            },
        });
        expect(describeAnswer(nullAnswered)).toBe(NULL_ANSWER.label);
        const closer = questionSchema.parse({
            id: "measuring",
            data: { lat: 47, lng: 8, type: "sea-level", hiderCloser: true },
        });
        // Sea level is always there: no null answer for it.
        expect(answerChoices(closer).map((c) => c.label)).toEqual([
            "Lower",
            "Higher",
        ]);
        expect(hasNullAnswer(zoo)).toBe(true);
        expect(hasNullAnswer(closer)).toBe(false);
        const lake = questionSchema.parse({
            id: "measuring",
            data: { lat: 47, lng: 8, type: "lake", hiderCloser: true },
        });
        expect(answerChoices(lake)[0]).toEqual(NULL_ANSWER);
    });
});

describe("answerChoices", () => {
    it("lists every possible answer in a fixed order, whatever the answer", () => {
        expect(answerChoices(q("radius", { within: false }))).toEqual([
            { label: "Yes", answer: { within: true } },
            { label: "No", answer: { within: false } },
        ]);
        expect(answerChoices(q("radius", { within: true }))).toEqual(
            answerChoices(q("radius", { within: false })),
        );
        const lengths = q("matching", {
            type: "same-length-station",
            lengthComparison: "same",
        });
        expect(answerChoices(lengths).map((c) => c.label)).toEqual([
            "Shorter",
            "Same length",
            "Longer",
        ]);
        expect(
            answerChoices(lengths).map((c) => isCurrentAnswer(lengths, c)),
        ).toEqual([false, true, false]);
    });
});
