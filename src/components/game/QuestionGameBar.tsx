import { useStore } from "@nanostores/react";
import * as turf from "@turf/turf";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

import {
    PlayCardConfirm,
    RANDOMIZE_ID,
    VETO_ID,
} from "@/components/game/PlayCardConfirm";
import { Button } from "@/components/ui/button";
import { useTick } from "@/hooks/useTick";
import { endgame, hiderMode, questions } from "@/lib/context";
import { ago } from "@/lib/format";
import { tap } from "@/lib/game/alerts";
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
import {
    askedBeforeText,
    repeatBadge,
    timesAskedBefore,
} from "@/lib/game/questionIdentity";
import { questionReference } from "@/lib/game/reference";
import { restRefusal } from "@/lib/game/rest";
import { serverNow } from "@/lib/game/serverTime";
import {
    gameRole,
    gameState,
    previewAnswers,
    sendOp,
    suggestedAnswers,
} from "@/lib/game/session";
import type { QuestionEntry, SharedQuestion } from "@/lib/game/types";
import { chosenStation } from "@/lib/hiderSpot";
import { showTip } from "@/lib/tour";
import { cn } from "@/lib/utils";
import { findTentacleLocations } from "@/maps/api";
import { errorMessage } from "@/maps/errors";
import { filterPointsWithinRadius } from "@/maps/questions/tentacles";
import type { Question } from "@/maps/schema";

import { SendQuestion } from "./SendQuestion";
import { ThermometerBar } from "./ThermometerBar";

const STATE_TEXT = {
    draft: "Draft: only seekers see this",
    armed: "Started: the seekers are travelling",
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

/** "· from your station, Wipkingen, 2.1 km away": where the answer is worked out from. */
const AnsweredFrom = ({ question }: { question: Question }) => {
    const station = useStore(chosenStation);
    const $endgame = useStore(endgame);
    const pin = useStore(hiderMode);
    const data = question.data as { lat?: number; lng?: number };
    const from =
        station && !$endgame
            ? {
                  what: `your station, ${station.name}`,
                  lat: station.lat,
                  lng: station.lng,
              }
            : pin !== false
              ? { what: "your pin", lat: pin.latitude, lng: pin.longitude }
              : null;
    if (!from) return null;
    const km =
        typeof data.lat === "number" && typeof data.lng === "number"
            ? turf.distance([from.lng, from.lat], [data.lng, data.lat], {
                  units: "kilometers",
              })
            : null;
    return (
        <>
            {" "}
            · from {from.what}
            {km !== null && (
                <>
                    ,{" "}
                    <strong>
                        {km < 10 ? km.toFixed(1) : Math.round(km)} km
                    </strong>{" "}
                    away
                </>
            )}
        </>
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
            showTip("hider-draw");
            toast.info(
                $game.settings.deck === "virtual"
                    ? `Draw ${draw.draw}, keep ${draw.keep}: select your new cards in Cards.`
                    : `Draw ${draw.draw}, keep ${draw.keep}. Record what you kept in Cards.`,
                { toastId: "draw", autoClose: 8000 },
            );
        }
    };

    const draw = DRAWS[question.id];
    const again =
        entry.state === "asked"
            ? timesAskedBefore($game!, question as unknown as SharedQuestion)
            : 0;
    return (
        <div className="mt-1 flex flex-col gap-2" data-testid="answer-panel">
            <p className="text-sm">
                {suggestion ? (
                    <>
                        The app suggests <strong>{suggestion.label}</strong>.
                    </>
                ) : (
                    "Choose the answer:"
                )}
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
                <div className="grid grid-cols-2 gap-2">
                    {choices.map((choice) => (
                        <Button
                            key={choice.label}
                            variant={isSelected(choice) ? "default" : "outline"}
                            className="h-auto min-h-16 whitespace-normal text-lg font-semibold max-md:min-h-16"
                            aria-pressed={isSelected(choice)}
                            onClick={() => choose(choice)}
                        >
                            {choice.label}
                        </Button>
                    ))}
                </div>
            ) : (
                <ul
                    className="flex flex-col gap-1"
                    aria-label="Answer"
                    data-testid="answer-list"
                >
                    {choices.map((choice) => (
                        <li key={choice.label}>
                            <button
                                type="button"
                                aria-pressed={isSelected(choice)}
                                className={cn(
                                    "flex min-h-12 w-full items-center rounded-lg border px-3 text-left text-sm font-semibold",
                                    isSelected(choice)
                                        ? "border-blue-500 bg-blue-600 text-white"
                                        : "border-slate-600 bg-slate-800/60",
                                )}
                                onClick={() => choose(choice)}
                            >
                                {choice.label}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <p className="opacity-80">
                {draw && `You draw ${draw.draw}, keep ${draw.keep}`}
                {again > 0 && (
                    <span className="text-red-300">
                        {" "}
                        · {repeatBadge(again)}: asked before
                    </span>
                )}
                . The map shows what this answer rules out.
            </p>
            <div className="sticky bottom-0 -mx-2 bg-sidebar px-2 py-2">
                <Button
                    className="h-12 w-full text-base font-semibold"
                    disabled={selected === null}
                    onClick={() => {
                        tap();
                        void send();
                    }}
                >
                    Send answer{selectedLabel ? `: ${selectedLabel}` : ""}
                </Button>
            </div>
        </div>
    );
};

/** Veto Question and Randomize Question: instead of answering, with the card's face. */
const PlayInstead = ({
    entry,
    questionKey,
    thermometer,
}: {
    entry: QuestionEntry;
    questionKey: number;
    thermometer: boolean;
}) => {
    const $game = useStore(gameState)!;
    const [playing, setPlaying] = useState<"veto" | "randomize" | null>(null);
    const hand = $game.deck?.hand;
    const has = (id: string) => (hand ? hand.includes(id) : true);
    const vetoOk = entry.state === "asked" && has(VETO_ID);
    const randomOk =
        entry.state === "asked" && !thermometer && has(RANDOMIZE_ID);
    return (
        <div className="grid grid-cols-2 gap-2" data-testid="play-instead">
            <Button
                variant="outline"
                className="h-auto min-h-11 whitespace-normal"
                disabled={!vetoOk}
                title="Play Veto Question: no answer, no cards for you"
                onClick={() => setPlaying("veto")}
            >
                {vetoOk ? "Veto" : "Veto (no card in hand)"}
            </Button>
            <Button
                variant="outline"
                className="h-auto min-h-11 whitespace-normal"
                disabled={!randomOk}
                title="Play Randomize Question: another question of this kind, chosen at random, which you answer instead"
                onClick={() => setPlaying("randomize")}
            >
                {randomOk
                    ? "Randomize"
                    : thermometer
                      ? "Randomize (not a thermometer)"
                      : "Randomize (no card in hand)"}
            </Button>
            <PlayCardConfirm
                cardId={
                    playing === "veto"
                        ? VETO_ID
                        : playing === "randomize"
                          ? RANDOMIZE_ID
                          : null
                }
                title={
                    playing === "veto"
                        ? "Veto this question?"
                        : "Randomize this question?"
                }
                text={
                    playing === "veto"
                        ? "No answer is given and you draw no cards."
                        : "It becomes another question of its kind, chosen at random, which you answer instead."
                }
                action={playing === "veto" ? "Play Veto" : "Play Randomize"}
                onPlay={() =>
                    void sendOp(
                        playing === "veto"
                            ? { type: "vetoQuestion", key: questionKey }
                            : { type: "randomizeQuestion", key: questionKey },
                    )
                }
                onClose={() => setPlaying(null)}
            />
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
    // The hider's answer screen (mock-up 11): no coloured bar, big choices.
    const answering = showChoices && entry.state === "asked";
    const timeLeft = answerTimeLeft(entry, serverNow());
    const askedBefore =
        entry.state === "draft" || entry.state === "armed"
            ? timesAskedBefore($game, question as unknown as SharedQuestion)
            : 0;
    // The curses on the seekers may stop this question from being sent.
    const blocking = blockingCurses($game, serverNow())[0];
    const refusal =
        entry.state === "draft" || entry.state === "armed"
            ? (restRefusal($game) ??
              (blocking
                  ? `${blocking.name}: no questions until it's cleared.`
                  : kindRefusal(
                        $game,
                        questionKind(question as unknown as SharedQuestion),
                        serverNow(),
                    )))
            : null;

    return (
        <div
            className={cn(
                "mx-2 mb-1 rounded-md px-2 py-1 text-xs",
                answering && "text-sm",
                entry.state === "draft" && "bg-amber-900/40 text-amber-100",
                entry.state === "armed" && "bg-violet-900/50 text-violet-100",
                entry.state === "asked" &&
                    !answering &&
                    "bg-blue-900/50 text-blue-100",
                entry.state === "answered" && "bg-green-900/40 text-green-100",
                entry.state === "vetoed" && "bg-slate-700/60 text-slate-200",
            )}
            data-testid="question-game-state"
            data-state={entry.state}
        >
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                {answering ? (
                    <p className="text-slate-300">
                        Asked by {entry.createdBy} ·{" "}
                        {ago(entry.askedAt ?? entry.updatedAt, serverNow())}
                        <AnsweredFrom question={question} />
                    </p>
                ) : (
                    <>
                        <p>
                            <strong>{STATE_TEXT[entry.state]}</strong>
                            {entry.state === "answered" &&
                                `: ${describeAnswer(question)}`}
                        </p>
                        <p className="opacity-80">
                            {entry.updatedBy === entry.createdBy
                                ? `By ${entry.createdBy}`
                                : `Changed by ${entry.updatedBy}`}{" "}
                            · {ago(entry.updatedAt, serverNow())}
                        </p>
                    </>
                )}
                {timeLeft !== null && (
                    <span
                        className={cn(
                            "shrink-0 rounded-full bg-slate-800 px-2.5 py-1 font-semibold tabular-nums",
                            TONE_CLASS[answerTimerTone(timeLeft)],
                        )}
                        data-testid="answer-timer"
                        data-tone={answerTimerTone(timeLeft)}
                    >
                        ⏳ {answerTimerText(timeLeft)}
                    </span>
                )}
            </div>
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
                    {askedBeforeText(askedBefore)}
                </p>
            )}
            {refusal && $role === "seeker" && (
                <p className="text-amber-300" data-testid="send-refusal">
                    {refusal}
                </p>
            )}
            {question.id === "thermometer" &&
            (entry.state === "draft" || entry.state === "armed") ? (
                <ThermometerBar
                    data={question.data}
                    questionKey={questionKey}
                    armed={entry.state === "armed"}
                    refused={refusal !== null}
                />
            ) : (
                entry.state === "draft" &&
                $role === "seeker" && (
                    <SendQuestion
                        question={question}
                        questionKey={questionKey}
                        refused={refusal !== null}
                    />
                )
            )}
            {showChoices && (
                <AnswerPanel
                    question={question}
                    entry={entry}
                    questionKey={questionKey}
                    onSent={() => setChanging(false)}
                />
            )}
            {$role === "hider" && entry.state === "asked" && (
                <PlayInstead
                    entry={entry}
                    questionKey={questionKey}
                    thermometer={question.id === "thermometer"}
                />
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
