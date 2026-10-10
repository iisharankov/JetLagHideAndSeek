// The shared games this phone knows: the list in Menu → Game, and which
// ones it has joined for real (name given, seeker or hider chosen).
import { atom } from "nanostores";

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

const JOINED_KEY = "joinedGames";

const readJoined = (): Record<string, true> => {
    try {
        return JSON.parse(sessionStorage.getItem(JOINED_KEY) ?? "{}");
    } catch {
        return {};
    }
};

/**
 * Games this tab has joined for real: name given, seeker or hider chosen.
 * Per tab (a new tab asks again; a reload doesn't).
 */
export const joinedGames = atom<Record<string, true>>(
    typeof sessionStorage === "undefined" ? {} : readJoined(),
);
const saveJoined = (value: Record<string, true>) => {
    joinedGames.set(value);
    try {
        sessionStorage.setItem(JOINED_KEY, JSON.stringify(value));
    } catch {
        // No session storage: asked again next time.
    }
};
export const markJoined = (id: string) =>
    saveJoined({ ...joinedGames.get(), [id]: true });
export const unmarkJoined = (id: string) => {
    const { [id]: removed, ...rest } = joinedGames.get();
    void removed;
    saveJoined(rest);
};
