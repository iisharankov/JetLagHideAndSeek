import { describe, expect, it } from "vitest";

import {
    formatCode,
    parseCode,
    playerStale,
    roleOfPlayer,
} from "@/lib/game/players";
import { defaultGameSettings } from "@/lib/game/settings";
import type { GameState, Player } from "@/lib/game/types";

const player = (patch: Partial<Player> = {}): Player => ({
    id: "p1",
    name: "Ana",
    teamId: null,
    joinedAt: 0,
    lastSeen: 0,
    ...patch,
});

const game = (teams: boolean, hiderTeamId: string | null = null) =>
    ({
        settings: { ...defaultGameSettings(), teams },
        hiderTeamId,
    }) as GameState;

describe("the role", () => {
    it("with teams, follows the team: the hiding team's members are the hiders", () => {
        expect(
            roleOfPlayer(game(true, "owls"), player({ teamId: "owls" })),
        ).toBe("hider");
        expect(
            roleOfPlayer(game(true, "owls"), player({ teamId: "foxes" })),
        ).toBe("seeker");
        expect(roleOfPlayer(game(true, null), player({ teamId: "owls" }))).toBe(
            "seeker",
        );
        // The hider flag means nothing with teams.
        expect(roleOfPlayer(game(true, "owls"), player({ hider: true }))).toBe(
            "seeker",
        );
    });

    it("without teams, is the one player who said they hide", () => {
        expect(roleOfPlayer(game(false), player({ hider: true }))).toBe(
            "hider",
        );
        expect(roleOfPlayer(game(false), player())).toBe("seeker");
        expect(roleOfPlayer(game(false), undefined)).toBe("seeker");
    });

    it("is nobody's once the player moved to another phone or was removed", () => {
        expect(
            roleOfPlayer(game(false), player({ hider: true, left: 5 })),
        ).toBe("seeker");
        expect(
            roleOfPlayer(
                game(true, "owls"),
                player({ teamId: "owls", left: 5 }),
            ),
        ).toBe("seeker");
    });
});

describe("the player code", () => {
    it("shows in two groups of three", () => {
        expect(formatCode("K7M4PQ")).toBe("K7M-4PQ");
    });

    it("is read however it's typed", () => {
        expect(parseCode(" k7m-4pq ")).toBe("K7M4PQ");
        expect(parseCode("K7M 4PQ")).toBe("K7M4PQ");
        expect(parseCode("K7M4P")).toBeNull();
        // 0, O, 1 and I aren't in codes: they look alike.
        expect(parseCode("K0M4PQ")).toBeNull();
    });
});

describe("a stale player", () => {
    it("hasn't been seen for an hour", () => {
        const now = 10 * 3600_000;
        expect(playerStale(player({ lastSeen: now - 59 * 60_000 }), now)).toBe(
            false,
        );
        expect(playerStale(player({ lastSeen: now - 61 * 60_000 }), now)).toBe(
            true,
        );
    });
});
