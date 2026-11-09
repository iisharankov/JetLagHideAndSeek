// The screens pushed over a tab's list, and Back: the open question
// (`openQuestion`, Round 28), and over it the ask flow (the question types,
// then one kind's choices). Back pops the top one; the phone's own Back
// button does the same, through the browser's history.
import { atom, computed } from "nanostores";

import { openQuestion, type SidebarTab, sidebarTab } from "@/lib/context";

/** The kinds a question can be asked as (the type tiles). */
export type AskKind =
    | "radius"
    | "thermometer"
    | "matching"
    | "measuring"
    | "tentacles"
    | "photo";

/**
 * The ask flow, when it's open: the types screen (`kind` null) or one
 * kind's choices. `research`: the hider's own probe, never sent.
 */
export const askFlow = atom<{ research: boolean; kind: AskKind | null } | null>(
    null,
);

/**
 * A screen pushed over a tab's own view: the seekers' list (Hider tab), a
 * photo question (Questions). It belongs to its tab and closes when
 * another tab is chosen.
 */
export type PushedScreen =
    | { tab: SidebarTab; kind: "seekers" }
    | { tab: SidebarTab; kind: "photo"; id: string };

export const pushedScreen = atom<PushedScreen | null>(null);

export const pushScreen = (screen: PushedScreen) => pushedScreen.set(screen);

/** How many screens are pushed over the list. */
export const screenDepth = computed(
    [askFlow, pushedScreen, openQuestion],
    (ask, screen, open) =>
        (open !== null ? 1 : 0) +
        (screen ? 1 : 0) +
        (ask ? (ask.kind === null ? 1 : 2) : 0),
);

export const openAsk = (research = false) =>
    askFlow.set({ research, kind: null });

export const pickKind = (kind: AskKind) => {
    const ask = askFlow.get();
    askFlow.set({ research: ask?.research ?? false, kind });
};

export const closeAsk = () => askFlow.set(null);

/**
 * Back one screen: a kind to the types, the types to what was under them,
 * a pushed screen (a photo question, the seekers) to its tab, a card to
 * the list.
 */
export const back = () => {
    const ask = askFlow.get();
    if (ask?.kind) askFlow.set({ ...ask, kind: null });
    else if (ask) askFlow.set(null);
    else if (pushedScreen.get()) pushedScreen.set(null);
    else if (openQuestion.get() !== null) openQuestion.set(null);
};

// The phone's Back button: one history entry per pushed screen. Leaving
// screens by the app's own ‹ takes their entries back off the history.
let pushed = 0;
let ignoreNextPop = 0;
let wired = false;

/** Keeps the history in step with the screens (once, in the browser). */
export const wireBackButton = () => {
    if (wired || typeof window === "undefined") return;
    wired = true;
    // A pushed screen is its tab's: another tab closes it.
    sidebarTab.listen((tab) => {
        const screen = pushedScreen.get();
        if (screen && screen.tab !== tab) pushedScreen.set(null);
    });
    screenDepth.subscribe((depth) => {
        while (pushed < depth) {
            pushed += 1;
            window.history.pushState(
                { ...window.history.state, jetlagScreen: pushed },
                "",
            );
        }
        if (pushed > depth) {
            const steps = pushed - depth;
            pushed = depth;
            ignoreNextPop += 1;
            window.history.go(-steps);
        }
    });
    window.addEventListener("popstate", () => {
        if (ignoreNextPop > 0) {
            ignoreNextPop -= 1;
            return;
        }
        if (pushed === 0) return;
        // The browser already went back one entry: follow it.
        pushed -= 1;
        back();
    });
};
