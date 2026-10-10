import { describe, expect, it } from "vitest";

import { CARDS } from "@/lib/game/deck";
import { defaultGameSettings } from "@/lib/game/settings";
import type { GameState, SharedQuestion } from "@/lib/game/types";
import { photoNamesFor } from "@/lib/rules/photoQuestions";

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
        // Deleting an answered question takes both sides: a seeker's delete
        // is a request, and the question stays until the hider agrees.
        const asked = apply(state, { type: "deleteQuestion", key: 1 });
        expect(asked.questions["1"]).toBeDefined();
        expect(asked.deleteRequests["1"]?.role).toBe("seeker");
        // The hider's delete is a request too; with both sides', it goes.
        expect(
            apply(state, { type: "deleteQuestion", key: 1 }, hider).questions[
                "1"
            ],
        ).toBeDefined();
        expect(
            apply(asked, { type: "deleteQuestion", key: 1 }, hider).questions[
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

describe("the hider's pin", () => {
    const mine = { id: "node/1", name: "Uster", lat: 47.3, lng: 8.7 };
    const other = { id: "node/2", name: "Wetzikon", lat: 47.32, lng: 8.8 };
    const pin = { latitude: 47.301, longitude: 8.701 };

    it("is fixed once the end game is on at the hider's station, and shown after the round", () => {
        let state = apply(
            fresh(),
            { type: "hiderReady", station: mine },
            hider,
            1000,
        );
        state = apply(state, { type: "setHiderPin", pin }, hider, 2000);
        state = apply(
            state,
            { type: "startEndgame", station: mine },
            seeker,
            3000,
        );
        expect(state.hider?.pinLocked).toBe(true);
        expect(() =>
            apply(
                state,
                {
                    type: "setHiderPin",
                    pin: { latitude: 47.31, longitude: 8.71 },
                },
                hider,
            ),
        ).toThrow(/pin is fixed/);
        // Not yet found: the seekers see nothing of it.
        expect(viewFor(state, "seeker").revealedPin).toBeNull();
        const found = apply(
            state,
            { type: "clock", action: "stop" },
            seeker,
            4000,
        );
        expect(viewFor(found, "seeker").revealedPin).toEqual(pin);
        expect(viewFor(found, "seeker").hider).toBeNull();
        // Undoing the end game frees the pin again.
        const undone = apply(state, { type: "endEndgame" }, seeker);
        expect(undone.hider?.pinLocked).toBe(false);
    });

    it("stays free when the seekers pick the wrong station", () => {
        let state = apply(
            fresh(),
            { type: "hiderReady", station: mine },
            hider,
            1000,
        );
        state = apply(
            state,
            { type: "startEndgame", station: other },
            seeker,
            3000,
        );
        expect(state.hider?.pinLocked).toBeUndefined();
        expect(
            apply(state, { type: "setHiderPin", pin }, hider).hider?.pin,
        ).toEqual(pin);
    });
});

describe("the hiding clock", () => {
    const station = { id: "node/1", name: "Uster", lat: 47.3, lng: 8.7 };

    it("starts by itself when the hider confirms their station", () => {
        const state = apply(
            fresh(),
            { type: "hiderReady", station },
            hider,
            4000,
        );
        expect(state.clock?.startedAt).toBe(4000);
        expect(state.clock?.pausedAt).toBeNull();
    });

    it("keeps a clock started sooner, and the end game doesn't start one", () => {
        let state = apply(
            fresh(),
            { type: "clock", action: "start" },
            seeker,
            1000,
        );
        state = apply(state, { type: "hiderReady", station }, hider, 4000);
        expect(state.clock?.startedAt).toBe(1000);
        expect(
            apply(fresh(), { type: "startEndgame", station }, seeker, 4000)
                .clock,
        ).toBeNull();
    });
});

describe("teams", () => {
    const owl: Actor = { name: "Cem", role: "seeker" };
    const station = { id: "node/1", name: "Uster", lat: 47.3, lng: 8.7 };
    const withTeams = () => {
        let state = apply(fresh(), { type: "joinTeam", name: "Foxes" }, hider);
        state = apply(state, { type: "joinTeam", name: " owls " }, seeker);
        return apply(state, { type: "joinTeam", name: "Owls" }, owl);
    };
    /** A finished round: the hider was found. */
    const over = (state: GameState) => {
        state = apply(state, { type: "hiderReady", station }, hider, 1000);
        return apply(state, { type: "clock", action: "stop" }, seeker, 5000);
    };

    it("are joined by name, made when new, and one per player", () => {
        let state = withTeams();
        expect(state.teams.map((t) => [t.name, t.members])).toEqual([
            ["Foxes", ["Ben"]],
            ["owls", ["Ana", "Cem"]],
        ]);
        state = apply(state, { type: "joinTeam", name: "Foxes" }, owl);
        expect(state.teams.map((t) => t.members)).toEqual([
            ["Ben", "Cem"],
            ["Ana"],
        ]);
        state = apply(state, { type: "leaveTeam" }, owl);
        expect(state.teams.map((t) => t.members)).toEqual([["Ben"], ["Ana"]]);
        expect(() =>
            apply(state, { type: "joinTeam", name: " " }, owl),
        ).toThrow(/Give the team a name/);
    });

    it("put the hider's team on the scoreboard", () => {
        const state = apply(
            withTeams(),
            { type: "hiderReady", station },
            hider,
        );
        expect(state.hiderName).toBe("Foxes");
    });

    it("let one team claim the next round once the round is over", () => {
        let state = withTeams();
        expect(() =>
            apply(
                state,
                { type: "claimNextRound", teamId: state.teams[1].id },
                seeker,
            ),
        ).toThrow(/isn't over yet/);
        state = over(state);
        const [foxes, owls] = state.teams;
        expect(() =>
            apply(state, { type: "claimNextRound", teamId: foxes.id }, seeker),
        ).toThrow(/own team/);
        state = apply(
            state,
            { type: "claimNextRound", teamId: owls.id },
            seeker,
        );
        expect(state.nextHiderTeamId).toBe(owls.id);
        expect(() =>
            apply(state, { type: "claimNextRound", teamId: foxes.id }, hider),
        ).toThrow(/owls already hides next/);
        // Withdrawing is the claiming team's.
        expect(() =>
            apply(state, { type: "claimNextRound", teamId: null }, hider),
        ).toThrow(/withdraw/);
        expect(
            apply(state, { type: "claimNextRound", teamId: null }, owl)
                .nextHiderTeamId,
        ).toBeNull();
    });

    it("hand the new round to the team that claimed it", () => {
        let state = over(withTeams());
        expect(() => apply(state, { type: "newRound" }, seeker)).toThrow(
            /Pick the team that hides next/,
        );
        const owls = state.teams[1];
        state = apply(state, { type: "claimNextRound", teamId: owls.id }, owl);
        state = apply(state, { type: "newRound" }, seeker);
        expect(state.rounds).toHaveLength(1);
        expect(state.rounds[0].hiderName).toBe("Foxes");
        expect(state.hiderTeamId).toBe(owls.id);
        expect(state.hiderName).toBe("owls");
        expect(state.nextHiderTeamId).toBeNull();
        expect(state.hasHider).toBe(false);
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
        // Not even how many cards the hider holds.
        expect(JSON.stringify(seekersView.deck)).not.toMatch(/Size/);
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

describe("the hider's station", () => {
    const station = { id: "node/1", name: "Uster", lat: 47.3, lng: 8.7 };

    it("tells the seekers when the hider is in place, not where", () => {
        let state = fresh();
        expect(state.hiderReadyAt).toBeNull();
        expect(() =>
            apply(state, { type: "hiderReady", station }, seeker),
        ).toThrow(/Only the hider/);
        state = apply(state, { type: "hiderReady", station }, hider, 5000);
        expect(state.hiderReadyAt).toBe(5000);
        expect(state.hider?.station).toEqual(station);
        const seen = viewFor(state, "seeker");
        expect(seen.hiderReadyAt).toBe(5000);
        expect(seen.hider).toBeNull();
        // A new round starts over.
        expect(
            apply(state, { type: "newRound" }, hider).hiderReadyAt,
        ).toBeNull();
    });

    it("needs a station", () => {
        expect(() =>
            apply(fresh(), { type: "hiderReady", station: null }, hider),
        ).toThrow(/Pick a station first/);
    });
});

describe("the late-answer penalty", () => {
    const asked = (state: GameState, key: number, at: number) => {
        state = apply(
            state,
            { type: "putQuestion", question: radius(key) },
            seeker,
            at,
        );
        return apply(state, { type: "sendQuestion", key }, seeker, at);
    };
    const answered = (state: GameState, key: number, at: number) =>
        apply(
            state,
            {
                type: "answerQuestion",
                key,
                answer: { within: true },
                basedOn: state.questions[String(key)].updatedAt,
            },
            hider,
            at,
        );
    const MIN = 60_000;

    it("warns twice, then gives the seekers a free question", () => {
        let state = asked(fresh(), 1, 1000);
        state = answered(state, 1, 1000 + 4 * MIN);
        expect(state.questions["1"].late).toBeUndefined();
        expect(state.lateAnswers).toBe(0);
        state = asked(state, 2, 10_000);
        state = answered(state, 2, 10_000 + 6 * MIN);
        expect(state.questions["2"].late).toBe(1);
        state = asked(state, 3, 20_000);
        state = answered(state, 3, 20_000 + 5 * MIN + 1);
        expect(state.questions["3"].late).toBe(2);
        expect(state.freeQuestions).toBe(0);
        state = asked(state, 4, 30_000);
        state = answered(state, 4, 30_000 + 7 * MIN);
        expect(state.lateAnswers).toBe(3);
        expect(state.freeQuestions).toBe(1);
        // The next answered question is the free one (real deck: a note).
        state = asked(state, 5, 40_000);
        state = answered(state, 5, 40_000 + MIN);
        expect(state.freeQuestions).toBe(0);
    });

    it("counts for the digital deck as a free draw, and can be turned off", () => {
        let state = newGameState(
            "g8",
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
        for (const key of [1, 2, 3]) {
            state = asked(state, key, key * 10_000);
            state = answered(state, key, key * 10_000 + 6 * MIN);
        }
        expect(state.deck?.freeQuestions).toBe(1);

        let off = newGameState(
            "g9",
            {
                playArea: {},
                zone: {},
                settings: {
                    ...defaultGameSettings("medium", "switzerland"),
                    latePenalty: false,
                },
            },
            1000,
        );
        off = asked(off, 1, 1000);
        off = answered(off, 1, 1000 + 9 * MIN);
        expect(off.lateAnswers).toBe(0);
        expect(off.questions["1"].late).toBeUndefined();
    });
});

describe("the clock by agreement", () => {
    it("pauses and resumes only when both sides ask", () => {
        let state = apply(
            fresh(),
            { type: "clock", action: "start" },
            seeker,
            1000,
        );
        state = apply(state, { type: "clock", action: "pause" }, hider, 2000);
        expect(state.clock?.pausedAt).toBeNull();
        expect(state.clockRequest).toEqual({
            action: "pause",
            by: "Ben",
            role: "hider",
            at: 2000,
        });
        // The same side asking again changes nothing.
        state = apply(state, { type: "clock", action: "pause" }, hider, 2500);
        expect(state.clockRequest?.at).toBe(2000);
        state = apply(state, { type: "clock", action: "pause" }, seeker, 3000);
        expect(state.clock?.pausedAt).toBe(3000);
        expect(state.clockRequest).toBeNull();
        state = apply(state, { type: "clock", action: "resume" }, seeker, 4000);
        expect(state.clock?.pausedAt).toBe(3000);
        expect(state.clockRequest?.action).toBe("resume");
        state = apply(state, { type: "clock", action: "cancel" }, hider, 4500);
        expect(state.clockRequest).toBeNull();
        state = apply(state, { type: "clock", action: "resume" }, hider, 5000);
        state = apply(state, { type: "clock", action: "resume" }, seeker, 6000);
        expect(state.clock?.pausedAt).toBeNull();
        expect(state.clock?.pausedMs).toBe(3000);
    });

    it("refuses a pause when the clock isn't running", () => {
        expect(() =>
            apply(fresh(), { type: "clock", action: "pause" }, seeker),
        ).toThrow(/isn't running/);
    });
});

describe("deleting by agreement", () => {
    it("deletes a draft at once, an asked question only when both sides agree", () => {
        let state = apply(
            fresh(),
            { type: "putQuestion", question: radius(1) },
            seeker,
            1000,
        );
        expect(
            apply(state, { type: "deleteQuestion", key: 1 }, seeker).questions[
                "1"
            ],
        ).toBeUndefined();
        state = apply(state, { type: "sendQuestion", key: 1 }, seeker, 2000);
        state = apply(state, { type: "deleteQuestion", key: 1 }, hider, 3000);
        expect(state.questions["1"]).toBeDefined();
        expect(state.deleteRequests["1"]).toEqual({
            by: "Ben",
            role: "hider",
            at: 3000,
        });
        const kept = apply(state, { type: "keepQuestion", key: 1 }, seeker);
        expect(kept.deleteRequests["1"]).toBeUndefined();
        expect(kept.questions["1"]).toBeDefined();
        state = apply(state, { type: "deleteQuestion", key: 1 }, seeker, 4000);
        expect(state.questions["1"]).toBeUndefined();
        expect(state.deleteRequests["1"]).toBeUndefined();
    });
});

describe("Randomize Question on photo questions", () => {
    const askPhoto = (state: GameState, name: string) =>
        apply(state, { type: "askPhoto", name }, seeker);

    it("turns an asked photo question into another of this game's size", () => {
        let state = askPhoto(fresh(), "Tree");
        const id = state.photoRequests[0].id;
        state = apply(state, { type: "randomizePhoto", id }, hider, 3000);
        const request = state.photoRequests[0];
        expect(request.name).not.toBe("Tree");
        expect(photoNamesFor("medium")).toContain(request.name);
        expect(request.randomizedFrom).toBe("Tree");
        expect(request.askedAs).toEqual(["Tree"]);
        expect(request.randomizedAt).toBe(3000);
        expect(request.photoId).toBeUndefined();
        expect(state.powerups.at(-1)?.name).toBe("Randomize Question");
    });

    it("only picks photo questions not asked this round", () => {
        const names = photoNamesFor("medium");
        let state = fresh();
        for (const name of names.slice(0, -1)) state = askPhoto(state, name);
        const id = state.photoRequests[0].id;
        state = apply(state, { type: "randomizePhoto", id }, hider);
        expect(state.photoRequests[0].name).toBe(names.at(-1));
        // Nothing is left now (the first one's old name counts as asked).
        expect(() =>
            apply(
                state,
                { type: "randomizePhoto", id: state.photoRequests[1].id },
                hider,
            ),
        ).toThrow(/nothing to randomize to/);
    });

    it("is the hider's, for photos not sent yet, and costs the card", () => {
        let state = askPhoto(fresh(), "Tree");
        const id = state.photoRequests[0].id;
        expect(() =>
            apply(state, { type: "randomizePhoto", id }, seeker),
        ).toThrow(GameRuleError);
        const sent = structuredClone(state);
        sent.photoRequests[0].photoId = "x.jpg";
        expect(() =>
            apply(sent, { type: "randomizePhoto", id }, hider),
        ).toThrow(/waiting for an answer/);
        expect(() =>
            apply(state, { type: "randomizePhoto", id: "nope" }, hider),
        ).toThrow(/No such photo/);

        state = askPhoto(
            newGameState(
                "g7",
                {
                    playArea: {},
                    zone: {},
                    settings: {
                        ...defaultGameSettings("medium", "switzerland"),
                        deck: "virtual",
                    },
                },
                1000,
            ),
            "Tree",
        );
        const digital = state.photoRequests[0].id;
        expect(() =>
            apply(state, { type: "randomizePhoto", id: digital }, hider),
        ).toThrow(/No Randomize Question card/);
        state = {
            ...state,
            deck: { ...state.deck!, hand: ["powerup_randomize_question"] },
        };
        state = apply(state, { type: "randomizePhoto", id: digital }, hider);
        expect(state.deck!.hand).toEqual([]);
    });
});

describe("casting costs with the digital deck", () => {
    const timeId = CARDS.find((card) => card.kind === "time")!.id;
    const powerupId = CARDS.find((card) => card.kind === "powerup")!.id;
    const withHand = (hand: string[]): GameState => {
        const state = newGameState(
            "g4",
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
        return { ...state, deck: { ...state.deck!, hand } };
    };

    it("'Discard a card' needs one other card, which goes too", () => {
        const state = withHand(["curse_right_turn", timeId, powerupId]);
        expect(() =>
            apply(state, { type: "playCard", index: 0 }, hider),
        ).toThrow(/costs 1 other card/);
        const cast = apply(
            state,
            { type: "playCard", index: 0, discards: [2] },
            hider,
        );
        expect(cast.deck!.hand).toEqual([timeId]);
        expect(cast.curses.at(-1)?.name).toBe("Curse of the Right Turn");
    });

    it("'Discard a time bonus' takes only a time bonus", () => {
        const state = withHand(["curse_spotty_memory", powerupId, timeId]);
        expect(() =>
            apply(state, { type: "playCard", index: 0, discards: [1] }, hider),
        ).toThrow(/time bonus/);
        const cast = apply(
            state,
            { type: "playCard", index: 0, discards: [2] },
            hider,
        );
        expect(cast.deck!.hand).toEqual([powerupId]);
    });

    it("'Discard your hand' empties it", () => {
        const state = withHand([timeId, "curse_drained_brain", powerupId]);
        const cast = apply(state, { type: "playCard", index: 1 }, hider);
        expect(cast.deck!.hand).toEqual([]);
        expect(cast.deck!.discard).toEqual(
            expect.arrayContaining([timeId, powerupId]),
        );
    });

    it("curses without a card cost are cast as before", () => {
        const state = withHand(["curse_cairn", timeId]);
        const cast = apply(state, { type: "playCard", index: 0 }, hider);
        expect(cast.deck!.hand).toEqual([timeId]);
    });
});

describe("curses that stop the seekers from asking", () => {
    const cast = (name: string, state = fresh()) =>
        apply(state, { type: "castCurse", name }, hider, 5000);
    const draft = (state: GameState, key = 1) =>
        apply(
            state,
            { type: "putQuestion", question: radius(key) },
            seeker,
            5100,
        );

    it("refuse questions and photo questions until the curse is cleared", () => {
        let state = draft(cast("Curse of the Cairn"));
        expect(() =>
            apply(state, { type: "sendQuestion", key: 1 }, seeker, 6000),
        ).toThrow(/Cairn.*cleared/);
        expect(() =>
            apply(state, { type: "askPhoto", name: "Tree" }, seeker, 6000),
        ).toThrow(/Cairn/);
        // Drafts can still be prepared.
        state = draft(state, 2);
        state = apply(
            state,
            { type: "clearCurse", id: state.curses[0].id },
            seeker,
            7000,
        );
        state = apply(state, { type: "sendQuestion", key: 1 }, seeker, 8000);
        expect(state.questions["1"].state).toBe("asked");
    });

    it("let the seekers ask under a curse that only reminds them", () => {
        const state = draft(cast("Curse of the Urban Explorer"));
        expect(
            apply(state, { type: "sendQuestion", key: 1 }, seeker, 6000)
                .questions["1"].state,
        ).toBe("asked");
    });

    it("end timed curses by themselves, and clear a passed one on any change", () => {
        const state = draft(cast("Curse of the Right Turn"));
        const later = apply(
            state,
            { type: "sendQuestion", key: 1 },
            seeker,
            5000 + 41 * 60_000,
        );
        expect(later.curses[0].clearedBy).toBe("time");
        expect(later.questions["1"].state).toBe("asked");
    });

    it("refuse the egg and the lemon during the end game", () => {
        const state = apply(
            fresh(),
            {
                type: "startEndgame",
                station: { id: "node/1", name: "Uster", lat: 47.3, lng: 8.7 },
            },
            seeker,
        );
        expect(() => cast("Curse of the Egg Partner", state)).toThrow(
            /end game/,
        );
        expect(() => cast("Curse of the Lemon Phylactery", state)).toThrow(
            /end game/,
        );
        expect(cast("Curse of the Cairn", state).curses).toHaveLength(1);
    });
});

describe("Curse of the Drained Brain", () => {
    it("blocks until the hider has chosen three kinds in three categories, then takes them away", () => {
        let state = apply(
            fresh(),
            { type: "castCurse", name: "Curse of the Drained Brain" },
            hider,
            5000,
        );
        const id = state.curses[0].id;
        state = apply(
            state,
            {
                type: "putQuestion",
                question: radius(1, { radius: 5, unit: "kilometers" }),
            },
            seeker,
            5100,
        );
        expect(() =>
            apply(state, { type: "sendQuestion", key: 1 }, seeker, 6000),
        ).toThrow(/Drained Brain/);
        expect(() =>
            apply(
                state,
                {
                    type: "blockQuestions",
                    id,
                    kinds: ["radius:5", "radius:10", "photo:tree"],
                },
                hider,
                6000,
            ),
        ).toThrow(/three different categories/);
        expect(() =>
            apply(
                state,
                { type: "blockQuestions", id, kinds: ["radius:5"] },
                seeker,
                6000,
            ),
        ).toThrow(GameRuleError);
        state = apply(
            state,
            {
                type: "blockQuestions",
                id,
                kinds: ["radius:5", "matching:zone", "photo:tree"],
            },
            hider,
            6000,
        );
        expect(state.curses[0].kinds).toEqual([
            "radius:5",
            "matching:zone",
            "photo:tree",
        ]);
        expect(() =>
            apply(state, { type: "sendQuestion", key: 1 }, seeker, 7000),
        ).toThrow(/taken away/);
        expect(() =>
            apply(state, { type: "askPhoto", name: "tree" }, seeker, 7000),
        ).toThrow(/taken away/);
        state = apply(
            state,
            {
                type: "putQuestion",
                question: radius(2, { radius: 10, unit: "kilometers" }),
            },
            seeker,
            7100,
        );
        expect(
            apply(state, { type: "sendQuestion", key: 2 }, seeker, 8000)
                .questions["2"].state,
        ).toBe("asked");
        // It lasts the run: nobody clears it, a new round does.
        expect(() =>
            apply(state, { type: "clearCurse", id }, seeker, 8000),
        ).toThrow(/rest of the run/);
        expect(apply(state, { type: "newRound" }, seeker, 9000).curses).toEqual(
            [],
        );
    });
});

describe("Curse of the Spotty Memory", () => {
    it("disables the rolled category until the next question, then wants a new roll", () => {
        let state = apply(
            fresh(),
            { type: "castCurse", name: "Curse of the Spotty Memory" },
            hider,
            5000,
        );
        const id = state.curses[0].id;
        state = apply(
            state,
            { type: "putQuestion", question: radius(1) },
            seeker,
            5100,
        );
        expect(() =>
            apply(state, { type: "sendQuestion", key: 1 }, seeker, 6000),
        ).toThrow(/Spotty Memory/);
        expect(() =>
            apply(
                state,
                { type: "setCurseCategory", id, category: "dice" },
                seeker,
                6000,
            ),
        ).toThrow(/category/);
        state = apply(
            state,
            { type: "setCurseCategory", id, category: "radius" },
            seeker,
            6000,
        );
        expect(() =>
            apply(state, { type: "sendQuestion", key: 1 }, seeker, 7000),
        ).toThrow(/disabled right now/);
        state = apply(state, { type: "askPhoto", name: "Tree" }, seeker, 7000);
        // Asked: the die is rolled again before the next one.
        expect(state.curses[0].category).toBeUndefined();
        expect(() =>
            apply(state, { type: "sendQuestion", key: 1 }, seeker, 8000),
        ).toThrow(/Spotty Memory/);
    });
});

describe("awards and the hider's own tasks", () => {
    it("add awarded minutes to the bonuses at the end", () => {
        let state = apply(
            fresh(),
            { type: "clock", action: "start" },
            seeker,
            1000,
        );
        state = apply(
            state,
            { type: "awardMinutes", minutes: 45, reason: "The egg cracked." },
            hider,
            2000,
        );
        expect(state.awards[0]).toMatchObject({
            minutes: 45,
            reason: "The egg cracked.",
            by: "Ben",
        });
        expect(() =>
            apply(
                state,
                { type: "awardMinutes", minutes: 0, reason: "" },
                hider,
            ),
        ).toThrow(/between 1 and 600/);
        state = apply(state, { type: "clock", action: "stop" }, seeker, 3000);
        state = apply(state, { type: "setBonus", minutes: 12 }, hider, 4000);
        expect(state.clock!.bonusMinutes).toBe(57);
        const next = apply(state, { type: "newRound" }, seeker, 5000);
        expect(next.rounds[0].awards).toHaveLength(1);
        expect(next.awards).toEqual([]);
    });

    it("keep how long the hider filmed a bird, within the card's limit", () => {
        let state = apply(
            fresh(),
            { type: "castCurse", name: "Curse of the Bird Guide" },
            hider,
            5000,
        );
        const id = state.curses[0].id;
        expect(() =>
            apply(state, { type: "setCurseTime", id, seconds: 700 }, hider),
        ).toThrow(/600 seconds/);
        state = apply(state, { type: "setCurseTime", id, seconds: 272 }, hider);
        expect(state.curses[0].seconds).toBe(272);
    });

    it("makes the next question free after the Impressionable Consumer", () => {
        const digital = newGameState(
            "g5",
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
        let state = apply(
            digital,
            { type: "castCurse", name: "Curse of the Impressionable Consumer" },
            hider,
            2000,
        );
        expect(state.deck!.freeQuestions).toBe(1);
        state = apply(
            state,
            { type: "clearCurse", id: state.curses[0].id },
            seeker,
            2500,
        );
        state = apply(
            state,
            { type: "putQuestion", question: radius(1), state: "asked" },
            seeker,
            3000,
        );
        state = apply(
            state,
            {
                type: "answerQuestion",
                key: 1,
                answer: { within: true },
                basedOn: 3000,
            },
            hider,
            4000,
        );
        expect(state.deck!.pending).toEqual([]);
        expect(state.deck!.hand).toEqual([]);
        expect(state.deck!.freeQuestions).toBe(0);
        state = apply(
            state,
            {
                type: "putQuestion",
                question: radius(2, { radius: 10 }),
                state: "asked",
            },
            seeker,
            5000,
        );
        state = apply(
            state,
            {
                type: "answerQuestion",
                key: 2,
                answer: { within: true },
                basedOn: 5000,
            },
            hider,
            6000,
        );
        expect(
            state.deck!.pending.length + state.deck!.hand.length,
        ).toBeGreaterThan(0);
    });
});

describe("the Move's period", () => {
    const moved = () => {
        const state = apply(
            fresh(),
            { type: "clock", action: "start" },
            seeker,
            1000,
        );
        return apply(state, { type: "move", station: null }, hider, 2000);
    };

    it("is 20 minutes in a medium game, and only the hider continues before it's over", () => {
        const state = moved();
        expect(state.move!.endsAt).toBe(2000 + 20 * 60_000);
        expect(() =>
            apply(state, { type: "resumeMove" }, seeker, 3000),
        ).toThrow(/Only the hider/);
        expect(
            apply(state, { type: "resumeMove" }, hider, 3000).move,
        ).toBeNull();
    });

    it("takes a 'continue' after the period ran out as nothing to do", () => {
        const state = moved();
        const after = state.move!.endsAt + 1;
        // Every phone sends one when it sees the time is up; none may fail.
        const seekerFirst = apply(state, { type: "resumeMove" }, seeker, after);
        expect(seekerFirst.move).toBeNull();
        expect(seekerFirst.clock!.pausedAt).toBeNull();
        expect(
            apply(seekerFirst, { type: "resumeMove" }, hider, after + 1).move,
        ).toBeNull();
    });

    it("runs out by itself: the next change resumes the game, whoever makes it", () => {
        const state = moved();
        const later = apply(
            state,
            { type: "askPhoto", name: "Tree" },
            seeker,
            2000 + 21 * 60_000,
        );
        expect(later.move).toBeNull();
        expect(later.clock!.pausedAt).toBeNull();
    });
});

describe("Duplicate Another Card", () => {
    const withHand = (hand: string[]): GameState => {
        const state = newGameState(
            "g6",
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
        return { ...state, deck: { ...state.deck!, hand } };
    };

    it("is played as a copy of another card, which stays in the hand", () => {
        const state = withHand([
            "powerup_duplicate_another_card",
            "curse_cairn",
            "time_bonus_5",
        ]);
        expect(() =>
            apply(state, { type: "playCard", index: 0 }, hider),
        ).toThrow(/choose the card it copies/);
        expect(() =>
            apply(state, { type: "playCard", index: 0, copyOf: 2 }, hider),
        ).toThrow(/counts by itself/);
        const cast = apply(
            state,
            { type: "playCard", index: 0, copyOf: 1 },
            hider,
        );
        expect(cast.curses.at(-1)?.name).toBe("Curse of the Cairn");
        expect(cast.deck!.hand).toEqual(["curse_cairn", "time_bonus_5"]);
    });

    it("pays the copied card's cost, never with the copied card itself", () => {
        const state = withHand([
            "powerup_duplicate_another_card",
            "curse_right_turn",
            "time_bonus_5",
        ]);
        expect(() =>
            apply(
                state,
                { type: "playCard", index: 0, copyOf: 1, discards: [1] },
                hider,
            ),
        ).toThrow(/costs/);
        const cast = apply(
            state,
            { type: "playCard", index: 0, copyOf: 1, discards: [2] },
            hider,
        );
        expect(cast.deck!.hand).toEqual(["curse_right_turn"]);
    });

    it("stands in for a Veto", () => {
        let state = withHand(["powerup_duplicate_another_card"]);
        state = apply(
            state,
            { type: "putQuestion", question: radius(1), state: "asked" },
            seeker,
        );
        state = apply(state, { type: "vetoQuestion", key: 1 }, hider);
        expect(state.questions["1"].state).toBe("vetoed");
        expect(state.deck!.hand).toEqual([]);
    });
});
