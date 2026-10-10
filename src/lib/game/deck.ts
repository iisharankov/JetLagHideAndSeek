// The hider deck as the app plays it ("digital deck" games): shuffled per
// round, the hider's draws are dealt by the game, the seekers never see the
// hand. A card is its image name (lib/rules/cards.ts), which is unique;
// the players' own cards are "custom:<id>". Pure functions, shared by the
// server and the phones; the server owns the deck in a shared game, the
// phone when playing alone.
import { CURSES, POWERUPS, TIME_BONUSES } from "@/lib/rules/cards";

import type { CustomCard, Deck, Draw, GameSettings, GameSize } from "./types";

export interface CardInfo {
    id: string;
    kind: "time" | "powerup" | "curse";
    name: string;
    /** The picture's name (lib/rules/cards.ts); "" for a custom card. */
    image: string;
    /** Time bonus: minutes for small, medium and large games. */
    minutes?: [number, number, number];
    effect?: string;
}

const SIZE_INDEX: Record<GameSize, number> = { small: 0, medium: 1, large: 2 };

/** Copies of a curse in the printed deck: one of each. */
const DEFAULT_CURSE_COUNT = 1;

/** Custom cards' ids start with this; the rest is the card's own id. */
export const CUSTOM_PREFIX = "custom:";

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

/** A custom card as the deck sees it. */
export const customCardInfo = (card: CustomCard): CardInfo => ({
    id: CUSTOM_PREFIX + card.id,
    kind: card.kind,
    name: card.name,
    image: "",
    effect: card.text,
    ...(card.minutes ? { minutes: card.minutes } : {}),
});

export const cardInfo = (id: string, custom: CustomCard[] = []): CardInfo => {
    const known = BY_ID.get(id);
    if (known) return known;
    const own = id.startsWith(CUSTOM_PREFIX)
        ? custom.find((card) => CUSTOM_PREFIX + card.id === id)
        : undefined;
    return own
        ? customCardInfo(own)
        : { id, kind: "curse", name: "Unknown card", image: "" };
};

/** Time bonus minutes of a card in this game size (0 for other cards). */
export const cardMinutes = (
    id: string,
    size: GameSize,
    custom: CustomCard[] = [],
) => cardInfo(id, custom).minutes?.[SIZE_INDEX[size]] ?? 0;

export const cardLabel = (
    id: string,
    size: GameSize,
    custom: CustomCard[] = [],
) => {
    const info = cardInfo(id, custom);
    return info.kind === "time"
        ? `${info.name} ${cardMinutes(id, size, custom)} min`
        : info.name;
};

/**
 * What casting a curse costs in cards, with the digital deck ("Discard a
 * card", "Discard a time bonus", "Discard your hand"). The other costs are
 * things to do, which the players check themselves.
 */
export interface CastingCost {
    discard: number | "hand";
    /** Only cards of this kind count. */
    kind?: "time" | "powerup";
}
export const CURSE_COSTS: Record<string, CastingCost> = {
    curse_drained_brain: { discard: "hand" },
    curse_egg_partner: { discard: 2 },
    curse_jammed_door: { discard: 2 },
    curse_spotty_memory: { discard: 1, kind: "time" },
    curse_lemon_phylactery: { discard: 1, kind: "powerup" },
    curse_hidden_hangman: { discard: 2 },
    curse_right_turn: { discard: 1 },
    curse_urban_explorer: { discard: 2 },
    curse_overflowing_chalice: { discard: 1 },
};

/** "a time bonus", "2 other cards", "your whole hand". */
export const castingCostText = (cost: CastingCost) => {
    if (cost.discard === "hand") return "your whole hand";
    const what =
        cost.kind === "time"
            ? "time bonus"
            : cost.kind === "powerup"
              ? "powerup"
              : "other card";
    return `${cost.discard} ${what}${cost.discard === 1 ? "" : "s"}`;
};

/** The printed deck's copies of a card. */
export const defaultCount = (id: string) =>
    TIME_BONUSES.find((bonus) => bonus.image === id)?.count ??
    POWERUPS.find((powerup) => powerup.image === id)?.count ??
    (CURSES.some((curse) => curse.image === id)
        ? (CURSES.find((curse) => curse.image === id)?.count ??
          DEFAULT_CURSE_COUNT)
        : 0);

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

type Composition = Pick<GameSettings, "deckCounts" | "customCards">;

/**
 * The whole deck, one entry per copy: the printed cards (with the game's
 * own counts where set) and the players' custom cards.
 */
export const deckComposition = (
    settings: Composition = { deckCounts: {}, customCards: [] },
): string[] => [
    ...CARDS.flatMap((card) =>
        Array<string>(
            settings.deckCounts[card.id] ?? defaultCount(card.id),
        ).fill(card.id),
    ),
    ...settings.customCards.flatMap((card) =>
        Array<string>(card.count).fill(CUSTOM_PREFIX + card.id),
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

export const newDeck = (
    settings?: Composition,
    random = Math.random,
): Deck => ({
    remaining: shuffled(deckComposition(settings), random),
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

/**
 * Deals the next draw the hider is owed, as soon as nothing is pending: the
 * cards just come. A draw with nothing to choose ("draw 1, keep 1", "draw
 * and keep 2") goes straight to the hand. An empty deck (discard pile
 * included) drops the draw with a note.
 */
export const advanceDeck = (
    deck: Deck,
    now: number,
    random = Math.random,
): Deck => {
    let next = deck;
    while (next.pending.length === 0 && next.owed.length > 0) {
        const [draw, ...owed] = next.owed;
        if (next.remaining.length + next.discard.length === 0) {
            next = {
                ...next,
                owed,
                log: [
                    ...next.log,
                    {
                        at: now,
                        text: `The deck is empty: no cards for ${draw.label}.`,
                    },
                ],
            };
            continue;
        }
        next = drawCards({ ...next, owed }, draw, random);
        if (
            next.pending.length > 0 &&
            next.pendingKeep >= next.pending.length
        ) {
            next = keepCards(
                next,
                next.pending.map((_, index) => index),
            );
        }
    }
    return next;
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
export const handBonusMinutes = (
    hand: string[],
    size: GameSize,
    custom: CustomCard[] = [],
) => {
    const times = hand
        .map((id) => cardMinutes(id, size, custom))
        .filter((minutes) => minutes > 0);
    const best = Math.max(0, ...times);
    const duplicates = hand.filter(
        (id) => id === "powerup_duplicate_another_card",
    ).length;
    return times.reduce((sum, minutes) => sum + minutes, 0) + duplicates * best;
};

/**
 * What the seekers may see of the deck: nothing in it, not how many cards
 * the hider holds or has left, nor what they drew; only the hand limit and
 * whether their next question is free.
 */
export const deckForSeekers = (deck: Deck): Deck => ({
    remaining: [],
    discard: [],
    hand: [],
    pending: [],
    pendingKeep: 0,
    owed: [],
    limit: deck.limit,
    // Not what they drew either: the log stays with the hider.
    log: [],
    ...(deck.freeQuestions ? { freeQuestions: deck.freeQuestions } : {}),
});
