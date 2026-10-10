import { useStore } from "@nanostores/react";
import { EyeIcon, EyeOffIcon, LockIcon, UnlockIcon } from "lucide-react";
import { VscChevronDown, VscTrash } from "react-icons/vsc";

import { QuestionGameBar } from "@/components/game/QuestionGameBar";
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
    draftsOnMap,
    isLoading,
    questions,
    questionStatuses,
    updateQuestion,
    updateQuestions,
} from "@/lib/context";
import { DRAWS } from "@/lib/game/deck";
import { gameRole, gameState } from "@/lib/game/session";
import { canChangeQuestion } from "@/lib/game/sync";
import { cn } from "@/lib/utils";

import { QuestionInfoButton } from "./QuestionInfoButton";

/**
 * The frame of a question card: the title, folding, the lock and hide
 * buttons, sharing and deleting. Folded, locked and hidden are the
 * question's own fields, so every card follows the saved question.
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
    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    const lockedByGame = !canChangeQuestion(questionKey, $game, $role);

    const isCollapsed = question?.data.collapsed ?? false;
    const locked = question ? !question.data.drag : false;
    const hidden = question?.data.hidden ?? false;
    const draw = question ? DRAWS[question.id] : undefined;
    const isDraft =
        !!$game &&
        ($game.questions[String(questionKey)]?.state ?? "draft") === "draft";

    /** "Only the open card" drafts: this one opens, the other drafts fold. */
    const focusDraft = () => {
        if (!isDraft || draftsOnMap.get() !== "active") return;
        const otherDrafts = questions
            .get()
            .filter(
                (other) =>
                    other.key !== questionKey &&
                    ($game?.questions[String(other.key)]?.state ?? "draft") ===
                        "draft",
            )
            .map((other) => other.key);
        updateQuestions(otherDrafts, { collapsed: true });
        updateQuestion(questionKey, { collapsed: false });
    };

    const toggleCollapse = () => {
        if (isCollapsed) {
            activeQuestionKey.set(questionKey);
            focusDraft();
        }
        updateQuestion(questionKey, { collapsed: !isCollapsed });
    };

    return (
        <>
            <SidebarGroup
                className={cn(
                    "transition-colors",
                    isActive &&
                        "bg-blue-500/10 ring-1 ring-inset ring-blue-500/60",
                    className,
                )}
                onPointerDown={() => {
                    if (activeQuestionKey.get() !== questionKey) {
                        activeQuestionKey.set(questionKey);
                        focusDraft();
                    }
                }}
                data-active={isActive || undefined}
            >
                <div className="relative">
                    <button
                        onClick={toggleCollapse}
                        className={cn(
                            "absolute top-2 left-2 text-white border rounded-md transition-transform duration-200",
                            isCollapsed && "-rotate-90",
                        )}
                    >
                        <VscChevronDown />
                    </button>
                    <SidebarGroupLabel
                        className="ml-8 mr-8 cursor-pointer"
                        onClick={toggleCollapse}
                    >
                        {label} {sub && `(${sub})`}
                        {draw && (
                            <span
                                className="ml-2 text-[10px] font-normal text-slate-400"
                                title="What the hider draws from the deck for answering"
                            >
                                hider draws {draw.draw}, keeps {draw.keep}
                            </span>
                        )}
                    </SidebarGroupLabel>
                    {question && (
                        <QuestionInfoButton
                            category={question.id}
                            type={
                                (
                                    question.data as {
                                        type?: string;
                                        locationType?: string;
                                    }
                                ).type ??
                                (question.data as { locationType?: string })
                                    .locationType
                            }
                        />
                    )}
                    <QuestionGameBar questionKey={questionKey} />
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
                                applied. Ask it again (it costs double).
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
                    <SidebarGroupContent
                        className={cn(
                            "overflow-hidden transition-[max-height] duration-200 max-h-[100rem]", // 100rem is arbitrary
                            isCollapsed && "max-h-0 duration-150",
                        )}
                    >
                        <SidebarMenu>{children}</SidebarMenu>
                        <div className="flex gap-1 pt-1 px-2 justify-end">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        disabled={$isLoading || lockedByGame}
                                        title={
                                            lockedByGame
                                                ? "Answered: only the hider can delete it"
                                                : "Delete question"
                                        }
                                        variant="outline"
                                        size="sm"
                                    >
                                        <VscTrash />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>
                                            Delete this question?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                            You can undo this for a few seconds
                                            afterwards.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>
                                            Cancel
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={() =>
                                                showUndoToast(
                                                    "Question deleted.",
                                                    deleteQuestion(questionKey),
                                                )
                                            }
                                            className="mb-2 sm:mb-0"
                                        >
                                            Delete Question
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    updateQuestion(questionKey, {
                                        drag: locked,
                                    })
                                }
                                disabled={$isLoading}
                                aria-label={
                                    locked ? "Unlock question" : "Lock question"
                                }
                                aria-pressed={locked}
                            >
                                {locked ? <LockIcon /> : <UnlockIcon />}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
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
                            </Button>
                        </div>
                    </SidebarGroupContent>
                </div>
            </SidebarGroup>
            <Separator className="h-1" />
        </>
    );
};
