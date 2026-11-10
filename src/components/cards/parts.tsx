import { useStore } from "@nanostores/react";
import type { ReactNode } from "react";

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
