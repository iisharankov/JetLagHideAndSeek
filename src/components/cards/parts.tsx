import { useStore } from "@nanostores/react";
import { type ReactNode, useState } from "react";

import { TwiceBadge } from "@/components/ask/QuestionTypes";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { gameState } from "@/lib/game/session";
import { cn } from "@/lib/utils";

// The pieces every question card is made of on a phone (round 40): a
// labelled section per setting, big chips, and the answer as one two-way
// (or three-way) toggle.

/** A setting of the question: a small label over its control. */
export const CardSection = ({
    label,
    children,
    className,
}: {
    label: string;
    children: ReactNode;
    className?: string;
}) => (
    <div className={cn("flex flex-col gap-1.5 px-3 py-1.5", className)}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {label}
        </p>
        {children}
    </div>
);

/** Chips: 44 px on phones, a strong colour when chosen. */
export const CHIP =
    "relative inline-flex min-h-11 min-w-14 items-center justify-center rounded-lg px-3 text-sm font-semibold disabled:opacity-50 md:min-h-9";
export const CHIP_ON = "bg-blue-600 text-white";
export const CHIP_OFF = "bg-slate-700 hover:bg-slate-600";

/**
 * The answer: alone it's what the hider said; in a game, on a draft, what
 * the map shows as a guess until the hider answers.
 */
export const AnswerToggle = <T extends string>({
    value,
    options,
    onChange,
    disabled,
}: {
    value: T;
    options: { value: T; label: string }[];
    onChange: (value: T) => void;
    disabled?: boolean;
}) => {
    const $game = useStore(gameState);
    return (
        <CardSection
            label={$game ? "Show the map as if the answer is" : "Answer"}
        >
            <ToggleGroup
                type="single"
                value={value}
                onValueChange={(next) => next && onChange(next as T)}
                disabled={disabled}
                className="grid w-full gap-0 overflow-hidden rounded-xl border border-slate-600"
                style={{
                    gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
                }}
                data-testid="answer-toggle"
            >
                {options.map((option) => (
                    <ToggleGroupItem
                        key={option.value}
                        value={option.value}
                        className="h-12 rounded-none border-r border-slate-600 text-base font-semibold last:border-r-0 data-[state=on]:bg-blue-600 data-[state=on]:text-white"
                    >
                        {option.label}
                    </ToggleGroupItem>
                ))}
            </ToggleGroup>
        </CardSection>
    );
};

/** "500 m", "10 km". */
export const kmLabel = (km: number) =>
    km < 1 ? `${Math.round(km * 1000)} m` : `${km} km`;

/**
 * A distance as one big button ("10 km ▾"); a tap opens the game's
 * distances in a small pop-up, ×2 on any asked before, and Custom… with
 * the number pad (round 41, the owner's idea: fewer things on the card).
 */
export const DistancePicker = ({
    value,
    options,
    onChange,
    twice,
    taken = [],
    disabled,
    label = "Distance",
}: {
    value: number;
    options: number[];
    onChange: (km: number) => void;
    /** Asked before this round: costs double. */
    twice?: (km: number) => boolean;
    /** Taken away (the Curse of the Drained Brain). */
    taken?: number[];
    disabled?: boolean;
    label?: string;
}) => {
    const [open, setOpen] = useState(false);
    const [custom, setCustom] = useState(false);
    const [typed, setTyped] = useState("");
    const listed = options.includes(value);
    const close = () => {
        setOpen(false);
        setCustom(false);
    };
    return (
        <CardSection label={label}>
            <Popover
                open={open}
                onOpenChange={(next) => (next ? setOpen(true) : close())}
            >
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        disabled={disabled}
                        className="flex min-h-12 w-full items-center justify-between rounded-xl border border-slate-600 bg-slate-800/60 px-4 text-left text-lg font-semibold hover:bg-slate-800 disabled:opacity-50"
                        aria-label={`${label}: ${kmLabel(value)}`}
                        data-testid="distance-picker"
                    >
                        <span>
                            {kmLabel(value)}
                            {!listed && (
                                <span className="ml-2 text-sm font-normal text-slate-400">
                                    custom
                                </span>
                            )}
                            {twice?.(value) && (
                                <TwiceBadge className="ml-2 align-middle" />
                            )}
                        </span>
                        <span className="text-slate-400" aria-hidden>
                            ▾
                        </span>
                    </button>
                </PopoverTrigger>
                <PopoverContent
                    className="w-[min(22rem,calc(100vw-2rem))] border-slate-700 bg-slate-900 p-3 text-white"
                    data-testid="distance-options"
                >
                    <div className="grid grid-cols-3 gap-2">
                        {options.map((km) => (
                            <button
                                key={km}
                                type="button"
                                aria-pressed={listed && km === value}
                                disabled={taken.includes(km)}
                                title={
                                    taken.includes(km)
                                        ? "Taken away by the Curse of the Drained Brain"
                                        : undefined
                                }
                                className={cn(
                                    CHIP,
                                    listed && km === value ? CHIP_ON : CHIP_OFF,
                                    taken.includes(km) && "line-through",
                                )}
                                onClick={() => {
                                    onChange(km);
                                    close();
                                }}
                            >
                                {kmLabel(km)}
                                {twice?.(km) && (
                                    <TwiceBadge className="absolute -right-1 -top-2" />
                                )}
                            </button>
                        ))}
                        <button
                            type="button"
                            aria-pressed={custom || !listed}
                            className={cn(
                                CHIP,
                                custom || !listed
                                    ? CHIP_ON
                                    : "border border-dashed border-slate-500",
                            )}
                            onClick={() => {
                                setCustom(true);
                                setTyped(String(value));
                            }}
                        >
                            Custom…
                        </button>
                    </div>
                    {custom && (
                        <form
                            className="mt-3 flex items-center gap-2"
                            onSubmit={(event) => {
                                event.preventDefault();
                                const km = parseFloat(typed.replace(",", "."));
                                if (km > 0 && km <= 1000) {
                                    onChange(km);
                                    close();
                                }
                            }}
                        >
                            <input
                                // The number pad, at once.
                                autoFocus
                                type="number"
                                inputMode="decimal"
                                step="any"
                                min={0.1}
                                max={1000}
                                aria-label="Custom distance (km)"
                                className="h-11 w-28 rounded-md border border-slate-600 bg-slate-950 px-2 text-base"
                                value={typed}
                                onChange={(event) =>
                                    setTyped(event.target.value)
                                }
                            />
                            <span>km</span>
                            <Button type="submit" className="ml-auto">
                                OK
                            </Button>
                        </form>
                    )}
                </PopoverContent>
            </Popover>
        </CardSection>
    );
};
