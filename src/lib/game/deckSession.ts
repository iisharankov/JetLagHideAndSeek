// The virtual deck as this phone uses it: the game's deck in a shared game
// (the server draws), this phone's own deck when playing alone.
import { toast } from "react-toastify";

import { persistentAtom } from "@/lib/persist";
import { errorMessage } from "@/maps/errors";

import {
    advanceDeck,
    cardInfo,
    CURSE_COSTS,
    discardHand,
    drawCards,
    keepCards,
    newDeck,
    removeFromHand,
} from "./deck";
import { activeGameId, sendOp } from "./session";
import type { Deck, DeckOp } from "./types";

export const localDeck = persistentAtom<Deck | null>("localDeck", null, {
    encode: JSON.stringify,
    decode: JSON.parse,
});

/** A fresh, shuffled deck for playing alone. */
export const newLocalDeck = () => localDeck.set(newDeck());

/** One deck change: sent to the game, or applied to this phone's deck. */
export const deckAct = (op: DeckOp) => {
    if (activeGameId.get()) {
        void sendOp(op);
        return;
    }
    const deck = localDeck.get();
    if (!deck) return;
    try {
        switch (op.type) {
            case "drawCards":
                if (!op.extra) throw new Error("Choose what to draw.");
                localDeck.set(drawCards(deck, op.extra));
                break;
            case "keepCards":
                localDeck.set(
                    advanceDeck(keepCards(deck, op.picks), Date.now()),
                );
                break;
            case "playCard": {
                const id = deck.hand[op.index];
                if (
                    id === "powerup_move" ||
                    CURSE_COSTS[id]?.discard === "hand"
                ) {
                    localDeck.set(discardHand(deck));
                    break;
                }
                let next = deck;
                for (const index of [op.index, ...(op.discards ?? [])].sort(
                    (a, b) => b - a,
                )) {
                    next = removeFromHand(next, index);
                }
                const swap = {
                    powerup_discard_1_draw_2: 2,
                    powerup_discard_2_draw_3: 3,
                }[id];
                if (swap) {
                    next = {
                        ...next,
                        owed: [
                            ...next.owed,
                            {
                                draw: swap,
                                keep: swap,
                                label: cardInfo(id).name,
                            },
                        ],
                    };
                }
                if (id === "powerup_draw_1_expand_1") {
                    next = {
                        ...next,
                        limit: next.limit + 1,
                        owed: [
                            ...next.owed,
                            { draw: 1, keep: 1, label: cardInfo(id).name },
                        ],
                    };
                }
                localDeck.set(advanceDeck(next, Date.now()));
                break;
            }
            case "discardCard":
                localDeck.set(removeFromHand(deck, op.index));
                break;
            case "discardHand":
                localDeck.set(discardHand(deck));
                break;
        }
    } catch (error) {
        toast.error(errorMessage(error));
    }
};
