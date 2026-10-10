// Shared games in SQLite, photos on disk, and live updates to subscribers.
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { moveMinutes } from "@/lib/game/curseRules";
import { advanceDeck } from "@/lib/game/deck";
import { timesPhotoAnsweredBefore } from "@/lib/game/questionIdentity";
import { normalizeGameSettings } from "@/lib/game/settings";
import type {
    GameOp,
    GameSettings,
    GameState,
    SharedQuestion,
} from "@/lib/game/types";

import { type Actor, applyOp, GameRuleError, newGameState } from "./gameOps";

const ID_ALPHABET =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const newId = (length: number) =>
    Array.from(randomBytes(length), (byte) => ID_ALPHABET[byte % 62]).join("");

/** Games nobody has changed for this long are deleted, photos included. */
export const KEEP_GAMES_MS = 365 * 24 * 3600 * 1000;
/** Photos per game; anyone with the link can upload, so there is a cap. */
export const MAX_PHOTOS_PER_GAME = 100;

const PHOTO_TYPES: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
};

export interface GameStore {
    create(
        start: { playArea: unknown; zone: unknown; settings: GameSettings },
        questions: SharedQuestion[],
        by: string,
    ): GameState;
    get(id: string): GameState | undefined;
    apply(id: string, op: GameOp, actor: Actor): GameState;
    /** `null` tells a subscriber the game was deleted. */
    subscribe(
        id: string,
        listener: (state: GameState | null) => void,
    ): () => void;
    /** Removes a game for everyone, photos included. False if unknown. */
    delete(id: string): boolean;
    claimHider(id: string, password: string, by?: string): string;
    isHider(id: string, token: string | undefined | null): boolean;
    addPhoto(
        id: string,
        bytes: Uint8Array,
        type: string,
        actor: Actor,
        options?: { requestId?: string; caption?: string },
    ): { state: GameState; photoId: string };
    readPhoto(
        id: string,
        photoId: string,
    ): { bytes: Buffer; type: string } | undefined;
    cleanup(now?: number): number;
}

const hashPassword = (password: string, salt = randomBytes(16)) =>
    `${salt.toString("hex")}:${scryptSync(password, salt, 32).toString("hex")}`;

const passwordMatches = (password: string, stored: string) => {
    const [salt, hash] = stored.split(":");
    const candidate = scryptSync(password, Buffer.from(salt, "hex"), 32);
    return timingSafeEqual(candidate, Buffer.from(hash, "hex"));
};

/**
 * Games in SQLite (a database, or a path; `:memory:` for tests); photos
 * under `photoDir`.
 */
export const createGameStore = (
    database: string | DatabaseSync,
    photoDir: string,
    {
        onChange,
    }: {
        /** Called with the game before and after every change (e.g. push). */
        onChange?: (before: GameState, after: GameState) => void;
    } = {},
): GameStore => {
    const db =
        typeof database === "string" ? new DatabaseSync(database) : database;
    db.exec(`
        CREATE TABLE IF NOT EXISTS games (
            id TEXT PRIMARY KEY,
            state TEXT NOT NULL,
            updated_at INTEGER NOT NULL,
            hider_secret TEXT,
            hider_token TEXT
        )
    `);
    const insert = db.prepare(
        "INSERT INTO games (id, state, updated_at) VALUES (?, ?, ?)",
    );
    const select = db.prepare(
        "SELECT state, hider_secret, hider_token FROM games WHERE id = ?",
    );
    const save = db.prepare(
        "UPDATE games SET state = ?, updated_at = ? WHERE id = ?",
    );
    const setHider = db.prepare(
        "UPDATE games SET hider_secret = ?, hider_token = ? WHERE id = ?",
    );
    const stale = db.prepare("SELECT id FROM games WHERE updated_at < ?");
    const remove = db.prepare("DELETE FROM games WHERE id = ?");

    const listeners = new Map<string, Set<(state: GameState | null) => void>>();

    type Row = {
        state: string;
        hider_secret: string | null;
        hider_token: string | null;
    };
    const row = (id: string) => select.get(id) as Row | undefined;
    const load = (id: string) => {
        const found = row(id);
        if (!found) return undefined;
        const state = JSON.parse(found.state) as GameState;
        state.hasHider = found.hider_secret !== null;
        // Games from before a settings change get the defaults for what's new.
        state.settings = normalizeGameSettings(state.settings);
        state.powerups ??= [];
        state.endgame ??= null;
        state.clock ??= null;
        state.deck ??= null;
        state.move ??= null;
        state.moves ??= [];
        state.hider ??= { station: null, pin: null };
        state.hiderName ??= null;
        state.awards ??= [];
        state.hiderReadyAt ??= null;
        state.teams ??= [];
        state.hiderTeamId ??= null;
        state.nextHiderTeamId ??= null;
        state.lateAnswers ??= 0;
        state.freeQuestions ??= 0;
        state.clockRequest ??= null;
        state.deleteRequests ??= {};
        state.revealedPin ??= null;
        if (state.move && !state.move.endsAt) {
            state.move.endsAt =
                state.move.startedAt +
                moveMinutes(state.settings.size) * 60_000;
        }
        for (const round of state.rounds) round.powerups ??= [];
        return state;
    };
    const notify = (state: GameState) => {
        for (const listener of listeners.get(state.id) ?? []) listener(state);
    };
    const store = (state: GameState, before?: GameState) => {
        save.run(JSON.stringify(state), state.updatedAt, state.id);
        notify(state);
        if (before && onChange) onChange(before, state);
        return state;
    };
    const required = (id: string) => {
        const state = load(id);
        if (!state) throw new GameRuleError("This game doesn't exist.", 404);
        return state;
    };
    const photoFolder = (id: string) => join(photoDir, id);

    return {
        create(start, questions, by) {
            const now = Date.now();
            const state = newGameState(newId(8), start, now);
            for (const question of questions) {
                state.questions[String(question.key)] = {
                    question,
                    state: "answered",
                    createdBy: by,
                    createdAt: now,
                    updatedBy: by,
                    updatedAt: now,
                    answeredAt: now,
                };
            }
            insert.run(state.id, JSON.stringify(state), now);
            return state;
        },

        get: load,

        apply(id, op, actor) {
            const before = required(id);
            const next = applyOp(before, op, actor, Date.now());
            if (op.type === "newRound") setHider.run(null, null, id);
            return store(next, before);
        },

        subscribe(id, listener) {
            if (!listeners.has(id)) listeners.set(id, new Set());
            listeners.get(id)!.add(listener);
            return () => {
                listeners.get(id)?.delete(listener);
                if (listeners.get(id)?.size === 0) listeners.delete(id);
            };
        },

        delete(id) {
            if (!row(id)) return false;
            remove.run(id);
            rmSync(photoFolder(id), { recursive: true, force: true });
            for (const listener of listeners.get(id) ?? []) listener(null);
            listeners.delete(id);
            return true;
        },

        claimHider(id, password, by) {
            const state = required(id);
            if (password.length < 4) {
                throw new GameRuleError(
                    "Choose a password of at least 4 characters.",
                    400,
                );
            }
            const found = row(id)!;
            // With teams, only the team hiding this round hides.
            const team = by
                ? state.teams.find((t) => t.members.includes(by))
                : undefined;
            if (state.hiderTeamId && team?.id !== state.hiderTeamId) {
                const hiders = state.teams.find(
                    (t) => t.id === state.hiderTeamId,
                );
                throw new GameRuleError(
                    `This round's hider is team ${hiders?.name ?? "?"}: join it to hide.`,
                    409,
                );
            }
            if (found.hider_secret && found.hider_token) {
                if (!passwordMatches(password, found.hider_secret)) {
                    throw new GameRuleError("Wrong hider password.");
                }
                return found.hider_token;
            }
            const token = randomBytes(24).toString("base64url");
            setHider.run(hashPassword(password), token, id);
            state.hasHider = true;
            if (team && !state.hiderTeamId) state.hiderTeamId = team.id;
            // The first hider's name (or their team's) goes on the scoreboard.
            if (team) state.hiderName = team.name;
            else if (by && by !== "Someone" && !state.hiderName)
                state.hiderName = by;
            state.version += 1;
            state.updatedAt = Date.now();
            store(state);
            return token;
        },

        isHider(id, token) {
            const stored = token ? row(id)?.hider_token : null;
            if (!token || !stored || stored.length !== token.length) {
                return false;
            }
            return timingSafeEqual(Buffer.from(stored), Buffer.from(token));
        },

        addPhoto(id, bytes, type, actor, options = {}) {
            const extension = PHOTO_TYPES[type];
            if (!extension) {
                throw new GameRuleError(
                    "Photos must be JPEG, PNG or WebP.",
                    400,
                );
            }
            const state = required(id);
            const before = structuredClone(state);
            if (state.photos.length >= MAX_PHOTOS_PER_GAME) {
                throw new GameRuleError(
                    `This game has its ${MAX_PHOTOS_PER_GAME} photos; start a new game for more.`,
                    409,
                );
            }
            const photoId = `${newId(10)}.${extension}`;
            mkdirSync(photoFolder(id), { recursive: true });
            writeFileSync(join(photoFolder(id), photoId), bytes);

            const now = Date.now();
            state.photos.push({
                id: photoId,
                by: actor.name,
                at: now,
                ...(options.requestId ? { requestId: options.requestId } : {}),
                ...(options.caption ? { caption: options.caption } : {}),
            });
            const request = state.photoRequests.find(
                (r) => r.id === options.requestId,
            );
            if (request) {
                const first = !request.photoId;
                request.photoId = photoId;
                request.answeredAt = now;
                // With the digital deck, an answered photo question earns a
                // draw; the same photo asked again costs the seekers double.
                if (first && state.deck) {
                    const again = timesPhotoAnsweredBefore(
                        state,
                        request.name,
                        request.id,
                    );
                    for (let i = 0; i <= again; i++) {
                        state.deck.owed.push({
                            draw: 1,
                            keep: 1,
                            label: i === 0 ? "Photo" : "Photo (asked again)",
                        });
                    }
                    state.deck = advanceDeck(state.deck, now);
                }
            }
            state.version += 1;
            state.updatedAt = now;
            return { state: store(state, before), photoId };
        },

        readPhoto(id, photoId) {
            if (!/^[A-Za-z0-9]+\.(jpg|png|webp)$/.test(photoId))
                return undefined;
            if (!/^[A-Za-z0-9]+$/.test(id)) return undefined;
            const file = join(photoFolder(id), photoId);
            if (!existsSync(file)) return undefined;
            const extension = photoId.split(".")[1];
            const type = Object.entries(PHOTO_TYPES).find(
                ([, ext]) => ext === extension,
            )![0];
            return { bytes: readFileSync(file), type };
        },

        cleanup(now = Date.now()) {
            const old = stale.all(now - KEEP_GAMES_MS) as { id: string }[];
            for (const { id } of old) {
                remove.run(id);
                rmSync(photoFolder(id), { recursive: true, force: true });
            }
            // Photo folders of games that no longer exist.
            if (existsSync(photoDir)) {
                for (const folder of readdirSync(photoDir)) {
                    if (!row(folder)) {
                        rmSync(join(photoDir, folder), {
                            recursive: true,
                            force: true,
                        });
                    }
                }
            }
            return old.length;
        },
    };
};
