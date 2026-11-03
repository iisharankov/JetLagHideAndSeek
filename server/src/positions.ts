// Where the seekers are, for the hider's map: the rulebook has the seekers
// keep a tracker on so the hider can follow them. The newest position of
// each seeker, per game, in memory only: a restart forgets them, and the
// phones send them again within a minute. Not part of the game's state, so
// a moving seeker doesn't resend the whole game to every phone.
import type { SeekerPosition } from "@/lib/game/types";

export type { SeekerPosition };

/** A game's seekers, at most: the longest silent goes beyond this. */
const MAX_PER_GAME = 30;
/** Not passed on after this long without news. */
const KEPT_MS = 12 * 3600 * 1000;

export type PositionStore = ReturnType<typeof createPositionStore>;

export const createPositionStore = (now = () => Date.now()) => {
    const games = new Map<string, Map<string, SeekerPosition>>();
    const listeners = new Map<string, Set<(list: SeekerPosition[]) => void>>();

    const list = (id: string) => {
        const time = now();
        return [...(games.get(id)?.values() ?? [])].filter(
            (position) => time - position.at <= KEPT_MS,
        );
    };

    return {
        list,
        set(id: string, position: Omit<SeekerPosition, "at">) {
            const seekers = games.get(id) ?? new Map<string, SeekerPosition>();
            games.set(id, seekers);
            // The newest last: the longest silent goes first.
            seekers.delete(position.name);
            seekers.set(position.name, { ...position, at: now() });
            while (seekers.size > MAX_PER_GAME) {
                seekers.delete(seekers.keys().next().value!);
            }
            const current = list(id);
            for (const listener of listeners.get(id) ?? []) listener(current);
        },
        subscribe(id: string, listener: (list: SeekerPosition[]) => void) {
            if (!listeners.has(id)) listeners.set(id, new Set());
            listeners.get(id)!.add(listener);
            return () => {
                listeners.get(id)?.delete(listener);
                if (listeners.get(id)?.size === 0) listeners.delete(id);
            };
        },
        forget(id: string) {
            games.delete(id);
        },
    };
};
