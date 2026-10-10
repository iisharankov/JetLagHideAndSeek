// The round's hiding clock (types.ts: RoundClock), shared through the game.
// Started when the seekers start searching, paused during a Move, stopped
// when the hider is found. Pure helpers, used by the server and the phones.
import type { ClockAction, RoundClock } from "./types";

export const EMPTY_CLOCK: RoundClock = {
    startedAt: null,
    pausedAt: null,
    pausedMs: 0,
    stoppedAt: null,
};

export type ClockState = "idle" | "running" | "paused" | "stopped";

export const clockState = (clock: RoundClock | null | undefined): ClockState =>
    !clock || clock.startedAt === null
        ? "idle"
        : clock.stoppedAt !== null
          ? "stopped"
          : clock.pausedAt !== null
            ? "paused"
            : "running";

/** Hiding time so far (in total, once stopped), in milliseconds. */
export const hidingTimeMs = (
    clock: RoundClock | null | undefined,
    now = Date.now(),
) => {
    if (!clock || clock.startedAt === null) return 0;
    const end = clock.stoppedAt ?? clock.pausedAt ?? now;
    return Math.max(0, end - clock.startedAt - clock.pausedMs);
};

/** One step of the clock; actions that don't apply change nothing. */
export const applyClockAction = (
    current: RoundClock | null | undefined,
    action: ClockAction,
    now: number,
): RoundClock | null => {
    const clock = { ...(current ?? EMPTY_CLOCK) };
    const state = clockState(clock);
    switch (action) {
        case "start":
            if (state === "idle") clock.startedAt = now;
            break;
        case "pause":
            if (state === "running") clock.pausedAt = now;
            break;
        case "resume":
            if (state === "paused") {
                clock.pausedMs += now - clock.pausedAt!;
                clock.pausedAt = null;
            }
            break;
        case "stop":
            if (state === "paused") {
                clock.pausedMs += now - clock.pausedAt!;
                clock.pausedAt = null;
            }
            if (state === "running" || state === "paused") {
                clock.stoppedAt = now;
            }
            break;
        case "reset":
            return null;
    }
    return clock;
};

/** "42:13", or "1:02:03" from an hour on. */
export const formatDuration = (ms: number) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    const mm = String(minutes).padStart(hours > 0 ? 2 : 1, "0");
    const ss = String(seconds).padStart(2, "0");
    return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
};
