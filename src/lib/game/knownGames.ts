// The shared games this phone knows: the list in Menu → Game, and which
// ones it has joined for real (name given, seeker or hider chosen).
import { persistentAtom } from "@/lib/persist";
import { parsePlayArea, playAreaName } from "@/lib/sharedGame";

import type { GameState } from "./types";

/** A shared game this phone has been in, for the list in Menu → Game. */
export interface KnownGame {
    id: string;
    area: string;
    joinedAt: number;
    lastSeen: number;
}
export const knownGames = persistentAtom<Record<string, KnownGame>>(
    "knownGames",
    {},
    { encode: JSON.stringify, decode: JSON.parse },
);

/** Keeps the game in the phone's list (Menu → Game). */
export const rememberGame = (state: GameState) => {
    const known = knownGames.get()[state.id];
    const now = Date.now();
    if (known && now - known.lastSeen < 60_000) return;
    let area = known?.area ?? "";
    try {
        area = playAreaName(parsePlayArea(state.playArea));
    } catch {
        // An odd play area: keep what we had.
    }
    knownGames.set({
        ...knownGames.get(),
        [state.id]: {
            id: state.id,
            area,
            joinedAt: known?.joinedAt ?? now,
            lastSeen: now,
        },
    });
};

export const forgetGame = (id: string) => {
    const { [id]: removed, ...rest } = knownGames.get();
    void removed;
    knownGames.set(rest);
};

/** Games this phone has joined for real: name given, seeker or hider chosen. */
export const joinedGames = persistentAtom<Record<string, true>>(
    "joinedGames",
    {},
    { encode: JSON.stringify, decode: JSON.parse },
);
export const markJoined = (id: string) =>
    joinedGames.set({ ...joinedGames.get(), [id]: true });
