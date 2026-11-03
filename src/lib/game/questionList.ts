// The Questions tab lists one row per question, "Question 3 · Radar", in
// the order they were asked (drafts after them, in the order they were
// made); a question opens from its row.
import type { Question } from "@/maps/schema";

import type { GameState, QuestionState } from "./types";

/** The rulebook's names for the categories. */
export const CATEGORY_NAMES: Record<string, string> = {
    radius: "Radar",
    thermometer: "Thermometer",
    tentacles: "Tentacles",
    matching: "Matching",
    measuring: "Measuring",
};

export interface QuestionRow {
    key: number;
    /** Its place in the list, from 1. */
    number: number;
    kind: string;
    /** In a shared game; null playing alone. */
    state: QuestionState | null;
}

export const questionRows = (
    list: Question[],
    game: Pick<GameState, "questions"> | null,
): QuestionRow[] => {
    const entry = (question: Question) => game?.questions[String(question.key)];
    /** When it went to the hider (made, for games from before that was kept). */
    const askedAt = (question: Question) => {
        const found = entry(question);
        if (!found || found.state === "draft") return null;
        return found.askedAt ?? found.createdAt;
    };
    // The list is in the order the questions were made (keys aren't).
    const made = new Map(list.map((question, index) => [question, index]));
    return [...list]
        .sort((a, b) => {
            const [first, second] = [askedAt(a), askedAt(b)];
            if (first !== null && second !== null && first !== second) {
                return first - second;
            }
            if (first !== null && second === null) return -1;
            if (first === null && second !== null) return 1;
            return made.get(a)! - made.get(b)!;
        })
        .map((question, index) => ({
            key: question.key,
            number: index + 1,
            kind: CATEGORY_NAMES[question.id] ?? question.id,
            state: game ? (entry(question)?.state ?? "draft") : null,
        }));
};
