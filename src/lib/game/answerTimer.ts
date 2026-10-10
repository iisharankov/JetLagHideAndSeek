// The rulebook gives the hider five minutes to answer a question. Both
// phones count down from the moment the question was sent.
import type { QuestionEntry } from "./types";

export const ANSWER_TIME_MS = 5 * 60_000;

/**
 * Time left to answer, in milliseconds (negative once overdue), or null for
 * a question that isn't waiting for an answer. Questions from before the
 * timer existed count from their last change.
 */
export const answerTimeLeft = (
    entry: Pick<QuestionEntry, "state" | "askedAt" | "updatedAt">,
    now: number,
) =>
    entry.state === "asked"
        ? (entry.askedAt ?? entry.updatedAt) + ANSWER_TIME_MS - now
        : null;

export type AnswerTimerTone = "ok" | "warning" | "overdue";

/** Amber in the last minute, red once the time is up. */
export const answerTimerTone = (leftMs: number): AnswerTimerTone =>
    leftMs <= 0 ? "overdue" : leftMs <= 60_000 ? "warning" : "ok";

const mmss = (ms: number) => {
    const total = Math.ceil(Math.abs(ms) / 1000);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

/** "4:12 to answer", or "1:05 over time". */
export const answerTimerText = (leftMs: number) =>
    leftMs > 0 ? `${mmss(leftMs)} to answer` : `${mmss(leftMs)} over time`;
