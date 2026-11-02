// Teams: who is in which, by name.
import { type GameState } from "@/lib/game/types";

/** The team a player is in, by name. */
export const teamOf = (state: GameState, name: string) =>
    state.teams.find((team) => team.members.includes(name));

export const teamById = (state: GameState, id: string | null) =>
    id ? state.teams.find((team) => team.id === id) : undefined;
