// Shared games in SQLite, photos on disk, and live updates to subscribers.
import { randomBytes, timingSafeEqual } from "node:crypto";
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
import { activePlayers, MIN_PASSWORD, roleOfPlayer } from "@/lib/game/players";
import { applyRest } from "@/lib/game/rest";
import { normalizeGameSettings } from "@/lib/game/settings";
import type {
    GameOp,
    GameSettings,
    GameState,
    Player,
    PlayerId,
    SharedQuestion,
} from "@/lib/game/types";

import { type CodeStore, createCodeStore } from "./codes";
import { type Actor, applyOp, GameRuleError, newGameState } from "./gameOps";
import { hashPassword, passwordMatches } from "./rules/passwords";
import {
    joinPlayer,
    type JoinRequest,
    migratePlayers,
    rejoinPlayer,
    removePlayer,
} from "./rules/players";
import { photoAnswered } from "./rules/questions";
import { WrongGuessError } from "./rules/shared";

const ID_ALPHABET =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const newId = (length: number) =>
    Array.from(randomBytes(length), (byte) => ID_ALPHABET[byte % 62]).join("");

/** Games nobody has changed for this long are deleted, photos included. */
export const KEEP_GAMES_MS = 365 * 24 * 3600 * 1000;
/** Photos per game; anyone with the link can upload, so there is a cap. */
export const MAX_PHOTOS_PER_GAME = 100;
/**
 * Players seen (a phone loading the game, its live stream) are noted in
 * memory and written with the next change, or at most this often per game:
 * every write sends the whole game to every phone.
 */
export const SEEN_EVERY_MS = 5 * 60_000;

const PHOTO_TYPES: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
};

/** A game as the admin lists it (Menu → Admin). */
export interface GameSummary {
    id: string;
    area: string;
    createdAt: number;
    updatedAt: number;
    /** The creator code's name ("Ana's code"), "Admin", or "" for older games. */
    creator: string;
    /** The name of whoever started it. */
    by: string;
    players: number;
}

export interface GameStore {
    create(
        start: { playArea: unknown; zone: unknown; settings: GameSettings },
        questions: SharedQuestion[],
        by: string,
        /** The code it was made with: a creator code's id, or "admin". */
        creator?: string,
    ): GameState;
    /** Every game, newest change first, for the admin. */
    summaries(): GameSummary[];
    /** Creator codes and games made per day (same database). */
    codes: CodeStore;
    get(id: string): GameState | undefined;
    apply(id: string, op: GameOp, actor: Actor): GameState;
    /** `null` tells a subscriber the game was deleted. */
    subscribe(
        id: string,
        listener: (state: GameState | null) => void,
    ): () => void;
    /** Removes a game for everyone, photos included. False if unknown. */
    delete(id: string): boolean;
    /** Joins a player, or updates one who joined before (the same id). */
    join(
        id: string,
        playerId: PlayerId,
        request: JoinRequest,
    ): { state: GameState; player: Player };
    /** Becomes the player with that code on this phone (another phone, wiped storage). */
    rejoin(
        id: string,
        playerId: PlayerId,
        code: string,
    ): { state: GameState; player: Player; replaced: PlayerId };
    removePlayer(id: string, playerId: PlayerId): GameState;
    /** A player's phone was here just now (kept in memory, written now and then). */
    touch(id: string, playerId: PlayerId): void;
    /** When a player was last seen, counting what isn't written yet. */
    lastSeen(id: string, playerId: PlayerId): number | undefined;
    /** The hider password from before teams: kept for phones not reloaded since. */
    claimHider(id: string, password: string, by?: string): string;
    isHider(id: string, token: string | undefined | null): boolean;
    /**
     * The key of whoever started the game (to delete it), handed out once,
     * right after `create`; null if the game already has one.
     */
    issueOrganiser(id: string): string | null;
    isOrganiser(id: string, token: string | undefined | null): boolean;
    /** Games from before organisers have none: the old rules apply to them. */
    hasOrganiser(id: string): boolean;
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
    /** Applies the rest periods (pause, resume) to recent games; how many changed. */
    tick(now?: number): number;
}

/** A player who moved to another phone (or was removed) can't change anything. */
const assertStillIn = (state: GameState, actor: Actor) => {
    const player = state.players[actor.id];
    if (player?.left) {
        throw new GameRuleError(
            player.removed
                ? "You were removed from this game. Open its link to join again."
                : "This player continued on another phone.",
        );
    }
};

/**
 * Whether the game has a hider: a player hiding (by team or by saying so),
 * or a phone with the hider password from before teams.
 */
const hasHider = (state: GameState, secret: boolean) =>
    secret ||
    activePlayers(state).some(
        (player) => roleOfPlayer(state, player) === "hider",
    );

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
    // Added with organisers (round 22): older databases get the column.
    const columns = db.prepare("PRAGMA table_info(games)").all() as {
        name: string;
    }[];
    if (!columns.some((column) => column.name === "organiser_token")) {
        db.exec("ALTER TABLE games ADD COLUMN organiser_token TEXT");
    }
    // Added with creator codes (round 33): who made a game.
    if (!columns.some((column) => column.name === "creator")) {
        db.exec("ALTER TABLE games ADD COLUMN creator TEXT");
        db.exec("ALTER TABLE games ADD COLUMN created_by TEXT");
    }
    const codes = createCodeStore(db);
    const insert = db.prepare(
        "INSERT INTO games (id, state, updated_at, creator, created_by) VALUES (?, ?, ?, ?, ?)",
    );
    const summaries = db.prepare(`
        SELECT g.id, g.updated_at, g.creator, g.created_by,
            json_extract(g.state, '$.createdAt') AS created_at,
            json_extract(g.state, '$.playArea.kind') AS area_kind,
            json_extract(g.state, '$.playArea.location.properties.name') AS area_name,
            (SELECT count(*) FROM json_each(g.state, '$.players') AS p
                WHERE json_extract(p.value, '$.left') IS NULL) AS players,
            c.name AS code_name
        FROM games g LEFT JOIN creator_codes c ON c.id = g.creator
        ORDER BY g.updated_at DESC
        LIMIT 500
    `);
    const select = db.prepare(
        "SELECT state, hider_secret, hider_token, organiser_token FROM games WHERE id = ?",
    );
    const save = db.prepare(
        "UPDATE games SET state = ?, updated_at = ? WHERE id = ?",
    );
    const setHider = db.prepare(
        "UPDATE games SET hider_secret = ?, hider_token = ? WHERE id = ?",
    );
    const setOrganiser = db.prepare(
        "UPDATE games SET organiser_token = ? WHERE id = ? AND organiser_token IS NULL",
    );
    const stale = db.prepare("SELECT id FROM games WHERE updated_at < ?");
    const recent = db.prepare("SELECT id FROM games WHERE updated_at >= ?");
    const remove = db.prepare("DELETE FROM games WHERE id = ?");

    const listeners = new Map<string, Set<(state: GameState | null) => void>>();

    type Row = {
        state: string;
        hider_secret: string | null;
        hider_token: string | null;
        organiser_token: string | null;
    };
    const row = (id: string) => select.get(id) as Row | undefined;
    const load = (id: string) => {
        const found = row(id);
        if (!found) return undefined;
        const state = JSON.parse(found.state) as GameState;
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
        state.restRequest ??= null;
        state.restWindow ??= null;
        state.deleteRequests ??= {};
        state.revealedPin ??= null;
        migratePlayers(state);
        state.hasHider = hasHider(state, found.hider_secret !== null);
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
    /** Players seen and not written yet, per game. */
    const seen = new Map<string, Map<PlayerId, number>>();
    const seenWritten = new Map<string, number>();
    /** Writes the players seen into the game (with a change, or now and then). */
    const writeSeen = (state: GameState) => {
        for (const [playerId, at] of seen.get(state.id) ?? []) {
            const player = state.players[playerId];
            if (player && !player.left && at > player.lastSeen) {
                player.lastSeen = at;
            }
        }
        seen.delete(state.id);
        seenWritten.set(state.id, Date.now());
    };
    const store = (state: GameState, before?: GameState) => {
        writeSeen(state);
        state.hasHider = hasHider(state, row(state.id)?.hider_secret != null);
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
        codes,

        summaries() {
            const rows = summaries.all() as {
                id: string;
                updated_at: number;
                creator: string | null;
                created_by: string | null;
                created_at: number | null;
                area_kind: string | null;
                area_name: string | null;
                players: number;
                code_name: string | null;
            }[];
            return rows.map((row) => ({
                id: row.id,
                area:
                    row.area_kind === "place"
                        ? (row.area_name ?? "a place")
                        : "a drawn play area",
                createdAt: row.created_at ?? row.updated_at,
                updatedAt: row.updated_at,
                creator:
                    row.creator === "admin" ? "Admin" : (row.code_name ?? ""),
                by: row.created_by ?? "",
                players: row.players,
            }));
        },

        create(start, questions, by, creator) {
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
            insert.run(
                state.id,
                JSON.stringify(state),
                now,
                creator ?? null,
                by,
            );
            return state;
        },

        get: load,

        apply(id, op, actor) {
            const before = required(id);
            const now = Date.now();
            assertStillIn(before, actor);
            const next = applyOp(before, op, actor, now);
            const me = next.players[actor.id];
            if (me) me.lastSeen = now;
            if (op.type === "newRound") setHider.run(null, null, id);
            return store(next, before);
        },

        join(id, playerId, request) {
            const before = required(id);
            const state = structuredClone(before);
            const now = Date.now();
            const player = joinPlayer(state, playerId, request, now);
            state.version += 1;
            state.updatedAt = now;
            store(state, before);
            return { state, player };
        },

        rejoin(id, playerId, code) {
            const before = required(id);
            const state = structuredClone(before);
            const now = Date.now();
            const { player, from } = rejoinPlayer(state, playerId, code, now);
            state.version += 1;
            state.updatedAt = now;
            store(state, before);
            return { state, player, replaced: from };
        },

        removePlayer(id, playerId) {
            const before = required(id);
            const state = structuredClone(before);
            const now = Date.now();
            removePlayer(state, playerId, now);
            state.version += 1;
            state.updatedAt = now;
            return store(state, before);
        },

        touch(id, playerId) {
            const now = Date.now();
            const stamps = seen.get(id) ?? new Map<PlayerId, number>();
            stamps.set(playerId, now);
            seen.set(id, stamps);
            if (now - (seenWritten.get(id) ?? 0) < SEEN_EVERY_MS) return;
            const state = load(id);
            const player = state?.players[playerId];
            if (!state || !player || player.left) return;
            if (now - player.lastSeen < SEEN_EVERY_MS) return;
            // Not a change of the game's: no new "updated" time, no push.
            state.version += 1;
            store(state);
        },

        lastSeen(id, playerId) {
            const stored = load(id)?.players[playerId]?.lastSeen;
            const memory = seen.get(id)?.get(playerId);
            if (stored === undefined) return memory;
            return Math.max(stored, memory ?? 0);
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
            if (password.length < MIN_PASSWORD) {
                throw new GameRuleError(
                    `Choose a password of at least ${MIN_PASSWORD} characters.`,
                    400,
                );
            }
            const found = row(id)!;
            // Phones from before players only (they never had teams): an
            // updated phone says "I'm the hider" with its player instead.
            if (state.settings.teams) {
                throw new GameRuleError(
                    "Reload the page to join this game: the app was updated.",
                    409,
                );
            }
            if (activePlayers(state).some((player) => player.hider)) {
                throw new GameRuleError(
                    "Someone is already the hider. If that's you on another phone, rejoin with your code.",
                    409,
                );
            }
            // With teams, only the team hiding this round hides.
            const team = by
                ? state.teams.find((t) =>
                      t.members.some(
                          (member) =>
                              member === by ||
                              state.players[member]?.name === by,
                      ),
                  )
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
                    throw new WrongGuessError("Wrong hider password.");
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

        issueOrganiser(id) {
            const found = row(id);
            if (!found || found.organiser_token) return null;
            const token = randomBytes(24).toString("base64url");
            setOrganiser.run(token, id);
            return token;
        },

        isOrganiser(id, token) {
            const stored = token ? row(id)?.organiser_token : null;
            if (!token || !stored || stored.length !== token.length) {
                return false;
            }
            return timingSafeEqual(Buffer.from(stored), Buffer.from(token));
        },

        hasOrganiser(id) {
            return !!row(id)?.organiser_token;
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
            assertStillIn(state, actor);
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
                const first = !request.photoId && !request.nullAnswer;
                request.photoId = photoId;
                // A photo after "I cannot answer" is the answer after all.
                delete request.nullAnswer;
                if (first) {
                    request.answeredAt = now;
                    photoAnswered(state, request, now);
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

        tick(now = Date.now()) {
            // Only games touched in the last days can be mid-round.
            const rows = recent.all(now - 3 * 24 * 3600_000) as {
                id: string;
            }[];
            let changed = 0;
            for (const { id } of rows) {
                const before = load(id);
                if (
                    !before ||
                    (!before.settings.rest && !before.clock?.pausedBy)
                ) {
                    continue;
                }
                const next = applyRest(before, now);
                if (!next) continue;
                next.version += 1;
                next.updatedAt = now;
                store(next, before);
                changed += 1;
            }
            return changed;
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
