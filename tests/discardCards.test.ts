import { describe, expect, it } from "vitest";

import { newDeck } from "@/lib/game/deck";
import { discardCards, localDeck } from "@/lib/game/deckSession";

describe("discarding several cards at once", () => {
    it("takes exactly the ones picked, wherever they are in the hand", async () => {
        localDeck.set({
            ...newDeck(),
            hand: ["a", "b", "c", "d", "e"],
        });
        await discardCards([1, 3]);
        expect(localDeck.get()?.hand).toEqual(["a", "c", "e"]);
        expect(localDeck.get()?.discard).toEqual(
            expect.arrayContaining(["b", "d"]),
        );
        // In any order.
        await discardCards([2, 0]);
        expect(localDeck.get()?.hand).toEqual(["c"]);
    });
});
