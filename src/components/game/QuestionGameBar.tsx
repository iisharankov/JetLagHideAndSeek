import { useStore } from "@nanostores/react";
import { useState } from "react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { useTick } from "@/hooks/useTick";
import { questions } from "@/lib/context";
import {
    answerChoices,
    describeAnswer,
    isCurrentAnswer,
} from "@/lib/game/answers";
import {
    answerTimeLeft,
    answerTimerText,
    answerTimerTone,
} from "@/lib/game/answerTimer";
import { DRAWS } from "@/lib/game/hand";
import { timesAnsweredBefore } from "@/lib/game/questionIdentity";
import { serverNow } from "@/lib/game/serverTime";
import {
    gameRole,
    gameState,
    sendOp,
    suggestedAnswers,
} from "@/lib/game/session";
import type { SharedQuestion } from "@/lib/game/types";
import { cn } from "@/lib/utils";

const ago = (time: number) => {
    const minutes = Math.round((serverNow() - time) / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    return `${Math.round(minutes / 60)} h ago`;
};

const STATE_TEXT = {
    draft: "Draft: only seekers see this",
    asked: "Asked: waiting for the hider",
    answered: "Answered",
    vetoed: "Vetoed by the hider: no answer, not applied",
};

const TONE_CLASS = {
    ok: "opacity-80",
    warning: "font-semibold text-amber-300",
    overdue: "font-semibold text-red-300",
};

/**
 * A question's place in a shared game: its state, who changed it last, the
 * time left to answer, and the next step (send it to the hider; the hider's
 * answer, veto or randomize).
 */
export const QuestionGameBar = ({ questionKey }: { questionKey: number }) => {
    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    const $suggestions = useStore(suggestedAnswers);
    const $questions = useStore(questions);
    const [changing, setChanging] = useState(false);
    const entry = $game?.questions[String(questionKey)];
    // The countdown ticks while the hider has the question.
    useTick(entry?.state === "asked");
    if (!$game) return null;

    const question = $questions.find((q) => q.key === questionKey);
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
    const hand = $game.deck?.hand;
    // Veto and Randomize: instead of answering. With the digital deck only
    // with the card in hand.
    const canVeto =
        $role === "hider" &&
        entry.state === "asked" &&
        (hand ? hand.includes("powerup_veto_question") : true);
    const canRandomize =
        $role === "hider" &&
        entry.state === "asked" &&
        question.id !== "thermometer" &&
        (hand ? hand.includes("powerup_randomize_question") : true);
    const timeLeft = answerTimeLeft(entry, serverNow());
    const askedBefore =
        entry.state === "draft"
            ? timesAnsweredBefore($game, question as unknown as SharedQuestion)
            : 0;

    return (
        <div
            className={cn(
                "mx-2 mb-1 rounded-md px-2 py-1 text-xs",
                entry.state === "draft" && "bg-amber-900/40 text-amber-100",
                entry.state === "asked" && "bg-blue-900/50 text-blue-100",
                entry.state === "answered" && "bg-green-900/40 text-green-100",
                entry.state === "vetoed" && "bg-slate-700/60 text-slate-200",
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
            {timeLeft !== null && (
                <p
                    className={TONE_CLASS[answerTimerTone(timeLeft)]}
                    data-testid="answer-timer"
                    data-tone={answerTimerTone(timeLeft)}
                >
                    ⏳ {answerTimerText(timeLeft)}
                </p>
            )}
            {entry.randomizedFrom && (
                <p className="opacity-80" data-testid="randomized-from">
                    Randomized: it was {entry.randomizedFrom}.
                </p>
            )}
            {askedBefore > 0 && (
                <p
                    className="font-semibold text-amber-300"
                    data-testid="asked-before"
                >
                    Asked before this round: it costs double (the hider draws
                    twice).
                </p>
            )}
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
            {(canVeto || canRandomize) && (
                <div className="mt-1 flex flex-wrap gap-1">
                    {canVeto && (
                        <Button
                            size="sm"
                            variant="outline"
                            title="Play Veto Question: no answer, no cards for you"
                            onClick={() => {
                                if (
                                    window.confirm(
                                        "Veto this question? No answer is given and you draw no cards.",
                                    )
                                ) {
                                    void sendOp({
                                        type: "vetoQuestion",
                                        key: questionKey,
                                    });
                                }
                            }}
                        >
                            Veto
                        </Button>
                    )}
                    {canRandomize && (
                        <Button
                            size="sm"
                            variant="outline"
                            title="Play Randomize Question: another question of this kind, chosen at random, which you answer instead"
                            onClick={() => {
                                if (
                                    window.confirm(
                                        "Randomize this question? It becomes another question of its kind, chosen at random, which you answer instead.",
                                    )
                                ) {
                                    void sendOp({
                                        type: "randomizeQuestion",
                                        key: questionKey,
                                    });
                                }
                            }}
                        >
                            Randomize
                        </Button>
                    )}
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
