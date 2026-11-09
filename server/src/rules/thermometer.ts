// The thermometer as the rulebook plays it: the seekers start it where they
// are (the hider is told), travel its distance as the crow flies, then ask.
// While they travel the question is "armed": nothing to answer, no cost.
import { ASK_SLACK, coveredKm, kmText } from "@/lib/game/thermometer";
import type { GameState, QuestionEntry } from "@/lib/game/types";

import { assertMayAsk, rollAgain } from "./curses";
import { type Actor, assertNotMoving, GameRuleError } from "./shared";

/** The fields that fix a thermometer once started: no edit moves them. */
const GEOMETRY = ["latA", "lngA", "latB", "lngB", "distanceKm", "armedAt"];

const seekersOnly = (actor: Actor, what: string) => {
    if (actor.role === "hider") {
        throw new GameRuleError(`Only the seekers ${what}.`);
    }
};

const thermometerOf = (state: GameState, key: number) => {
    const entry = state.questions[String(key)];
    if (!entry || entry.question.id !== "thermometer") {
        throw new GameRuleError(
            "That thermometer doesn't exist (any more).",
            404,
        );
    }
    return entry;
};

/** A phone's edit of a started thermometer keeps where it started. */
export const keepThermometerGeometry = (
    existing: QuestionEntry,
    data: Record<string, unknown>,
) => {
    if (existing.question.id !== "thermometer") return data;
    if (existing.state === "draft") return data;
    const kept = { ...data };
    for (const field of GEOMETRY) {
        if (field in existing.question.data) {
            kept[field] = existing.question.data[field];
        } else {
            delete kept[field];
        }
    }
    return kept;
};

/** Started where the seekers are: the hider is told, nothing is asked yet. */
export const armThermometer = (
    state: GameState,
    actor: Actor,
    op: {
        key: number;
        distanceKm: number;
        start: { lat: number; lng: number };
    },
    now: number,
) => {
    seekersOnly(actor, "start a thermometer");
    const entry = thermometerOf(state, op.key);
    if (entry.state !== "draft") {
        throw new GameRuleError(
            "This thermometer is already started (or asked).",
            409,
        );
    }
    assertNotMoving(state);
    assertMayAsk(state, "thermometer", now);
    entry.question.data = {
        ...entry.question.data,
        latA: op.start.lat,
        lngA: op.start.lng,
        latB: null,
        lngB: null,
        distanceKm: op.distanceKm,
        armedAt: now,
    };
    entry.state = "armed";
    entry.updatedBy = actor.name;
    entry.updatedAt = now;
};

/** Asked from where the seekers are now, once they've covered the distance. */
export const askThermometer = (
    state: GameState,
    actor: Actor,
    op: { key: number; end: { lat: number; lng: number } },
    now: number,
) => {
    seekersOnly(actor, "ask a thermometer");
    const entry = thermometerOf(state, op.key);
    if (entry.state !== "armed") {
        throw new GameRuleError("Start the thermometer first.", 409);
    }
    assertNotMoving(state);
    assertMayAsk(state, "thermometer", now);
    const data = entry.question.data as {
        latA: number;
        lngA: number;
        distanceKm: number;
    };
    const covered = coveredKm(
        { lat: data.latA, lng: data.lngA },
        { latitude: op.end.lat, longitude: op.end.lng },
    );
    if (covered < data.distanceKm * ASK_SLACK) {
        throw new GameRuleError(
            `You've covered ${kmText(covered)} of ${kmText(data.distanceKm)} km, as the crow flies: keep going.`,
            409,
        );
    }
    entry.question.data = {
        ...entry.question.data,
        latB: op.end.lat,
        lngB: op.end.lng,
    };
    entry.state = "asked";
    entry.askedAt = now;
    entry.updatedBy = actor.name;
    entry.updatedAt = now;
    rollAgain(state);
};

/** Called off while travelling: a draft again; nothing was asked, nothing costs. */
export const cancelThermometer = (
    state: GameState,
    actor: Actor,
    key: number,
    now: number,
) => {
    seekersOnly(actor, "call off a thermometer");
    const entry = thermometerOf(state, key);
    if (entry.state !== "armed") {
        throw new GameRuleError("This thermometer isn't under way.", 409);
    }
    const { armedAt: _armedAt, ...data } = entry.question.data;
    void _armedAt;
    entry.question.data = { ...data, latB: null, lngB: null };
    entry.state = "draft";
    entry.updatedBy = actor.name;
    entry.updatedAt = now;
};
