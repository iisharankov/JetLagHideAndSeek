import { useStore } from "@nanostores/react";
import {
    Check,
    Copy,
    Keyboard,
    LocateFixed,
    Lock,
    MapPin,
    Pencil,
    RefreshCw,
} from "lucide-react";
import { type ReactNode, useState } from "react";

import {
    CoordinatesEditor,
    copyCoordinates,
    locateTo,
} from "@/components/LatLngPicker";
import { Dialog } from "@/components/ui/dialog";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { atMyPosition, nextChoice } from "@/lib/cardText";
import { cardLayout } from "@/lib/context";
import { gameState } from "@/lib/game/session";
import { currentPosition, knownPosition, lastFix } from "@/lib/geolocation";
import { cn } from "@/lib/utils";
import { ICON_COLORS } from "@/maps/api";

// The question card's middle (round 46, the owner's pick of the round 45
// pictures, to try out): three layouts of the same parts, chosen in
// Settings. A: labelled sections; B: the question as a sentence; C: a
// summary with Edit. What if is a chip that flips; Location opens a small
// pop-up (your GPS, the pin, typed, copy).

/** How a part draws itself: a button in a row, or a word in the sentence. */
export type Look = "plain" | "token";

export interface Guess {
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
    disabled?: boolean;
}

export interface CardParts {
    /** The first choice: the distance, or the kind of place. */
    first: { label: string; render: (look: Look) => ReactNode };
    /** Where it's asked from; null when there's no one point (a custom zone). */
    location: { label: string; render: (look: Look) => ReactNode } | null;
    /** Layout B: the sentence around the two choices. */
    sentence: (first: ReactNode, location: ReactNode) => ReactNode;
    /** Layout C: the question in one line, and where it's from. */
    summary: { title: string; sub: string };
    /** The answer playing alone; in a game, the guess the map shows. */
    guess: Guess | null;
    /** Rows under the choices: a zone's level, warnings, custom drawing. */
    extra?: ReactNode;
}

/** The word a token or the summary uses for where a point is. */
export const useWhere = (lat: number, lng: number) => {
    useStore(currentPosition);
    useStore(lastFix);
    return atMyPosition({ lat, lng }, knownPosition()) ? "me" : "the pin";
};

/**
 * Location: "Me · GPS" when the point is where the phone is, else "Pin"
 * and its coordinates; ⟳ moves it to where you are. A tap opens the
 * choices (picture 15): your GPS, the pin, typed or pasted, copy.
 */
export const LocationButton = ({
    lat,
    lng,
    onChange,
    disabled,
    look,
    label = "Location",
    colorName,
}: {
    lat: number;
    lng: number;
    onChange: (lat: number | null, lng: number | null) => void;
    disabled?: boolean;
    look: Look;
    label?: string;
    colorName?: keyof typeof ICON_COLORS;
}) => {
    const [open, setOpen] = useState(false);
    const [typing, setTyping] = useState(false);
    const where = useWhere(lat, lng);
    const here = knownPosition();
    const mine = where === "me";
    const color = colorName ? ICON_COLORS[colorName] : undefined;
    const accuracy = here?.accuracy ? `±${Math.round(here.accuracy)} m` : "";
    const coordinates = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const Icon = mine ? LocateFixed : MapPin;

    const choice = (
        key: string,
        icon: ReactNode,
        title: string,
        detail: string | null,
        on: boolean,
        act: () => void,
    ) => (
        <button
            key={key}
            type="button"
            className={cn(
                "flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left text-base font-semibold hover:bg-white/10 [&>svg]:h-5 [&>svg]:w-5 [&>svg]:shrink-0 [&>svg]:text-blue-200",
                on && "bg-blue-900/70",
            )}
            onClick={act}
        >
            {icon}
            <span className="min-w-0 flex-1">
                {title}
                {detail && (
                    <span className="block text-xs font-normal text-slate-400">
                        {detail}
                    </span>
                )}
            </span>
            {on && <Check className="text-blue-300" aria-hidden />}
        </button>
    );

    const trigger =
        look === "token" ? (
            <button
                type="button"
                disabled={disabled}
                className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-slate-600 bg-slate-800 px-2.5 font-bold hover:bg-slate-700 disabled:opacity-50"
                aria-label={`${label}: ${mine ? "me" : "the pin"}`}
                data-testid="location-button"
            >
                <Icon
                    className="h-4 w-4"
                    style={{ color: color ?? "#60a5fa" }}
                    aria-hidden
                />
                {where}
                <span className="text-slate-400" aria-hidden>
                    ▾
                </span>
            </button>
        ) : (
            <button
                type="button"
                disabled={disabled}
                className="flex min-h-12 min-w-0 flex-1 items-center gap-2 pl-3 text-left disabled:opacity-50"
                aria-label={`${label}: ${mine ? "me, GPS" : `the pin, ${coordinates}`}`}
                data-testid="location-button"
            >
                <Icon
                    className="h-5 w-5 shrink-0"
                    style={{ color: color ?? "#60a5fa" }}
                    aria-hidden
                />
                <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-base font-semibold">
                        {mine ? "Me · GPS" : "Pin"}
                    </span>
                    <span className="block truncate text-xs text-slate-400 tabular-nums">
                        {mine ? accuracy || coordinates : coordinates}
                    </span>
                </span>
            </button>
        );

    return (
        <>
            <Popover open={open} onOpenChange={setOpen}>
                {look === "token" ? (
                    <PopoverTrigger asChild>{trigger}</PopoverTrigger>
                ) : (
                    <div className="flex min-w-0 items-center rounded-xl border border-slate-600 bg-slate-800/60">
                        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
                        <button
                            type="button"
                            disabled={disabled}
                            className="mr-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-700 text-blue-200 hover:bg-slate-600 disabled:opacity-50"
                            aria-label="Move it to where I am"
                            title="Move it to where I am"
                            onClick={() => locateTo(onChange)}
                        >
                            <RefreshCw className="h-4 w-4" aria-hidden />
                        </button>
                    </div>
                )}
                <PopoverContent
                    className="w-[min(22rem,calc(100vw-2rem))] border-slate-600 bg-slate-900 p-2 text-white"
                    data-testid="location-choices"
                >
                    <p className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {label}
                    </p>
                    {choice(
                        "gps",
                        <LocateFixed aria-hidden />,
                        "Me · GPS",
                        here
                            ? `${here.latitude.toFixed(4)}, ${here.longitude.toFixed(4)}${accuracy ? ` · ${accuracy}` : ""}`
                            : "Where you are now",
                        mine,
                        () => {
                            setOpen(false);
                            locateTo(onChange);
                        },
                    )}
                    {choice(
                        "pin",
                        <MapPin aria-hidden />,
                        "The pin",
                        "Drag it on the map",
                        !mine,
                        () => setOpen(false),
                    )}
                    {choice(
                        "type",
                        <Keyboard aria-hidden />,
                        "Type or paste coordinates",
                        null,
                        false,
                        () => {
                            setOpen(false);
                            setTyping(true);
                        },
                    )}
                    {choice(
                        "copy",
                        <Copy aria-hidden />,
                        "Copy the coordinates",
                        null,
                        false,
                        () => {
                            setOpen(false);
                            copyCoordinates(lat, lng);
                        },
                    )}
                </PopoverContent>
            </Popover>
            <Dialog open={typing} onOpenChange={setTyping}>
                {typing && (
                    <CoordinatesEditor
                        title={label}
                        latitude={lat}
                        longitude={lng}
                        onChange={onChange}
                        disabled={disabled}
                    />
                )}
            </Dialog>
        </>
    );
};

/**
 * What if (in a game: the guess the map shows until the hider answers;
 * alone: the answer) as one chip; a tap moves to the next answer (picture
 * 14, way 3: short, and the ⟳ says it switches).
 */
export const WhatIfChip = ({ guess }: { guess: Guess }) => {
    const $game = useStore(gameState);
    const label =
        guess.options.find((option) => option.value === guess.value)?.label ??
        guess.value;
    return (
        <button
            type="button"
            disabled={guess.disabled}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-white pl-3 pr-1.5 text-[15px] font-bold text-slate-800 shadow-md hover:bg-slate-100 disabled:opacity-60"
            onClick={() =>
                guess.onChange(
                    nextChoice(
                        guess.options.map((option) => option.value),
                        guess.value,
                    ),
                )
            }
            title={
                $game
                    ? "The map shows this answer until the hider's comes. Tap to switch."
                    : "Tap to switch the answer"
            }
            data-testid="what-if"
        >
            {$game ? "What if:" : "Answer:"}
            <span className="text-blue-600">{label}</span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <RefreshCw className="h-4 w-4" aria-hidden />
            </span>
        </button>
    );
};

/** Layout A's rows: two labelled choices side by side, then the extra rows. */
const Sections = ({ parts }: { parts: CardParts }) => (
    <>
        <div
            className={cn(
                "grid gap-2 px-3 py-1.5",
                parts.location
                    ? "grid-cols-[0.85fr_1.15fr] md:grid-cols-1"
                    : "grid-cols-1",
            )}
        >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:order-1">
                {parts.first.label}
            </p>
            {parts.location && (
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:order-3">
                    {parts.location.label}
                </p>
            )}
            <div className="min-w-0 md:order-2">
                {parts.first.render("plain")}
            </div>
            {parts.location && (
                <div className="min-w-0 md:order-4">
                    {parts.location.render("plain")}
                </div>
            )}
        </div>
        {parts.extra}
    </>
);

/**
 * The middle of an open card, as Settings says: Sections, Sentence or
 * Summary (with Edit, which shows the sections until Done).
 */
export const CardBody = ({ parts }: { parts: CardParts }) => {
    const layout = useStore(cardLayout);
    const [editing, setEditing] = useState(false);
    return (
        <div
            className="flex flex-col gap-1 pb-1"
            data-testid="card-body"
            data-layout={layout}
        >
            {layout === "sections" && <Sections parts={parts} />}
            {layout === "sentence" && (
                <>
                    <p
                        className="overflow-hidden whitespace-nowrap px-3 py-1 text-[15px] font-semibold leading-10 md:whitespace-normal [&>*]:align-middle"
                        data-testid="card-sentence"
                    >
                        {parts.sentence(
                            parts.first.render("token"),
                            parts.location?.render("token") ?? null,
                        )}
                    </p>
                    {parts.extra}
                </>
            )}
            {layout === "summary" && (
                <>
                    <div className="mx-3 my-1 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 py-2 pl-3 pr-2">
                        <div
                            className="min-w-0 flex-1"
                            data-testid="card-summary"
                        >
                            <p className="text-lg font-bold leading-snug">
                                {parts.summary.title}
                            </p>
                            <p className="truncate text-xs text-slate-400">
                                {parts.summary.sub}
                            </p>
                        </div>
                        <button
                            type="button"
                            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg bg-slate-700 px-3 text-sm font-bold text-blue-200 hover:bg-slate-600"
                            aria-expanded={editing}
                            onClick={() => setEditing(!editing)}
                        >
                            {editing ? (
                                <Check className="h-4 w-4" aria-hidden />
                            ) : (
                                <Pencil className="h-4 w-4" aria-hidden />
                            )}
                            {editing ? "Done" : "Edit"}
                        </button>
                    </div>
                    {editing && <Sections parts={parts} />}
                </>
            )}
        </div>
    );
};

/**
 * Sent: what was asked and where from, fixed (picture 18): dashed, a lock
 * on what was chosen, and Copy on the place.
 */
export const FixedRow = ({
    first,
    testId,
    place,
}: {
    first: ReactNode;
    testId?: string;
    place?: { lat: number; lng: number; label?: string } | null;
}) => (
    <div
        className={cn(
            "grid gap-2 px-3 py-1.5",
            place ? "grid-cols-2 md:grid-cols-1" : "grid-cols-1",
        )}
    >
        <div
            className="flex min-h-12 min-w-0 items-center gap-2 rounded-xl border border-dashed border-slate-600 px-3 text-[15px] font-semibold text-slate-200"
            data-testid={testId}
        >
            <span className="min-w-0 flex-1 truncate">{first}</span>
            <Lock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        </div>
        {place && (
            <div className="flex min-h-12 min-w-0 items-center gap-2 rounded-xl border border-dashed border-slate-600 pl-3 pr-1">
                <MapPin
                    className="h-5 w-5 shrink-0 text-blue-300"
                    aria-hidden
                />
                <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-sm font-semibold">
                        {place.label ?? "Location"}
                    </span>
                    <span className="block truncate text-xs text-slate-400 tabular-nums">
                        {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
                    </span>
                </span>
                <button
                    type="button"
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-white/10"
                    onClick={() => copyCoordinates(place.lat, place.lng)}
                    title="Copy coordinates"
                    aria-label="Copy coordinates"
                >
                    <Copy className="h-4 w-4" aria-hidden />
                </button>
            </div>
        )}
    </div>
);

/** A type's list (matching, measuring, tentacles) as a row's button or a sentence's word. */
export const selectTrigger = (look: Look, placeholder: string) => ({
    placeholder,
    className:
        look === "token"
            ? "inline-flex h-9 min-h-9 w-auto max-w-[9.5rem] gap-1 rounded-lg border-0 bg-blue-600 px-2.5 py-0 font-bold text-white max-md:min-h-9 max-md:text-[15px] [&>span]:truncate"
            : "min-h-12 rounded-xl border-slate-600 bg-slate-800/60 font-semibold [&>span]:truncate",
});

/** A small button of the card's foot: its icon over its word. */
export const FootTool = ({
    icon,
    word,
    className,
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    icon: ReactNode;
    word: string;
}) => (
    <button
        type="button"
        className={cn(
            "inline-flex min-h-14 w-[4.5rem] shrink-0 flex-col md:w-14 items-center justify-center gap-0.5 rounded-xl border border-slate-600 text-xs font-semibold hover:bg-white/10 disabled:opacity-40 [&>svg]:h-5 [&>svg]:w-5",
            className,
        )}
        {...props}
    >
        {icon}
        {word}
    </button>
);
