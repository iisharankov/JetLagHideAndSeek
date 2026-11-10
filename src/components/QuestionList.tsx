import { useStore } from "@nanostores/react";
import { ChevronRight, EyeOffIcon } from "lucide-react";

import { activeQuestionKey, showQuestion } from "@/lib/context";
import { questionRows } from "@/lib/game/questionList";
import { gameRole, gameState } from "@/lib/game/session";
import type { QuestionState } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { questionColor } from "@/maps/questionColors";
import type { Question } from "@/maps/schema";

const STATUS: Record<
    QuestionState,
    { seeker: string; hider: string; className: string }
> = {
    draft: {
        seeker: "Draft",
        hider: "Draft",
        className: "bg-amber-900/70 text-amber-100",
    },
    armed: {
        seeker: "Travelling",
        hider: "Started · travelling",
        className: "bg-violet-800 text-violet-100",
    },
    asked: {
        seeker: "Waiting",
        hider: "Answer it",
        className: "bg-blue-700 text-white",
    },
    answered: {
        seeker: "Answered",
        hider: "Answered",
        className: "bg-green-900/70 text-green-100",
    },
    vetoed: {
        seeker: "Vetoed",
        hider: "Vetoed",
        className: "bg-slate-700 text-slate-200",
    },
};

/** "Question 3 · Radar": the heading of a question's open card too. */
export const questionTitle = (number: number, kind: string, research = false) =>
    `${research ? "Research" : "Question"} ${number} · ${kind}`;

/**
 * The Questions (or Research) tab: one row per question, in the order they
 * were asked, its pin's colour and where it stands. A row opens the card.
 */
export const QuestionList = ({
    list,
    research = false,
}: {
    list: Question[];
    research?: boolean;
}) => {
    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    const $active = useStore(activeQuestionKey);
    const rows = questionRows(list, research ? null : $game);
    if (rows.length === 0) return null;
    return (
        <ul
            className="flex flex-col gap-1 px-2 py-2"
            data-testid="question-list"
        >
            {rows.map((row) => {
                const question = list.find((q) => q.key === row.key)!;
                const data = question.data as { hidden?: boolean };
                // The colour it draws in on the map (round 42).
                const color = questionColor(question);
                const status = row.state ? STATUS[row.state] : null;
                const statusText = status
                    ? $role === "hider"
                        ? status.hider
                        : status.seeker
                    : null;
                return (
                    <li key={row.key}>
                        <button
                            type="button"
                            className={cn(
                                "flex min-h-11 w-full items-center gap-2 rounded-md border border-slate-700 bg-slate-800/40 px-3 py-2 text-left text-sm hover:bg-slate-800",
                                row.key === $active && "border-blue-500/70",
                                data.hidden && "opacity-60",
                            )}
                            onClick={() => showQuestion(row.key)}
                        >
                            <span
                                className="h-3 w-3 shrink-0 rounded-full border border-white/40"
                                style={{ background: color }}
                                aria-hidden="true"
                            />
                            <span className="min-w-0 flex-1 truncate font-semibold">
                                {questionTitle(row.number, row.kind, research)}
                            </span>
                            {data.hidden && (
                                <EyeOffIcon
                                    className="h-4 w-4 shrink-0 text-slate-400"
                                    aria-label="hidden from the map"
                                />
                            )}
                            {status && (
                                <span
                                    className={cn(
                                        "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold",
                                        status.className,
                                    )}
                                >
                                    {statusText}
                                </span>
                            )}
                            <ChevronRight
                                className="h-4 w-4 shrink-0 text-slate-400"
                                aria-hidden="true"
                            />
                        </button>
                    </li>
                );
            })}
        </ul>
    );
};
