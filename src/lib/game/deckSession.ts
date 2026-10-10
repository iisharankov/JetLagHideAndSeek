// The virtual deck as this phone uses it: the game's deck in a shared game
// (the server draws), this phone's own deck when playing alone.
import { toast } from "react-toastify";

import { persistentAtom } from "@/lib/persist";
import { errorMessage } from "@/maps/errors";

import {
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
                localDeck.set(keepCards(deck, op.picks));
                break;
            case "playCard":
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
