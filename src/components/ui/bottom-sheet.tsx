import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The phone's panel over the map: the whole screen above the tab bar
 * (round 41: no half height, no handle; the tab bar's Map brings the map
 * back). No dialog semantics, so the tab bar stays usable.
 */
export const BottomSheet = ({
    open,
    bottomInset = 0,
    className,
    style,
    children,
    ...props
}: React.HTMLAttributes<HTMLDivElement> & {
    open: boolean;
    /** Room kept free under the panel (the tab bar), in px. */
    bottomInset?: number;
    style?: React.CSSProperties;
}) => (
    <div
        {...props}
        className={cn(
            "fixed inset-x-0 top-0 z-[1035] flex flex-col bg-sidebar text-sidebar-foreground",
            // Closed: hidden, and off the screen below.
            !open && "invisible translate-y-[100vh]",
            className,
        )}
        style={{
            ...style,
            bottom: `calc(${bottomInset}px + env(safe-area-inset-bottom))`,
            paddingTop: "env(safe-area-inset-top)",
        }}
        data-open={open || undefined}
    >
        <div className="flex min-h-0 w-full flex-1 flex-col">{children}</div>
    </div>
);
