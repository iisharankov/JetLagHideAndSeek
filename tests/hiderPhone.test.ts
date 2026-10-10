import { beforeEach, describe, expect, it } from "vitest";

import { hiderMode } from "@/lib/context";
import { gameRole, gameState, hiderPhone } from "@/lib/game/session";
import type { GameState } from "@/lib/game/types";

// Only whether there is a game matters here.
const game = { id: "g" } as GameState;
const pin = { latitude: 47.37, longitude: 8.54 };

describe("hiderPhone", () => {
    beforeEach(() => {
        hiderMode.set(false);
        gameState.set(null);
        gameRole.set("seeker");
    });

    it("is off without hider mode, game or no game", () => {
        expect(hiderPhone.get()).toBe(false);
        gameState.set(game);
        gameRole.set("hider");
        expect(hiderPhone.get()).toBe(false);
    });

    it("is on in hider mode when playing alone", () => {
        hiderMode.set(pin);
        expect(hiderPhone.get()).toBe(true);
    });

    it("in a shared game, only the hider's phone counts", () => {
        hiderMode.set(pin);
        gameState.set(game);
        expect(hiderPhone.get()).toBe(false);
        gameRole.set("hider");
        expect(hiderPhone.get()).toBe(true);
    });

    it("tells its listeners when it flips, not on every game change", () => {
        hiderMode.set(pin);
        gameState.set(game);
        gameRole.set("hider");
        const seen: boolean[] = [];
        const stop = hiderPhone.listen((value) => seen.push(value));

        gameState.set({ ...game });
        gameState.set({ ...game });
        expect(seen).toEqual([]);

        gameRole.set("seeker");
        expect(seen).toEqual([false]);
        stop();
    });
});
