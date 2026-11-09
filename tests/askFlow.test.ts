import * as turf from "@turf/turf";
import { beforeEach, describe, expect, it } from "vitest";

import { openQuestion } from "@/lib/context";
import {
    askedBefore,
    matchingQuestion,
    radarQuestion,
    tentacleQuestion,
    thermometerQuestion,
} from "@/lib/game/newQuestion";
import type { GameState, QuestionEntry } from "@/lib/game/types";
import {
    askFlow,
    back,
    closeAsk,
    openAsk,
    pickKind,
    pushedScreen,
    pushScreen,
    screenDepth,
} from "@/lib/screens";
import { questionSchema } from "@/maps/schema";

const HB = { lat: 47.3779, lng: 8.5403 };

describe("new questions from the ask flow", () => {
    it("are made with what was chosen, and parse as questions", () => {
        const radar = radarQuestion(HB, 10);
        expect(radar.data).toMatchObject({ radius: 10, unit: "kilometers" });
        const matching = matchingQuestion(HB, "airport");
        const tentacles = tentacleQuestion(HB, "zoo", 10);
        for (const question of [radar, matching, tentacles]) {
            expect(
                questionSchema.safeParse({ ...question, key: 1 }).success,
            ).toBe(true);
        }
    });

    it("make a shared game's thermometer without an end, and a lone one with its end east", () => {
        expect(thermometerQuestion(HB, 5, true).data).toMatchObject({
            latB: null,
            lngB: null,
            distanceKm: 5,
        });
        const alone = thermometerQuestion(HB, 5, false).data;
        expect(alone.lngB).toBeGreaterThan(HB.lng);
        expect(
            turf.distance([HB.lng, HB.lat], [alone.lngB!, alone.latB!], {
                units: "kilometers",
            }),
        ).toBeCloseTo(5, 3);
    });

    it("know a question answered before this round (×2)", () => {
        const answered = (radius: number): QuestionEntry => ({
            question: {
                id: "radius",
                key: 1,
                data: { radius, unit: "kilometers" },
            },
            state: "answered",
            createdBy: "Ana",
            createdAt: 1,
            updatedBy: "Ana",
            updatedAt: 1,
        });
        const state = {
            questions: { "1": answered(5) },
        } as unknown as GameState;
        expect(askedBefore(state, radarQuestion(HB, 5))).toBe(1);
        expect(askedBefore(state, radarQuestion(HB, 10))).toBe(0);
        expect(askedBefore(null, radarQuestion(HB, 5))).toBe(0);
    });
});

describe("the screens and Back", () => {
    beforeEach(() => {
        closeAsk();
        openQuestion.set(null);
    });

    it("go back one screen at a time: a kind, the types, the open card", () => {
        openQuestion.set(7);
        openAsk();
        pickKind("radius");
        expect(screenDepth.get()).toBe(3);
        back();
        expect(askFlow.get()).toEqual({ research: false, kind: null });
        back();
        expect(askFlow.get()).toBeNull();
        expect(openQuestion.get()).toBe(7);
        back();
        expect(openQuestion.get()).toBeNull();
        expect(screenDepth.get()).toBe(0);
        // Nothing left: Back does nothing.
        back();
        expect(screenDepth.get()).toBe(0);
    });
});

describe("a screen pushed over a tab (the seekers' list, a photo question)", () => {
    beforeEach(() => {
        openQuestion.set(null);
        closeAsk();
        pushedScreen.set(null);
    });

    it("is one screen deep, and Back closes it", () => {
        pushScreen({ tab: "stations", kind: "seekers" });
        expect(screenDepth.get()).toBe(1);
        back();
        expect(pushedScreen.get()).toBeNull();
        expect(screenDepth.get()).toBe(0);
    });

    it("comes off after the ask flow over it, and before the open card under it", () => {
        openQuestion.set(3);
        pushScreen({ tab: "questions", kind: "photo", id: "r1" });
        openAsk();
        expect(screenDepth.get()).toBe(3);
        back();
        expect(askFlow.get()).toBeNull();
        expect(pushedScreen.get()).toEqual({
            tab: "questions",
            kind: "photo",
            id: "r1",
        });
        back();
        expect(pushedScreen.get()).toBeNull();
        expect(openQuestion.get()).toBe(3);
    });
});
