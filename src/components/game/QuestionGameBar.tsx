import { useStore } from "@nanostores/react";
import * as turf from "@turf/turf";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useTick } from "@/hooks/useTick";
import { questions } from "@/lib/context";
import {
    answerChoices,
    answerOf,
    type Choice,
    describeAnswer,
    type TentaclePlace,
} from "@/lib/game/answers";
import {
    answerTimeLeft,
    answerTimerText,
    answerTimerTone,
} from "@/lib/game/answerTimer";
import {
    blockingCurses,
    kindRefusal,
    questionKind,
} from "@/lib/game/curseRules";
import { DRAWS } from "@/lib/game/hand";
import { timesAnsweredBefore } from "@/lib/game/questionIdentity";
import { questionReference } from "@/lib/game/reference";
import { serverNow } from "@/lib/game/serverTime";
import {
    gameRole,
    gameState,
    previewAnswers,
    sendOp,
    suggestedAnswers,
} from "@/lib/game/session";
import type { QuestionEntry, SharedQuestion } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { findTentacleLocations } from "@/maps/api";
import { errorMessage } from "@/maps/errors";
import { filterPointsWithinRadius } from "@/maps/questions/tentacles";
import type { Question } from "@/maps/schema";

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

const same = (a: unknown, b: unknown) =>
    JSON.stringify(a) === JSON.stringify(b);

/** Tentacles: the places of the kind within reach, to answer with. */
const useTentaclePlaces = (question: Question) => {
    const [places, setPlaces] = useState<TentaclePlace[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const data = question.data as Record<string, any>;
    const key =
        question.id === "tentacles"
            ? JSON.stringify([
                  data.locationType,
                  data.lat,
                  data.lng,
                  data.radius,
                  data.unit,
                  data.locationType === "custom" ? data.places : null,
              ])
            : "";
    useEffect(() => {
        if (question.id !== "tentacles") return;
        let cancelled = false;
        setPlaces(null);
        setError(null);
        const load =
            data.locationType === "custom"
                ? Promise.resolve(turf.featureCollection(data.places))
                : findTentacleLocations(data as any);
        load.then((found) =>
            filterPointsWithinRadius(
                found,
                data.lng,
                data.lat,
                data.radius,
                data.unit,
            ),
        ).then(
            (within) => {
                if (cancelled) return;
                setPlaces(
                    within.features.map((feature: any) => ({
                        name: feature.properties.name,
                        feature,
                    })),
                );
            },
            (failure) => !cancelled && setError(errorMessage(failure)),
        );
        return () => {
            cancelled = true;
        };
    }, [key]);
    return { places, error };
};

/** What the seekers' question refers to (their station, their zone…). */
const ReferenceLine = ({ question }: { question: Question }) => {
    const [text, setText] = useState<string | null>(null);
    const data = question.data as Record<string, any>;
    const key = JSON.stringify([question.id, data.type, data.lat, data.lng]);
    useEffect(() => {
        let cancelled = false;
        setText(null);
        questionReference(question).then(
            (line) => !cancelled && setText(line),
            () => undefined,
        );
        return () => {
            cancelled = true;
        };
    }, [key]);
    if (!text) return null;
    return (
        <p className="font-semibold" data-testid="question-reference">
            {text}
        </p>
    );
};

/**
 * The hider's answer: a choice shows on the map what it would rule out;
 * Send makes it the answer. Four choices or fewer are buttons, more (a
 * tentacle question's places) a list.
 */
const AnswerPanel = ({
    question,
    entry,
    questionKey,
    onSent,
}: {
    question: Question;
    entry: QuestionEntry;
    questionKey: number;
    onSent: () => void;
}) => {
    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    const $suggestions = useStore(suggestedAnswers);
    const $previews = useStore(previewAnswers);
    const { places, error } = useTentaclePlaces(question);
    const suggestion = $suggestions[questionKey];
    const choices = answerChoices(question, places ?? undefined);
    const current = entry.state === "answered" ? answerOf(question) : null;
    const selected =
        $previews[questionKey] ?? current ?? suggestion?.answer ?? null;
    const isSelected = (choice: Choice) =>
        selected !== null && same(choice.answer, selected);
    const choose = (choice: Choice) =>
        previewAnswers.set({
            ...previewAnswers.get(),
            [questionKey]: choice.answer,
        });
    const selectedLabel = choices.find(isSelected)?.label;
    // Hider mode's suggestion previews on the map by itself; a tap changes it.
    useEffect(() => {
        if (suggestion && !previewAnswers.get()[questionKey] && !current) {
            previewAnswers.set({
                ...previewAnswers.get(),
                [questionKey]: suggestion.answer,
            });
        }
    }, [suggestion?.label]);

    const send = async () => {
        if (!selected || !$game) return;
        await sendOp({
            type: "answerQuestion",
            key: questionKey,
            answer: selected,
            basedOn: entry.updatedAt,
        });
        onSent();
        const draw = DRAWS[question.id];
        if ($role === "hider" && draw) {
            toast.info(
                $game.settings.deck === "virtual"
                    ? `Draw ${draw.draw}, keep ${draw.keep}: select your new cards in Cards.`
                    : `Draw ${draw.draw}, keep ${draw.keep}. Record what you kept in Cards.`,
                { toastId: "draw", autoClose: 8000 },
            );
        }
    };

    return (
        <div className="mt-1 flex flex-col gap-1" data-testid="answer-panel">
            <p>
                {suggestion
                    ? `Hider mode suggests: ${suggestion.label}`
                    : "Choose the answer:"}
            </p>
            {question.id === "tentacles" && places === null && !error && (
                <p className="opacity-80">Finding the places within reach…</p>
            )}
            {error && (
                <p className="text-red-300">
                    Couldn&apos;t load the places: {error}
                </p>
            )}
            {choices.length <= 4 ? (
                <div className="flex flex-wrap gap-1">
                    {choices.map((choice) => (
                        <Button
                            key={choice.label}
                            size="sm"
                            variant={isSelected(choice) ? "default" : "outline"}
                            aria-pressed={isSelected(choice)}
                            onClick={() => choose(choice)}
                        >
                            {choice.label}
                        </Button>
                    ))}
                </div>
            ) : (
                <Select
                    trigger="Answer"
                    options={Object.fromEntries(
                        choices.map((choice) => [choice.label, choice.label]),
                    )}
                    value={selectedLabel ?? ""}
                    onValueChange={(label) => {
                        const choice = choices.find((c) => c.label === label);
                        if (choice) choose(choice);
                    }}
                />
            )}
            <p className="opacity-80">
                The map shows what this answer rules out. Send it when it&apos;s
                right.
            </p>
            <Button
                size="sm"
                className="w-full"
                disabled={selected === null}
                onClick={() => void send()}
            >
                Send answer{selectedLabel ? `: ${selectedLabel}` : ""}
            </Button>
        </div>
    );
};

/**
 * A question's place in a shared game: its state, who changed it last, the
 * time left to answer, and the next step (send it to the hider; the hider's
 * answer, veto or randomize).
 */
export const QuestionGameBar = ({ questionKey }: { questionKey: number }) => {
    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    const $questions = useStore(questions);
    const $previews = useStore(previewAnswers);
    const [changing, setChanging] = useState(false);
    const entry = $game?.questions[String(questionKey)];
    // The countdown ticks while the hider has the question.
    useTick(entry?.state === "asked");
    // A preview belongs to a question waiting for its answer.
    useEffect(() => {
        if (entry?.state !== "asked" && !changing && $previews[questionKey]) {
            const { [questionKey]: gone, ...rest } = previewAnswers.get();
            void gone;
            previewAnswers.set(rest);
        }
    }, [entry?.state, changing]);
    if (!$game) return null;

    const question = $questions.find((q) => q.key === questionKey);
    if (!question) return null;
    if (!entry) {
        return <p className="mx-2 mb-1 text-xs text-slate-400">Sending…</p>;
    }

    const mayAnswer = $role === "hider" || $game.settings.seekersCanAnswer;
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
    // The curses on the seekers may stop this question from being sent.
    const blocking = blockingCurses($game, serverNow())[0];
    const refusal =
        entry.state === "draft"
            ? blocking
                ? `${blocking.name}: no questions until it's cleared.`
                : kindRefusal(
                      $game,
                      questionKind(question as unknown as SharedQuestion),
                      serverNow(),
                  )
            : null;

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
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <p>
                    <strong>{STATE_TEXT[entry.state]}</strong>
                    {entry.state === "answered" &&
                        `: ${describeAnswer(question)}`}
                </p>
                <p className="opacity-80">
                    {entry.updatedBy === entry.createdBy
                        ? `By ${entry.createdBy}`
                        : `Changed by ${entry.updatedBy}`}{" "}
                    · {ago(entry.updatedAt)}
                </p>
            </div>
            {timeLeft !== null && (
                <p
                    className={TONE_CLASS[answerTimerTone(timeLeft)]}
                    data-testid="answer-timer"
                    data-tone={answerTimerTone(timeLeft)}
                >
                    ⏳ {answerTimerText(timeLeft)}
                </p>
            )}
            {entry.late && (
                <p
                    className="font-semibold text-amber-300"
                    data-testid="late-answer"
                >
                    Answered late (
                    {entry.late % 3 === 0
                        ? "the seekers' next question is free"
                        : `warning ${entry.late % 3} of 2`}
                    ).
                </p>
            )}
            {entry.state !== "draft" && <ReferenceLine question={question} />}
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
            {refusal && $role === "seeker" && (
                <p className="text-amber-300" data-testid="send-refusal">
                    {refusal}
                </p>
            )}
            {entry.state === "draft" && $role === "seeker" && (
                <Button
                    disabled={refusal !== null}
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
                <AnswerPanel
                    question={question}
                    entry={entry}
                    questionKey={questionKey}
                    onSent={() => setChanging(false)}
                />
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
                            Veto this question
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
