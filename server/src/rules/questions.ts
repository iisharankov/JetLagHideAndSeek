// Questions and answers: what the hider draws for one, Randomize Question's
// variants, the late-answer penalty.
import { randomInt } from "node:crypto";

import { ANSWER_TIME_MS } from "@/lib/game/answerTimer";
import { advanceDeck, DRAWS, removeFromHand } from "@/lib/game/deck";
import { questionIdentity } from "@/lib/game/questionIdentity";
import { ALWAYS_OFF, questionKey, tentacleRadiusKm } from "@/lib/game/settings";
import {
    type GameSettings,
    type GameState,
    type QuestionEntry,
    type SharedQuestion,
} from "@/lib/game/types";
import { TYPES } from "@/lib/questionInfo";
import { photoNamesFor } from "@/lib/rules/photoQuestions";

import { cardOrCopy, CHALICE, GameRuleError, RANDOMIZE } from "./shared";

/**
 * With the digital deck, an answered question earns the hider draws: the
 * rulebook's draw, again for the same question asked again, and one card
 * more while the Overflowing Chalice is on.
 */
export const oweDraws = (
    state: GameState,
    entry: QuestionEntry,
    now: number,
) => {
    if (!state.deck) return;
    const draw = DRAWS[entry.question.id];
    if (!draw) return;
    // Curse of the Impressionable Consumer: "the seekers' next question is free".
    if ((state.deck.freeQuestions ?? 0) > 0) {
        state.deck.freeQuestions = (state.deck.freeQuestions ?? 1) - 1;
        state.deck.log.push({
            at: now,
            text: "That question was free (a curse, or the late-answer penalty): no draw.",
        });
        return;
    }
    const identity = questionIdentity(entry.question);
    const times = Object.values(state.questions).filter(
        (other) =>
            other.state === "answered" &&
            questionIdentity(other.question) === identity,
    ).length;
    const chalice = (state.deck.chaliceLeft ?? 0) > 0;
    for (let i = 0; i < Math.max(1, times); i++) {
        const label = i === 0 ? draw.label : `${draw.label} (asked again)`;
        state.deck.owed.push({
            ...draw,
            draw: draw.draw + (chalice ? 1 : 0),
            label: chalice ? `${label} + Overflowing Chalice` : label,
        });
    }
    if (chalice) {
        state.deck.chaliceLeft = (state.deck.chaliceLeft ?? 1) - 1;
        if (state.deck.chaliceLeft === 0) {
            const curse = state.curses.find(
                (c) => c.name === CHALICE && !c.clearedAt,
            );
            if (curse) {
                curse.clearedAt = now;
                curse.clearedBy = "the game";
            }
        }
    }
    state.deck = advanceDeck(state.deck, now);
};

/** The hider casts a curse; the Overflowing Chalice also starts counting. */

export interface Variant {
    identity: string;
    label: string;
    patch: Record<string, unknown>;
}

/** Every question of a category this game allows (custom ones aside). */

export const variantsOf = (
    settings: GameSettings,
    question: SharedQuestion,
): Variant[] => {
    const data = question.data as Record<string, unknown>;
    if (question.id === "radius") {
        return settings.radarKm.map((km) => ({
            identity: `radius:${km}kilometers`,
            label: `Radar ${km} km`,
            patch: { radius: km, unit: "kilometers" },
        }));
    }
    if (
        question.id !== "matching" &&
        question.id !== "measuring" &&
        question.id !== "tentacles"
    ) {
        return [];
    }
    const category = question.id;
    const field = category === "tentacles" ? "locationType" : "type";
    return Object.entries(TYPES[category])
        .filter(
            ([type]) =>
                !type.startsWith("custom") &&
                !ALWAYS_OFF.includes(questionKey(category, type)) &&
                !settings.disabledQuestions.includes(
                    questionKey(category, type),
                ),
        )
        .map(([type, info]) => ({
            identity: `${category}:${type}`,
            label: info.label,
            patch: {
                [field]: type,
                ...(category === "tentacles"
                    ? {
                          radius: tentacleRadiusKm(type, settings.tentacleKm),
                          unit: "kilometers",
                      }
                    : {}),
                ...(category === "matching" &&
                (type === "zone" || type === "letter-zone")
                    ? { cat: data.cat ?? { adminLevel: 4 } }
                    : {}),
            },
        }));
};

/** What the question is now, in the words of the setup screens. */

export const variantLabel = (
    settings: GameSettings,
    question: SharedQuestion,
) =>
    variantsOf(settings, question).find(
        (variant) => variant.identity === questionIdentity(question),
    )?.label ?? questionIdentity(question);

/**
 * Randomize Question: "a new unasked question from the same category is
 * chosen, at random". The questions asked this round don't come up again.
 */
export const randomVariant = (state: GameState, question: SharedQuestion) => {
    const asked = new Set(
        Object.values(state.questions)
            .filter((entry) => entry.state !== "draft")
            .flatMap((entry) => [
                questionIdentity(entry.question),
                ...(entry.askedAs ?? []),
            ]),
    );
    const candidates = variantsOf(state.settings, question).filter(
        (variant) => !asked.has(variant.identity),
    );
    if (candidates.length === 0) {
        throw new GameRuleError(
            question.id === "thermometer"
                ? "Thermometer questions have no variants to randomize."
                : "Every question of this kind has been asked already: nothing to randomize to.",
            409,
        );
    }
    return candidates[randomInt(candidates.length)];
};

/** The team a player is in, by name. */

/**
 * The late-answer penalty: an answer over the five minutes is a warning,
 * twice; the third time the seekers' next question is free (no draw).
 */
export const noteLateAnswer = (
    state: GameState,
    entry: QuestionEntry,
    now: number,
) => {
    if (!state.settings.latePenalty) return;
    const askedAt = entry.askedAt ?? entry.createdAt;
    if (now - askedAt <= ANSWER_TIME_MS) return;
    state.lateAnswers += 1;
    entry.late = state.lateAnswers;
    if (state.lateAnswers % 3 === 0) {
        if (state.deck) {
            state.deck.freeQuestions = (state.deck.freeQuestions ?? 0) + 1;
        } else {
            state.freeQuestions += 1;
        }
    }
};

export const photoKey = (name: string) => name.trim().toLowerCase();

/**
 * Randomize Question on a photo question: another photo question of this
 * game's size, not asked this round (under any name it had).
 */
export const randomPhotoName = (state: GameState) => {
    const asked = new Set(
        state.photoRequests
            .flatMap((request) => [request.name, ...(request.askedAs ?? [])])
            .map(photoKey),
    );
    const candidates = photoNamesFor(state.settings.size).filter(
        (name) => !asked.has(photoKey(name)),
    );
    if (candidates.length === 0) {
        throw new GameRuleError(
            "Every photo question has been asked already: nothing to randomize to.",
            409,
        );
    }
    return candidates[randomInt(candidates.length)];
};

/** Randomize Question costs the card, with the digital deck. */

export const payRandomize = (state: GameState) => {
    if (!state.deck) return;
    const index = cardOrCopy(state.deck.hand, RANDOMIZE);
    if (index === -1) {
        throw new GameRuleError(
            "No Randomize Question card in your hand.",
            409,
        );
    }
    state.deck = removeFromHand(state.deck, index);
};
