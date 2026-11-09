// Players: joining a game, moving to another phone with the player code,
// claiming the hider without teams, and removing a player gone quiet.
import { createHash, randomInt } from "node:crypto";

import {
    activePlayers,
    CODE_ALPHABET,
    CODE_LENGTH,
    parseCode,
} from "@/lib/game/players";
import type { GameState, Player, PlayerId } from "@/lib/game/types";

import { GameRuleError, WrongGuessError } from "./shared";
import {
    joinTeamIn,
    removeFromTeams,
    teamById,
    type TeamChoice,
} from "./teams";

/** What a phone may send as its key: a random id it made once. */
const KEY = /^[A-Za-z0-9_-]{16,100}$/;

export const validKey = (key: string | undefined | null): key is string =>
    !!key && KEY.test(key);

/**
 * The player's public id, from the phone's private key. The game lists its
 * players by this id; only the phone knows the key, so seeing the game
 * never lets anyone act as someone else.
 */
export const publicId = (key: string): PlayerId =>
    `p${createHash("sha256").update(key).digest("base64url").slice(0, 15)}`;

/** Phones and games from before players: the player is their name. */
export const legacyId = (name: string): PlayerId => `legacy:${name}`;

const newCode = (state: GameState) => {
    for (;;) {
        const code = Array.from(
            { length: CODE_LENGTH },
            () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
        ).join("");
        if (!Object.values(state.players).some((p) => p.code === code)) {
            return code;
        }
    }
};

export interface JoinRequest {
    name: string;
    team?: TeamChoice;
    /** True: I hide (without teams: the hider; with: my team hides). False: I don't (any more). */
    hider?: boolean;
}

/** Without teams the hider is one player; with teams, a team. */
const claimHider = (state: GameState, player: Player) => {
    if (state.settings.teams) {
        const team = teamById(state, player.teamId)!;
        if (!state.hiderTeamId) {
            state.hiderTeamId = team.id;
            state.hiderName = team.name;
        } else if (state.hiderTeamId !== team.id) {
            const hiding = teamById(state, state.hiderTeamId);
            throw new GameRuleError(
                `${hiding?.name ?? "Another team"} hide this round.`,
                409,
            );
        }
        return;
    }
    if (activePlayers(state).some((p) => p.hider && p.id !== player.id)) {
        throw new GameRuleError(
            "Someone is already the hider. If that's you on another phone, rejoin with your code.",
            409,
        );
    }
    player.hider = true;
    state.hiderName ??= player.name;
};

/**
 * Joins (or joins again: the same id is the same player, renamed if they
 * like). With teams, the player must be in one; `hider` claims the role.
 */
export const joinPlayer = (
    state: GameState,
    id: PlayerId,
    request: JoinRequest,
    now: number,
): Player => {
    const known = state.players[id];
    // A player who left (another phone took over, or removed) starts afresh.
    const player: Player =
        known && !known.left
            ? known
            : {
                  id,
                  name: request.name,
                  teamId: null,
                  code: newCode(state),
                  joinedAt: now,
                  lastSeen: now,
              };
    player.name = request.name;
    player.lastSeen = now;
    state.players[id] = player;
    if (request.team) {
        joinTeamIn(state, id, request.team);
    } else if (state.settings.teams && !teamById(state, player.teamId)) {
        throw new GameRuleError(
            "Everyone in this game is in a team: pick one, or make one.",
            400,
        );
    }
    if (request.hider === true) {
        claimHider(state, player);
    } else if (request.hider === false && !state.settings.teams) {
        delete player.hider;
    }
    return player;
};

/**
 * Becomes the player with this code, on this phone: their name, team and
 * hider role move here; the old phone's id (`from`) is dead.
 */
export const rejoinPlayer = (
    state: GameState,
    id: PlayerId,
    typed: string,
    now: number,
): { player: Player; from: PlayerId } => {
    const code = parseCode(typed);
    const target = code
        ? activePlayers(state).find((player) => player.code === code)
        : undefined;
    if (!target) {
        throw new WrongGuessError("No player in this game has that code.");
    }
    if (target.id === id) {
        target.lastSeen = now;
        return { player: target, from: id };
    }
    // This phone's own player, if it had one, gives way.
    if (state.players[id]) removeFromTeams(state, id);
    const moved: Player = { ...target, id, lastSeen: now };
    const { code: _code, ...old } = target;
    void _code;
    state.players[target.id] = { ...old, left: now };
    state.players[id] = moved;
    for (const team of state.teams) {
        team.members = team.members.map((member) =>
            member === target.id ? id : member,
        );
    }
    return { player: moved, from: target.id };
};

/** Takes a player out of the game (gone quiet, or a stray phone). */
export const removePlayer = (state: GameState, id: PlayerId, now: number) => {
    const player = state.players[id];
    if (!player || player.left) {
        throw new GameRuleError("That player isn't in the game.", 404);
    }
    removeFromTeams(state, id);
    const { code: _code, hider: _hider, ...rest } = player;
    void _code;
    void _hider;
    state.players[id] = { ...rest, teamId: null, left: now, removed: true };
};

/**
 * Games from before players: each team member (a name then) becomes a
 * placeholder player, so the teams still show who was in them.
 */
export const migratePlayers = (state: GameState) => {
    state.players ??= {};
    for (const team of state.teams) {
        team.members = team.members.map((member) => {
            if (state.players[member]) return member;
            const id = legacyId(member);
            state.players[id] ??= {
                id,
                name: member,
                teamId: team.id,
                joinedAt: state.createdAt,
                lastSeen: state.updatedAt,
            };
            return id;
        });
    }
};
