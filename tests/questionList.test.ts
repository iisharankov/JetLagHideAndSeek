import { describe, expect, it } from "vitest";

import { questionRows } from "@/lib/game/questionList";
import type { GameState, QuestionEntry } from "@/lib/game/types";
import type { Question } from "@/maps/schema";

const question = (key: number, id = "radius") =>
    ({ id, key, data: {} }) as unknown as Question;

const entry = (
    state: QuestionEntry["state"],
    askedAt?: number,
    createdAt = 0,
): Partial<QuestionEntry> => ({ state, askedAt, createdAt });

const game = (entries: Record<number, Partial<QuestionEntry>>) =>
    ({ questions: entries }) as unknown as Pick<GameState, "questions">;

describe("the Questions tab's list", () => {
    it("numbers the questions in the order they were asked, drafts last", () => {
        const rows = questionRows(
            [
                question(1, "radius"),
                question(2, "thermometer"),
                question(3, "matching"),
                question(4, "measuring"),
            ],
            game({
                1: entry("answered", 300),
                2: entry("draft"),
                3: entry("asked", 500),
                4: entry("answered", 100),
            }),
        );
        expect(rows.map((row) => [row.key, row.number, row.kind])).toEqual([
            [4, 1, "Measuring"],
            [1, 2, "Radar"],
            [3, 3, "Matching"],
            [2, 4, "Thermometer"],
        ]);
        expect(rows.map((row) => row.state)).toEqual([
            "answered",
            "answered",
            "asked",
            "draft",
        ]);
    });

    it("keeps drafts in the order they were made", () => {
        const rows = questionRows(
            [question(7), question(3), question(5)],
            game({ 7: entry("draft"), 3: entry("draft") }),
        );
        expect(rows.map((row) => row.key)).toEqual([7, 3, 5]);
        // One the game hasn't heard of yet is a draft too.
        expect(rows.map((row) => row.state)).toEqual([
            "draft",
            "draft",
            "draft",
        ]);
    });

    it("orders a question asked before the time was kept by when it was made", () => {
        const rows = questionRows(
            [question(1), question(2)],
            game({
                1: entry("asked", 400),
                2: entry("answered", undefined, 200),
            }),
        );
        expect(rows.map((row) => row.key)).toEqual([2, 1]);
    });

    it("playing alone, in the order they were made, with no state", () => {
        const rows = questionRows([question(2), question(1)], null);
        expect(rows.map((row) => [row.key, row.number, row.state])).toEqual([
            [2, 1, null],
            [1, 2, null],
        ]);
    });
});
