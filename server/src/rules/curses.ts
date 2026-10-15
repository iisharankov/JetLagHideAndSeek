// The curses on the seekers: casting, running out, what they forbid.
import { applyClockAction } from "@/lib/game/clock";
import {
    blockingCurses,
    curseEndsAt,
    curseRule,
    kindRefusal,
} from "@/lib/game/curseRules";
import { restRefusal } from "@/lib/game/rest";
import { type GameState } from "@/lib/game/types";

import { CHALICE, CHALICE_QUESTIONS, GameRuleError, shortId } from "./shared";

export const castCurse = (state: GameState, name: string, now: number) => {
    const rule = curseRule(name);
    if (rule.notInEndgame && state.endgame) {
        throw new GameRuleError(
            `${name} can't be cast during the end game.`,
            409,
        );
    }
    state.curses.push({ id: shortId(), name, castAt: now });
    if (name === CHALICE && state.deck) {
        state.deck.chaliceLeft = CHALICE_QUESTIONS;
    }
    if (rule.freeQuestion && state.deck) {
        state.deck.freeQuestions = (state.deck.freeQuestions ?? 0) + 1;
    }
};

/** Timed curses end by themselves; a Move's period runs out by itself. */

export const passTime = (state: GameState, now: number) => {
    for (const entry of state.curses) {
        if (entry.clearedAt) continue;
        const endsAt = curseEndsAt(entry, state.settings.size);
        if (endsAt !== null && endsAt <= now) {
            entry.clearedAt = endsAt;
            entry.clearedBy = "time";
        }
    }
    if (state.move && now >= state.move.endsAt) {
        state.move = null;
        state.clock = applyClockAction(state.clock, "resume", now);
    }
};

/** The curses on the seekers may stop them from asking, or from asking a kind. */

export const assertMayAsk = (state: GameState, kind: string, now: number) => {
    const rest = restRefusal(state);
    if (rest) throw new GameRuleError(rest, 409);
    const blocking = blockingCurses(state, now)[0];
    if (blocking) {
        throw new GameRuleError(
            `${blocking.name}: the seekers can't ask until it's done and cleared (Cards tab).`,
            409,
        );
    }
    const refusal = kindRefusal(state, kind, now);
    if (refusal) throw new GameRuleError(refusal, 409);
};

/** Spotty Memory: after a question is asked, the seekers roll again. */

export const rollAgain = (state: GameState) => {
    for (const entry of state.curses) {
        if (!entry.clearedAt && curseRule(entry.name).takes === "category") {
            delete entry.category;
        }
    }
};

/** A curse entry still in force, or a refusal. */

export const activeCurse = (state: GameState, id: string, now: number) => {
    const entry = state.curses.find((c) => c.id === id);
    if (!entry || entry.clearedAt) {
        throw new GameRuleError("That curse isn't on the seekers.", 404);
    }
    const endsAt = curseEndsAt(entry, state.settings.size);
    if (endsAt !== null && endsAt <= now) {
        throw new GameRuleError("That curse is over.", 409);
    }
    return entry;
};

/** The hider's bonus at the end: the hand (or what they typed) plus the awards. */

export const awardedMinutes = (state: GameState) =>
    state.awards.reduce((sum, award) => sum + award.minutes, 0);

/** A variant of a question: what makes it a different question. */
