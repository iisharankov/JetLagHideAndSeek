// The scoreboard of a shared game: each round's hiding time plus the time
// bonuses, per hider. The rulebook counts a player's best round.
import { clockState, hidingTimeMs } from "./clock";
import type { GameState, PastRound, RoundClock } from "./types";

export interface ScoreRow {
    /** 1 for the first round played. */
    round: number;
    hider: string;
    hidingMs: number;
    bonusMinutes: number;
    totalMs: number;
    /** The round still going (its clock running or not yet stopped). */
    current: boolean;
}

const rowFor = (
    round: number,
    hider: string | null | undefined,
    clock: RoundClock | null | undefined,
    now: number,
    current: boolean,
): ScoreRow | null => {
    if (clockState(clock) === "idle") return null;
    const hidingMs = hidingTimeMs(clock, now);
    const bonusMinutes = clock?.bonusMinutes ?? 0;
    return {
        round,
        hider: hider || "The hider",
        hidingMs,
        bonusMinutes,
        totalMs: hidingMs + bonusMinutes * 60_000,
        current,
    };
};

/** Every round that had a clock, oldest first; the one being played last. */
export const scoreRows = (
    state: Pick<GameState, "rounds" | "clock" | "hiderName">,
    now = Date.now(),
): ScoreRow[] => {
    const rows: ScoreRow[] = [];
    state.rounds.forEach((past: PastRound, index) => {
        const row = rowFor(index + 1, past.hiderName, past.clock, now, false);
        if (row) rows.push(row);
    });
    const current = rowFor(
        state.rounds.length + 1,
        state.hiderName,
        state.clock,
        now,
        clockState(state.clock) !== "stopped",
    );
    if (current) rows.push(current);
    return rows;
};

/** The best finished round of each hider, best first. */
export const ranking = (rows: ScoreRow[]) => {
    const best = new Map<string, ScoreRow>();
    for (const row of rows) {
        if (row.current) continue;
        const known = best.get(row.hider);
        if (!known || row.totalMs > known.totalMs) best.set(row.hider, row);
    }
    return [...best.values()].sort((a, b) => b.totalMs - a.totalMs);
};
