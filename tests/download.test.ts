import { describe, expect, it } from "vitest";

import { photoUrl } from "@/lib/game/api";
import { gameFile, gameFileName } from "@/lib/game/download";
import { defaultGameSettings } from "@/lib/game/settings";
import type { GameState } from "@/lib/game/types";

const game: GameState = {
    id: "abc12345",
    version: 3,
    createdAt: 0,
    updatedAt: 0,
    playArea: null,
    zone: null,
    settings: defaultGameSettings("medium", "switzerland"),
    questions: {},
    photoRequests: [],
    photos: [{ id: "p1.jpg", by: "Ben", at: 5 }],
    curses: [],
    powerups: [],
    endgame: null,
    clock: null,
    deck: null,
    move: null,
    moves: [],
    hider: null,
    hasHider: true,
    hiderReadyAt: null,
    teams: [],
    hiderTeamId: null,
    nextHiderTeamId: null,
    lateAnswers: 0,
    freeQuestions: 0,
    clockRequest: null,
    restRequest: null,
    restWindow: null,
    deleteRequests: {},
    revealedPin: null,
    hiderName: null,
    awards: [],
    rounds: [],
};

describe("the game file", () => {
    it("holds the game, who saved it and links to the photos", () => {
        const now = new Date("2026-10-15T20:00:00Z");
        const file = JSON.parse(gameFile(game, "seeker", now));
        expect(file.exportedAt).toBe("2026-10-15T20:00:00.000Z");
        expect(file.role).toBe("seeker");
        expect(file.game.id).toBe("abc12345");
        expect(file.photos[0].url).toBe(photoUrl("abc12345", "p1.jpg"));
        expect(gameFileName(game, now)).toBe(
            "jetlag-game-abc12345-2026-10-15.json",
        );
    });
});
