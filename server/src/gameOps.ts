// The rules of a shared game: who may change what. Pure functions, so they
// are easy to test; games.ts stores the results and tells every phone.
import { randomBytes } from "node:crypto";

import { applyClockAction } from "@/lib/game/clock";
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
    hasHider: false,
    rounds: [],
});

/** What a player may see: the hider never sees the seekers' drafts. */
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
        : state;

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

/** Answered questions are the hider's, unless the game lets seekers answer. */
const assertMayChangeAnswered = (
    state: GameState,
    entry: QuestionEntry,
    actor: Actor,
) => {
    if (
        entry.state === "answered" &&
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
            entry.state = "answered";
            entry.answeredAt = now;
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
        case "startEndgame": {
            // The seekers have found the station: only its zone is left,
            // and everything asked so far (drafts included) no longer counts.
            const station = (op.station ?? {}) as Partial<StationPick>;
            if (
                typeof station.id !== "string" ||
                !Number.isFinite(station.lat) ||
                !Number.isFinite(station.lng)
            ) {
                throw new GameRuleError("Pick a station on the map.", 400);
            }
            state.endgame = {
                station: {
                    id: station.id,
                    name: String(station.name ?? "").slice(0, 200),
                    lat: station.lat!,
                    lng: station.lng!,
                },
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
            const minutes = Number(op.minutes);
            if (!Number.isFinite(minutes) || minutes < 0 || minutes > 600) {
                throw new GameRuleError("Bonus minutes must be a number.", 400);
            }
            state.clock.bonusMinutes = Math.round(minutes);
            break;
        }
        case "newRound":
            state.rounds.push({
                endedAt: now,
                questions: Object.values(state.questions),
                photoRequests: state.photoRequests,
                curses: state.curses,
                powerups: state.powerups,
                endgame: state.endgame,
                clock: state.clock,
            });
            state.questions = {};
            state.photoRequests = [];
            state.curses = [];
            state.powerups = [];
            state.endgame = null;
            state.clock = null;
            state.hasHider = false;
            break;
        default:
            throw new GameRuleError("Unknown change.", 400);
    }
    return state;
};
