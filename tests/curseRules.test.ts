import { describe, expect, it } from "vitest";

import {
    activeCurses,
    blockedKinds,
    blockingCurses,
    CURSE_RULES,
    curseEndsAt,
    disabledCategory,
    kindLabel,
    kindRefusal,
    lastsTheRun,
    moveMinutes,
    photoKind,
    questionKind,
} from "@/lib/game/curseRules";
import { defaultGameSettings } from "@/lib/game/settings";
import type { CurseEntry } from "@/lib/game/types";
import { CURSES } from "@/lib/rules/cards";

const settings = defaultGameSettings("medium");
const entry = (name: string, extra: Partial<CurseEntry> = {}): CurseEntry => ({
    id: name,
    name,
    castAt: 1000,
    ...extra,
});

describe("curse rules", () => {
    it("cover every printed curse", () => {
        for (const curse of CURSES)
            expect(CURSE_RULES).toHaveProperty(curse.image);
    });

    it("know which curses stop the seekers from asking", () => {
        const state = {
            settings,
            curses: [
                entry("Curse of the Cairn"),
                entry("Curse of the Right Turn"),
                entry("Curse of the Luxury Car", { clearedAt: 2000 }),
            ],
        };
        expect(blockingCurses(state, 3000).map((c) => c.name)).toEqual([
            "Curse of the Cairn",
        ]);
    });

    it("end timed curses by themselves", () => {
        const timed = entry("Curse of the Right Turn");
        // 40 minutes in a medium game.
        expect(curseEndsAt(timed, "medium")).toBe(1000 + 40 * 60_000);
        expect(curseEndsAt(entry("Curse of the Cairn"), "medium")).toBeNull();
        const state = { settings, curses: [timed] };
        expect(activeCurses(state, 1000 + 39 * 60_000)).toHaveLength(1);
        expect(activeCurses(state, 1000 + 41 * 60_000)).toHaveLength(0);
    });

    it("a Drained Brain blocks until the hider chose, then takes the kinds away", () => {
        const brain = entry("Curse of the Drained Brain");
        expect(
            blockingCurses({ settings, curses: [brain] }, 2000),
        ).toHaveLength(1);
        const chosen = {
            ...brain,
            kinds: ["radius:5", "matching:zone", "photo:tree"],
        };
        const state = { settings, curses: [chosen] };
        expect(blockingCurses(state, 2000)).toHaveLength(0);
        expect(blockedKinds(state, 2000)).toEqual([
            "radius:5",
            "matching:zone",
            "photo:tree",
        ]);
        expect(kindRefusal(state, "matching:zone", 2000)).toMatch(
            /Drained Brain/,
        );
        expect(kindRefusal(state, "matching:airport", 2000)).toBeNull();
        expect(lastsTheRun("Curse of the Drained Brain")).toBe(true);
        expect(lastsTheRun("Curse of the Cairn")).toBe(false);
    });

    it("a Spotty Memory blocks until the die is rolled, then disables a category", () => {
        const memory = entry("Curse of the Spotty Memory");
        expect(
            blockingCurses({ settings, curses: [memory] }, 2000),
        ).toHaveLength(1);
        const state = {
            settings,
            curses: [{ ...memory, category: "matching" }],
        };
        expect(blockingCurses(state, 2000)).toHaveLength(0);
        expect(disabledCategory(state, 2000)).toBe("matching");
        expect(kindRefusal(state, "matching:zone", 2000)).toMatch(
            /Spotty Memory/,
        );
        expect(kindRefusal(state, "radius:5", 2000)).toBeNull();
    });

    it("names question kinds and labels them", () => {
        expect(
            questionKind({
                id: "radius",
                key: 1,
                data: { radius: 5, unit: "kilometers" },
            }),
        ).toBe("radius:5");
        expect(
            questionKind({
                id: "radius",
                key: 1,
                data: { radius: 500, unit: "meters" },
            }),
        ).toBe("radius:0.5");
        expect(questionKind({ id: "thermometer", key: 1, data: {} })).toBe(
            "thermometer",
        );
        expect(
            questionKind({ id: "matching", key: 1, data: { type: "zone" } }),
        ).toBe("matching:zone");
        expect(
            questionKind({
                id: "tentacles",
                key: 1,
                data: { locationType: "zoo" },
            }),
        ).toBe("tentacles:zoo");
        expect(photoKind(" Tree ")).toBe("photo:tree");
        expect(kindLabel("radius:0.5")).toBe("Radar 500 m");
        expect(kindLabel("matching:zone")).toBe("Matching: Same zone");
        expect(kindLabel("photo:tree")).toBe("Photo: Tree");
        expect(kindLabel("thermometer")).toBe("Thermometer");
    });

    it("gives a Move its period by game size", () => {
        expect([
            moveMinutes("small"),
            moveMinutes("medium"),
            moveMinutes("large"),
        ]).toEqual([10, 20, 60]);
    });
});
