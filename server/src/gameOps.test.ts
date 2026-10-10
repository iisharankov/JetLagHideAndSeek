import { describe, expect, it } from "vitest";

import { defaultGameSettings } from "@/lib/game/settings";
import type { GameState, SharedQuestion } from "@/lib/game/types";

import {
    type Actor,
    applyOp,
    GameRuleError,
    newGameState,
    viewFor,
} from "./gameOps";

const radius = (key: number, data: Record<string, unknown> = {}) =>
    ({
        id: "radius",
        key,
        data: { lat: 47.37, lng: 8.54, radius: 5, within: true, ...data },
    }) as SharedQuestion;

const seeker: Actor = { name: "Ana", role: "seeker" };
const hider: Actor = { name: "Ben", role: "hider" };

const fresh = () =>
    newGameState(
        "g1",
        {
            playArea: { kind: "place" },
            zone: {},
            settings: defaultGameSettings("medium", "switzerland"),
        },
        1000,
    );

const apply = (state: GameState, op: any, actor: Actor = seeker, now = 2000) =>
    applyOp(state, op, actor, now);

describe("questions", () => {
    it("a seeker's new question is a draft the hider can't see", () => {
        const state = apply(fresh(), {
            type: "putQuestion",
            question: radius(1),
        });
        expect(state.questions["1"].state).toBe("draft");
        expect(state.questions["1"].createdBy).toBe("Ana");
        expect(viewFor(state, "seeker").questions["1"]).toBeDefined();
        expect(viewFor(state, "hider").questions["1"]).toBeUndefined();
    });

    it("sending a question to the hider makes it visible to them", () => {
        let state = apply(fresh(), {
            type: "putQuestion",
            question: radius(1),
        });
        state = apply(state, { type: "sendQuestion", key: 1 });
        expect(state.questions["1"].state).toBe("asked");
        expect(viewFor(state, "hider").questions["1"]).toBeDefined();
    });

    it("the hider's answer only changes the answer fields", () => {
        let state = apply(fresh(), {
            type: "putQuestion",
            question: radius(1),
            state: "asked",
        });
        state = apply(
            state,
            {
                type: "answerQuestion",
                key: 1,
                answer: { within: false, radius: 99 },
                basedOn: state.questions["1"].updatedAt,
            },
            hider,
            3000,
        );
        const entry = state.questions["1"];
        expect(entry.state).toBe("answered");
        expect(entry.question.data.within).toBe(false);
        expect(entry.question.data.radius).toBe(5); // not an answer field
        expect(entry.answeredAt).toBe(3000);
    });

    it("refuses an answer worked out for an older version of the question", () => {
        let state = apply(fresh(), {
            type: "putQuestion",
            question: radius(1),
            state: "asked",
        });
        const asked = state.questions["1"].updatedAt;
        state = apply(
            state,
            { type: "putQuestion", question: radius(1, { radius: 10 }) },
            seeker,
            2500,
        );
        expect(() =>
            apply(
                state,
                {
                    type: "answerQuestion",
                    key: 1,
                    answer: { within: false },
                    basedOn: asked,
                },
                hider,
            ),
        ).toThrow(GameRuleError);
    });

    it("only the hider answers, unless the game lets seekers", () => {
        let state = apply(fresh(), {
            type: "putQuestion",
            question: radius(1),
            state: "asked",
        });
        const answer = {
            type: "answerQuestion",
            key: 1,
            answer: { within: true },
            basedOn: state.questions["1"].updatedAt,
        };
        expect(() => apply(state, answer, seeker)).toThrow(/Only the hider/);

        state = apply(
            state,
            { type: "setSettings", settings: { seekersCanAnswer: true } },
            hider,
        );
        expect(apply(state, answer, seeker).questions["1"].state).toBe(
            "answered",
        );
    });

    it("seekers can't change or delete an answered question", () => {
        let state = apply(fresh(), {
            type: "putQuestion",
            question: radius(1),
            state: "asked",
        });
        state = apply(
            state,
            {
                type: "answerQuestion",
                key: 1,
                answer: { within: false },
                basedOn: state.questions["1"].updatedAt,
            },
            hider,
        );
        expect(() =>
            apply(state, {
                type: "putQuestion",
                question: radius(1, { lat: 46 }),
            }),
        ).toThrow(/answered/);
        expect(() => apply(state, { type: "deleteQuestion", key: 1 })).toThrow(
            /answered/,
        );
        // The hider can.
        expect(
            apply(state, { type: "deleteQuestion", key: 1 }, hider).questions[
                "1"
            ],
        ).toBeUndefined();
    });

    it("the hider can't touch the seekers' drafts", () => {
        const state = apply(fresh(), {
            type: "putQuestion",
            question: radius(1),
        });
        expect(() =>
            apply(state, { type: "deleteQuestion", key: 1 }, hider),
        ).toThrow(GameRuleError);
    });

    it("last change wins and says who made it", () => {
        let state = apply(fresh(), {
            type: "putQuestion",
            question: radius(1),
        });
        state = apply(
            state,
            { type: "putQuestion", question: radius(1, { radius: 7 }) },
            { name: "Cleo", role: "seeker" },
            2500,
        );
        expect(state.questions["1"].question.data.radius).toBe(7);
        expect(state.questions["1"].updatedBy).toBe("Cleo");
        expect(state.questions["1"].createdBy).toBe("Ana");
    });

    it("never stores a phone's own view settings", () => {
        const state = apply(fresh(), {
            type: "putQuestion",
            question: radius(1, { collapsed: true, hidden: true, drag: true }),
        });
        const data = state.questions["1"].question.data;
        expect(data.collapsed).toBeUndefined();
        expect(data.hidden).toBeUndefined();
        expect(data.drag).toBeUndefined();
    });
});

describe("settings", () => {
    it("are fixed once the game has started", () => {
        expect(() =>
            apply(
                fresh(),
                { type: "setSettings", settings: { size: "large" } },
                hider,
            ),
        ).toThrow(/fixed once the game has started/);
        expect(() =>
            apply(
                fresh(),
                {
                    type: "setSettings",
                    settings: {
                        stationKinds: {
                            halts: true,
                            trams: true,
                            boats: false,
                        },
                    },
                },
                hider,
            ),
        ).toThrow(/fixed/);
    });

    it("let the hider widen the hiding zone and let seekers answer", () => {
        expect(() =>
            apply(fresh(), {
                type: "setSettings",
                settings: { seekersCanAnswer: true },
            }),
        ).toThrow(/Only the hider/);
        expect(() =>
            apply(fresh(), {
                type: "setSettings",
                settings: { hidingRadiusKm: 1 },
            }),
        ).toThrow(/Only the hider/);
        const changed = apply(
            fresh(),
            {
                type: "setSettings",
                settings: { hidingRadiusKm: 1, seekersCanAnswer: true },
            },
            hider,
        );
        expect(changed.settings.hidingRadiusKm).toBe(1);
        expect(changed.settings.seekersCanAnswer).toBe(true);
        expect(changed.settings.size).toBe("medium");
        expect(() =>
            apply(
                fresh(),
                { type: "setSettings", settings: { hidingRadiusKm: 500 } },
                hider,
            ),
        ).toThrow(/up to 50 km/);
    });
});

describe("photos and curses", () => {
    it("seekers ask for photos; the hider casts curses; anyone clears them", () => {
        let state = apply(fresh(), { type: "askPhoto", name: "Tree" });
        expect(state.photoRequests[0]).toMatchObject({
            name: "Tree",
            askedBy: "Ana",
        });

        expect(() =>
            apply(state, { type: "castCurse", name: "Curse of the Cairn" }),
        ).toThrow(/Only the hider/);
        state = apply(
            state,
            { type: "castCurse", name: "Curse of the Cairn" },
            hider,
        );
        const curse = state.curses[0];
        expect(curse.name).toBe("Curse of the Cairn");

        state = apply(
            state,
            { type: "clearCurse", id: curse.id },
            seeker,
            5000,
        );
        expect(state.curses[0]).toMatchObject({
            clearedAt: 5000,
            clearedBy: "Ana",
        });
    });
});

describe("powerups", () => {
    it("the hider plays them, everyone sees which and when, a new round puts them away", () => {
        expect(() =>
            apply(fresh(), { type: "playPowerup", name: "Move" }),
        ).toThrow(/Only the hider/);
        let state = apply(
            fresh(),
            { type: "playPowerup", name: "Move" },
            hider,
            7000,
        );
        expect(state.powerups[0]).toMatchObject({
            name: "Move",
            playedAt: 7000,
            by: "Ben",
        });

        state = apply(state, { type: "newRound" }, seeker, 9000);
        expect(state.powerups).toEqual([]);
        expect(state.rounds[0].powerups).toHaveLength(1);
    });
});

describe("end game", () => {
    it("keeps only the picked station's zone: earlier questions no longer count", () => {
        let state = apply(fresh(), {
            type: "putQuestion",
            question: radius(1),
        });
        state = apply(state, {
            type: "putQuestion",
            question: radius(2),
            state: "asked",
        });
        expect(() =>
            apply(state, { type: "startEndgame", station: { id: "x" } }),
        ).toThrow(/Pick a station/);

        state = apply(
            state,
            {
                type: "startEndgame",
                station: { id: "node/5", name: "Uster", lat: 47.35, lng: 8.72 },
            },
            seeker,
            8000,
        );
        expect(state.endgame).toMatchObject({
            station: { id: "node/5", name: "Uster" },
            startedAt: 8000,
            by: "Ana",
        });
        // The draft counts as "before" too: the server knows every question.
        expect(state.endgame!.before.sort()).toEqual([1, 2]);

        state = apply(state, {
            type: "putQuestion",
            question: radius(3),
            state: "asked",
        });
        expect(state.endgame!.before).not.toContain(3);

        state = apply(state, { type: "endEndgame" });
        expect(state.endgame).toBeNull();
    });

    it("ends with the round", () => {
        let state = apply(fresh(), {
            type: "startEndgame",
            station: { id: "node/5", name: "Uster", lat: 47.35, lng: 8.72 },
        });
        state = apply(state, { type: "newRound" });
        expect(state.endgame).toBeNull();
        expect(state.rounds[0].endgame?.station.id).toBe("node/5");
    });
});

describe("the hiding clock", () => {
    it("runs for everyone; the hider adds bonuses once it's stopped", () => {
        let state = apply(
            fresh(),
            { type: "clock", action: "start" },
            seeker,
            1000,
        );
        expect(state.clock?.startedAt).toBe(1000);
        expect(() =>
            apply(state, { type: "setBonus", minutes: 5 }, hider),
        ).toThrow(/still running/);
        expect(() => apply(state, { type: "clock", action: "dance" })).toThrow(
            /Unknown clock action/,
        );

        state = apply(state, { type: "clock", action: "pause" }, hider, 2000);
        state = apply(state, { type: "clock", action: "resume" }, hider, 3000);
        state = apply(state, { type: "clock", action: "stop" }, seeker, 4000);
        expect(state.clock).toMatchObject({
            startedAt: 1000,
            pausedMs: 1000,
            stoppedAt: 4000,
        });
        expect(() => apply(state, { type: "setBonus", minutes: 5 })).toThrow(
            /Only the hider/,
        );
        state = apply(state, { type: "setBonus", minutes: 5 }, hider);
        expect(state.clock?.bonusMinutes).toBe(5);

        state = apply(state, { type: "newRound" });
        expect(state.clock).toBeNull();
        expect(state.rounds[0].clock?.bonusMinutes).toBe(5);
    });
});

describe("new round", () => {
    it("keeps the finished round and starts empty, with no hider", () => {
        let state = apply(fresh(), {
            type: "putQuestion",
            question: radius(1),
            state: "asked",
        });
        state = { ...state, hasHider: true };
        state = apply(state, { type: "newRound" }, seeker, 9000);
        expect(state.questions).toEqual({});
        expect(state.hasHider).toBe(false);
        expect(state.rounds).toHaveLength(1);
        expect(state.rounds[0].questions).toHaveLength(1);
        expect(state.rounds[0].endedAt).toBe(9000);
    });
});

describe("versions", () => {
    it("every change bumps the version and the update time", () => {
        const before = fresh();
        const after = apply(before, { type: "askPhoto", name: "Tree" });
        expect(after.version).toBe(before.version + 1);
        expect(after.updatedAt).toBe(2000);
        expect(before.photoRequests).toEqual([]); // not mutated
    });
});
