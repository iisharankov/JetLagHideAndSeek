import { describe, expect, it } from "vitest";

import { defaultGameSettings } from "@/lib/game/settings";
import {
    canChangeQuestion,
    diffLocal,
    mergeRemoteQuestions,
    roleOnMap,
    syncedJson,
    toShared,
} from "@/lib/game/sync";
import type { GameState, QuestionEntry } from "@/lib/game/types";
import { type Question, questionSchema } from "@/maps/schema";

const radius = (key: number, data: object = {}) =>
    questionSchema.parse({
        id: "radius",
        key,
        data: {
            lat: 47.37,
            lng: 8.54,
            radius: 5,
            color: "red",
            ...data,
        },
    }) as Question;

const entry = (
    question: Question,
    state: QuestionEntry["state"],
    createdBy = "Ana",
    createdAt = 1,
): QuestionEntry => ({
    question: toShared(question),
    state,
    createdBy,
    createdAt,
    updatedBy: createdBy,
    updatedAt: createdAt,
});

const game = (entries: QuestionEntry[]): GameState => ({
    id: "g",
    version: 2,
    createdAt: 0,
    updatedAt: 0,
    playArea: null,
    zone: null,
    settings: defaultGameSettings("medium", "switzerland"),
    questions: Object.fromEntries(
        entries.map((e) => [String(e.question.key), e]),
    ),
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
    hasHider: false,
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

describe("toShared", () => {
    it("leaves out each phone's own view settings", () => {
        const shared = toShared(radius(1, { collapsed: true, hidden: true }));
        expect(shared.data.collapsed).toBeUndefined();
        expect(shared.data.hidden).toBeUndefined();
        expect(shared.data.drag).toBeUndefined();
        expect(shared.data.radius).toBe(5);
    });
});

describe("mergeRemoteQuestions", () => {
    it("takes the server's questions in the order they were asked", () => {
        const merged = mergeRemoteQuestions(
            game([
                entry(radius(2), "asked", "Ana", 20),
                entry(radius(1), "answered", "Ana", 10),
            ]),
            [],
            new Map(),
            "Ana",
        );
        expect(merged.map((q) => q.key)).toEqual([1, 2]);
    });

    it("keeps this phone's view settings for questions it already has", () => {
        const local = [radius(1, { collapsed: true, hidden: true })];
        const merged = mergeRemoteQuestions(
            game([entry(radius(1, { radius: 9 }), "answered")]),
            local,
            new Map([[1, syncedJson(local[0])]]),
            "Ana",
        );
        expect(merged[0].data.collapsed).toBe(true);
        expect(merged[0].data.hidden).toBe(true);
        expect((merged[0].data as any).radius).toBe(9);
    });

    it("unlocks only your own drafts by default", () => {
        const merged = mergeRemoteQuestions(
            game([
                entry(radius(1), "draft", "Ana"),
                entry(radius(2), "draft", "Cleo"),
                entry(radius(3), "answered", "Ana"),
            ]),
            [],
            new Map(),
            "Ana",
        );
        expect(merged.map((q) => q.data.drag)).toEqual([true, false, false]);
    });

    it("locks answered questions when asked to (seekers may not change them)", () => {
        const local = [radius(1, { drag: true })];
        const merged = mergeRemoteQuestions(
            game([entry(radius(1), "answered")]),
            local,
            new Map([[1, syncedJson(local[0])]]),
            "Ana",
            { lockAnswered: true },
        );
        expect(merged[0].data.drag).toBe(false);
    });

    it("doesn't overwrite a change this phone hasn't sent yet", () => {
        const sent = radius(1, { radius: 5 });
        const editing = radius(1, { radius: 8 });
        const merged = mergeRemoteQuestions(
            game([entry(radius(1, { radius: 5 }), "draft")]),
            [editing],
            new Map([[1, syncedJson(sent)]]),
            "Ana",
        );
        expect((merged[0].data as any).radius).toBe(8);
    });

    it("keeps new questions not sent yet, and doesn't bring back deleted ones", () => {
        const kept = radius(1);
        const created = radius(2);
        const merged = mergeRemoteQuestions(
            game([entry(kept, "draft"), entry(radius(3), "draft")]),
            [kept, created],
            new Map([
                [1, syncedJson(kept)],
                [3, syncedJson(radius(3))], // deleted here, not sent yet
            ]),
            "Ana",
        );
        expect(merged.map((q) => q.key)).toEqual([1, 2]);
    });
});

describe("diffLocal", () => {
    it("keeps the hider's research questions on the phone", () => {
        const probe = radius(7);
        probe.data.research = true;
        expect(diffLocal([probe], new Map())).toEqual([]);
        expect(roleOnMap(probe, game([]))).toBe("speculative");
    });

    it("sends new and changed questions, and deletions", () => {
        const unchanged = radius(1);
        const changed = radius(2, { radius: 9 });
        const created = radius(4);
        const ops = diffLocal(
            [unchanged, changed, created],
            new Map([
                [1, syncedJson(unchanged)],
                [2, syncedJson(radius(2))],
                [3, syncedJson(radius(3))],
            ]),
        );
        expect(
            ops.map((op) => [
                op.type,
                "key" in op ? op.key : (op as any).question.key,
            ]),
        ).toEqual([
            ["putQuestion", 2],
            ["putQuestion", 4],
            ["deleteQuestion", 3],
        ]);
    });

    it("ignores changes to a phone's own view settings", () => {
        const q = radius(1);
        const synced = new Map([[1, syncedJson(q)]]);
        expect(diffLocal([radius(1, { collapsed: true })], synced)).toEqual([]);
    });
});

describe("roleOnMap", () => {
    const state = game([
        entry(radius(1), "answered"),
        entry(radius(2), "asked"),
        entry(radius(3), "draft"),
    ]);

    it("answers count; drafts are speculative; asked ones wait", () => {
        expect(roleOnMap(radius(1), state)).toBe("confirmed");
        expect(roleOnMap(radius(2), state)).toBe("waiting");
        expect(roleOnMap(radius(3), state)).toBe("speculative");
        expect(roleOnMap(radius(4), state)).toBe("speculative"); // not sent yet
    });

    it("everything counts when not playing a shared game", () => {
        expect(roleOnMap(radius(2), null)).toBe("confirmed");
    });
});

describe("canChangeQuestion", () => {
    const state = game([
        entry(radius(1), "answered"),
        entry(radius(2), "asked"),
    ]);

    it("locks answered questions for seekers, unless the game allows it", () => {
        expect(canChangeQuestion(1, state, "seeker")).toBe(false);
        expect(canChangeQuestion(1, state, "hider")).toBe(true);
        expect(canChangeQuestion(2, state, "seeker")).toBe(true);
        expect(canChangeQuestion(9, state, "seeker")).toBe(true); // not sent yet
        expect(canChangeQuestion(1, null, "seeker")).toBe(true); // playing alone
        const open = {
            ...state,
            settings: { ...state.settings, seekersCanAnswer: true },
        };
        expect(canChangeQuestion(1, open, "seeker")).toBe(true);
    });
});
