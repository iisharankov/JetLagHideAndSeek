import { describe, expect, it } from "vitest";

import {
    cardInfo,
    cardLabel,
    deckComposition,
    deckForSeekers,
    discardHand,
    drawCards,
    handBonusMinutes,
    keepCards,
    newDeck,
    removeFromHand,
} from "@/lib/game/deck";
import { CURSES, POWERUPS, TIME_BONUSES } from "@/lib/rules/cards";

const sum = (numbers: number[]) => numbers.reduce((a, b) => a + b, 0);

describe("the virtual hider deck", () => {
    it("holds every copy of every card, shuffled", () => {
        const all = deckComposition();
        expect(all).toHaveLength(
            sum(TIME_BONUSES.map((b) => b.count)) +
                sum(POWERUPS.map((p) => p.count)) +
                sum(CURSES.map((c) => c.count ?? 2)),
        );
        expect(all.filter((id) => id === "powerup_move")).toHaveLength(1);
        expect(all.filter((id) => id === "time_bonus_5")).toHaveLength(25);

        const deck = newDeck(() => 0.5);
        expect([...deck.remaining].sort()).toEqual([...all].sort());
        expect(deck.hand).toEqual([]);
        expect(deck.limit).toBe(6);
    });

    it("draws, keeps the picks, discards the rest", () => {
        let deck = { ...newDeck(), remaining: ["a", "b", "c", "d"] };
        deck = drawCards(deck, { draw: 3, keep: 1, label: "Matching" });
        expect(deck.pending).toEqual(["a", "b", "c"]);
        expect(deck.remaining).toEqual(["d"]);
        expect(() =>
            drawCards(deck, { draw: 1, keep: 1, label: "Photo" }),
        ).toThrow(/last draw/);
        expect(() => keepCards(deck, [0, 1])).toThrow(/Pick 1 card/);

        deck = keepCards(deck, [1]);
        expect(deck.hand).toEqual(["b"]);
        expect(deck.discard).toEqual(["a", "c"]);
        expect(deck.pending).toEqual([]);
    });

    it("shuffles the discard pile back in when the deck runs short", () => {
        let deck = { ...newDeck(), remaining: ["a"], discard: ["x", "y"] };
        deck = drawCards(deck, { draw: 2, keep: 1, label: "Radar" }, () => 0);
        expect(deck.pending).toHaveLength(2);
        expect(deck.pending[0]).toBe("a");
        expect(deck.discard).toEqual([]);
    });

    it("plays or discards from the hand", () => {
        let deck = { ...newDeck(), hand: ["curse_cairn", "time_bonus_5"] };
        deck = removeFromHand(deck, 0);
        expect(deck.hand).toEqual(["time_bonus_5"]);
        expect(deck.discard).toEqual(["curse_cairn"]);
        expect(() => removeFromHand(deck, 5)).toThrow(/isn't in the hand/);
        deck = discardHand(deck);
        expect(deck.hand).toEqual([]);
    });

    it("adds the time bonuses up, a duplicate copying the biggest", () => {
        expect(
            handBonusMinutes(["time_bonus_5", "time_bonus_15"], "medium"),
        ).toBe(3 + 9);
        expect(
            handBonusMinutes(
                [
                    "time_bonus_5",
                    "time_bonus_15",
                    "powerup_duplicate_another_card",
                ],
                "large",
            ),
        ).toBe(5 + 15 + 15);
        expect(cardLabel("time_bonus_30", "small")).toBe("Time bonus 12 min");
        expect(cardInfo("curse_cairn").name).toBe("Curse of the Cairn");
    });

    it("shows the seekers only how big the hand is", () => {
        const deck = { ...newDeck(), hand: ["curse_cairn"], limit: 7 };
        const seen = deckForSeekers(deck);
        expect(seen.hand).toEqual([]);
        expect(seen.remaining).toEqual([]);
        expect(seen.handSize).toBe(1);
        expect(seen.limit).toBe(7);
    });
});
