// When is a question "the same question" as an earlier one? The rulebook
// makes the seekers pay a question's cost again when they ask it again, so
// the hider draws twice. Shared by the server (the draws) and the phones
// (the warning before asking).
import type { GameState, SharedQuestion } from "./types";

/**
 * A question's identity: its category and type, or, for radar, its radius.
 */
export const questionIdentity = (question: SharedQuestion) => {
    const data = question.data as Record<string, unknown>;
    if (question.id === "radius") {
        return `radius:${String(data.radius)}${String(data.unit ?? "")}`;
    }
    return `${question.id}:${String(data.type ?? data.locationType ?? "")}`;
};

/** How often the same question was already answered this round. */
export const timesAnsweredBefore = (
    state: Pick<GameState, "questions">,
    question: SharedQuestion,
) => {
    const identity = questionIdentity(question);
    return Object.values(state.questions).filter(
        (entry) =>
            entry.question.key !== question.key &&
            entry.state === "answered" &&
            questionIdentity(entry.question) === identity,
    ).length;
};

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
            !!request.photoId &&
            photoName(request.name) === photoName(name),
    ).length;
