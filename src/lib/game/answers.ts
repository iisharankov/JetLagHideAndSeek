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

interface Choice {
    label: string;
    answer: Answer;
}

const LENGTHS: Choice[] = [
    { label: "Shorter", answer: { lengthComparison: "shorter" } },
    { label: "Same length", answer: { lengthComparison: "same" } },
    { label: "Longer", answer: { lengthComparison: "longer" } },
];

/** Every answer the hider could give. */
const allChoices = (question: Question): Choice[] => {
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
            if (data.type === "same-length-station") return LENGTHS;
            return [
                { label: "Same", answer: { same: true } },
                { label: "Different", answer: { same: false } },
            ];
        case "measuring":
            return data.type === "sea-level"
                ? [
                      { label: "Lower", answer: { hiderCloser: true } },
                      { label: "Higher", answer: { hiderCloser: false } },
                  ]
                : [
                      { label: "Closer", answer: { hiderCloser: true } },
                      { label: "Further", answer: { hiderCloser: false } },
                  ];
        case "tentacles":
            return [
                ...(data.location
                    ? [
                          {
                              label:
                                  data.location.properties?.name ??
                                  "Named place",
                              answer: { location: data.location },
                          },
                      ]
                    : []),
                { label: "Not within reach", answer: { location: false } },
            ];
        default:
            return [];
    }
};

const sameAnswer = (a: Answer, b: Answer) =>
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
export const answerChoices = (question: Question): Choice[] =>
    allChoices(question);

/** Whether a choice is the question's current answer. */
export const isCurrentAnswer = (question: Question, choice: Choice) =>
    sameAnswer(choice.answer, answerOf(question));
