import { useStore } from "@nanostores/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useTick } from "@/hooks/useTick";
import { coachMark } from "@/lib/coachMark";

const PAD = 8;
const GAP = 16;
/** A target that never shows up (a panel that didn't open): give up. */
const GIVE_UP_MS = 15_000;

/**
 * The tutorial's ring and note, for one thing to do right now ("pick your
 * hiding spot"). Unlike the tutorial it dims nothing: the page stays usable
 * underneath, and the note goes away by itself once the element it points
 * at is gone (the thing was done) or when the player taps "Got it".
 */
export const CoachMark = () => {
    const $mark = useStore(coachMark);
    // Follows the element while the panel slides in or the page scrolls.
    useTick(!!$mark, 300);
    const cardRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 300, height: 120 });
    const seen = useRef(false);
    const since = useRef(0);

    useEffect(() => {
        seen.current = false;
        since.current = Date.now();
    }, [$mark]);

    const target =
        $mark && typeof document !== "undefined"
            ? document.querySelector($mark.target)
            : null;
    const rect = target?.getBoundingClientRect() ?? null;
    const visible = !!rect && rect.width > 0 && rect.height > 0;

    useEffect(() => {
        if (!$mark) return;
        if (visible) {
            seen.current = true;
            return;
        }
        if (seen.current || Date.now() - since.current > GIVE_UP_MS) {
            coachMark.set(null);
        }
    });

    useLayoutEffect(() => {
        const card = cardRef.current;
        if (!card) return;
        const { width, height } = card.getBoundingClientRect();
        if (
            width > 0 &&
            height > 0 &&
            (width !== size.width || height !== size.height)
        ) {
            setSize({ width, height });
        }
    });

    if (!$mark || !rect || !visible) return null;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(size.width, vw - 2 * GAP);
    let left: number;
    let top: number;
    if (rect.right + GAP + width <= vw - GAP) {
        // Next to the sidebar, over the map.
        left = rect.right + GAP;
        top = rect.top;
    } else if (rect.top - GAP - size.height >= GAP) {
        // Above the phone's sheet, over the map.
        left = rect.left;
        top = rect.top - GAP - size.height;
    } else {
        left = rect.left;
        top = rect.bottom + GAP;
    }
    left = Math.max(GAP, Math.min(left, vw - width - GAP));
    top = Math.max(GAP, Math.min(top, vh - size.height - GAP));

    return (
        <div className="pointer-events-none fixed inset-0 z-[1038]">
            <div
                className="absolute rounded-xl border-[3px] border-blue-500 tutorial-highlight-pulse"
                style={{
                    left: rect.left - PAD,
                    top: rect.top - PAD,
                    width: rect.width + 2 * PAD,
                    height: rect.height + 2 * PAD,
                    boxShadow:
                        "0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 24px rgba(59, 130, 246, 0.6)",
                }}
            />
            <div
                ref={cardRef}
                role="status"
                data-testid="coach-mark"
                className="pointer-events-auto absolute flex flex-col gap-2 rounded-lg border border-blue-400 bg-slate-900 p-3 text-sm text-white shadow-xl"
                style={{ left, top, width: "min(320px, calc(100vw - 32px))" }}
            >
                <p className="font-semibold font-poppins">{$mark.title}</p>
                <p className="text-xs text-slate-200">{$mark.text}</p>
                <Button
                    size="sm"
                    className="self-end"
                    onClick={() => coachMark.set(null)}
                >
                    Got it
                </Button>
            </div>
        </div>
    );
};
