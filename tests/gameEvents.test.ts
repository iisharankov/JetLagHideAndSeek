import { describe, expect, it } from "vitest";

import { gameEvents } from "@/lib/game/events";
import { defaultGameSettings } from "@/lib/game/settings";
import type { GameState, QuestionEntry } from "@/lib/game/types";

const base = (): GameState => ({
    id: "g1",
    version: 1,
    createdAt: 0,
    updatedAt: 0,
    playArea: null,
    zone: null,
    settings: defaultGameSettings("medium", "switzerland"),
    questions: {},
    photoRequests: [],
    photos: [],
    curses: [],
    powerups: [],
    endgame: null,
    clock: null,
    deck: null,
    move: null,
    moves: [],
    hider: null,
    hasHider: true,
    hiderName: null,
    rounds: [],
});

const entry = (
    state: QuestionEntry["state"],
    data: Record<string, unknown> = {},
): QuestionEntry => ({
    question: {
        id: "radius",
        key: 1,
        data: { lat: 47, lng: 8, radius: 5, ...data },
    },
    state,
    createdBy: "Ana",
    createdAt: 1,
    updatedBy: "Ana",
    updatedAt: 2,
});

describe("game events", () => {
    it("tells the hider about new questions and photo questions, not drafts", () => {
        const before = { ...base(), questions: { "1": entry("draft") } };
        const after = {
            ...base(),
            questions: { "1": entry("asked") },
            photoRequests: [
                { id: "r1", name: "Tree", askedBy: "Ana", askedAt: 3 },
            ],
        };
        expect(gameEvents(before, after, "hider")).toEqual([
            {
                key: "q1",
                kind: "question",
                title: "New question",
                body: "Radar 5 km, from Ana",
            },
            {
                key: "prr1",
                kind: "photoRequest",
                title: "Photo question",
                body: "Tree, from Ana",
            },
        ]);
        // A seeker hears nothing about their own question being sent.
        expect(gameEvents(before, after, "seeker")).toEqual([]);
        // The first state of a game is never news.
        expect(gameEvents(null, after, "hider")).toEqual([]);
    });

    it("tells the seekers about answers, vetoes, cards and moves", () => {
        const before = { ...base(), questions: { "1": entry("asked") } };
        const after: GameState = {
            ...base(),
            questions: { "1": entry("answered", { within: true }) },
            curses: [{ id: "c1", name: "Curse of the Cairn", castAt: 5 }],
            powerups: [{ id: "p1", name: "Move", playedAt: 6, by: "Ben" }],
            move: {
                station: { id: "node/1", name: "Uster", lat: 47.3, lng: 8.7 },
                startedAt: 6,
                by: "Ben",
            },
        };
        const events = gameEvents(before, after, "seeker");
        expect(events.map((e) => e.kind)).toEqual(["answer", "curse", "move"]);
        expect(events[0].body).toMatch(/^Radar 5 km: /);
        expect(events[1].name).toBe("Curse of the Cairn");
        expect(events[2].body).toMatch(/was at Uster/);
        expect(gameEvents(before, after, "hider")).toEqual([]);
    });
});
