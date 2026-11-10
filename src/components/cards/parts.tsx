import { type ReactNode, useState } from "react";

import { RepeatBadge } from "@/components/ask/QuestionTypes";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// The pieces question cards are made of: a labelled section, big chips,
// and the distance as one button with its pop-up (the answer is the What
// if chip since round 46, in layout.tsx).

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
    asked,
    taken = [],
    disabled,
    label = "Distance",
    look = "section",
}: {
    value: number;
    options: number[];
    onChange: (km: number) => void;
    /** How often this distance was asked before this round (×2, ×3…). */
    asked?: (km: number) => number;
    /** Taken away (the Curse of the Drained Brain). */
    taken?: number[];
    disabled?: boolean;
    label?: string;
    /**
     * "section": under its own label; "plain": the button alone (a row of
     * the card's layout labels it); "token": a word in the sentence.
     */
    look?: "section" | "plain" | "token";
}) => {
    const [open, setOpen] = useState(false);
    const [custom, setCustom] = useState(false);
    const [typed, setTyped] = useState("");
    const listed = options.includes(value);
    const close = () => {
        setOpen(false);
        setCustom(false);
    };
    const token = look === "token";
    const picker = (
        <Popover
            open={open}
            onOpenChange={(next) => (next ? setOpen(true) : close())}
        >
            <PopoverTrigger asChild>
                <button
                    type="button"
                    disabled={disabled}
                    className={
                        token
                            ? "inline-flex h-10 shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-2.5 font-bold text-white hover:bg-blue-500 disabled:opacity-50"
                            : "flex min-h-12 w-full items-center justify-between rounded-xl border border-slate-600 bg-slate-800/60 px-4 text-left text-lg font-semibold hover:bg-slate-800 disabled:opacity-50"
                    }
                    aria-label={`${label}: ${kmLabel(value)}`}
                    data-testid="distance-picker"
                >
                    <span className="whitespace-nowrap">
                        {kmLabel(value)}
                        {!listed && !token && (
                            <span className="ml-2 text-sm font-normal text-slate-400">
                                custom
                            </span>
                        )}
                        {!token && (
                            <RepeatBadge
                                before={asked?.(value) ?? 0}
                                className="ml-2 align-middle"
                            />
                        )}
                    </span>
                    <span
                        className={token ? "text-blue-100" : "text-slate-400"}
                        aria-hidden
                    >
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
                            <RepeatBadge
                                before={asked?.(km) ?? 0}
                                className="absolute -right-1 -top-2"
                            />
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
                            onChange={(event) => setTyped(event.target.value)}
                        />
                        <span>km</span>
                        <Button type="submit" className="ml-auto">
                            OK
                        </Button>
                    </form>
                )}
            </PopoverContent>
        </Popover>
    );
    return look === "section" ? (
        <CardSection label={label}>{picker}</CardSection>
    ) : (
        picker
    );
};
