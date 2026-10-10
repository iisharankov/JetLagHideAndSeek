import { useStore } from "@nanostores/react";
import { useState } from "react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { questions } from "@/lib/context";
import {
    answerChoices,
    describeAnswer,
    isCurrentAnswer,
} from "@/lib/game/answers";
import { DRAWS } from "@/lib/game/hand";
import {
    gameRole,
    gameState,
    sendOp,
    suggestedAnswers,
} from "@/lib/game/session";
import { cn } from "@/lib/utils";

const ago = (time: number) => {
    const minutes = Math.round((Date.now() - time) / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    return `${Math.round(minutes / 60)} h ago`;
};

const STATE_TEXT = {
    draft: "Draft: only seekers see this",
    asked: "Asked: waiting for the hider",
    answered: "Answered",
};

/**
 * A question's place in a shared game: its state, who changed it last, and
 * the next step (send it to the hider; the hider's answer).
 */
export const QuestionGameBar = ({ questionKey }: { questionKey: number }) => {
    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    const $suggestions = useStore(suggestedAnswers);
    const $questions = useStore(questions);
    const [changing, setChanging] = useState(false);
    if (!$game) return null;

    const question = $questions.find((q) => q.key === questionKey);
    const entry = $game.questions[String(questionKey)];
    if (!question) return null;
    if (!entry) {
        return <p className="mx-2 mb-1 text-xs text-slate-400">Sending…</p>;
    }

    const mayAnswer = $role === "hider" || $game.settings.seekersCanAnswer;
    const suggestion = $suggestions[questionKey];
    const choices = answerChoices(question);
    const isSuggested = (choice: (typeof choices)[number]) =>
        !!suggestion &&
        JSON.stringify(choice.answer) === JSON.stringify(suggestion.answer);
    const showChoices =
        mayAnswer &&
        (entry.state === "asked" || (entry.state === "answered" && changing));

    return (
        <div
            className={cn(
                "mx-2 mb-1 rounded-md px-2 py-1 text-xs",
                entry.state === "draft" && "bg-amber-900/40 text-amber-100",
                entry.state === "asked" && "bg-blue-900/50 text-blue-100",
                entry.state === "answered" && "bg-green-900/40 text-green-100",
            )}
            data-testid="question-game-state"
            data-state={entry.state}
        >
            <p>
                <strong>{STATE_TEXT[entry.state]}</strong>
                {entry.state === "answered" && `: ${describeAnswer(question)}`}
            </p>
            <p className="opacity-80">
                {entry.updatedBy === entry.createdBy
                    ? `By ${entry.createdBy}`
                    : `Changed by ${entry.updatedBy}`}{" "}
                · {ago(entry.updatedAt)}
            </p>
            {entry.state === "draft" && $role === "seeker" && (
                <Button
                    size="sm"
                    className="mt-1 w-full"
                    onClick={() =>
                        void sendOp({ type: "sendQuestion", key: questionKey })
                    }
                >
                    Send to the hider
                </Button>
            )}
            {showChoices && (
                <div className="mt-1 flex flex-col gap-1">
                    <p>
                        {suggestion
                            ? `Hider mode suggests: ${suggestion.label}`
                            : "Send the answer:"}
                    </p>
                    <div className="flex flex-wrap gap-1">
                        {choices.map((choice) => (
                            <Button
                                key={choice.label}
                                size="sm"
                                variant={
                                    isSuggested(choice) ||
                                    (entry.state === "answered" &&
                                        isCurrentAnswer(question, choice))
                                        ? "default"
                                        : "outline"
                                }
                                title={
                                    isSuggested(choice)
                                        ? "Suggested by hider mode"
                                        : undefined
                                }
                                onClick={() => {
                                    setChanging(false);
                                    void sendOp({
                                        type: "answerQuestion",
                                        key: questionKey,
                                        answer: choice.answer,
                                        basedOn: entry.updatedAt,
                                    });
                                    const draw = DRAWS[question.id];
                                    if ($role === "hider" && draw) {
                                        toast.info(
                                            $game.settings.deck === "virtual"
                                                ? `Draw ${draw.draw}, keep ${draw.keep}: select your new cards in Cards.`
                                                : `Draw ${draw.draw}, keep ${draw.keep}. Record what you kept in Cards.`,
                                            {
                                                toastId: "draw",
                                                autoClose: 8000,
                                            },
                                        );
                                    }
                                }}
                            >
                                {choice.label}
                            </Button>
                        ))}
                    </div>
                </div>
            )}
            {entry.state === "answered" && mayAnswer && !changing && (
                <Button
                    size="sm"
                    variant="outline"
                    className="mt-1"
                    onClick={() => setChanging(true)}
                >
                    Change the answer
                </Button>
            )}
        </div>
    );
};
