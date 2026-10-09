import { describe, expect, it } from "vitest";

import { answerChoices, answerOf, describeAnswer } from "@/lib/game/answers";
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

describe("answerChoices", () => {
    it("lists every possible answer, the current one first", () => {
        expect(answerChoices(q("radius", { within: false }))).toEqual([
            { label: "No", answer: { within: false } },
            { label: "Yes", answer: { within: true } },
        ]);
        expect(
            answerChoices(
                q("matching", {
                    type: "same-length-station",
                    lengthComparison: "same",
                }),
            ).map((c) => c.label),
        ).toEqual(["Same length", "Shorter", "Longer"]);
    });
});
