// Teams: who is in which, by player id, and getting into one with its
// password. With the Teams setting every player is in a team (the owner's
// Q58 answer); the team that hides is the hider.
import { MAX_PASSWORD, MIN_PASSWORD } from "@/lib/game/players";
import type { GameState, PlayerId, Team } from "@/lib/game/types";

import { hashPassword, passwordMatches } from "./passwords";
import { GameRuleError, shortId, WrongGuessError } from "./shared";

/** The team a player is in. */
export const teamOf = (state: GameState, id: PlayerId) =>
    state.teams.find((team) => team.members.includes(id));

export const teamById = (state: GameState, id: string | null | undefined) =>
    id ? state.teams.find((team) => team.id === id) : undefined;

/**
 * Takes a player out of every team. A team left with nobody goes, unless
 * it hides this round or the next.
 */
export const removeFromTeams = (state: GameState, id: PlayerId) => {
    for (const team of state.teams) {
        team.members = team.members.filter((member) => member !== id);
    }
    state.teams = state.teams.filter(
        (team) =>
            team.members.length > 0 ||
            team.id === state.hiderTeamId ||
            team.id === state.nextHiderTeamId,
    );
};

const checkNewPassword = (password: string) => {
    if (password.length < MIN_PASSWORD) {
        throw new GameRuleError(
            `Choose a team password of at least ${MIN_PASSWORD} characters.`,
            400,
        );
    }
    if (password.length > MAX_PASSWORD) {
        throw new GameRuleError(
            `Choose a team password of ${MAX_PASSWORD} characters or fewer.`,
            400,
        );
    }
};

export interface TeamChoice {
    /** An existing team, by id. */
    id?: string;
    /** A team by name: joined if it exists (any case), made if not. */
    name?: string;
    password?: string;
}

/**
 * Puts a joined player into a team: an existing one after its password, or
 * a new one with the password given. Already in it: nothing to type.
 */
export const joinTeamIn = (
    state: GameState,
    playerId: PlayerId,
    choice: TeamChoice,
): Team => {
    if (!state.settings.teams) {
        throw new GameRuleError("This game has no teams.", 409);
    }
    const player = state.players[playerId];
    if (!player || player.left) {
        throw new GameRuleError("Join the game first.", 409);
    }
    const name = String(choice.name ?? "")
        .trim()
        .slice(0, 30);
    const existing = choice.id
        ? teamById(state, choice.id)
        : state.teams.find(
              (team) => team.name.toLowerCase() === name.toLowerCase(),
          );
    if (choice.id && !existing) {
        throw new GameRuleError("That team isn't in the game any more.", 404);
    }
    if (existing?.members.includes(playerId)) return existing;
    const password = String(choice.password ?? "");
    let team = existing;
    if (team?.passwordHash) {
        if (!passwordMatches(password, team.passwordHash)) {
            throw new WrongGuessError("Wrong team password.");
        }
    } else if (team) {
        // A team from before passwords: the first to join sets one.
        checkNewPassword(password);
        team.passwordHash = hashPassword(password);
    } else {
        if (!name) throw new GameRuleError("Give the team a name.", 400);
        checkNewPassword(password);
        team = {
            id: shortId(),
            name,
            members: [],
            passwordHash: hashPassword(password),
        };
    }
    removeFromTeams(state, playerId);
    if (!state.teams.includes(team)) state.teams.push(team);
    team.members.push(playerId);
    player.teamId = team.id;
    return team;
};
