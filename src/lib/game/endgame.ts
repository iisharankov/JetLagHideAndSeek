// The end game: the seekers pick the hider's station. In a shared game the
// pick goes through the server (everyone, hider included, gets it); alone,
// it's this phone's own.
import { atom } from "nanostores";

import { endgame, questions } from "@/lib/context";
import { endgameDelayMs, schedule } from "@/lib/game/delayed";
import { activeGameId, sendOp } from "@/lib/game/session";
import type { StationPick } from "@/lib/game/types";

export const startEndgame = (station: StationPick) => {
    if (activeGameId.get()) {
        void sendOp({ type: "startEndgame", station });
        return;
    }
    endgame.set({
        station,
        startedAt: Date.now(),
        before: questions.get().map((q) => q.key),
    });
};

export const endEndgame = () => {
    if (activeGameId.get()) {
        void sendOp({ type: "endEndgame" });
        return;
    }
    endgame.set(null);
};

/** The hider's Start the end game, waiting its 5 s for an Undo. */
export const pendingEndgame = atom<{ endsAt: number } | null>(null);
let cancelPending: (() => void) | null = null;

const storedDelay = () => {
    try {
        return localStorage.getItem("endgameDelayMs");
    } catch {
        return null;
    }
};

/**
 * Starts the end game after a few seconds (principle 10: it reveals the
 * hider's zone); `undoEndgameSoon` within them and nothing is sent.
 */
export const startEndgameSoon = (station: StationPick) => {
    cancelPending?.();
    const ms = endgameDelayMs(storedDelay());
    pendingEndgame.set({ endsAt: Date.now() + ms });
    cancelPending = schedule(() => {
        cancelPending = null;
        pendingEndgame.set(null);
        startEndgame(station);
    }, ms);
};

export const undoEndgameSoon = () => {
    cancelPending?.();
    cancelPending = null;
    pendingEndgame.set(null);
};
