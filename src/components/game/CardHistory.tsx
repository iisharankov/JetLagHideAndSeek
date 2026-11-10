// Cards → History (round 41): the round so far as one list, newest first.
import { useState } from "react";

import { clockTime } from "@/lib/format";
import { historyEntries, type HistoryEntry } from "@/lib/game/history";
import type { GameState } from "@/lib/game/types";
import { cn } from "@/lib/utils";

const ICONS: Record<HistoryEntry["kind"] | "deck", string> = {
    question: "❓",
    answer: "💬",
    photo: "📷",
    curse: "🪨",
    powerup: "🃏",
    move: "🚶",
    hider: "🫥",
    endgame: "🏁",
    deck: "🂠",
};

/** Test ids the browser tests know a kind by. */
const TEST_IDS: Partial<Record<HistoryEntry["kind"], string>> = {
    hider: "hider-ready",
    powerup: "played-powerup",
};

/**
 * Cards → History: what happened this round, newest first: questions asked
 * and answered, photos, curses, cards played, moves, the end game, and the
 * digital deck's own log (cards drawn and kept).
 */
export const CardHistory = ({
    state,
    log,
}: {
    state: GameState;
    /** The digital deck's log (draws), newest first or not. */
    log: { at: number; text: string }[];
}) => {
    const [all, setAll] = useState(false);
    const entries = [
        ...historyEntries(state),
        ...log.map((entry) => ({
            at: entry.at,
            kind: "deck" as const,
            text: entry.text,
        })),
    ].sort((a, b) => b.at - a.at);
    const shown = all ? entries : entries.slice(0, 30);
    return (
        <details className="rounded-md border border-slate-700 p-2" open>
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold font-poppins">
                History ({entries.length})
            </summary>
            <ol className="mt-1 flex flex-col text-sm" data-testid="history">
                {entries.length === 0 && (
                    <li className="text-slate-400">Nothing yet.</li>
                )}
                {shown.map((entry, index) => (
                    <li
                        key={`${entry.at}-${index}`}
                        className={cn(
                            "flex gap-2 border-b border-slate-800 py-2 last:border-b-0",
                            entry.kind === "deck" && "text-slate-400",
                        )}
                        data-testid={
                            entry.kind === "deck"
                                ? undefined
                                : TEST_IDS[entry.kind]
                        }
                    >
                        <span className="w-12 shrink-0 tabular-nums text-slate-400">
                            {clockTime(entry.at)}
                        </span>
                        <span aria-hidden>{ICONS[entry.kind]}</span>
                        <span className="min-w-0 flex-1">{entry.text}</span>
                    </li>
                ))}
            </ol>
            {entries.length > shown.length && (
                <button
                    type="button"
                    className="mt-1 min-h-11 text-sm text-blue-300 underline"
                    onClick={() => setAll(true)}
                >
                    Show all {entries.length}
                </button>
            )}
        </details>
    );
};
