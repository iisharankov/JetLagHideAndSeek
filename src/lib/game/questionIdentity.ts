// When is a question "the same question" as an earlier one? The rulebook
// makes the seekers pay a question's cost again when they ask it again, so
// the hider draws twice. Shared by the server (the draws) and the phones
// (the warning before asking).
import type { GameState, SharedQuestion } from "./types";

/**
 * A question's identity: its category and type, or, for radar, its radius,
 * for the thermometer its distance.
 */
export const questionIdentity = (question: SharedQuestion) => {
    const data = question.data as Record<string, unknown>;
    if (question.id === "radius") {
        return `radius:${String(data.radius)}${String(data.unit ?? "")}`;
    }
    if (question.id === "thermometer") {
        return `thermometer:${String(data.distanceKm ?? "")}`;
    }
    return `${question.id}:${String(data.type ?? data.locationType ?? "")}`;
};

/**
 * How often the same question was already asked this round: answered, or
 * vetoed ("the question is still considered to have been asked", the
 * rulebook's Veto).
 */
export const timesAskedBefore = (
    state: Pick<GameState, "questions">,
    question: SharedQuestion,
) => {
    const identity = questionIdentity(question);
    return Object.values(state.questions).filter(
        (entry) =>
            entry.question.key !== question.key &&
            (entry.state === "answered" || entry.state === "vetoed") &&
            questionIdentity(entry.question) === identity,
    ).length;
};

/**
 * "×3": what a question asked `before` times already costs. The rulebook:
 * twice the second time, triple the third, and so on.
 */
export const repeatBadge = (before: number) => `×${before + 1}`;

/** The cost in words: "double", "triple", then "×4". */
export const costWord = (before: number) =>
    before === 1 ? "double" : before === 2 ? "triple" : repeatBadge(before);

const times = (n: number) =>
    n === 1 ? "once" : n === 2 ? "twice" : `${n} times`;

/** "Asked twice before this round: it costs triple (the hider draws 3 times)." */
export const askedBeforeText = (before: number) =>
    `Asked ${before === 1 ? "" : `${times(before)} `}before this round: it costs ${costWord(before)} (the hider draws ${times(before + 1)}).`;

/** Photo names compare without case or spaces around. */
const photoName = (name: string) => name.trim().toLowerCase();

/** How often a photo question with this name was already answered this round. */
export const timesPhotoAnsweredBefore = (
    state: Pick<GameState, "photoRequests">,
    name: string,
    /** The request being answered now, if any. */
    exceptId?: string,
) =>
    state.photoRequests.filter(
        (request) =>
            request.id !== exceptId &&
            (!!request.photoId || !!request.nullAnswer) &&
            photoName(request.name) === photoName(name),
    ).length;
