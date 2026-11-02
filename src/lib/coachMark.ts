// A one-off pointer in the tutorial's style: a ring around one element and
// a short note next to it. Shown until the element leaves the page (its job
// is done) or the player taps "Got it". The tutorial's tours and tips use
// the same ring and note (lib/tour.ts).
import { atom } from "nanostores";

export interface CoachMark {
    /** CSS selector of the element to point at: the first one on the page, of several. */
    target: string | string[];
    title: string;
    text: string;
    /** A one-time tip (lib/tour.ts): another tip may take its place. */
    tip?: boolean;
}

export const coachMark = atom<CoachMark | null>(null);
