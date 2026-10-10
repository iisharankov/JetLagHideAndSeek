// A one-off pointer in the tutorial's style: a ring around one element and
// a short note next to it. Shown until the element leaves the page (its job
// is done) or the player taps "Got it".
import { atom } from "nanostores";

export interface CoachMark {
    /** CSS selector of the element to point at. */
    target: string;
    title: string;
    text: string;
}

export const coachMark = atom<CoachMark | null>(null);
