// What the tutorial says. Short on purpose: a title of at most four words, a
// note of at most twenty, the on-screen labels in **bold** exactly as the
// app shows them (tests/tour.test.ts checks the budget). Game rules come
// from the rulebook (src/content/rules/quick-start-guide/); the examples
// are drawn on the map in Zürich canton (lib/tourDemo.ts).
import type { SidebarTab } from "@/lib/context";
import type { GameEvent } from "@/lib/game/events";
import type { Role } from "@/lib/game/types";

import type { DemoId } from "./tourDemo";

export type TourId = "seeker" | "hider" | "organiser";

export interface TourStep {
    id: string;
    title: string;
    text: string;
    /** What to point at: the first of these on the page. None: the note alone. */
    target?: string[];
    /** Before pointing: the sidebar open, or closed (out of the map's way). */
    sidebar?: "open" | "closed";
    /** …and on this tab. */
    tab?: SidebarTab;
    /** An example drawn on the map. */
    demo?: DemoId;
    /** Left out when its target isn't on the page (a tab that comes and goes). */
    optional?: boolean;
    /** Tapping the target goes on to the next step. */
    advanceOnTap?: boolean;
}

const id = (name: string) => `[data-tutorial-id="${name}"]`;
const tab = (value: SidebarTab) =>
    `[data-tutorial-id="sidebar-tabs"] [data-value="${value}"]`;
const TABS = id("sidebar-tabs");
const MENU = id("menu-button");
const SIDEBAR_BUTTON = id("left-sidebar-trigger");
const CLOCK = '[data-testid="round-clock"]';

/** The game itself, with examples on the map: both roles start here. */
const BASICS: TourStep[] = [
    {
        id: "how-to-play",
        title: "How to play",
        text: "One player (or team) hides near a station. The others ask questions to find them; the longest hide wins.",
        sidebar: "closed",
    },
    {
        id: "zones",
        title: "Hiding zones",
        text: "After the hiding period, the hider must stay in one station's circle: their hiding zone.",
        sidebar: "closed",
        demo: "zones",
    },
    {
        id: "radar",
        title: "Radar",
        text: "Seekers at Zürich HB: within 10 km of us? Yes. Everything farther is shaded: the hider isn't there.",
        sidebar: "closed",
        demo: "radar",
    },
    {
        id: "thermometer",
        title: "Thermometer",
        text: "They ride on to Oerlikon: hotter or colder? Colder. The half nearer Oerlikon is shaded.",
        sidebar: "closed",
        demo: "thermometer",
    },
    {
        id: "more-kinds",
        title: "Three more kinds",
        text: "Matching, Measuring and Tentacles compare places: the same nearest airport? Closer to a museum?",
        sidebar: "closed",
        demo: "thermometer",
    },
    {
        id: "station-decides",
        title: "The station decides",
        text: "Answers come from the hider's station, not their spot. Wipkingen is on the open side, so its whole zone stays.",
        sidebar: "closed",
        demo: "station",
    },
    {
        id: "endgame",
        title: "The end game",
        text: "In their zone? Tap **Found it** on that station. From then on, answers come from the hider's pin.",
        sidebar: "closed",
        demo: "endgame",
    },
    {
        id: "pin",
        title: "The pin",
        text: "The pin is where the hider really is. Once the end game starts there, it can't move.",
        sidebar: "closed",
        demo: "endgame",
    },
    {
        id: "cards",
        title: "Cards and time",
        text: "Each answer earns the hider cards: curses for the seekers, and time bonuses added when they're found.",
        sidebar: "closed",
    },
];

const MENU_STEP: TourStep = {
    id: "menu",
    title: "Rules and help",
    text: "The rules, every card and this tutorial are in the **Menu**.",
    target: [MENU],
};

export const TOURS: Record<TourId, TourStep[]> = {
    seeker: [
        ...BASICS,
        {
            id: "sidebar",
            title: "Your sidebar",
            text: "Tap **Questions** to open your questions, the stations left and your cards.",
            target: [SIDEBAR_BUTTON],
            sidebar: "closed",
            tab: "questions",
            advanceOnTap: true,
        },
        {
            id: "ask",
            title: "Ask a question",
            text: "Tap **Add Question**, pick a kind, then drag its pin on the map to where you are.",
            target: [id("add-questions-buttons")],
            sidebar: "open",
            tab: "questions",
        },
        {
            id: "send",
            title: "Send it",
            text: "It's a draft until you tap **Send to the hider**. They have five minutes; the answer shades the map.",
            target: [id("send-question"), id("add-questions-buttons")],
            sidebar: "open",
            tab: "questions",
        },
        {
            id: "stations",
            title: "Stations left",
            text: "Turn on **Show hiding zones**: green circles are where the hider may be. **Found it** starts the end game.",
            target: [tab("stations"), TABS],
            sidebar: "open",
            tab: "stations",
        },
        {
            id: "curses",
            title: "Curses",
            text: "Curses on you show under **Cards**. Do what they say, then tap **Cleared**.",
            target: [tab("curses"), TABS],
            sidebar: "open",
            tab: "curses",
        },
        {
            id: "clock",
            title: "The clock",
            text: "The hider's time, running until they're found. A pause or a rest needs both sides to agree.",
            target: [CLOCK],
            sidebar: "open",
            tab: "questions",
        },
        MENU_STEP,
    ],
    hider: [
        ...BASICS,
        {
            id: "pick",
            title: "Your station",
            text: "Tap your station on the map, or **Mine** in the list; it turns red. Then tap **Done**.",
            target: [id("hider-pick")],
            sidebar: "open",
            tab: "stations",
            // A hider whose station is set (the tour from the Menu) skips it.
            optional: true,
        },
        {
            id: "research",
            title: "Try it first",
            text: "Before **Done**, **Research** questions are yours alone: see what a station would answer.",
            target: [tab("research")],
            sidebar: "open",
            optional: true,
        },
        {
            id: "answer",
            title: "Answering",
            text: "A beep means a question: answer under **Questions** within five minutes. The app suggests the answer.",
            target: [tab("questions"), TABS],
            sidebar: "open",
        },
        {
            id: "hand",
            title: "Your cards",
            text: "After each answer you draw cards; keep them in **Cards**. Play curses and powerups from there.",
            target: [tab("curses"), TABS],
            sidebar: "open",
        },
        {
            id: "time",
            title: "Your time",
            text: "Your hiding time. Time bonuses in your hand are added when you're found: longest hide wins.",
            target: [CLOCK],
            sidebar: "open",
        },
        {
            id: "station-then-pin",
            title: "Station, then pin",
            text: "Answers come from your station until the end game, then from your pin: keep it where you are.",
            target: ['[data-testid="hider-panel"]'],
            sidebar: "open",
            tab: "stations",
        },
        MENU_STEP,
    ],
    organiser: [
        {
            id: "welcome",
            title: "Hide and Seek",
            text: "A map for Jet Lag's Hide and Seek. Set up a game here, then send everyone the link.",
        },
        {
            id: "setup",
            title: "Start a game",
            text: "**Menu** → **Start a shared game**: play area, size, deck and questions, then **Start the game**.",
            target: [MENU],
        },
        {
            id: "places",
            title: "Check the places",
            text: "In setup, **Review places on the map**: reject wrong zoos, parks or museums before you play.",
            target: [MENU],
        },
        {
            id: "invite",
            title: "Invite everyone",
            text: "In the **Menu**, **Share the game link**. Everyone gives a name and picks seeker or hider.",
            target: [MENU],
        },
        {
            id: "menu",
            title: "Rules and help",
            text: "The rules, every card and the seeker and hider tutorials are in the **Menu**.",
            target: [MENU],
        },
    ],
};

/** The buttons in Menu → Game → Help. */
export const TOUR_LABELS: Record<TourId, string> = {
    seeker: "Seeker",
    hider: "Hider",
    organiser: "Setting up",
};

/** The first time on a phone: "Show Tutorial" or not. */
export const OFFERS: Record<TourId, { title: string; text: string }> = {
    seeker: {
        title: "New here?",
        text: "How the game works, with examples on the map, then how to ask questions here.",
    },
    hider: {
        title: "New here?",
        text: "How the game works, with examples on the map, then how to hide and answer here.",
    },
    organiser: {
        title: "New here?",
        text: "How to set up a game and invite everyone.",
    },
};

export type TipId =
    | "hider-question"
    | "hider-draw"
    | "hider-endgame"
    | "seeker-hider-ready"
    | "seeker-answer"
    | "seeker-curse"
    | "seeker-move";

export interface Tip {
    title: string;
    text: string;
    target: string[];
}

/** One-time tips, the first time something happens in a game. */
export const TIPS: Record<TipId, Tip> = {
    "hider-question": {
        title: "A question",
        text: "Answer it under **Questions** within five minutes. The map shows what each answer rules out.",
        target: [tab("questions"), SIDEBAR_BUTTON],
    },
    "hider-draw": {
        title: "Your cards",
        text: "Your answer earns cards: pick the ones you keep in **Cards**.",
        target: [tab("curses"), SIDEBAR_BUTTON],
    },
    "hider-endgame": {
        title: "End game",
        text: "Stay put. Your answers now come from your pin: keep it exactly where you are.",
        target: ['[data-testid="hider-endgame"]', SIDEBAR_BUTTON],
    },
    "seeker-hider-ready": {
        title: "The hider is ready",
        text: "Tap **Start** on the clock when you set off.",
        target: [CLOCK, SIDEBAR_BUTTON],
    },
    "seeker-answer": {
        title: "Answered",
        text: "The map now shades where the hider can't be.",
        target: [tab("questions"), SIDEBAR_BUTTON],
    },
    "seeker-curse": {
        title: "A curse",
        text: "It's in **Cards**: do what it says, then tap **Cleared**.",
        target: [tab("curses"), SIDEBAR_BUTTON],
    },
    "seeker-move": {
        title: "The hider moves",
        text: "No questions until they continue. Their old station is on the map.",
        target: ['[data-testid="move-banner"]', SIDEBAR_BUTTON],
    },
};

/** The tip a piece of game news calls for on this phone, if any. */
export const tipForEvent = (
    event: Pick<GameEvent, "kind" | "title">,
    role: Role,
): TipId | null => {
    if (role === "hider") {
        if (event.kind === "question") return "hider-question";
        if (event.kind === "endgame") return "hider-endgame";
        return null;
    }
    switch (event.kind) {
        case "hider":
            return "seeker-hider-ready";
        case "answer":
            // Not a veto: nothing new is shaded then.
            return event.title === "Answered" ? "seeker-answer" : null;
        case "curse":
            return "seeker-curse";
        case "move":
            return "seeker-move";
        default:
            return null;
    }
};
