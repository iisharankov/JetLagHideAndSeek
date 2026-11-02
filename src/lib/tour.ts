// The tutorial's state: which tour runs and where it is, and what this phone
// has seen. Tours and tips are shown by components/CoachMark.tsx (a ring
// and a note that dim nothing, so the game stays usable underneath); their
// texts are in lib/tourSteps.ts.
import { atom } from "nanostores";

import { coachMark } from "@/lib/coachMark";
import { persistentAtom } from "@/lib/persist";

import { type TipId, TIPS, type TourId, TOURS } from "./tourSteps";

const json = { encode: JSON.stringify, decode: JSON.parse };

/** Offer tours and tips at all (the browser tests switch it off). */
export const showTutorial = persistentAtom<boolean>(
    "showTutorials",
    true,
    json,
);

/** Tours ("seeker") and tips ("tip:seeker-curse") this phone has had. */
export const tutorialsSeen = persistentAtom<Record<string, true>>(
    "tutorialsSeen",
    {},
    json,
);

export interface TourState {
    id: TourId;
    /** The step shown, or the offer ("Show Tutorial") before the first. */
    step: number | "offer";
    /** Which way the player went last: a missing step is skipped that way. */
    direction?: 1 | -1;
    /** Runs when the tour ends, however it ends. */
    then?: () => void;
    /** A tip whose moment came during the tour: shown when it ends. */
    tip?: TipId;
}

export const tour = atom<TourState | null>(null);

const markSeen = (key: string) =>
    tutorialsSeen.set({ ...tutorialsSeen.get(), [key]: true });

/**
 * The first time in a role on this phone: offer its tour. False when it
 * isn't offered (seen, switched off, a tour running); `then` runs when an
 * offered tour ends. An offer nobody answered gives way to a newer one
 * (it isn't declined, so it may come again).
 */
export const offerTour = (id: TourId, then?: () => void) => {
    const current = tour.get();
    if (
        !showTutorial.get() ||
        tutorialsSeen.get()[id] ||
        (current && current.step !== "offer")
    ) {
        return false;
    }
    tour.set({ id, step: "offer", then });
    return true;
};

/** Runs a tour from its first step (the Menu does, whatever was seen). */
export const startTour = (id: TourId, then?: () => void) =>
    tour.set({ id, step: 0, direction: 1, then });

/** Ends the tour (finished, skipped or declined): it isn't offered again. */
export const endTour = () => {
    const current = tour.get();
    if (!current) return;
    markSeen(current.id);
    tour.set(null);
    current.then?.();
    if (current.tip) showTip(current.tip);
};

const goTo = (step: number, direction: 1 | -1) => {
    const current = tour.get();
    if (!current) return;
    if (step >= TOURS[current.id].length) {
        endTour();
        return;
    }
    tour.set({ ...current, step: Math.max(0, step), direction });
};

export const nextStep = () => {
    const current = tour.get();
    if (!current) return;
    goTo(current.step === "offer" ? 0 : current.step + 1, 1);
};

export const backStep = () => {
    const current = tour.get();
    if (!current || current.step === "offer") return;
    goTo(current.step - 1, -1);
};

/** The step's target isn't there: on to the next one the way the player was going. */
export const skipMissingStep = () => {
    const current = tour.get();
    if (!current || current.step === "offer") return;
    if (current.direction === -1 && current.step > 0) {
        goTo(current.step - 1, -1);
    } else {
        goTo(current.step + 1, 1);
    }
};

/**
 * A one-time tip, the first time something happens. During a tour it waits
 * for the tour's end (the latest one only); it never covers a pointer to
 * something to do now ("pick your hiding spot"), and a newer tip replaces
 * an older one. Not shown: tried again the next time it happens.
 */
export const showTip = (id: TipId) => {
    const key = `tip:${id}`;
    if (!showTutorial.get() || tutorialsSeen.get()[key]) return false;
    const running = tour.get();
    if (running) {
        tour.set({ ...running, tip: id });
        return false;
    }
    const showing = coachMark.get();
    if (showing && !showing.tip) return false;
    markSeen(key);
    coachMark.set({ ...TIPS[id], tip: true });
    return true;
};
