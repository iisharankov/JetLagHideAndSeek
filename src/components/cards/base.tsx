import { useStore } from "@nanostores/react";
import {
    ChevronLeft,
    EyeIcon,
    EyeOffIcon,
    Hand,
    LockIcon,
    Send,
    UnlockIcon,
} from "lucide-react";
import { createContext, useContext, useEffect, useRef } from "react";
import { VscTrash } from "react-icons/vsc";

import { DrawBadge, RepeatBadge } from "@/components/ask/QuestionTypes";
import { QuestionGameBar, useRefusal } from "@/components/game/QuestionGameBar";
import { AskFromPanel, useSendQuestion } from "@/components/game/SendQuestion";
import { ThermometerBar } from "@/components/game/ThermometerBar";
import { useRuleInfo } from "@/components/RuleInfo";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
} from "@/components/ui/sidebar-l";
import { showUndoToast } from "@/components/undoToast";
import { useTick } from "@/hooks/useTick";
import {
    activeQuestionKey,
    cardOverMap,
    deleteQuestion,
    isLoading,
    questions,
    questionStatuses,
    updateQuestion,
} from "@/lib/context";
import { ago } from "@/lib/format";
import {
    answerTimeLeft,
    answerTimerText,
    answerTimerTone,
} from "@/lib/game/answerTimer";
import { DRAWS } from "@/lib/game/deck";
import { costWord, timesAskedBefore } from "@/lib/game/questionIdentity";
import { serverNow } from "@/lib/game/serverTime";
import { gameRole, gameState, sendOp } from "@/lib/game/session";
import type { QuestionEntry, SharedQuestion } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { frameQuestion } from "@/maps/frameQuestion";
import type { Question } from "@/maps/schema";

import { CardBody, type CardParts, FootTool, WhatIfChip } from "./layout";

/** The foot's middle when it isn't a big button: a wide, quiet one. */
const FOOT_WIDE =
    "inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-slate-600 px-3 text-sm font-semibold hover:bg-white/10 disabled:opacity-40 [&>svg]:h-4 [&>svg]:w-4";

const TIMER_TONE = {
    ok: "text-slate-200",
    warning: "text-amber-300",
    overdue: "text-red-300",
};

/** "By Ana · 2 min ago", "Sent by Ana · 1 min ago": under the title. */
const byline = (entry: QuestionEntry | undefined) => {
    if (!entry) return null;
    if (entry.state === "draft") {
        return `${
            entry.updatedBy === entry.createdBy
                ? `By ${entry.createdBy}`
                : `Changed by ${entry.updatedBy}`
        } · ${ago(entry.updatedAt, serverNow())}`;
    }
    return `Sent by ${entry.createdBy} · ${ago(
        entry.askedAt ?? entry.updatedAt,
        serverNow(),
    )}`;
};

/**
 * The foot's middle (round 46, between Hide and Delete): Send on a draft
 * (Start, then Ask, on a thermometer), the time left while the hider
 * answers; playing alone, the lock.
 */
const FootMiddle = ({
    question,
    questionKey,
    entry,
    send,
}: {
    question: Question;
    questionKey: number;
    entry: QuestionEntry | undefined;
    send: ReturnType<typeof useSendQuestion>;
}) => {
    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    const $isLoading = useStore(isLoading);
    const refusal = useRefusal(question, entry);
    useTick(entry?.state === "asked");
    const locked = !question.data.drag;
    if (!$game) {
        return (
            <button
                type="button"
                className={FOOT_WIDE}
                onClick={() => updateQuestion(questionKey, { drag: locked })}
                disabled={$isLoading}
                aria-label={locked ? "Unlock question" : "Lock question"}
                aria-pressed={locked}
                title="Locked questions keep their place and answer"
            >
                {locked ? <LockIcon /> : <UnlockIcon />}
                {locked ? "Locked" : "Unlocked"}
            </button>
        );
    }
    if (question.data.research) return null;
    if (!entry) {
        return (
            <p className="flex w-full items-center justify-center text-sm text-slate-400">
                Sending…
            </p>
        );
    }
    const seeker = $role === "seeker";
    if (
        question.id === "thermometer" &&
        (entry.state === "draft" || entry.state === "armed")
    ) {
        return seeker ? (
            <ThermometerBar
                data={question.data}
                questionKey={questionKey}
                armed={entry.state === "armed"}
                refused={refusal !== null}
                part="action"
            />
        ) : null;
    }
    if (entry.state === "draft" && seeker) {
        return (
            <Button
                className="h-14 w-full rounded-xl bg-blue-600 px-2 text-lg font-bold text-white shadow-lg shadow-blue-900/50 hover:bg-blue-500 md:text-base [&_svg]:size-5"
                disabled={refusal !== null || send.away !== null}
                data-tutorial-id="send-question"
                onClick={send.start}
            >
                <Send aria-hidden />
                Send
            </Button>
        );
    }
    const timeLeft = answerTimeLeft(entry, serverNow());
    if (timeLeft !== null) {
        const tone = answerTimerTone(timeLeft);
        return (
            <p
                className={cn(
                    "flex w-full items-center justify-center rounded-xl border border-slate-600 bg-slate-800/70 px-2 text-center text-sm font-semibold tabular-nums",
                    TIMER_TONE[tone],
                )}
                data-testid="answer-timer"
                data-tone={tone}
            >
                ⏳ {answerTimerText(timeLeft)}
            </p>
        );
    }
    return null;
};

/** In a shared game: what the question's state is there, else null. */
export const useGameQuestionState = (questionKey: number) => {
    const $game = useStore(gameState);
    return $game?.questions[String(questionKey)]?.state ?? null;
};

/**
 * Once a question has gone to the hider nothing about it can change: the
 * card shows what was asked and what was answered, no controls.
 */
export const useFrozen = (questionKey: number) => {
    const state = useGameQuestionState(questionKey);
    return state !== null && state !== "draft";
};

/**
 * The open question's heading ("Question 3 · Radar", QuestionList.tsx) and
 * the way back to the list.
 */
export const QuestionHeading = createContext<{
    title: string;
    back: () => void;
} | null>(null);

/**
 * The frame of a question's card (round 46): the header (back, the cost and
 * ×2, the title and who made it, ⓘ), the game's state, the middle in the
 * layout Settings chose (`parts`; `children` for what was asked once it's
 * fixed), and the foot: Hide · Send · Delete. On a phone the open card
 * leaves the map showing between its header and the rest, with What if on
 * the map. Locked and hidden are the question's own fields, so every card
 * follows the saved question.
 */
export const QuestionCard = ({
    children,
    questionKey,
    className,
    label,
    sub,
    parts,
}: {
    children?: React.ReactNode;
    questionKey: number;
    className?: string;
    label?: string;
    sub?: string;
    /** The choices, laid out as Settings says; none once it's fixed. */
    parts?: CardParts | null;
}) => {
    const $questions = useStore(questions);
    const $isLoading = useStore(isLoading);
    const status = useStore(questionStatuses)[questionKey];
    const question = $questions.find((q) => q.key === questionKey);
    const isActive = useStore(activeQuestionKey) === questionKey;
    const heading = useContext(QuestionHeading);
    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    const $over = useStore(cardOverMap);
    const entry = $game?.questions[String(questionKey)];
    // Asked or answered: deleting takes both sides.
    const byAgreement = !!entry && entry.state !== "draft";
    const deleteRequest = $game?.deleteRequests?.[String(questionKey)];
    // On a phone, the open card over the map.
    const overMap = $over && !!heading;
    const gap = useRef<HTMLDivElement>(null);
    const send = useSendQuestion(question!, questionKey);

    const hidden = question?.data.hidden ?? false;
    const draw = question ? DRAWS[question.id] : undefined;
    // The hider's research questions never join the game.
    const research = !!question?.data.research;
    const before =
        question &&
        $game &&
        (entry?.state === "draft" || entry?.state === "armed")
            ? timesAskedBefore($game, question as unknown as SharedQuestion)
            : 0;
    const info = useRuleInfo(
        question?.id ?? "radius",
        question
            ? ((question.data as { type?: string; locationType?: string })
                  .type ??
                  (question.data as { locationType?: string }).locationType)
            : undefined,
    );
    // Opened over the map: the map frames the question in the gap, and
    // again when its distance changes (not while its pin is dragged).
    const data = (question?.data ?? {}) as Record<string, unknown>;
    const frameKey = `${questionKey}|${String(data.radius)}|${String(data.distanceKm)}`;
    useEffect(() => {
        if (!overMap || !question) return;
        const frame = requestAnimationFrame(() => {
            const box = gap.current?.getBoundingClientRect();
            if (box) frameQuestion(question, box);
        });
        return () => cancelAnimationFrame(frame);
    }, [overMap, frameKey]);

    const guess = parts?.guess ? <WhatIfChip guess={parts.guess} /> : null;
    const draggable = !!question?.data.drag && !!parts && parts.location;
    return (
        <>
            <SidebarGroup
                className={cn(
                    "transition-colors",
                    overMap
                        ? "pointer-events-none flex-1 p-0"
                        : isActive &&
                              "bg-blue-500/10 ring-1 ring-inset ring-blue-500/60",
                    className,
                )}
                onPointerDown={() => activeQuestionKey.set(questionKey)}
                data-active={isActive || undefined}
            >
                <div
                    className={cn(
                        "relative",
                        overMap &&
                            "pointer-events-auto bg-sidebar px-2 pb-1 shadow-md",
                    )}
                >
                    <div
                        className="flex items-center gap-1.5 pl-1 pr-1 pt-1"
                        data-testid="card-header"
                    >
                        {heading && (
                            <button
                                type="button"
                                onClick={heading.back}
                                className="inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-lg bg-slate-800 pl-1 pr-3 text-sm font-semibold text-blue-200 hover:bg-slate-700 md:min-h-9"
                                aria-label="All questions"
                            >
                                <ChevronLeft className="h-5 w-5" />
                                List
                            </button>
                        )}
                        <div className="min-w-0 flex-1">
                            <SidebarGroupLabel className="h-auto px-1 text-[15px] font-semibold leading-tight text-white md:text-sm">
                                <span className="line-clamp-2">
                                    {heading?.title ?? label}{" "}
                                    {sub && `(${sub})`}
                                </span>
                            </SidebarGroupLabel>
                            {/* The cost and ×2 side by side, then who made it. */}
                            <div className="flex min-w-0 items-center gap-1 px-1 pt-0.5">
                                {question && draw && (
                                    <DrawBadge kind={question.id} />
                                )}
                                <RepeatBadge
                                    before={before}
                                    className="shrink-0 py-0.5 text-xs"
                                />
                                {byline(entry) && (
                                    <p className="ml-0.5 truncate text-xs text-slate-400">
                                        {byline(entry)}
                                    </p>
                                )}
                            </div>
                        </div>
                        {question && info.button}
                    </div>
                    {info.panel}
                </div>
                {overMap && (
                    <div
                        ref={gap}
                        className="relative min-h-40 flex-1"
                        data-testid="card-map-window"
                    >
                        {guess && (
                            <div className="pointer-events-auto absolute left-3 top-3">
                                {guess}
                            </div>
                        )}
                        {draggable && (
                            <p className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg bg-white/95 px-2.5 py-1.5 text-xs font-semibold text-slate-800 shadow">
                                <Hand className="h-4 w-4" aria-hidden />
                                Drag the pin to move it
                            </p>
                        )}
                    </div>
                )}
                <div
                    className={cn(
                        overMap &&
                            "pointer-events-auto rounded-t-2xl bg-sidebar pt-2 shadow-[0_-8px_24px_rgba(0,0,0,0.45)]",
                    )}
                >
                    {deleteRequest && (
                        <div
                            className="mx-2 mb-1 rounded-md border border-red-500/60 bg-red-950/40 px-2 py-1 text-xs"
                            data-testid="delete-request"
                        >
                            {deleteRequest.role === $role ? (
                                <>
                                    <p>
                                        Waiting for the other side to agree to
                                        deleting this question.
                                    </p>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="mt-1"
                                        onClick={() =>
                                            void sendOp({
                                                type: "keepQuestion",
                                                key: questionKey,
                                            })
                                        }
                                    >
                                        Withdraw
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <p>
                                        <strong>{deleteRequest.by}</strong> asks
                                        to delete this question.
                                    </p>
                                    <div className="mt-1 flex gap-1">
                                        <Button
                                            size="sm"
                                            onClick={() =>
                                                void sendOp({
                                                    type: "deleteQuestion",
                                                    key: questionKey,
                                                })
                                            }
                                        >
                                            Delete too
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                                void sendOp({
                                                    type: "keepQuestion",
                                                    key: questionKey,
                                                })
                                            }
                                        >
                                            Keep it
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                    {status?.state === "skipped" &&
                        status.reason === "inactive-draft" && (
                            <p
                                role="status"
                                className="mx-2 mb-1 rounded-md bg-slate-700/60 px-2 py-1 text-xs text-slate-200"
                            >
                                Draft only outlined: tap the card to show it on
                                the map (Settings → drafts: only the open card).
                            </p>
                        )}
                    {status?.state === "skipped" &&
                        status.reason === "vetoed" && (
                            <p
                                role="status"
                                className="mx-2 mb-1 rounded-md bg-slate-700/60 px-2 py-1 text-xs text-slate-200"
                            >
                                Vetoed: the hider gave no answer, so nothing is
                                applied. Ask it again (it costs{" "}
                                {costWord(
                                    1 +
                                        (question && $game
                                            ? timesAskedBefore(
                                                  $game,
                                                  question as unknown as SharedQuestion,
                                              )
                                            : 0),
                                )}
                                ).
                            </p>
                        )}
                    {status?.state === "skipped" &&
                        status.reason === "before-endgame" && (
                            <p
                                role="status"
                                className="mx-2 mb-1 rounded-md bg-slate-700/60 px-2 py-1 text-xs text-slate-200"
                            >
                                Asked before the end game: not applied any more.
                            </p>
                        )}
                    {(status?.state === "error" ||
                        status?.state === "not-applicable") && (
                        <p
                            role="status"
                            className={cn(
                                "mx-2 mb-1 rounded-md px-2 py-1 text-xs",
                                status.state === "error"
                                    ? "bg-red-900/70 text-red-100"
                                    : "bg-amber-900/60 text-amber-100",
                            )}
                        >
                            {status.state === "error"
                                ? "Not applied: "
                                : "Not applicable: "}
                            {status.message}
                        </p>
                    )}
                    <SidebarGroupContent>
                        {!overMap && guess && (
                            <div className="px-3 py-1.5">{guess}</div>
                        )}
                        {parts && <CardBody parts={parts} />}
                        <SidebarMenu>{children}</SidebarMenu>
                        {/* What was asked, then where it stands: the hider's answer, the time. */}
                        {!research && (
                            <QuestionGameBar questionKey={questionKey} />
                        )}
                        {/* The card's own actions, at its foot: Send in the middle (round 46). */}
                        <div
                            className="mt-2 flex flex-col gap-2 border-t border-slate-700/70 px-3 py-2"
                            data-testid="card-actions"
                        >
                            {send.away !== null && question && (
                                <AskFromPanel
                                    question={question}
                                    away={send.away}
                                    send={send.send}
                                    cancel={send.cancel}
                                />
                            )}
                            <div className="flex items-stretch gap-2">
                                <FootTool
                                    icon={hidden ? <EyeOffIcon /> : <EyeIcon />}
                                    word={hidden ? "Show" : "Hide"}
                                    onClick={() =>
                                        updateQuestion(questionKey, {
                                            hidden: !hidden,
                                        })
                                    }
                                    disabled={$isLoading}
                                    aria-label={
                                        hidden
                                            ? "Show question"
                                            : "Hide question"
                                    }
                                    aria-pressed={hidden}
                                    title={
                                        hidden
                                            ? "Show it on the map again"
                                            : "Hide it from the map"
                                    }
                                />
                                <div className="flex min-w-0 flex-1">
                                    {question && (
                                        <FootMiddle
                                            question={question}
                                            questionKey={questionKey}
                                            entry={entry}
                                            send={send}
                                        />
                                    )}
                                </div>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <FootTool
                                            icon={<VscTrash />}
                                            word="Delete"
                                            className="text-red-300"
                                            disabled={$isLoading}
                                            title={
                                                byAgreement
                                                    ? "Ask to delete it (the other side must agree)"
                                                    : "Delete question"
                                            }
                                            aria-label="Delete question"
                                        />
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>
                                                Delete this question?
                                            </AlertDialogTitle>
                                            <AlertDialogDescription>
                                                {byAgreement
                                                    ? "It's part of the game: the other side gets a note and must agree before it goes."
                                                    : "You can undo this for a few seconds afterwards."}
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>
                                                Cancel
                                            </AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={() => {
                                                    if (byAgreement) {
                                                        void sendOp({
                                                            type: "deleteQuestion",
                                                            key: questionKey,
                                                        });
                                                        return;
                                                    }
                                                    showUndoToast(
                                                        "Question deleted.",
                                                        deleteQuestion(
                                                            questionKey,
                                                        ),
                                                    );
                                                }}
                                                className="mb-2 sm:mb-0"
                                            >
                                                {byAgreement
                                                    ? "Ask to delete"
                                                    : "Delete Question"}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                    </SidebarGroupContent>
                </div>
            </SidebarGroup>
            {!overMap && <Separator className="h-1" />}
        </>
    );
};
