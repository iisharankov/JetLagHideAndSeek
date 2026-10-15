// A question's answer, as the hider gives it: picked out of the question,
// said in the game's words, and the possible alternatives.
import type { Question } from "@/maps/schema";

import { ANSWER_FIELDS } from "./types";

type Answer = Record<string, unknown>;

/** The answer part of a question's data (e.g. { within: true }). */
export const answerOf = (question: Question): Answer =>
    Object.fromEntries(
        ANSWER_FIELDS.filter(
            (field) => (question.data as any)[field] !== undefined,
        ).map((field) => [field, (question.data as any)[field]]),
    );

export interface Choice {
    label: string;
    answer: Answer;
}

/** A place a tentacle question can be answered with. */
export interface TentaclePlace {
    name: string;
    feature: unknown;
}

/**
 * The rulebook: a question about a kind of place with none inside the play
 * area has a null answer, which still counts as answered.
 */
export const NULL_ANSWER: Choice = {
    label: "Null: none in the play area",
    answer: { nullAnswer: true },
};

// Questions about something that is always there (the seekers' station, the
// zone they're in, the ground) have no null answer.
const NO_NULL_MATCHING = new Set([
    "zone",
    "letter-zone",
    "same-first-letter-station",
    "same-length-station",
    "same-train-line",
    "custom-zone",
    "custom-points",
]);
const NO_NULL_MEASURING = new Set([
    "sea-level",
    "admin-measure",
    "rail-measure",
    "custom-measure",
]);

/** Whether the rulebook's null answer is one of the question's answers. */
export const hasNullAnswer = (question: Question) => {
    const type = (question.data as { type?: string }).type ?? "";
    if (question.id === "matching") return !NO_NULL_MATCHING.has(type);
    if (question.id === "measuring") return !NO_NULL_MEASURING.has(type);
    return false;
};

const LENGTHS: Choice[] = [
    { label: "Shorter", answer: { lengthComparison: "shorter" } },
    { label: "Same length", answer: { lengthComparison: "same" } },
    { label: "Longer", answer: { lengthComparison: "longer" } },
];

/** Every answer the hider could give (tentacles: the places within reach). */
const allChoices = (question: Question, places?: TentaclePlace[]): Choice[] => {
    const data = question.data as any;
    switch (question.id) {
        case "radius":
            return [
                { label: "Yes", answer: { within: true } },
                { label: "No", answer: { within: false } },
            ];
        case "thermometer":
            return [
                { label: "Hotter", answer: { warmer: true } },
                { label: "Colder", answer: { warmer: false } },
            ];
        case "matching":
            return [
                ...(hasNullAnswer(question) ? [NULL_ANSWER] : []),
                ...(data.type === "same-length-station"
                    ? LENGTHS
                    : [
                          { label: "Same", answer: { same: true } },
                          { label: "Different", answer: { same: false } },
                      ]),
            ];
        case "measuring":
            return [
                ...(hasNullAnswer(question) ? [NULL_ANSWER] : []),
                ...(data.type === "sea-level"
                    ? [
                          { label: "Lower", answer: { hiderCloser: true } },
                          { label: "Higher", answer: { hiderCloser: false } },
                      ]
                    : [
                          { label: "Closer", answer: { hiderCloser: true } },
                          { label: "Further", answer: { hiderCloser: false } },
                      ]),
            ];
        case "tentacles": {
            const listed =
                places ??
                (data.location
                    ? [
                          {
                              name:
                                  data.location.properties?.name ??
                                  "Named place",
                              feature: data.location,
                          },
                      ]
                    : []);
            return [
                ...listed.map((place) => ({
                    label: place.name,
                    answer: { location: place.feature },
                })),
                { label: "Not within reach", answer: { location: false } },
            ];
        }
        default:
            return [];
    }
};

const sameAnswer = (a: Answer, b: Answer) =>
    // A null answer is its own thing: a question answered "null" matches
    // no other choice, and vice versa.
    !!a.nullAnswer === !!b.nullAnswer &&
    Object.keys(a).every(
        (field) => JSON.stringify(a[field]) === JSON.stringify(b[field]),
    );

/** The question's current answer in the game's words ("Closer", "No"…). */
export const describeAnswer = (question: Question) => {
    const current = answerOf(question);
    return (
        allChoices(question).find((choice) =>
            sameAnswer(choice.answer, current),
        )?.label ?? "—"
    );
};

/** The possible answers, always in the same order (so buttons don't move). */
export const answerChoices = (
    question: Question,
    places?: TentaclePlace[],
): Choice[] => allChoices(question, places);

/** Whether a choice is the question's current answer. */
export const isCurrentAnswer = (question: Question, choice: Choice) =>
    sameAnswer(choice.answer, answerOf(question));
