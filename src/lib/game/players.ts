// Who is who in a shared game, for the server and the phones alike: the
// role rule, the player code, and when a player counts as gone.
import type { GameState, Player, Role } from "./types";

/**
 * Hider or seeker. With teams, the team that hides this round is the hider
 * (every member, whoever typed what); without teams, the one player who
 * said they hide. A player who moved to another phone, or was removed, is
 * nobody's hider.
 */
export const roleOfPlayer = (
    state: Pick<GameState, "settings" | "hiderTeamId">,
    player: Player | undefined | null,
): Role => {
    if (!player || player.left) return "seeker";
    if (state.settings.teams) {
        return player.teamId !== null && player.teamId === state.hiderTeamId
            ? "hider"
            : "seeker";
    }
    return player.hider ? "hider" : "seeker";
};

/** The players still in the game. */
export const activePlayers = (state: Pick<GameState, "players">) =>
    Object.values(state.players ?? {}).filter((player) => !player.left);

/** Without 0/O and 1/I, which look alike on a phone. */
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;

/** "K7M4PQ" → "K7M-4PQ", easier to read out and type. */
export const formatCode = (code: string) =>
    `${code.slice(0, 3)}-${code.slice(3)}`;

/** A code as typed ("k7m-4pq", "K7M 4PQ") → "K7M4PQ"; null if it can't be one. */
export const parseCode = (typed: string) => {
    const code = typed.toUpperCase().replace(/[\s-]/g, "");
    return code.length === CODE_LENGTH &&
        [...code].every((letter) => CODE_ALPHABET.includes(letter))
        ? code
        : null;
};

/** Not heard from for this long: anyone may remove the player. */
export const STALE_MS = 60 * 60_000;

export const playerStale = (player: Pick<Player, "lastSeen">, now: number) =>
    now - player.lastSeen > STALE_MS;

/** Shortest passwords for teams (the owner's Q50 answer). */
export const MIN_PASSWORD = 6;
/** Password managers make long ones; bcrypt-style tools trip past 72. */
export const MAX_PASSWORD = 64;
