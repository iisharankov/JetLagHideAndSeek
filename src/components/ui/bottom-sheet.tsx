import * as React from "react";

import { cn } from "@/lib/utils";

export type SheetSnap = "half" | "full";

/** How tall the sheet is at a snap, in px. */
const heightFor = (snap: SheetSnap) =>
    snap === "full" ? window.innerHeight : Math.round(window.innerHeight / 2);

/**
 * A sheet from the bottom of a phone's screen, with nothing dimmed or
 * blocked behind it: half the screen or all of it. Its handle drags it
 * between closed, half and full (a tap on the handle switches half and
 * full). No dialog semantics, so the rest of the page stays usable.
 */
export const BottomSheet = ({
    open,
    snap,
    onSnapChange,
    onClose,
    className,
    children,
    ...props
}: React.HTMLAttributes<HTMLDivElement> & {
    open: boolean;
    snap: SheetSnap;
    onSnapChange: (snap: SheetSnap) => void;
    onClose: () => void;
}) => {
    const [dragHeight, setDragHeight] = React.useState<number | null>(null);
    const drag = React.useRef<{
        pointerId: number;
        y: number;
        at: number;
        base: number;
        moved: boolean;
    } | null>(null);
    const [, rerender] = React.useState(0);
    React.useEffect(() => {
        const onResize = () => rerender((n) => n + 1);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    const restHeight = open ? heightFor(snap) : 0;
    const height = dragHeight ?? restHeight;

    const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {
            pointerId: event.pointerId,
            y: event.clientY,
            at: Date.now(),
            base: restHeight,
            moved: false,
        };
    };
    const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId) return;
        const next = current.base + (current.y - event.clientY);
        if (Math.abs(current.y - event.clientY) > 4) current.moved = true;
        setDragHeight(Math.max(0, Math.min(window.innerHeight, next)));
    };
    const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId) return;
        drag.current = null;
        const final = dragHeight;
        setDragHeight(null);
        if (!current.moved) {
            // A tap on the handle: half ↔ full.
            onSnapChange(snap === "full" ? "half" : "full");
            return;
        }
        if (final === null) return;
        const travelled = final - current.base;
        const fast = Math.abs(travelled) / Math.max(1, Date.now() - current.at);
        const flick = fast > 0.4 ? Math.sign(travelled) : 0;
        const total = window.innerHeight;
        if (flick < 0 || final < total * 0.25) {
            if (flick < 0 && current.base >= total - 1) onSnapChange("half");
            else onClose();
        } else if (flick > 0 || final > total * 0.75) {
            onSnapChange("full");
        } else {
            onSnapChange("half");
        }
    };

    return (
        <div
            {...props}
            className={cn(
                "fixed inset-x-0 bottom-0 z-[1035] flex flex-col rounded-t-2xl border-t border-slate-600 bg-sidebar text-sidebar-foreground shadow-[0_-8px_30px_rgba(0,0,0,0.5)]",
                !open && dragHeight === null && "invisible",
                className,
            )}
            style={{
                height: `${height}px`,
                transition:
                    dragHeight === null ? "height 220ms ease-out" : "none",
            }}
            data-snap={snap}
            data-open={open || undefined}
        >
            <div
                className="flex h-7 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                role="button"
                aria-label={
                    snap === "full" ? "Shrink the panel" : "Expand the panel"
                }
                data-testid="sheet-handle"
            >
                <div
                    className="h-1.5 w-12 rounded-full bg-slate-500"
                    aria-hidden="true"
                />
            </div>
            <div className="flex min-h-0 w-full flex-1 flex-col">
                {children}
            </div>
        </div>
    );
};
