// The hider's hand: the cards they kept from the hider deck, on the hider's
// phone only (the seekers never see it). The deck itself is the real one;
// the app just keeps track, and adds the time bonuses up at the end.
import { persistentAtom } from "@/lib/persist";
import { CURSES, POWERUPS, TIME_BONUSES } from "@/lib/rules/cards";

import type { GameSize } from "./types";

export const SIZE_INDEX: Record<GameSize, number> = {
    small: 0,
    medium: 1,
    large: 2,
};

export interface HandCard {
    id: string;
    kind: "time" | "powerup" | "curse";
    name: string;
    /** Time bonus: its minutes for this game's size. */
    minutes?: number;
}

const json = { encode: JSON.stringify, decode: JSON.parse };

export const hand = persistentAtom<HandCard[]>("hiderHand", [], json);
/** The rulebook's 6, plus one per "Draw 1, Expand 1" played this round. */
export const handLimit = persistentAtom<number>("hiderHandLimit", 6, json);

/**
 * What the hider draws after answering a question, from the rulebook's
 * question pages ("draw 2 cards and keep 1", …), by question id.
 */
export const DRAWS: Record<
    string,
    { draw: number; keep: number; label: string }
> = {
    radius: { draw: 2, keep: 1, label: "Radar" },
    thermometer: { draw: 2, keep: 1, label: "Thermometer" },
    tentacles: { draw: 4, keep: 2, label: "Tentacles" },
    matching: { draw: 3, keep: 1, label: "Matching" },
    measuring: { draw: 3, keep: 1, label: "Measuring" },
    photo: { draw: 1, keep: 1, label: "Photo" },
};

export const cardLabel = (card: Omit<HandCard, "id">) =>
    card.kind === "time" ? `Time bonus ${card.minutes} min` : card.name;

/** Every card the hider might keep, with time bonuses for this game size. */
export const cardChoices = (size: GameSize): Omit<HandCard, "id">[] => [
    ...TIME_BONUSES.map((bonus) => ({
        kind: "time" as const,
        name: "Time bonus",
        minutes: bonus.minutes[SIZE_INDEX[size]],
    })),
    ...POWERUPS.map((powerup) => ({
        kind: "powerup" as const,
        name: powerup.name,
    })),
    ...CURSES.map((curse) => ({ kind: "curse" as const, name: curse.name })),
];

export const keepCard = (card: Omit<HandCard, "id">) =>
    hand.set([...hand.get(), { id: crypto.randomUUID(), ...card }]);

export const discardCard = (id: string) =>
    hand.set(hand.get().filter((card) => card.id !== id));

/** Takes one card of this name out of the hand (when it's played). */
export const removeOne = (name: string) => {
    const index = hand.get().findIndex((card) => card.name === name);
    if (index !== -1) discardCard(hand.get()[index].id);
};

export const discardHand = () => hand.set([]);

/**
 * Minutes added to the hiding time at the end of the round: every time
 * bonus still in the hand, and each "Duplicate Another Card" as a copy of
 * the biggest one (the rulebook lets it double a time bonus).
 */
export const bonusMinutes = (cards: HandCard[]) => {
    const times = cards
        .filter((card) => card.kind === "time")
        .map((card) => card.minutes ?? 0);
    const best = Math.max(0, ...times);
    const duplicates = cards.filter(
        (card) => card.name === "Duplicate Another Card",
    ).length;
    return times.reduce((sum, minutes) => sum + minutes, 0) + duplicates * best;
};
