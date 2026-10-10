// The hider's spot and the Move card.
import { applyClockAction } from "@/lib/game/clock";
import { moveMinutes } from "@/lib/game/curseRules";
import { discardHand } from "@/lib/game/deck";
import {
    type GameState,
    type HiderSpot,
    type StationPick,
} from "@/lib/game/types";

import { type Actor, GameRuleError, shortId } from "./shared";

export const stationOf = (raw: unknown): StationPick | null => {
    const station = raw as Partial<StationPick> | null | undefined;
    if (
        !station ||
        typeof station.id !== "string" ||
        !Number.isFinite(station.lat) ||
        !Number.isFinite(station.lng)
    ) {
        return null;
    }
    return {
        id: station.id.slice(0, 80),
        name: String(station.name ?? "").slice(0, 200),
        lat: station.lat!,
        lng: station.lng!,
    };
};

export const hiderWith = (
    state: GameState,
    patch: Partial<HiderSpot>,
): HiderSpot => ({
    station: null,
    pin: null,
    ...state.hider,
    ...patch,
});

/** A station as a phone sent it, checked; null when there is none. */

/**
 * The Move card: the hider leaves for a new station. The seekers are told
 * the old one and frozen, the questions so far are put away (the map starts
 * over), the clock pauses, and the hider's hand is discarded.
 */
export const startMove = (
    state: GameState,
    actor: Actor,
    station: StationPick | null,
    now: number,
) => {
    if (state.move)
        throw new GameRuleError("A move is already under way.", 409);
    if (state.endgame) {
        throw new GameRuleError(
            "Move can't be played during the end game.",
            409,
        );
    }
    state.moves.push({
        at: now,
        station,
        questions: Object.values(state.questions),
    });
    state.questions = {};
    state.deleteRequests = {};
    state.move = {
        station,
        startedAt: now,
        endsAt: now + moveMinutes(state.settings.size) * 60_000,
        by: actor.name,
    };
    // A new station is next; the pin stays where the hider is.
    state.hider = { station: null, pin: state.hider?.pin ?? null };
    state.clockRequest = null;
    state.clock = applyClockAction(state.clock, "pause", now);
    if (state.deck) state.deck = discardHand(state.deck);
    state.powerups.push({
        id: shortId(),
        name: "Move",
        playedAt: now,
        by: actor.name,
    });
};

/** Applies one change, returning the new state (the old one is untouched). */
