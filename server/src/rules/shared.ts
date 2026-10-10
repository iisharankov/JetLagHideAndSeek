// What every rule needs: the error a refused change raises, who is asking,
// the cards the rules name, and the checks the operations share.
import { randomBytes } from "node:crypto";

import {
    type GameState,
    LOCAL_FIELDS,
    type QuestionEntry,
    type Role,
    type SharedQuestion,
} from "@/lib/game/types";

export class GameRuleError extends Error {
    constructor(
        message: string,
        readonly status: 400 | 403 | 404 | 409 = 403,
    ) {
        super(message);
    }
}

export interface Actor {
    name: string;
    role: Role;
}

export const shortId = () => randomBytes(6).toString("base64url");

export const DISCARD_DRAW: Record<string, { discard: number; draw: number }> = {
    powerup_discard_1_draw_2: { discard: 1, draw: 2 },
    powerup_discard_2_draw_3: { discard: 2, draw: 3 },
};

/** "For the next three questions, you may draw an additional card." */

export const CHALICE = "Curse of the Overflowing Chalice";

export const CHALICE_QUESTIONS = 3;

export const RANDOMIZE = "powerup_randomize_question";

export const VETO = "powerup_veto_question";

export const DUPLICATE = "powerup_duplicate_another_card";

/** A change the rules don't allow; the API answers with `status`. */

export const withoutLocalFields = (
    question: SharedQuestion,
): SharedQuestion => {
    const data = { ...question.data };
    for (const field of LOCAL_FIELDS) delete data[field];
    return { id: question.id, key: question.key, data };
};

export const visibleEntry = (state: GameState, key: number, actor: Actor) => {
    const entry = state.questions[String(key)];
    if (!entry || (actor.role === "hider" && entry.state === "draft")) {
        throw new GameRuleError("That question doesn't exist (any more).", 404);
    }
    return entry;
};

/** Answered (or vetoed) questions are the hider's, unless the game lets seekers answer. */

export const assertMayChangeAnswered = (
    state: GameState,
    entry: QuestionEntry,
    actor: Actor,
) => {
    if (
        (entry.state === "answered" || entry.state === "vetoed") &&
        actor.role !== "hider" &&
        !state.settings.seekersCanAnswer
    ) {
        throw new GameRuleError(
            "This question is answered: only the hider can change it.",
        );
    }
};

export const assertHider = (actor: Actor, what: string) => {
    if (actor.role !== "hider") {
        throw new GameRuleError(`Only the hider can ${what}.`);
    }
};

/** While the hider moves, the seekers are frozen: no asking. */

export const assertNotMoving = (state: GameState) => {
    if (state.move) {
        throw new GameRuleError(
            "The hider is on the move: no questions until they continue.",
            409,
        );
    }
};

export const ruleError = (error: unknown) =>
    new GameRuleError(
        error instanceof Error ? error.message : String(error),
        409,
    );

/** Where a card is in the hand, or a Duplicate Another Card standing in for it. */

export const cardOrCopy = (hand: string[], id: string) => {
    const own = hand.indexOf(id);
    return own !== -1 ? own : hand.indexOf(DUPLICATE);
};

/** The deck, in a game that has one. */

export const deckOf = (state: GameState) => {
    if (!state.deck) {
        throw new GameRuleError("This game uses the real deck of cards.", 409);
    }
    return state.deck;
};

/** The hider's spot with some of it changed. */
