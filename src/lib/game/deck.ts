// The hider deck as the app plays it ("virtual deck" games): shuffled per
// round, the hider draws and keeps cards through it, the seekers never see
// the hand. A card is its image name (lib/rules/cards.ts), which is unique.
// Pure functions, shared by the server and the phones; the server owns the
// deck in a shared game, the phone when playing alone.
import { CURSES, POWERUPS, TIME_BONUSES } from "@/lib/rules/cards";

import type { Deck, Draw, GameSize } from "./types";

export interface CardInfo {
    id: string;
    kind: "time" | "powerup" | "curse";
    name: string;
    image: string;
    /** Time bonus: minutes for small, medium and large games. */
    minutes?: [number, number, number];
    effect?: string;
}

const SIZE_INDEX: Record<GameSize, number> = { small: 0, medium: 1, large: 2 };

/** Copies of a curse in the deck, until the real count is in cards.ts. */
const DEFAULT_CURSE_COUNT = 2;

export const CARDS: CardInfo[] = [
    ...TIME_BONUSES.map((bonus) => ({
        id: bonus.image,
        kind: "time" as const,
        name: "Time bonus",
        image: bonus.image,
        minutes: bonus.minutes,
    })),
    ...POWERUPS.map((powerup) => ({
        id: powerup.image,
        kind: "powerup" as const,
        name: powerup.name,
        image: powerup.image,
        effect: powerup.effect,
    })),
    ...CURSES.map((curse) => ({
        id: curse.image,
        kind: "curse" as const,
        name: curse.name,
        image: curse.image,
        effect: curse.effect,
    })),
];
const BY_ID = new Map(CARDS.map((card) => [card.id, card]));

export const cardInfo = (id: string): CardInfo =>
    BY_ID.get(id) ?? { id, kind: "curse", name: id, image: id };

/** Time bonus minutes of a card in this game size (0 for other cards). */
export const cardMinutes = (id: string, size: GameSize) =>
    cardInfo(id).minutes?.[SIZE_INDEX[size]] ?? 0;

export const cardLabel = (id: string, size: GameSize) => {
    const info = cardInfo(id);
    return info.kind === "time"
        ? `Time bonus ${cardMinutes(id, size)} min`
        : info.name;
};

/**
 * What the hider draws after answering a question, from the rulebook's
 * question pages ("draw 2 cards and keep 1", …), by question id.
 */
export const DRAWS: Record<string, Draw> = {
    radius: { draw: 2, keep: 1, label: "Radar" },
    thermometer: { draw: 2, keep: 1, label: "Thermometer" },
    tentacles: { draw: 4, keep: 2, label: "Tentacles" },
    matching: { draw: 3, keep: 1, label: "Matching" },
    measuring: { draw: 3, keep: 1, label: "Measuring" },
    photo: { draw: 1, keep: 1, label: "Photo" },
};

/** The whole deck, one entry per copy. */
export const deckComposition = (): string[] => [
    ...TIME_BONUSES.flatMap((bonus) => Array(bonus.count).fill(bonus.image)),
    ...POWERUPS.flatMap((powerup) => Array(powerup.count).fill(powerup.image)),
    ...CURSES.flatMap((curse) =>
        Array(curse.count ?? DEFAULT_CURSE_COUNT).fill(curse.image),
    ),
];

export const shuffled = <T>(items: T[], random = Math.random): T[] => {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
};

export const newDeck = (random = Math.random): Deck => ({
    remaining: shuffled(deckComposition(), random),
    discard: [],
    hand: [],
    pending: [],
    pendingKeep: 0,
    owed: [],
    limit: 6,
    log: [],
});

/**
 * Takes `draw` cards off the top for the hider to look at (the discard pile
 * is shuffled back in when the deck runs short); `keepCards` follows.
 */
export const drawCards = (
    deck: Deck,
    { draw, keep }: Draw,
    random = Math.random,
): Deck => {
    if (deck.pending.length > 0) {
        throw new Error("Pick from the last draw first.");
    }
    let remaining = [...deck.remaining];
    let discard = [...deck.discard];
    if (remaining.length < draw && discard.length > 0) {
        remaining = [...remaining, ...shuffled(discard, random)];
        discard = [];
    }
    const pending = remaining.splice(0, draw);
    return {
        ...deck,
        remaining,
        discard,
        pending,
        pendingKeep: Math.min(keep, pending.length),
    };
};

/** Keeps the picked cards of the draw (by index); the rest are discarded. */
export const keepCards = (deck: Deck, picks: number[]): Deck => {
    const chosen = [...new Set(picks)].filter(
        (index) =>
            Number.isInteger(index) &&
            index >= 0 &&
            index < deck.pending.length,
    );
    if (chosen.length !== deck.pendingKeep) {
        throw new Error(
            `Pick ${deck.pendingKeep} card${deck.pendingKeep === 1 ? "" : "s"}.`,
        );
    }
    return {
        ...deck,
        hand: [...deck.hand, ...chosen.map((index) => deck.pending[index])],
        discard: [
            ...deck.discard,
            ...deck.pending.filter((_, index) => !chosen.includes(index)),
        ],
        pending: [],
        pendingKeep: 0,
    };
};

/** A card leaves the hand (played or discarded). */
export const removeFromHand = (deck: Deck, index: number): Deck => {
    if (!Number.isInteger(index) || index < 0 || index >= deck.hand.length) {
        throw new Error("That card isn't in the hand.");
    }
    return {
        ...deck,
        hand: deck.hand.filter((_, i) => i !== index),
        discard: [...deck.discard, deck.hand[index]],
    };
};

export const discardHand = (deck: Deck): Deck => ({
    ...deck,
    hand: [],
    discard: [...deck.discard, ...deck.hand],
});

/**
 * Minutes added to the hiding time at the end of the round: every time
 * bonus still in the hand, and each "Duplicate Another Card" as a copy of
 * the biggest one (the rulebook lets it double a time bonus).
 */
export const handBonusMinutes = (hand: string[], size: GameSize) => {
    const times = hand
        .map((id) => cardMinutes(id, size))
        .filter((minutes) => minutes > 0);
    const best = Math.max(0, ...times);
    const duplicates = hand.filter(
        (id) => id === "powerup_duplicate_another_card",
    ).length;
    return times.reduce((sum, minutes) => sum + minutes, 0) + duplicates * best;
};

/** What the seekers may see of the deck: nothing in it, only its size. */
export const deckForSeekers = (deck: Deck): Deck => ({
    remaining: [],
    discard: [],
    hand: [],
    pending: [],
    pendingKeep: 0,
    owed: [],
    limit: deck.limit,
    log: deck.log,
    handSize: deck.hand.length,
    deckSize: deck.remaining.length,
});
