// The rules of a shared game: who may change what. Pure functions, so they
// are easy to test; games.ts stores the results and tells every phone.
import { randomBytes } from "node:crypto";

import { applyClockAction } from "@/lib/game/clock";
import {
    advanceDeck,
    cardInfo,
    deckForSeekers,
    discardHand,
    drawCards,
    DRAWS,
    handBonusMinutes,
    keepCards,
    newDeck,
    removeFromHand,
} from "@/lib/game/deck";
import { normalizeGameSettings } from "@/lib/game/settings";
import {
    ANSWER_FIELDS,
    type GameOp,
    type GameSettings,
    type GameState,
    LOCAL_FIELDS,
    type QuestionEntry,
    type Role,
    type SharedQuestion,
    type StationPick,
} from "@/lib/game/types";

const CHANGEABLE_LATER = new Set(["hidingRadiusKm", "seekersCanAnswer"]);
const CLOCK_ACTIONS = new Set(["start", "pause", "resume", "stop", "reset"]);

/** "Discard N, draw M": the cards discarded, then drawn and kept. */
const DISCARD_DRAW: Record<string, { discard: number; draw: number }> = {
    powerup_discard_1_draw_2: { discard: 1, draw: 2 },
    powerup_discard_2_draw_3: { discard: 2, draw: 3 },
};

/** A change the rules don't allow; the API answers with `status`. */
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

const shortId = () => randomBytes(6).toString("base64url");

export const newGameState = (
    id: string,
    {
        playArea,
        zone,
        settings,
    }: { playArea: unknown; zone: unknown; settings: GameSettings },
    now: number,
): GameState => ({
    id,
    version: 1,
    createdAt: now,
    updatedAt: now,
    playArea,
    zone,
    settings,
    questions: {},
    photoRequests: [],
    photos: [],
    curses: [],
    powerups: [],
    endgame: null,
    clock: null,
    deck: settings.deck === "virtual" ? newDeck(settings) : null,
    move: null,
    moves: [],
    hasHider: false,
    rounds: [],
});

/**
 * What a player may see: the hider never sees the seekers' drafts, and the
 * seekers never see the hider's cards.
 */
export const viewFor = (state: GameState, role: Role): GameState =>
    role === "hider"
        ? {
              ...state,
              questions: Object.fromEntries(
                  Object.entries(state.questions).filter(
                      ([, entry]) => entry.state !== "draft",
                  ),
              ),
          }
        : { ...state, deck: state.deck ? deckForSeekers(state.deck) : null };

const withoutLocalFields = (question: SharedQuestion): SharedQuestion => {
    const data = { ...question.data };
    for (const field of LOCAL_FIELDS) delete data[field];
    return { id: question.id, key: question.key, data };
};

const visibleEntry = (state: GameState, key: number, actor: Actor) => {
    const entry = state.questions[String(key)];
    if (!entry || (actor.role === "hider" && entry.state === "draft")) {
        throw new GameRuleError("That question doesn't exist (any more).", 404);
    }
    return entry;
};

/** Answered (or vetoed) questions are the hider's, unless the game lets seekers answer. */
const assertMayChangeAnswered = (
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

const assertHider = (actor: Actor, what: string) => {
    if (actor.role !== "hider") {
        throw new GameRuleError(`Only the hider can ${what}.`);
    }
};

/** While the hider moves, the seekers are frozen: no asking. */
const assertNotMoving = (state: GameState) => {
    if (state.move) {
        throw new GameRuleError(
            "The hider is on the move: no questions until they continue.",
            409,
        );
    }
};

/**
 * The same question asked again: the rulebook makes the seekers pay its cost
 * again, so the hider draws again. A question is the same when its category
 * and type (or, for radar, its radius) are.
 */
const questionIdentity = (question: SharedQuestion) => {
    const data = question.data as Record<string, unknown>;
    if (question.id === "radius") {
        return `radius:${String(data.radius)}${String(data.unit ?? "")}`;
    }
    return `${question.id}:${String(data.type ?? data.locationType ?? "")}`;
};

/** With the digital deck, an answered question earns the hider draws. */
const oweDraws = (state: GameState, entry: QuestionEntry, now: number) => {
    if (!state.deck) return;
    const draw = DRAWS[entry.question.id];
    if (!draw) return;
    const identity = questionIdentity(entry.question);
    const times = Object.values(state.questions).filter(
        (other) =>
            other.state === "answered" &&
            questionIdentity(other.question) === identity,
    ).length;
    for (let i = 0; i < Math.max(1, times); i++) {
        state.deck.owed.push({
            ...draw,
            label: i === 0 ? draw.label : `${draw.label} (asked again)`,
        });
    }
    state.deck = advanceDeck(state.deck, now);
};

const ruleError = (error: unknown) =>
    new GameRuleError(
        error instanceof Error ? error.message : String(error),
        409,
    );

/** The deck, in a game that has one. */
const deckOf = (state: GameState) => {
    if (!state.deck) {
        throw new GameRuleError("This game uses the real deck of cards.", 409);
    }
    return state.deck;
};

/** A station as a phone sent it, checked; null when there is none. */
const stationOf = (raw: unknown): StationPick | null => {
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

/**
 * The Move card: the hider leaves for a new station. The seekers are told
 * the old one and frozen, the questions so far are put away (the map starts
 * over), the clock pauses, and the hider's hand is discarded.
 */
const startMove = (
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
    state.move = { station, startedAt: now, by: actor.name };
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
export const applyOp = (
    current: GameState,
    op: GameOp,
    actor: Actor,
    now: number,
): GameState => {
    const state: GameState = structuredClone(current);
    state.version += 1;
    state.updatedAt = now;

    switch (op.type) {
        case "putQuestion": {
            const key = String(op.question.key);
            const question = withoutLocalFields(op.question);
            const existing = state.questions[key];
            if (existing) {
                visibleEntry(state, op.question.key, actor);
                assertMayChangeAnswered(state, existing, actor);
                existing.question = question;
                existing.updatedBy = actor.name;
                existing.updatedAt = now;
            } else {
                if (actor.role !== "hider") assertNotMoving(state);
                state.questions[key] = {
                    question,
                    state:
                        op.state ??
                        (actor.role === "hider" ? "asked" : "draft"),
                    createdBy: actor.name,
                    createdAt: now,
                    updatedBy: actor.name,
                    updatedAt: now,
                };
            }
            break;
        }
        case "deleteQuestion": {
            const entry = visibleEntry(state, op.key, actor);
            assertMayChangeAnswered(state, entry, actor);
            delete state.questions[String(op.key)];
            break;
        }
        case "sendQuestion": {
            assertNotMoving(state);
            const entry = visibleEntry(state, op.key, actor);
            if (entry.state === "draft") {
                entry.state = "asked";
                entry.updatedBy = actor.name;
                entry.updatedAt = now;
            }
            break;
        }
        case "answerQuestion": {
            const entry = visibleEntry(state, op.key, actor);
            if (actor.role !== "hider" && !state.settings.seekersCanAnswer) {
                throw new GameRuleError("Only the hider can answer questions.");
            }
            if (op.basedOn < entry.updatedAt) {
                throw new GameRuleError(
                    "The question changed after this answer was worked out. Check it again.",
                    409,
                );
            }
            for (const field of ANSWER_FIELDS) {
                if (field in op.answer) {
                    entry.question.data[field] = op.answer[field];
                }
            }
            const firstAnswer = entry.state !== "answered";
            entry.state = "answered";
            entry.answeredAt = now;
            entry.updatedBy = actor.name;
            entry.updatedAt = now;
            if (firstAnswer) oweDraws(state, entry, now);
            break;
        }
        case "vetoQuestion": {
            // Played instead of answering: no answer, no reward.
            assertHider(actor, "veto questions");
            const entry = visibleEntry(state, op.key, actor);
            if (entry.state !== "asked") {
                throw new GameRuleError(
                    "Only a question waiting for an answer can be vetoed.",
                    409,
                );
            }
            if (state.deck) {
                const index = state.deck.hand.indexOf("powerup_veto_question");
                if (index === -1) {
                    throw new GameRuleError("No Veto card in your hand.", 409);
                }
                state.deck = removeFromHand(state.deck, index);
            }
            state.powerups.push({
                id: shortId(),
                name: "Veto Question",
                playedAt: now,
                by: actor.name,
            });
            entry.state = "vetoed";
            entry.updatedBy = actor.name;
            entry.updatedAt = now;
            break;
        }
        case "setPlayArea":
            state.playArea = op.playArea;
            break;
        case "setZone":
            state.zone = op.zone;
            break;
        case "setSettings": {
            // Settings are decided before the game starts. The hider may
            // still widen the hiding zone and let seekers answer.
            for (const key of Object.keys(op.settings)) {
                if (!CHANGEABLE_LATER.has(key)) {
                    throw new GameRuleError(
                        "Game settings are fixed once the game has started (start a new game to change them).",
                    );
                }
            }
            assertHider(actor, "change the game settings");
            const next = normalizeGameSettings({
                ...state.settings,
                ...op.settings,
            });
            if (
                op.settings.hidingRadiusKm !== undefined &&
                next.hidingRadiusKm !== op.settings.hidingRadiusKm
            ) {
                throw new GameRuleError("Choose a radius up to 50 km.", 400);
            }
            state.settings = next;
            break;
        }
        case "askPhoto":
            assertNotMoving(state);
            state.photoRequests.push({
                id: shortId(),
                name: String(op.name).slice(0, 200),
                askedBy: actor.name,
                askedAt: now,
            });
            break;
        case "deletePhotoRequest":
            state.photoRequests = state.photoRequests.filter(
                (request) => request.id !== op.id,
            );
            break;
        case "castCurse":
            assertHider(actor, "cast curses");
            state.curses.push({
                id: shortId(),
                name: String(op.name).slice(0, 200),
                castAt: now,
            });
            break;
        case "clearCurse": {
            const curse = state.curses.find((c) => c.id === op.id);
            if (!curse) throw new GameRuleError("No such curse.", 404);
            curse.clearedAt = now;
            curse.clearedBy = actor.name;
            break;
        }
        case "playPowerup":
            assertHider(actor, "play powerups");
            state.powerups.push({
                id: shortId(),
                name: String(op.name).slice(0, 200),
                playedAt: now,
                by: actor.name,
            });
            break;
        case "move":
            // The real deck: the hider plays the Move card by hand.
            assertHider(actor, "move");
            startMove(state, actor, stationOf(op.station), now);
            break;
        case "resumeMove":
            assertHider(actor, "continue after a move");
            if (!state.move) throw new GameRuleError("No move under way.", 409);
            state.move = null;
            state.clock = applyClockAction(state.clock, "resume", now);
            break;
        case "startEndgame": {
            // The seekers have found the station: only its zone is left,
            // and everything asked so far (drafts included) no longer counts.
            assertNotMoving(state);
            const station = stationOf(op.station);
            if (!station) {
                throw new GameRuleError("Pick a station on the map.", 400);
            }
            state.endgame = {
                station,
                startedAt: now,
                by: actor.name,
                before: Object.keys(state.questions).map(Number),
            };
            break;
        }
        case "endEndgame":
            state.endgame = null;
            break;
        case "clock": {
            if (!CLOCK_ACTIONS.has(op.action)) {
                throw new GameRuleError("Unknown clock action.", 400);
            }
            state.clock = applyClockAction(state.clock, op.action, now);
            break;
        }
        case "setBonus": {
            assertHider(actor, "send the time bonuses");
            if (!state.clock?.stoppedAt) {
                throw new GameRuleError(
                    "The round isn't over yet: the clock is still running.",
                    409,
                );
            }
            // With the digital deck the game knows the hand.
            const minutes = state.deck
                ? handBonusMinutes(
                      state.deck.hand,
                      state.settings.size,
                      state.settings.customCards,
                  )
                : Number(op.minutes);
            if (!Number.isFinite(minutes) || minutes < 0 || minutes > 600) {
                throw new GameRuleError("Bonus minutes must be a number.", 400);
            }
            state.clock.bonusMinutes = Math.round(minutes);
            break;
        }
        case "drawCards": {
            assertHider(actor, "draw cards");
            const deck = deckOf(state);
            const draw = op.extra ?? deck.owed[0];
            if (!draw) {
                throw new GameRuleError(
                    "Nothing to draw: answer a question first.",
                    409,
                );
            }
            if (
                op.extra &&
                !(
                    Number.isInteger(draw.draw) &&
                    Number.isInteger(draw.keep) &&
                    draw.draw >= 1 &&
                    draw.draw <= 6 &&
                    draw.keep >= 1 &&
                    draw.keep <= draw.draw
                )
            ) {
                throw new GameRuleError("That isn't a draw.", 400);
            }
            try {
                state.deck = drawCards(deck, draw);
            } catch (error) {
                throw ruleError(error);
            }
            if (op.extra) {
                state.deck.log.push({
                    at: now,
                    text: `${actor.name} drew ${draw.draw} extra card${
                        draw.draw === 1 ? "" : "s"
                    }, keeping ${draw.keep} (${String(draw.label).slice(0, 40)}).`,
                });
            } else {
                state.deck.owed.shift();
            }
            break;
        }
        case "keepCards": {
            assertHider(actor, "keep cards");
            try {
                state.deck = keepCards(
                    deckOf(state),
                    Array.isArray(op.picks) ? op.picks.map(Number) : [],
                );
            } catch (error) {
                throw ruleError(error);
            }
            state.deck = advanceDeck(state.deck, now);
            break;
        }
        case "playCard": {
            assertHider(actor, "play cards");
            const deck = deckOf(state);
            const id = deck.hand[op.index];
            if (!id)
                throw new GameRuleError("That card isn't in the hand.", 409);
            const card = cardInfo(id, state.settings.customCards);
            if (card.kind === "time") {
                throw new GameRuleError(
                    "Time bonuses can't be played, only discarded.",
                    409,
                );
            }
            if (id === "powerup_move") {
                // The whole hand goes, this card with it.
                startMove(state, actor, stationOf(op.station), now);
                break;
            }
            const swap = DISCARD_DRAW[id];
            let discards: number[] = [];
            if (swap) {
                discards = [...new Set((op.discards ?? []).map(Number))].filter(
                    (index) =>
                        Number.isInteger(index) &&
                        index >= 0 &&
                        index < deck.hand.length &&
                        index !== op.index,
                );
                if (discards.length !== swap.discard) {
                    throw new GameRuleError(
                        `Choose ${swap.discard} other card${
                            swap.discard === 1 ? "" : "s"
                        } to discard.`,
                        400,
                    );
                }
            }
            // Highest index first, so the others still point at their cards.
            let next = deck;
            for (const index of [op.index, ...discards].sort((a, b) => b - a)) {
                next = removeFromHand(next, index);
            }
            state.deck = next;
            if (card.kind === "curse") {
                state.curses.push({
                    id: shortId(),
                    name: card.name,
                    castAt: now,
                });
                break;
            }
            state.powerups.push({
                id: shortId(),
                name: card.name,
                playedAt: now,
                by: actor.name,
            });
            if (swap) {
                state.deck.owed.push({
                    draw: swap.draw,
                    keep: swap.draw,
                    label: card.name,
                });
            }
            if (id === "powerup_draw_1_expand_1") {
                state.deck.limit += 1;
                state.deck.owed.push({ draw: 1, keep: 1, label: card.name });
            }
            state.deck = advanceDeck(state.deck, now);
            break;
        }
        case "discardCard": {
            assertHider(actor, "discard cards");
            try {
                state.deck = removeFromHand(deckOf(state), op.index);
            } catch (error) {
                throw ruleError(error);
            }
            break;
        }
        case "discardHand":
            assertHider(actor, "discard the hand");
            state.deck = discardHand(deckOf(state));
            break;
        case "newRound":
            state.rounds.push({
                endedAt: now,
                questions: Object.values(state.questions),
                photoRequests: state.photoRequests,
                curses: state.curses,
                powerups: state.powerups,
                endgame: state.endgame,
                clock: state.clock,
                deck: state.deck,
                moves: state.moves,
            });
            state.questions = {};
            state.photoRequests = [];
            state.curses = [];
            state.powerups = [];
            state.endgame = null;
            state.clock = null;
            state.deck =
                state.settings.deck === "virtual"
                    ? newDeck(state.settings)
                    : null;
            state.move = null;
            state.moves = [];
            state.hasHider = false;
            break;
        default:
            throw new GameRuleError("Unknown change.", 400);
    }
    return state;
};
