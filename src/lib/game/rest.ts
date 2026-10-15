// Rest periods (the rulebook suggests them for long games): the game pauses
// by itself at the agreed time and goes on by itself at the end. Pure
// helpers shared by the server (which applies them every so often) and the
// phones (which show them).
import { applyClockAction, clockState } from "./clock";
import type { GameState, RestPeriod } from "./types";

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** "22:05" → minutes since midnight, or null. */
export const parseTime = (text: string) => {
    const match = TIME.exec(text);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

export const isValidTimeZone = (zone: string) => {
    try {
        Intl.DateTimeFormat(undefined, { timeZone: zone });
        return true;
    } catch {
        return false;
    }
};

/** This phone's time zone, e.g. "Europe/Zurich". */
export const phoneTimeZone = () =>
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

/** The date ("2026-10-15") and minutes since midnight at `now` in a zone. */
export const localClock = (now: number, timeZone: string) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(new Date(now));
    const get = (type: string) =>
        parts.find((part) => part.type === type)?.value ?? "00";
    return {
        date: `${get("year")}-${get("month")}-${get("day")}`,
        minutes: Number(get("hour")) * 60 + Number(get("minute")),
    };
};

/** A rest period as received: two clock times and a zone, or nothing. */
export const normalizeRest = (value: unknown): RestPeriod | null => {
    if (!value || typeof value !== "object") return null;
    const { from, until, timeZone } = value as Partial<RestPeriod>;
    if (
        typeof from !== "string" ||
        typeof until !== "string" ||
        parseTime(from) === null ||
        parseTime(until) === null ||
        from === until
    ) {
        return null;
    }
    return {
        from,
        until,
        timeZone:
            typeof timeZone === "string" && isValidTimeZone(timeZone)
                ? timeZone
                : "UTC",
    };
};

/** Whether `now` falls in the rest period (which may run past midnight). */
export const inRest = (rest: RestPeriod, now: number) => {
    const { minutes } = localClock(now, rest.timeZone);
    const from = parseTime(rest.from)!;
    const until = parseTime(rest.until)!;
    return from < until
        ? minutes >= from && minutes < until
        : minutes >= from || minutes < until;
};

/** The rest period `now` is in, by the day it started ("2026-10-15T22:00"). */
export const restWindowKey = (rest: RestPeriod, now: number) => {
    const { date, minutes } = localClock(now, rest.timeZone);
    const from = parseTime(rest.from)!;
    const until = parseTime(rest.until)!;
    // Past midnight and before the end: the rest started the day before.
    const startedYesterday = from > until && minutes < until;
    const day = startedYesterday
        ? localClock(now - 24 * 3600_000, rest.timeZone).date
        : date;
    return `${day}T${rest.from}`;
};

export const describeRest = (rest: RestPeriod | null) =>
    rest ? `${rest.from}–${rest.until}` : "none";

/** The clock is paused for the rest period. */
export const resting = (state: Pick<GameState, "clock">) =>
    clockState(state.clock) === "paused" && state.clock?.pausedBy === "rest";

/** Why the seekers can't ask right now, if it's the rest period. */
export const restRefusal = (state: Pick<GameState, "clock" | "settings">) =>
    resting(state) && state.settings.rest
        ? `Rest period until ${state.settings.rest.until}: no questions until the clock goes on.`
        : null;

/**
 * The step the server takes every so often: the clock pauses when the rest
 * starts (once per rest: resumed early by agreement, it stays running) and
 * goes on when it ends. Null when nothing changes.
 */
export const applyRest = (state: GameState, now: number): GameState | null => {
    const rest = state.settings.rest;
    const clock = state.clock;
    const state_ = clockState(clock);
    const resume = () => ({
        ...state,
        clockRequest: null,
        clock: {
            ...applyClockAction(clock, "resume", now)!,
            pausedBy: undefined,
        },
    });
    if (!rest) return resting(state) ? resume() : null;
    const isRest = inRest(rest, now);
    if (isRest && state_ === "running") {
        const key = restWindowKey(rest, now);
        if (state.restWindow === key) return null;
        return {
            ...state,
            restWindow: key,
            clockRequest: null,
            clock: {
                ...applyClockAction(clock, "pause", now)!,
                pausedBy: "rest",
            },
        };
    }
    if (!isRest && resting(state)) return resume();
    return null;
};
