import { useStore } from "@nanostores/react";
import {
    type ReactNode,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";

import { Button } from "@/components/ui/button";
import { SidebarContext } from "@/components/ui/sidebar-l";
import { useTick } from "@/hooks/useTick";
import { coachMark } from "@/lib/coachMark";
import { mapBottomInset, setupDialog, sidebarTab } from "@/lib/context";
import { activeGameId, GAME_URL_PARAM } from "@/lib/game/session";
import {
    backStep,
    endTour,
    nextStep,
    offerTour,
    skipMissingStep,
    tour,
} from "@/lib/tour";
import { OFFERS, TOURS, type TourStep } from "@/lib/tourSteps";

const PAD = 8;
const GAP = 16;
/** A target that never shows up (a panel that didn't open): give up. */
const GIVE_UP_MS = 15_000;
/** A tour step's target not there by then: the note goes on without it (or the step is left out). */
const WAIT_MS = 1_500;
/**
 * The note shows once its target has stopped moving (the phone's sheet
 * slides in, a panel scrolls) for this long, so a tap on Next isn't split
 * between two places; a target that never rests gets its note anyway.
 */
const SETTLE_MS = 250;
const RESTLESS_MS = 2_000;
/** A note without a target: below the Menu button… */
const TOP = 64;
/** …or, on a phone with the sheet closed, above the sidebar button: clear of the toasts at the top, and in reach of a thumb. */
const BOTTOM = 72;
const PHONE = 768;

const demoLayer = () => import("@/maps/tourDemoLayer");

/** The first of the selectors that is on the page, in view and not hidden. */
const findTarget = (selectors: string | string[] | undefined) => {
    if (!selectors || typeof document === "undefined") return null;
    for (const selector of Array.isArray(selectors) ? selectors : [selectors]) {
        const element = document.querySelector(selector);
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        if (
            rect.width > 0 &&
            rect.height > 0 &&
            rect.bottom > 0 &&
            rect.right > 0 &&
            rect.top < window.innerHeight &&
            rect.left < window.innerWidth &&
            // The phone's sheet is hidden as it closes, while still in place.
            getComputedStyle(element).visibility !== "hidden"
        ) {
            return { element, rect };
        }
    }
    return null;
};

const rectKey = (rect: DOMRect | null) =>
    rect
        ? [rect.left, rect.top, rect.width, rect.height]
              .map(Math.round)
              .join(",")
        : "";

/** "Then tap **Done**": the label in bold. */
const withBold = (text: string) =>
    text
        .split("**")
        .map((part, index) =>
            index % 2 ? <strong key={index}>{part}</strong> : part,
        );

/** Opens the sidebar (on a tab), or closes it: the examples need the map. */
const arrangeSidebar = ({ sidebar, tab }: TourStep) => {
    if (tab) sidebarTab.set(tab);
    if (!sidebar) return;
    const context = SidebarContext.get();
    const open = sidebar === "open";
    if (context.isMobile) context.setOpenMobile(open);
    else context.setOpen(open);
};

/**
 * The tutorial's ring and note. It runs the tours (lib/tour.ts) and shows
 * single notes: one thing to do right now ("pick your hiding spot") or a
 * tip the first time something happens. It dims nothing: the page stays
 * usable underneath. A single note goes away by itself once the element it
 * points at is gone (the thing was done) or when the player taps "Got it".
 */
export const CoachMark = () => {
    const $mark = useStore(coachMark);
    const $tour = useStore(tour);
    const $sheet = useStore(mapBottomInset);
    const step =
        $tour && $tour.step !== "offer" ? TOURS[$tour.id][$tour.step] : null;
    const offer = $tour?.step === "offer" ? OFFERS[$tour.id] : null;
    // Follows the element while the panel slides in or the page scrolls.
    useTick(!!$tour || !!$mark, 300);
    const cardRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 300, height: 120 });
    const demoShown = useRef(false);
    // Each note (a tour's step, or a single note) has its own clock: how
    // long its target has been awaited, and whether it was ever there.
    const showing = $tour ? `${$tour.id}:${$tour.step}` : $mark;
    const clock = useRef({ showing: null as unknown, since: 0, seen: false });
    if (clock.current.showing !== showing) {
        clock.current = { showing, since: Date.now(), seen: false };
    }
    // Where the target was last, and since when.
    const rest = useRef({ key: "", since: 0 });

    // A first visit to the plain address (not a game's link): the tour
    // for whoever sets games up. A link opens the join dialog instead.
    useEffect(() => {
        const timer = setTimeout(() => {
            const fromLink = new URL(window.location.href).searchParams.has(
                GAME_URL_PARAM,
            );
            if (
                !fromLink &&
                activeGameId.get() === "" &&
                setupDialog.get() === null
            ) {
                offerTour("organiser");
            }
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

    // Each step puts the sidebar and the map in place; the examples go
    // when the tour ends, and the map goes back to where it was.
    useEffect(() => {
        if (step) {
            arrangeSidebar(step);
            if (step.demo) {
                demoShown.current = true;
                const demo = step.demo;
                void demoLayer().then((layer) => layer.showDemo(demo));
            } else if (demoShown.current) {
                void demoLayer().then((layer) => layer.clearDemo(false));
            }
        } else if (demoShown.current) {
            demoShown.current = false;
            void demoLayer().then((layer) => layer.clearDemo(true));
        }
    }, [$tour?.id, $tour?.step]);

    const found = findTarget(
        step ? step.target : offer ? undefined : $mark?.target,
    );
    const rect = found?.rect ?? null;
    const now = Date.now();
    const waited = now - clock.current.since;
    const where = rectKey(rect);
    if (rest.current.key !== where) rest.current = { key: where, since: now };
    const settled =
        !rect ||
        now - rest.current.since >= SETTLE_MS ||
        now - clock.current.since >= RESTLESS_MS;

    useEffect(() => {
        if ($tour) {
            if (step?.optional && !found && waited > WAIT_MS) {
                skipMissingStep();
            }
            return;
        }
        if (!$mark) return;
        if (found) {
            clock.current.seen = true;
            return;
        }
        if (clock.current.seen || waited > GIVE_UP_MS) coachMark.set(null);
    });

    // "Tap the highlighted thing to go on."
    const element = found?.element ?? null;
    useEffect(() => {
        if (!step?.advanceOnTap || !element) return;
        const onTap = () => nextStep();
        element.addEventListener("click", onTap);
        return () => element.removeEventListener("click", onTap);
    }, [element, step]);

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

    if (!$tour && !$mark) return null;
    // A single note needs its element; a tour step waits a moment for it.
    if (!$tour && !rect) return null;
    if (step?.target && !rect && waited <= WAIT_MS) return null;
    if (!settled) return null;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(size.width, vw - 2 * GAP);
    let left: number;
    let top: number;
    if (!rect) {
        left = (vw - width) / 2;
        top = vw < PHONE && $sheet === 0 ? vh - size.height - BOTTOM : TOP;
    } else if (rect.right + GAP + width <= vw - GAP) {
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

    let title: string;
    let text: string;
    let footer: ReactNode;
    if ($tour && offer) {
        ({ title, text } = offer);
        footer = (
            <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={endTour}>
                    No thanks
                </Button>
                <Button size="sm" onClick={nextStep}>
                    Show Tutorial
                </Button>
            </div>
        );
    } else if ($tour && step) {
        ({ title, text } = step);
        const index = $tour.step as number;
        const total = TOURS[$tour.id].length;
        footer = (
            <div className="flex items-center justify-between gap-2">
                <button
                    type="button"
                    className="text-xs text-slate-300 underline"
                    onClick={endTour}
                >
                    Skip tutorial
                </button>
                <span className="text-xs text-slate-300">
                    {`${index + 1} of ${total}`}
                </span>
                <div className="flex gap-1">
                    <Button
                        size="sm"
                        variant="secondary"
                        disabled={index === 0}
                        onClick={backStep}
                    >
                        Back
                    </Button>
                    <Button size="sm" onClick={nextStep}>
                        {index === total - 1 ? "Finish" : "Next"}
                    </Button>
                </div>
            </div>
        );
    } else {
        ({ title, text } = $mark!);
        footer = (
            <Button
                size="sm"
                className="self-end"
                onClick={() => coachMark.set(null)}
            >
                Got it
            </Button>
        );
    }

    return (
        <div className="pointer-events-none fixed inset-0 z-[1038]">
            {rect && (
                <div
                    className="coach-ring-pulse absolute rounded-xl border-[3px] border-blue-500"
                    style={{
                        left: rect.left - PAD,
                        top: rect.top - PAD,
                        width: rect.width + 2 * PAD,
                        height: rect.height + 2 * PAD,
                    }}
                />
            )}
            <div
                ref={cardRef}
                role="status"
                data-testid="coach-mark"
                data-tour-step={step?.id ?? (offer ? "offer" : undefined)}
                className="pointer-events-auto absolute flex flex-col gap-2 rounded-lg border border-blue-400 bg-slate-900 p-3 text-sm text-white shadow-xl"
                style={{ left, top, width: "min(320px, calc(100vw - 32px))" }}
            >
                <p className="font-semibold font-poppins">{title}</p>
                <p className="text-xs text-slate-200">{withBold(text)}</p>
                {footer}
            </div>
        </div>
    );
};
