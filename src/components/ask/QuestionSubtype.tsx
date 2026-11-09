import { useStore } from "@nanostores/react";
import { useState } from "react";

import { RulesText } from "@/components/RulesText";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    addQuestion,
    gameSettings,
    openQuestion,
    regionRules,
} from "@/lib/context";
import { sidebarTab } from "@/lib/context";
import { kindRefusal, photoKind } from "@/lib/game/curseRules";
import {
    askedBefore,
    matchingQuestion,
    measuringQuestion,
    photoAskedBefore,
    radarQuestion,
    type Start,
    tentacleQuestion,
    thermometerQuestion,
} from "@/lib/game/newQuestion";
import { serverNow } from "@/lib/game/serverTime";
import {
    armThermometer,
    gameState,
    sendOp,
    sendQuestion,
} from "@/lib/game/session";
import { kmText } from "@/lib/game/thermometer";
import { hiddenTypesFor, tentacleKmFor } from "@/lib/gameSettings";
import { currentPosition } from "@/lib/geolocation";
import { TYPES } from "@/lib/questionInfo";
import { photoQuestions } from "@/lib/rules/content";
import { askFlow, type AskKind, closeAsk } from "@/lib/screens";
import { cn } from "@/lib/utils";
import { adaptTypeOptions } from "@/maps/regionRules";
import {
    determineUnionizedStrings,
    matchingQuestionSchema,
    measuringQuestionSchema,
} from "@/maps/schema";

import {
    askRefusal,
    KINDS,
    ScreenHeader,
    startPoint,
    TwiceBadge,
} from "./QuestionTypes";

const SIZE_NAMES = { small: "small", medium: "medium", large: "large" };
const CHIP =
    "relative min-h-11 rounded-lg px-3 text-sm font-semibold disabled:opacity-40";
const CHIP_ON = "bg-blue-600 text-white";
const CHIP_OFF = "bg-slate-700 hover:bg-slate-600";
const TILE =
    "relative flex min-h-16 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/70 p-2 text-center text-sm font-semibold";

/** The types a matching or measuring question can be, for this game. */
const typeTiles = (
    category: "matching" | "measuring",
    hidden: string[],
    rules: Parameters<typeof adaptTypeOptions>[1],
) => {
    const schema =
        category === "matching"
            ? matchingQuestionSchema
            : measuringQuestionSchema;
    const options = Object.fromEntries(
        schema.options
            .flatMap((option: any) =>
                determineUnionizedStrings(option.shape.type),
            )
            .map((literal: any) => [literal._def.value, literal.description]),
    ) as Record<string, string>;
    const adapted = adaptTypeOptions(
        options,
        {
            ...rules,
            hiddenQuestionTypes: [...rules.hiddenQuestionTypes, ...hidden],
        },
        "",
    );
    const labels = TYPES[category] as Record<string, { label: string }>;
    return Object.entries(adapted)
        .filter(([type]) => !type.startsWith("custom"))
        .map(([type, label]) => ({
            type,
            label: labels[type]?.label ?? label,
        }));
};

const SMALL_TENTACLES = ["museum", "library", "cinema", "hospital"];
const BIG_TENTACLES = ["zoo", "aquarium", "theme_park"];

/**
 * One kind's choices (mock-ups 04–06): what to ask, from where, and ×2 on
 * what was asked before this round. The question is made on Ask (or as a
 * draft to plan with); nothing exists before that.
 */
export const QuestionSubtype = ({ kind }: { kind: AskKind }) => {
    const $game = useStore(gameState);
    const $settings = useStore(gameSettings);
    const $rules = useStore(regionRules);
    const $ask = useStore(askFlow);
    useStore(currentPosition);
    const research = !!$ask?.research;
    const settings = $game?.settings ?? $settings;
    const shared = !!$game && !research;
    const title = KINDS.find((k) => k.kind === kind)!.title;
    const start = startPoint();

    const radii = settings.radarKm;
    const thermo = settings.thermometerKm;
    const [km, setKm] = useState<number>(
        kind === "thermometer"
            ? (thermo[1] ?? thermo[0] ?? 5)
            : (radii[Math.floor(radii.length / 2)] ?? 5),
    );
    const [custom, setCustom] = useState(false);
    const [type, setType] = useState<string | null>(null);
    const [photo, setPhoto] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    /** The question as chosen so far (null: something still to pick). */
    const chosen = (at: Start) => {
        switch (kind) {
            case "radius":
                return radarQuestion(at, km);
            case "thermometer":
                return thermometerQuestion(at, km, shared);
            case "matching":
                return type ? matchingQuestion(at, type) : null;
            case "measuring":
                return type ? measuringQuestion(at, type) : null;
            case "tentacles":
                return type
                    ? tentacleQuestion(at, type, tentacleKmFor(type))
                    : null;
            default:
                return null;
        }
    };
    const twice = (question: ReturnType<typeof chosen>) =>
        shared && question && askedBefore($game, question) > 0;

    /** Makes the question; asks it (or starts it) in a shared game unless a draft. */
    const make = async (send: boolean) => {
        if (!start) return;
        const question = chosen(start);
        if (!question) return;
        const key = Math.random();
        addQuestion({
            ...question,
            key,
            data: research
                ? { ...question.data, research: true }
                : question.data,
        } as Parameters<typeof addQuestion>[0]);
        closeAsk();
        openQuestion.set(key);
        if (!send || !shared) return;
        setBusy(true);
        try {
            if (kind === "thermometer") {
                await armThermometer(key, km, {
                    lat: start.lat,
                    lng: start.lng,
                });
            } else {
                await sendQuestion(key);
            }
        } finally {
            setBusy(false);
        }
    };

    const refusal = shared ? askRefusal($game, kind, true) : null;
    const question = start ? chosen(start) : null;
    const primary =
        kind === "photo"
            ? photo
                ? `Ask for: ${photo}`
                : "Pick a photo"
            : !question
              ? kind === "tentacles"
                  ? "Pick a place kind"
                  : "Pick a type"
              : !shared
                ? "Add the question"
                : kind === "radius"
                  ? `Ask: within ${kmText(km)} km of me?`
                  : kind === "thermometer"
                    ? `Start the thermometer (${kmText(km)} km)`
                    : "Ask the hider";

    const chips = (list: number[]) => (
        <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Distance"
        >
            {list.map((value) => {
                const on = !custom && km === value;
                const probe =
                    kind === "radius"
                        ? radarQuestion({ lat: 0, lng: 0 }, value)
                        : thermometerQuestion({ lat: 0, lng: 0 }, value, true);
                return (
                    <button
                        key={value}
                        type="button"
                        aria-pressed={on}
                        className={cn(CHIP, on ? CHIP_ON : CHIP_OFF)}
                        onClick={() => {
                            setKm(value);
                            setCustom(false);
                        }}
                    >
                        {value < 1 ? `${value * 1000} m` : `${value} km`}
                        {twice(probe) && (
                            <TwiceBadge className="absolute -right-1 -top-2" />
                        )}
                    </button>
                );
            })}
            <button
                type="button"
                aria-pressed={custom}
                className={cn(
                    CHIP,
                    custom ? CHIP_ON : "border border-dashed border-slate-500",
                )}
                onClick={() => setCustom(true)}
            >
                Custom…
            </button>
            {custom && (
                <label className="flex items-center gap-2 text-sm">
                    <Input
                        type="number"
                        inputMode="decimal"
                        min={0.1}
                        step={0.1}
                        aria-label="Custom distance (km)"
                        className="h-11 w-24"
                        debounce={0}
                        value={km}
                        onChange={(event) => {
                            const value = parseFloat(event.target.value);
                            if (value > 0 && value <= 1000) setKm(value);
                        }}
                    />
                    km
                </label>
            )}
        </div>
    );

    const tiles = (choices: { type: string; label: string }[]) => (
        <div className="grid grid-cols-2 gap-2">
            {choices.map((choice) => {
                const probe = start ? chosenFor(choice.type) : null;
                return (
                    <button
                        key={choice.type}
                        type="button"
                        aria-pressed={type === choice.type}
                        className={cn(
                            TILE,
                            type === choice.type &&
                                "border-blue-500 bg-blue-600 text-white",
                        )}
                        onClick={() => setType(choice.type)}
                    >
                        {choice.label}
                        {probe && twice(probe) && (
                            <TwiceBadge className="absolute left-2 top-2" />
                        )}
                    </button>
                );
            })}
        </div>
    );
    const chosenFor = (value: string) =>
        kind === "matching"
            ? matchingQuestion(start!, value)
            : kind === "measuring"
              ? measuringQuestion(start!, value)
              : tentacleQuestion(start!, value, tentacleKmFor(value));

    const photos = photoQuestions().filter((q) =>
        q.sizes.includes(settings.size),
    );
    const photoRefusal = (name: string) =>
        refusal ??
        ($game ? kindRefusal($game, photoKind(name), serverNow()) : null);

    return (
        <div
            className="flex min-h-full flex-col"
            data-testid="question-subtype"
        >
            <ScreenHeader title={title} kind={kind} />
            <div className="flex flex-1 flex-col gap-3 p-3">
                {(kind === "radius" || kind === "thermometer") && (
                    <>
                        <p className="text-xs text-slate-400">
                            {kind === "thermometer"
                                ? "Starts where you are. Travel the distance, then ask. "
                                : ""}
                            Distance ({SIZE_NAMES[settings.size]} game)
                        </p>
                        {chips(kind === "radius" ? radii : thermo)}
                    </>
                )}
                {(kind === "matching" || kind === "measuring") &&
                    tiles(
                        typeTiles(kind, hiddenTypesFor(kind, settings), $rules),
                    )}
                {kind === "tentacles" && (
                    <>
                        <p className="text-xs text-slate-400">
                            Within {settings.tentacleKm[0]} km
                        </p>
                        {tiles(
                            SMALL_TENTACLES.map((value) => ({
                                type: value,
                                label: TYPES.tentacles[
                                    value as keyof typeof TYPES.tentacles
                                ].label,
                            })),
                        )}
                        <p className="text-xs text-slate-400">
                            Within {settings.tentacleKm[1]} km
                        </p>
                        {tiles(
                            BIG_TENTACLES.map((value) => ({
                                type: value,
                                label: TYPES.tentacles[
                                    value as keyof typeof TYPES.tentacles
                                ].label,
                            })),
                        )}
                    </>
                )}
                {kind === "photo" && (
                    <>
                        <p className="text-xs text-slate-400">
                            The hider has {settings.size === "large" ? 20 : 10}{" "}
                            minutes (this is a {SIZE_NAMES[settings.size]}{" "}
                            game). Tap one for exactly what the photo must show.
                        </p>
                        <ul
                            className="flex flex-col gap-2"
                            data-testid="photo-choices"
                        >
                            {photos.map((choice) => {
                                const open = photo === choice.name;
                                return (
                                    <li
                                        key={choice.name}
                                        className={cn(
                                            "rounded-xl border border-slate-700 bg-slate-800/70",
                                            open && "border-blue-500",
                                        )}
                                    >
                                        <button
                                            type="button"
                                            aria-expanded={open}
                                            className="flex min-h-14 w-full items-center gap-2 px-3 text-left font-semibold"
                                            onClick={() =>
                                                setPhoto(
                                                    open ? null : choice.name,
                                                )
                                            }
                                        >
                                            {photoAskedBefore(
                                                $game,
                                                choice.name,
                                            ) > 0 && <TwiceBadge />}
                                            <span className="flex-1">
                                                {choice.name}
                                            </span>
                                            <span aria-hidden>
                                                {open ? "⌄" : "›"}
                                            </span>
                                        </button>
                                        {open && (
                                            <div
                                                className="rules-text px-3 pb-3 text-sm"
                                                data-testid="photo-rule"
                                            >
                                                <RulesText
                                                    markdown={choice.rules}
                                                    images={false}
                                                />
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </>
                )}
                {kind !== "photo" && (
                    <p
                        className="text-xs text-slate-400"
                        data-testid="asked-from"
                    >
                        Asked from:{" "}
                        {start?.here
                            ? `where you are (${start.lat.toFixed(4)}° N, ${start.lng.toFixed(4)}° E${
                                  start.here.accuracy
                                      ? ` · ±${Math.round(start.here.accuracy)} m`
                                      : ""
                              })`
                            : "the map's centre (no position: turn location on to ask from where you are). The pin can be dragged afterwards."}
                    </p>
                )}
                {question && twice(question) && (
                    <p className="rounded-lg border border-amber-500/60 bg-amber-950/40 p-2 text-sm text-amber-200">
                        Asked already this round: asking it again costs double.
                    </p>
                )}
                {refusal && (
                    <p
                        className="text-sm text-amber-300"
                        data-testid="ask-refusal"
                    >
                        {refusal}
                    </p>
                )}
            </div>
            <div className="sticky bottom-0 flex flex-col gap-2 border-t border-slate-700 bg-sidebar p-3">
                <Button
                    className="h-auto min-h-12 whitespace-normal py-2 text-base font-semibold"
                    disabled={
                        busy ||
                        !start ||
                        (kind === "photo"
                            ? !photo || photoRefusal(photo) !== null
                            : !question || refusal !== null)
                    }
                    data-tutorial-id="ask-send"
                    onClick={() => {
                        if (kind === "photo") {
                            if (!photo) return;
                            void sendOp({ type: "askPhoto", name: photo });
                            closeAsk();
                            sidebarTab.set("photos");
                            return;
                        }
                        void make(true);
                    }}
                >
                    {primary}
                </Button>
                {shared && kind !== "photo" && (
                    <Button
                        variant="outline"
                        className="min-h-11"
                        disabled={busy || !question}
                        onClick={() => void make(false)}
                    >
                        Add as a draft (plan first)
                    </Button>
                )}
            </div>
        </div>
    );
};
