import { describe, expect, it } from "vitest";

import {
    bonusMinutes,
    cardChoices,
    discardCard,
    DRAWS,
    hand,
    keepCard,
    removeOne,
} from "@/lib/game/hand";

describe("the hider's hand", () => {
    it("draws as the rulebook says", () => {
        expect(DRAWS.radius).toMatchObject({ draw: 2, keep: 1 });
        expect(DRAWS.tentacles).toMatchObject({ draw: 4, keep: 2 });
        expect(DRAWS.measuring).toMatchObject({ draw: 3, keep: 1 });
        expect(DRAWS.photo).toMatchObject({ draw: 1, keep: 1 });
    });

    it("offers time bonuses scaled to the game size", () => {
        const medium = cardChoices("medium").filter((c) => c.kind === "time");
        expect(medium.map((c) => c.minutes)).toEqual([3, 6, 9, 12, 18]);
        expect(cardChoices("small").some((c) => c.name === "Move")).toBe(true);
    });

    it("adds up the time bonuses, with a duplicate copying the biggest", () => {
        hand.set([]);
        keepCard({ kind: "time", name: "Time bonus", minutes: 6 });
        keepCard({ kind: "time", name: "Time bonus", minutes: 15 });
        keepCard({ kind: "curse", name: "Curse of the Cairn" });
        expect(bonusMinutes(hand.get())).toBe(21);

        keepCard({ kind: "powerup", name: "Duplicate Another Card" });
        expect(bonusMinutes(hand.get())).toBe(36);

        removeOne("Curse of the Cairn");
        expect(hand.get().map((c) => c.name)).toEqual([
            "Time bonus",
            "Time bonus",
            "Duplicate Another Card",
        ]);
        discardCard(hand.get()[0].id);
        expect(bonusMinutes(hand.get())).toBe(30);
    });
});
