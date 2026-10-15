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

    it("warns the hider about late answers and tells the other side about requests", () => {
        const before = { ...base(), questions: { "1": entry("asked") } };
        const late: GameState = {
            ...base(),
            questions: {
                "1": { ...entry("answered", { within: true }), late: 3 },
            },
            clockRequest: { action: "pause", by: "Ana", role: "seeker", at: 5 },
            deleteRequests: { "1": { by: "Ana", role: "seeker", at: 6 } },
        };
        const hider = gameEvents(before, late, "hider");
        expect(hider.map((e) => e.kind)).toEqual(["late", "clock", "delete"]);
        expect(hider[0].title).toBe("Third late answer");
        expect(hider[1].title).toBe("Ana asks to pause the clock");
        expect(hider[2].body).toMatch(/^Radar 5 km: agree/);
        // The seekers hear about the free question, not their own requests.
        const seekers = gameEvents(before, late, "seeker");
        expect(seekers.map((e) => e.kind)).toEqual(["late", "answer"]);
        expect(seekers[0].title).toBe("Your next question is free");
    });

    it("announces a new round and the team that hides next", () => {
        const teams = [
            { id: "t1", name: "Foxes", members: ["Ben"] },
            { id: "t2", name: "Owls", members: ["Ana"] },
        ];
        const before: GameState = { ...base(), teams };
        const claimed: GameState = { ...base(), teams, nextHiderTeamId: "t2" };
        expect(
            gameEvents(before, claimed, "seeker").map((e) => e.title),
        ).toEqual(["Owls hides next"]);
        const next: GameState = {
            ...base(),
            teams,
            hiderTeamId: "t2",
            rounds: [
                {
                    endedAt: 9,
                    questions: [],
                    photoRequests: [],
                    curses: [],
                    powerups: [],
                },
            ],
        };
        const events = gameEvents(claimed, next, "hider");
        expect(events.map((e) => e.kind)).toEqual(["round"]);
        expect(events[0].body).toBe("Team Owls hides. Say who you are.");
    });

    it("tells the seekers the hider is in place, and what a photo question became", () => {
        const before = base();
        const after: GameState = {
            ...base(),
            hiderReadyAt: 9,
            powerups: [
                {
                    id: "p2",
                    name: "Randomize Question",
                    playedAt: 7,
                    by: "Ben",
                },
            ],
            photoRequests: [
                {
                    id: "r1",
                    name: "Bench",
                    askedBy: "Ana",
                    askedAt: 3,
                    randomizedFrom: "Tree",
                    randomizedAt: 7,
                    askedAs: ["Tree"],
                },
            ],
        };
        const events = gameEvents(before, after, "seeker");
        expect(events.map((e) => e.kind)).toEqual(["hider", "powerup"]);
        expect(events[0].title).toBe("The hider is in place");
        expect(events[1].body).toBe(
            "Photo: Tree became Photo: Bench; the hider sends that instead.",
        );
        // Nothing new the second time round.
        expect(gameEvents(after, after, "seeker")).toEqual([]);
        // The hider hears about the new photo question, not about themselves.
        expect(gameEvents(before, after, "hider").map((e) => e.kind)).toEqual([
            "photoRequest",
        ]);
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
                endsAt: 1200006,
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
