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

describe("the hiding spot", () => {
    it("is shared between the hider's phones and hidden from the seekers", () => {
        let state = fresh();
        expect(() =>
            apply(state, { type: "setHiderStation", station: null }),
        ).toThrow(/Only the hider/);
        state = apply(
            state,
            {
                type: "setHiderStation",
                station: { id: "node/5", name: "Uster", lat: 47.35, lng: 8.72 },
            },
            hider,
        );
        state = apply(
            state,
            {
                type: "setHiderPin",
                pin: { latitude: 47.351, longitude: 8.721 },
            },
            hider,
        );
        expect(state.hider).toEqual({
            station: { id: "node/5", name: "Uster", lat: 47.35, lng: 8.72 },
            pin: { latitude: 47.351, longitude: 8.721 },
        });
        expect(viewFor(state, "hider").hider?.station?.name).toBe("Uster");
        expect(viewFor(state, "seeker").hider).toBeNull();
        expect(() =>
            apply(
                state,
                { type: "setHiderPin", pin: { latitude: "x" } },
                hider,
            ),
        ).toThrow(/isn't a position/);

        // A move means a new station; the pin stays. A new round clears both.
        state = apply(state, { type: "move", station: null }, hider);
        expect(state.hider?.station).toBeNull();
        expect(state.hider?.pin?.latitude).toBe(47.351);
        state = apply(state, { type: "newRound" });
        expect(state.hider).toEqual({ station: null, pin: null });
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

describe("the virtual deck", () => {
    const virtual = () =>
        newGameState(
            "g2",
            {
                playArea: { kind: "place" },
                zone: {},
                settings: {
                    ...defaultGameSettings("medium", "switzerland"),
                    deck: "virtual",
                },
            },
            1000,
        );

    it("owes the hider draws for answered questions, more when asked again", () => {
        let state = virtual();
        expect(state.deck?.remaining.length).toBe(100);
        state = apply(state, {
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
                basedOn: 5000,
            },
            hider,
            5000,
        );
        // The draw is dealt at once: 2 cards to pick 1 from.
        expect(state.deck?.owed).toEqual([]);
        expect(state.deck?.pending).toHaveLength(2);
        expect(state.deck?.pendingKeep).toBe(1);
        // Changing the answer doesn't earn another draw.
        state = apply(
            state,
            {
                type: "answerQuestion",
                key: 1,
                answer: { within: true },
                basedOn: 6000,
            },
            hider,
            6000,
        );
        expect(state.deck?.owed).toHaveLength(0);
        state = apply(state, { type: "keepCards", picks: [0] }, hider);
        expect(state.deck?.hand).toHaveLength(1);
        // The same question (5 km radar) a second time: two draws, one
        // dealt now, the other queued.
        state = apply(state, {
            type: "putQuestion",
            question: radius(2),
            state: "asked",
        });
        state = apply(
            state,
            {
                type: "answerQuestion",
                key: 2,
                answer: { within: true },
                basedOn: 7000,
            },
            hider,
            7000,
        );
        expect(state.deck?.pending).toHaveLength(2);
        expect(state.deck?.owed.map((d) => d.label)).toEqual([
            "Radar (asked again)",
        ]);
        state = apply(state, { type: "keepCards", picks: [1] }, hider);
        expect(state.deck?.pending).toHaveLength(2);
        expect(state.deck?.owed).toEqual([]);
    });

    it("vetoes a question with the card, and swaps cards with the powerups", () => {
        let state = virtual();
        state = apply(state, {
            type: "putQuestion",
            question: radius(1),
            state: "asked",
        });
        expect(() =>
            apply(state, { type: "vetoQuestion", key: 1 }, hider),
        ).toThrow(/No Veto card/);
        state.deck!.hand = [
            "powerup_veto_question",
            "powerup_discard_1_draw_2",
            "curse_cairn",
            "time_bonus_5",
        ];
        state = apply(state, { type: "vetoQuestion", key: 1 }, hider);
        expect(state.questions["1"].state).toBe("vetoed");
        expect(state.powerups.at(-1)?.name).toBe("Veto Question");
        expect(state.deck?.hand).toEqual([
            "powerup_discard_1_draw_2",
            "curse_cairn",
            "time_bonus_5",
        ]);
        expect(state.deck?.pending).toEqual([]);

        // Discard 1, draw 2: one other card goes, two come (and are kept).
        expect(() =>
            apply(state, { type: "playCard", index: 0 }, hider),
        ).toThrow(/Choose 1 other card/);
        state = apply(
            state,
            { type: "playCard", index: 0, discards: [2] },
            hider,
        );
        // Two cards drawn and kept at once: nothing to choose.
        expect(state.deck?.hand).toHaveLength(3);
        expect(state.deck?.hand[0]).toBe("curse_cairn");
        expect(state.deck?.pending).toEqual([]);
    });

    it("Move puts the questions away, freezes the seekers, and resumes on request", () => {
        let state = virtual();
        state = apply(state, {
            type: "putQuestion",
            question: radius(1),
            state: "asked",
        });
        state = apply(state, { type: "clock", action: "start" }, seeker, 1000);
        state.deck!.hand = ["powerup_move", "time_bonus_5"];
        state = apply(
            state,
            {
                type: "playCard",
                index: 0,
                station: { id: "node/5", name: "Uster", lat: 47.35, lng: 8.72 },
            },
            hider,
            5000,
        );
        expect(state.move).toMatchObject({
            station: { name: "Uster" },
            startedAt: 5000,
            by: "Ben",
        });
        expect(state.questions).toEqual({});
        expect(state.moves[0].questions).toHaveLength(1);
        expect(state.deck?.hand).toEqual([]);
        expect(state.clock?.pausedAt).toBe(5000);
        expect(state.powerups.at(-1)?.name).toBe("Move");
        expect(() =>
            apply(state, { type: "putQuestion", question: radius(2) }),
        ).toThrow(/on the move/);

        state = apply(state, { type: "resumeMove" }, hider, 9000);
        expect(state.move).toBeNull();
        expect(state.clock?.pausedAt).toBeNull();
        expect(state.clock?.pausedMs).toBe(4000);
        state = apply(state, { type: "putQuestion", question: radius(2) });
        expect(state.questions["2"].state).toBe("draft");

        // With the real deck, Move is an op of its own.
        let real = apply(fresh(), { type: "move", station: null }, hider);
        expect(real.move?.station).toBeNull();
        real = apply(real, { type: "newRound" });
        expect(real.move).toBeNull();
        expect(real.rounds[0].moves).toHaveLength(1);
    });

    it("draws, keeps, plays and hides the hand from the seekers", () => {
        let state = virtual();
        expect(() => apply(state, { type: "drawCards" }, hider)).toThrow(
            /Nothing to draw/,
        );
        state = apply(
            state,
            {
                type: "drawCards",
                extra: { draw: 3, keep: 1, label: "Matching" },
            },
            hider,
        );
        expect(state.deck?.pending).toHaveLength(3);
        expect(state.deck?.log[0].text).toMatch(/Ben drew 3 extra cards/);
        expect(() => apply(state, { type: "keepCards", picks: [0] })).toThrow(
            /Only the hider/,
        );
        state = apply(state, { type: "keepCards", picks: [1] }, hider);
        expect(state.deck?.hand).toHaveLength(1);
        expect(state.deck?.pending).toEqual([]);

        const seekersView = viewFor(state, "seeker");
        expect(seekersView.deck?.hand).toEqual([]);
        expect(seekersView.deck?.handSize).toBe(1);
        expect(viewFor(state, "hider").deck?.hand).toHaveLength(1);

        // Playing a curse from the hand casts it for everyone.
        state.deck!.hand = ["curse_cairn", "time_bonus_5", "powerup_move"];
        state = apply(state, { type: "playCard", index: 0 }, hider);
        expect(state.curses[0].name).toBe("Curse of the Cairn");
        expect(state.deck?.hand).toEqual(["time_bonus_5", "powerup_move"]);
        expect(() =>
            apply(state, { type: "playCard", index: 0 }, hider),
        ).toThrow(/only discarded/);
        // Move discards the whole hand.
        state = apply(state, { type: "playCard", index: 1 }, hider);
        expect(state.powerups[0].name).toBe("Move");
        expect(state.deck?.hand).toEqual([]);
    });

    it("works the bonuses out from the hand, and reshuffles for a new round", () => {
        let state = virtual();
        state.deck!.hand = ["time_bonus_10", "time_bonus_5"];
        state = apply(state, { type: "clock", action: "start" }, seeker, 1000);
        state = apply(state, { type: "clock", action: "stop" }, seeker, 2000);
        state = apply(state, { type: "setBonus", minutes: 99 }, hider);
        expect(state.clock?.bonusMinutes).toBe(6 + 3);

        state = apply(state, { type: "newRound" });
        expect(state.deck?.hand).toEqual([]);
        // A whole new shuffled deck.
        expect(state.deck?.remaining.length).toBe(
            virtual().deck!.remaining.length,
        );
        expect(state.rounds[0].deck?.hand).toEqual([
            "time_bonus_10",
            "time_bonus_5",
        ]);
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

describe("the answer timer and the scoreboard", () => {
    it("records when a question was sent to the hider", () => {
        let state = apply(fresh(), {
            type: "putQuestion",
            question: radius(1),
        });
        expect(state.questions["1"].askedAt).toBeUndefined();
        state = apply(state, { type: "sendQuestion", key: 1 }, seeker, 5000);
        expect(state.questions["1"].askedAt).toBe(5000);
        // The hider's own questions are asked from the start.
        state = apply(
            state,
            { type: "putQuestion", question: radius(2) },
            hider,
            6000,
        );
        expect(state.questions["2"].askedAt).toBe(6000);
    });

    it("remembers who hid, round by round", () => {
        let state = apply(fresh(), { type: "clock", action: "start" }, hider);
        expect(state.hiderName).toBe("Ben");
        state = apply(state, { type: "newRound" }, seeker);
        expect(state.rounds[0].hiderName).toBe("Ben");
        expect(state.hiderName).toBeNull();
        // Someone with no name set doesn't count.
        state = apply(
            state,
            { type: "clock", action: "start" },
            {
                name: "Someone",
                role: "hider",
            },
        );
        expect(state.hiderName).toBeNull();
    });
});

describe("Curse of the Overflowing Chalice", () => {
    const digital = () =>
        newGameState(
            "g2",
            {
                playArea: {},
                zone: {},
                settings: {
                    ...defaultGameSettings("medium", "switzerland"),
                    deck: "virtual",
                },
            },
            1000,
        );

    it("adds a card to each of the next three draws, then clears itself", () => {
        let state = apply(
            digital(),
            { type: "castCurse", name: "Curse of the Overflowing Chalice" },
            hider,
        );
        expect(state.deck!.chaliceLeft).toBe(3);
        for (let key = 1; key <= 4; key++) {
            state = apply(state, {
                type: "putQuestion",
                question: radius(key, { radius: key }),
                state: "asked",
            });
            state = apply(
                state,
                {
                    type: "answerQuestion",
                    key,
                    answer: { within: true },
                    basedOn: 2000,
                },
                hider,
                3000 + key,
            );
            // Each draw is dealt at once: one card more while the curse is on.
            expect(state.deck!.pending.length).toBe(key <= 3 ? 3 : 2);
            expect(state.deck!.pendingKeep).toBe(1);
            // Keep one so the next draw can be dealt.
            state = apply(state, { type: "keepCards", picks: [0] }, hider);
        }
        expect(state.deck!.chaliceLeft).toBe(0);
        const curse = state.curses.find(
            (c) => c.name === "Curse of the Overflowing Chalice",
        )!;
        expect(curse.clearedBy).toBe("the game");
    });

    it("does nothing with the real deck (the hider draws by hand)", () => {
        const state = apply(
            fresh(),
            { type: "castCurse", name: "Curse of the Overflowing Chalice" },
            hider,
        );
        expect(state.deck).toBeNull();
        expect(state.curses).toHaveLength(1);
    });
});

describe("Randomize Question", () => {
    const asked = (question: SharedQuestion, state = fresh()) =>
        apply(state, { type: "putQuestion", question, state: "asked" });

    it("turns an asked question into another of its kind, unasked this round", () => {
        let state = asked(radius(1, { radius: 5, unit: "kilometers" }));
        state = apply(
            state,
            { type: "randomizeQuestion", key: 1 },
            hider,
            3000,
        );
        const entry = state.questions["1"];
        expect(entry.state).toBe("asked");
        expect(entry.question.data.radius).not.toBe(5);
        expect(entry.question.data.unit).toBe("kilometers");
        expect(entry.randomizedFrom).toBe("Radar 5 km");
        expect(entry.updatedAt).toBe(3000);
        expect(state.powerups.at(-1)?.name).toBe("Randomize Question");
    });

    it("only picks kinds the game allows and hasn't had yet", () => {
        let state = fresh();
        // Every matching type but one has been asked.
        const types = [
            "airport",
            "major-city",
            "zone",
            "letter-zone",
            "same-first-letter-station",
            "same-length-station",
            "same-train-line",
        ];
        const leftOut = [
            "aquarium",
            "hospital",
            "museum",
            "theme_park",
            "zoo",
            "cinema",
            "library",
            "golf_course",
            "consulate",
            "park",
            "aquarium-full",
            "zoo-full",
            "theme_park-full",
            "museum-full",
            "hospital-full",
            "cinema-full",
            "library-full",
            "golf_course-full",
            "consulate-full",
            "park-full",
        ];
        state = {
            ...state,
            settings: {
                ...state.settings,
                disabledQuestions: [
                    ...state.settings.disabledQuestions,
                    ...leftOut.map((type) => `matching:${type}`),
                    "matching:same-train-line",
                ],
            },
        };
        types
            .filter((type) => type !== "same-train-line")
            .forEach((type, index) => {
                if (type === "letter-zone") return;
                state = asked(
                    {
                        id: "matching",
                        key: index + 1,
                        data: { lat: 1, lng: 2, type, cat: { adminLevel: 4 } },
                    } as SharedQuestion,
                    state,
                );
            });
        state = apply(state, { type: "randomizeQuestion", key: 1 }, hider);
        expect(state.questions["1"].question.data.type).toBe("letter-zone");
        expect(state.questions["1"].question.data.cat).toEqual({
            adminLevel: 4,
        });
        // Nothing is left now.
        expect(() =>
            apply(state, { type: "randomizeQuestion", key: 2 }, hider),
        ).toThrow(/nothing to randomize to/);
    });

    it("is the hider's, for questions waiting for an answer, and not for thermometers", () => {
        const state = asked(radius(1));
        expect(() =>
            apply(state, { type: "randomizeQuestion", key: 1 }, seeker),
        ).toThrow(GameRuleError);
        const answered = apply(
            state,
            {
                type: "answerQuestion",
                key: 1,
                answer: { within: true },
                basedOn: 2000,
            },
            hider,
        );
        expect(() =>
            apply(answered, { type: "randomizeQuestion", key: 1 }, hider),
        ).toThrow(/waiting for an answer/);
        const thermo = asked({
            id: "thermometer",
            key: 9,
            data: { latA: 1, lngA: 2, latB: 3, lngB: 4 },
        } as SharedQuestion);
        expect(() =>
            apply(thermo, { type: "randomizeQuestion", key: 9 }, hider),
        ).toThrow(/no variants/);
    });

    it("with the digital deck it costs the card", () => {
        let state = newGameState(
            "g3",
            {
                playArea: {},
                zone: {},
                settings: {
                    ...defaultGameSettings("medium", "switzerland"),
                    deck: "virtual",
                },
            },
            1000,
        );
        state = asked(radius(1), state);
        expect(() =>
            apply(state, { type: "randomizeQuestion", key: 1 }, hider),
        ).toThrow(/No Randomize Question card/);
        state = {
            ...state,
            deck: {
                ...state.deck!,
                hand: ["powerup_randomize_question", "time_5"],
            },
        };
        state = apply(state, { type: "randomizeQuestion", key: 1 }, hider);
        expect(state.deck!.hand).toEqual(["time_5"]);
    });
});
