import { describe, expect, it } from "vitest";

import { historyEntries } from "@/lib/game/history";
import { defaultGameSettings } from "@/lib/game/settings";
import type { GameState, QuestionEntry } from "@/lib/game/types";

const base = (): GameState =>
    ({
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
        hiderReadyAt: null,
        players: {},
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
    }) as unknown as GameState;

const radar = (overrides: Partial<QuestionEntry>): QuestionEntry => ({
    question: {
        id: "radius",
        key: 1,
        data: {
            lat: 47.4,
            lng: 8.5,
            radius: 10,
            unit: "kilometers",
            within: true,
        },
    },
    state: "answered",
    createdBy: "Ana",
    createdAt: 100,
    updatedBy: "Ben",
    updatedAt: 300,
    askedAt: 200,
    answeredAt: 300,
    ...overrides,
});

describe("the game's history", () => {
    it("lists questions asked and answered, photos, curses and cards, newest first", () => {
        const state = {
            ...base(),
            hiderReadyAt: 50,
            questions: { "1": radar({}) },
            photoRequests: [
                {
                    id: "r1",
                    name: "Tree",
                    askedBy: "Ana",
                    askedAt: 400,
                    photoId: "a.jpg",
                    answeredAt: 500,
                },
                {
                    id: "r2",
                    name: "The Sky",
                    askedBy: "Cem",
                    askedAt: 600,
                    nullAnswer: true,
                    answeredAt: 650,
                },
            ],
            curses: [
                {
                    id: "c1",
                    name: "Curse of the Cairn",
                    by: "Ben",
                    castAt: 700,
                    clearedAt: 800,
                    clearedBy: "Ana",
                },
            ],
            powerups: [
                {
                    id: "p1",
                    name: "Randomize Question",
                    playedAt: 900,
                    by: "Ben",
                    detail: "Radar 5 km → Radar 15 km",
                },
            ],
        } as unknown as GameState;
        const lines = historyEntries(state).map((e) => `${e.at} ${e.text}`);
        expect(lines).toEqual([
            "900 Ben played Randomize Question: Radar 5 km → Radar 15 km",
            "800 Ana cleared Curse of the Cairn",
            "700 The hider cast Curse of the Cairn",
            "650 The hider can't answer the photo: The Sky",
            "600 Cem asked for a photo: The Sky",
            "500 The hider sent the photo: Tree",
            "400 Ana asked for a photo: Tree",
            "300 Ben answered Radar 10 km: Yes",
            "200 Ana asked Radar 10 km",
            "50 The hider picked their station",
        ]);
    });

    it("says when a question was vetoed, and when a thermometer started", () => {
        const state = {
            ...base(),
            questions: {
                "1": radar({ state: "vetoed", answeredAt: undefined }),
                "2": {
                    ...radar({}),
                    question: {
                        id: "thermometer",
                        key: 2,
                        data: {
                            latA: 47.4,
                            lngA: 8.5,
                            latB: null,
                            lngB: null,
                            distanceKm: 5,
                            armedAt: 1000,
                        },
                    },
                    state: "armed",
                    askedAt: undefined,
                    answeredAt: undefined,
                    updatedAt: 1000,
                },
            },
        } as unknown as GameState;
        const lines = historyEntries(state).map((e) => e.text);
        expect(lines).toContain("Ana started Thermometer 5 km");
        expect(lines).toContain("Ben vetoed Radar 10 km");
        expect(lines).toContain("Ana asked Radar 10 km");
    });
});
