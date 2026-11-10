import { useStore } from "@nanostores/react";
import {
    ChevronLeft,
    EyeIcon,
    EyeOffIcon,
    LockIcon,
    UnlockIcon,
} from "lucide-react";
import { createContext, useContext } from "react";
import { VscTrash } from "react-icons/vsc";

import { DrawBadge } from "@/components/ask/QuestionTypes";
import { QuestionGameBar } from "@/components/game/QuestionGameBar";
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
import {
    activeQuestionKey,
    deleteQuestion,
    isLoading,
    questions,
    questionStatuses,
    updateQuestion,
} from "@/lib/context";
import { DRAWS } from "@/lib/game/deck";
import { costWord, timesAskedBefore } from "@/lib/game/questionIdentity";
import { gameRole, gameState, sendOp } from "@/lib/game/session";
import type { SharedQuestion } from "@/lib/game/types";
import { cn } from "@/lib/utils";

/** The card's foot: a label and an icon, 44 px on phones. */
const FOOT_BUTTON =
    "inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-600 px-3 text-sm font-semibold hover:bg-white/10 disabled:opacity-40 md:min-h-9 [&>svg]:h-4 [&>svg]:w-4";

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
 * The frame of a question's open card: back to the list, the title with
 * hide, delete and ⓘ, and (playing alone) the lock. Locked and hidden are
 * the question's own fields, so every card follows the saved question. In
 * a shared game an answered question is locked for everyone.
 */
export const QuestionCard = ({
    children,
    questionKey,
    className,
    label,
    sub,
}: {
    children: React.ReactNode;
    questionKey: number;
    className?: string;
    label?: string;
    sub?: string;
}) => {
    const $questions = useStore(questions);
    const $isLoading = useStore(isLoading);
    const status = useStore(questionStatuses)[questionKey];
    const question = $questions.find((q) => q.key === questionKey);
    const isActive = useStore(activeQuestionKey) === questionKey;
    const heading = useContext(QuestionHeading);
    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    const entry = $game?.questions[String(questionKey)];
    // Asked or answered: deleting takes both sides.
    const byAgreement = !!entry && entry.state !== "draft";
    const deleteRequest = $game?.deleteRequests?.[String(questionKey)];

    const locked = question ? !question.data.drag : false;
    const hidden = question?.data.hidden ?? false;
    const draw = question ? DRAWS[question.id] : undefined;
    // The hider's research questions never join the game.
    const research = !!question?.data.research;
    const info = useRuleInfo(
        question?.id ?? "radius",
        question
            ? ((question.data as { type?: string; locationType?: string })
                  .type ??
                  (question.data as { locationType?: string }).locationType)
            : undefined,
    );
    return (
        <>
            <SidebarGroup
                className={cn(
                    "transition-colors",
                    isActive &&
                        "bg-blue-500/10 ring-1 ring-inset ring-blue-500/60",
                    className,
                )}
                onPointerDown={() => activeQuestionKey.set(questionKey)}
                data-active={isActive || undefined}
            >
                <div className="relative">
                    <div className="flex items-center gap-1 pl-1 pr-1 pt-1">
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
                        {question && draw && <DrawBadge kind={question.id} />}
                        <SidebarGroupLabel className="h-auto min-w-0 flex-1 text-base font-semibold text-white md:text-sm">
                            {heading?.title ?? label} {sub && `(${sub})`}
                        </SidebarGroupLabel>
                        {question && info.button}
                    </div>
                    {info.panel}
                    {!research && <QuestionGameBar questionKey={questionKey} />}
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
                        <SidebarMenu>{children}</SidebarMenu>
                        {/* The card's own actions, at its foot: big enough to hit, out of the title's way. */}
                        <div
                            className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-700/70 px-3 py-2"
                            data-testid="card-actions"
                        >
                            <button
                                type="button"
                                className={FOOT_BUTTON}
                                onClick={() =>
                                    updateQuestion(questionKey, {
                                        hidden: !hidden,
                                    })
                                }
                                disabled={$isLoading}
                                aria-label={
                                    hidden ? "Show question" : "Hide question"
                                }
                                aria-pressed={hidden}
                            >
                                {hidden ? <EyeOffIcon /> : <EyeIcon />}
                                {hidden
                                    ? "Show on the map"
                                    : "Hide from the map"}
                            </button>
                            {!$game && (
                                <button
                                    type="button"
                                    className={FOOT_BUTTON}
                                    onClick={() =>
                                        updateQuestion(questionKey, {
                                            drag: locked,
                                        })
                                    }
                                    disabled={$isLoading}
                                    aria-label={
                                        locked
                                            ? "Unlock question"
                                            : "Lock question"
                                    }
                                    aria-pressed={locked}
                                    title="Locked questions keep their place and answer"
                                >
                                    {locked ? <LockIcon /> : <UnlockIcon />}
                                    {locked ? "Locked" : "Unlocked"}
                                </button>
                            )}
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <button
                                        type="button"
                                        className={cn(
                                            FOOT_BUTTON,
                                            "ml-auto text-red-300",
                                        )}
                                        disabled={$isLoading}
                                        title={
                                            byAgreement
                                                ? "Ask to delete it (the other side must agree)"
                                                : "Delete question"
                                        }
                                        aria-label="Delete question"
                                    >
                                        <VscTrash />
                                        Delete
                                    </button>
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
                                                    deleteQuestion(questionKey),
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
                    </SidebarGroupContent>
                </div>
            </SidebarGroup>
            <Separator className="h-1" />
        </>
    );
};
