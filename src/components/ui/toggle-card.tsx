import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A setting as a card you tap to switch on or off. It is highlighted and
 * says "On" while active, so its state is clear at a glance.
 */
export const ToggleCard = ({
    title,
    description,
    checked,
    onCheckedChange,
    disabled,
    className,
}: {
    title: ReactNode;
    description?: ReactNode;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
    className?: string;
}) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
            "flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            checked
                ? "border-blue-500 bg-blue-500/15"
                : "border-slate-600 bg-slate-800/40 hover:bg-slate-800",
            className,
        )}
    >
        <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{title}</span>
            {description && (
                <span className="mt-0.5 block text-xs text-slate-400">
                    {description}
                </span>
            )}
        </span>
        <span
            aria-hidden="true"
            className={cn(
                "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-bold",
                checked
                    ? "bg-blue-500 text-white"
                    : "bg-slate-600 text-slate-200",
            )}
        >
            {checked ? "On" : "Off"}
        </span>
    </button>
);

/** A row of options of which exactly one is active, shown highlighted. */
export const SegmentedControl = <T extends string>({
    label,
    options,
    value,
    onValueChange,
    disabled,
}: {
    label: string;
    options: { value: T; label: string }[];
    value: T;
    onValueChange: (value: T) => void;
    disabled?: boolean;
}) => (
    <div
        role="radiogroup"
        aria-label={label}
        // Four or more options go in two rows: a sidebar is narrow.
        className={cn(
            "w-full gap-1",
            options.length > 3 ? "grid grid-cols-2" : "flex",
        )}
    >
        {options.map((option) => {
            const active = option.value === value;
            return (
                <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={disabled}
                    onClick={() => onValueChange(option.value)}
                    className={cn(
                        "flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50",
                        active
                            ? "border-blue-500 bg-blue-500 text-white"
                            : "border-slate-600 bg-slate-800/40 text-slate-200 hover:bg-slate-800",
                    )}
                >
                    {option.label}
                </button>
            );
        })}
    </div>
);
