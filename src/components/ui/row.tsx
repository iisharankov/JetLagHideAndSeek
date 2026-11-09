import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const ROW =
    "flex min-h-14 w-full items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-left text-sm";

/**
 * A row of a tab's list (the Hider tab, mock-up 14): an icon, a title, a
 * line under it, and what's on the right. With `onClick` it's a button.
 */
export const Row = ({
    icon,
    title,
    sub,
    right,
    onClick,
    className,
    chevron,
    ...rest
}: {
    icon?: ReactNode;
    title: ReactNode;
    sub?: ReactNode;
    right?: ReactNode;
    onClick?: () => void;
    className?: string;
    chevron?: boolean;
    "data-testid"?: string;
    "data-tutorial-id"?: string;
}) => {
    const body = (
        <>
            {icon && (
                <span className="w-6 shrink-0 text-center text-xl" aria-hidden>
                    {icon}
                </span>
            )}
            <span className="min-w-0 flex-1">
                <span className="block font-semibold">{title}</span>
                {sub && (
                    <span className="block text-xs text-slate-400">{sub}</span>
                )}
            </span>
            {right}
            {chevron && (
                <span className="shrink-0 text-slate-400" aria-hidden>
                    ›
                </span>
            )}
        </>
    );
    return onClick ? (
        <button
            type="button"
            className={cn(ROW, "hover:bg-slate-800", className)}
            onClick={onClick}
            {...rest}
        >
            {body}
        </button>
    ) : (
        <div className={cn(ROW, className)} {...rest}>
            {body}
        </div>
    );
};

/** A row that turns something on and off, with an On/Off tag. */
export const SwitchRow = ({
    icon,
    title,
    sub,
    checked,
    onCheckedChange,
    tutorialId,
}: {
    icon?: ReactNode;
    title: string;
    sub?: ReactNode;
    checked: boolean;
    onCheckedChange: (on: boolean) => void;
    tutorialId?: string;
}) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        className={cn(ROW, "hover:bg-slate-800")}
        onClick={() => onCheckedChange(!checked)}
        data-tutorial-id={tutorialId}
    >
        {icon && (
            <span className="w-6 shrink-0 text-center text-xl" aria-hidden>
                {icon}
            </span>
        )}
        <span className="min-w-0 flex-1">
            <span className="block font-semibold">{title}</span>
            {sub && <span className="block text-xs text-slate-400">{sub}</span>}
        </span>
        <span
            className={cn(
                "shrink-0 rounded-md px-2 py-1 text-xs font-bold",
                checked
                    ? "bg-blue-600 text-white"
                    : "bg-slate-700 text-slate-300",
            )}
            aria-hidden
        >
            {checked ? "On" : "Off"}
        </span>
    </button>
);
