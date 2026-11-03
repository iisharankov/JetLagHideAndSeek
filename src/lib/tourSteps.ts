// What the tutorial says. A title of at most five words and a note of at
// most 45 (a tip or an offer: 25), the on-screen labels in **bold** exactly
// as the app shows them (tests/tour.test.ts checks both). Game rules come
// from the rulebook (src/content/rules/quick-start-guide/); the examples
// are drawn on the map in Zürich canton (lib/tourDemo.ts). The seekers and
// the hider each get their own tour: the game from their side, then the app.
import type { MenuTab, SidebarTab } from "@/lib/context";
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
    /** The Menu open on this tab (closed again for a step without). */
    menu?: MenuTab;
    /** A new game's setup open on this screen (0 to 2), while there's no game. */
    setup?: number;
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
const SIDEBAR_BUTTON = id("left-sidebar-trigger");
const CLOCK = '[data-testid="round-clock"]';

/** The game from the seekers' side, with examples on the map. */
const SEEKING: TourStep[] = [
    {
        id: "how-to-play",
        title: "How to play",
        text: "One player (or team) hides; everyone else seeks. The hider gets a head start, the hiding period, to reach a train station and hide near it. Then you travel and ask questions until you find them. The longest hide wins.",
        sidebar: "closed",
    },
    {
        id: "example",
        title: "Our example",
        text: "Picture a medium game in Zürich canton: you start at Zürich HB. Every station has a hiding zone, a 500 m circle. The hider is somewhere in one of them; you don't know which.",
        sidebar: "closed",
        demo: "zones",
    },
    {
        id: "radar",
        title: "Radar",
        text: "A Radar asks: are you within this distance of us? At Zürich HB you choose 10 km. The hider answers Yes, so everything farther than 10 km is shaded: they can't be there.",
        sidebar: "closed",
        demo: "radar",
    },
    {
        id: "thermometer",
        title: "Thermometer",
        text: "A Thermometer: you travel at least a set distance, then ask whether you got hotter or colder. You ride from Zürich HB to Oerlikon. Colder: the hider is nearer HB, so the half nearer Oerlikon is shaded.",
        sidebar: "closed",
        demo: "thermometer",
    },
    {
        id: "more-kinds",
        title: "Three more kinds, and photos",
        text: "Matching: is your nearest airport the same as ours? Measuring: are you closer to a museum than we are? Tentacles: of the museums near us, which is nearest you? Photos: send us a picture of… Each answer shades more.",
        sidebar: "closed",
        demo: "thermometer",
    },
    {
        id: "station-decides",
        title: "Zones stay whole",
        text: "Answers are worked out from the hider's station, not where they stand. Wipkingen's station is on the open side of the line, so its whole zone stays, though part of it lies in the shade.",
        sidebar: "closed",
        demo: "station",
    },
    {
        id: "endgame",
        title: "The end game",
        text: "Inside the hider's zone and off transport? The end game starts: the hider tells you, stays put, and taps **Start the end game**. If your game shows the stations, you can tap **Found it** yourself.",
        sidebar: "closed",
        demo: "endgame",
    },
    {
        id: "pin",
        title: "The hider's pin",
        text: "From then on, answers come from the hider's pin, where they really stand, and it can't move. Search the zone; once you spot them, they're found and their time stops.",
        sidebar: "closed",
        demo: "endgame",
    },
    {
        id: "cards",
        title: "Cards and curses",
        text: "Every answer earns the hider cards. Curses are played on you: do what they say. Time bonuses add to their score. Powerups can veto a question, swap it for a random one, or let them move.",
        sidebar: "closed",
    },
];

/** The game from the hider's side, with their own zone in the examples. */
const HIDING: TourStep[] = [
    {
        id: "how-to-play",
        title: "You're the hider",
        text: "You get a head start, the hiding period, to travel to a train station and settle into its hiding zone. Then the seekers ask questions and you answer truthfully. The longer they take to find you, the better.",
        sidebar: "closed",
    },
    {
        id: "zone",
        title: "Your hiding zone",
        text: "Every station has a 500 m circle around it (in a medium game). Pick yours: it turns red, and after the hiding period you stay inside it. Say you hide at Wipkingen, in Zürich.",
        sidebar: "closed",
        demo: "hider-zone",
    },
    {
        id: "answering",
        title: "Answering",
        text: "The seekers at Zürich HB ask: are you within 10 km of us? The app works it out from your station: Wipkingen is about 2 km away, so it suggests Yes. You check it and send it.",
        sidebar: "closed",
        demo: "hider-radar",
    },
    {
        id: "station-decides",
        title: "Your station decides",
        text: "Answers come from your station, not the spot you stand on, so you may move anywhere in your circle until the end game. You have five minutes to answer each question.",
        sidebar: "closed",
        demo: "hider-zone",
    },
    {
        id: "cards",
        title: "Your cards",
        text: "Each answer lets you draw cards and keep some: the question says how many. Time bonuses add to your score, curses slow the seekers down, and powerups help: veto a question, randomize it, or move.",
        sidebar: "closed",
    },
    {
        id: "endgame",
        title: "The end game",
        text: "When the seekers are inside your zone and off transport, the end game starts: tell them, tap **Start the end game**, and stay where you are. From then on your answers come from your pin.",
        sidebar: "closed",
        demo: "endgame",
    },
    {
        id: "pin",
        title: "Your pin",
        text: "Keep your pin where you really are. Once the end game starts it's fixed, and the seekers must find you right there. When they spot you, your time stops and your bonuses count.",
        sidebar: "closed",
        demo: "endgame",
    },
];

const MENU_STEP: TourStep = {
    id: "menu",
    title: "Rules and help",
    text: "The rules, every card and this tutorial are in the **Menu**, under **Help**. Tap the round button at the top right to open it.",
    target: [id("menu-help")],
    menu: "game",
};

export const TOURS: Record<TourId, TourStep[]> = {
    seeker: [
        ...SEEKING,
        {
            id: "sidebar",
            title: "Your sidebar",
            text: "Tap **Questions** to open your questions, cards and photos. On a phone, swipe it up for more room.",
            target: [SIDEBAR_BUTTON],
            sidebar: "closed",
            tab: "questions",
            advanceOnTap: true,
        },
        {
            id: "ask",
            title: "Ask a question",
            text: "Tap **Add Question** and pick a kind. It starts where you are if Follow me is on; otherwise drag its pin there.",
            target: [id("add-questions-buttons")],
            sidebar: "open",
            tab: "questions",
        },
        {
            id: "send",
            title: "Send it",
            text: "A new question is a draft only the seekers see; the map shows what each answer would mean. Tap **Send to the hider** when ready: they have five minutes to answer.",
            target: [id("send-question"), id("add-questions-buttons")],
            sidebar: "open",
            tab: "questions",
        },
        {
            id: "stations",
            title: "Stations left",
            text: "If your game shows the stations: turn on **Show hiding zones** to see where the hider may be, and tap **Found it** on their station to start the end game.",
            target: [tab("stations")],
            sidebar: "open",
            tab: "stations",
            // Not there when the game keeps the stations to the hider.
            optional: true,
        },
        {
            id: "curses",
            title: "Curses",
            text: "Curses on you appear under **Cards**, with what they stop you doing. Do what they say, then tap **Cleared**.",
            target: [tab("curses"), TABS],
            sidebar: "open",
            tab: "curses",
        },
        {
            id: "photos",
            title: "Photos",
            text: "Ask for a photo under **Photos**. The hider has ten minutes to send it (twenty in a large game).",
            target: [tab("photos"), TABS],
            sidebar: "open",
            tab: "photos",
        },
        {
            id: "clock",
            title: "The clock",
            text: "The hider's time, running until they're found. A pause, or a rest overnight, needs both sides to agree.",
            target: [CLOCK],
            sidebar: "open",
            tab: "questions",
        },
        {
            id: "follow-me",
            title: "Follow me",
            text: "In the **Menu**, under **Settings**: **Follow me (GPS)** shows where you are on the map, and new questions start there.",
            target: [id("follow-me")],
            menu: "settings",
        },
        MENU_STEP,
    ],
    hider: [
        ...HIDING,
        {
            id: "pick",
            title: "Pick your station",
            text: "Tap your station on the map, or **Mine** in the list; it turns red. Then tap **Done**: the seekers hear you're ready, not where.",
            target: [id("hider-pick")],
            sidebar: "open",
            tab: "stations",
            // A hider whose station is set (the tour from the Menu) skips it.
            optional: true,
        },
        {
            id: "research",
            title: "Try it first",
            text: "Before **Done**, **Research** questions are yours alone: see what a station would answer before you commit.",
            target: [tab("research")],
            sidebar: "open",
            optional: true,
        },
        {
            id: "answer",
            title: "Answering here",
            text: "A beep means a question: it's under **Questions**. The app suggests the answer and the map shows what it rules out. Pick it, then send it.",
            target: [tab("questions"), TABS],
            sidebar: "open",
        },
        {
            id: "hand",
            title: "Your hand",
            text: "Under **Cards**, keep the cards you draw and play curses and powerups. Over the hand limit, you discard first.",
            target: [tab("curses"), TABS],
            sidebar: "open",
        },
        {
            id: "time",
            title: "Your time",
            text: "Your hiding time. The time bonuses in your hand are added when you're found: longest hide wins.",
            target: [CLOCK],
            sidebar: "open",
        },
        {
            id: "start-endgame",
            title: "Start the end game",
            text: "Seekers in your zone and off transport? Tap **Start the end game** here, tell them, and stay put.",
            target: ['[data-testid="hider-start-endgame"]'],
            sidebar: "open",
            tab: "stations",
            // Only once your station is set.
            optional: true,
        },
        {
            id: "alerts",
            title: "Don't miss a question",
            text: "In the **Menu**, under **Settings**: keep **Buzz and beep** on, so a question can't slip by. Below it, allow notifications to hear of one while the app is in the background.",
            target: [id("alerts")],
            menu: "settings",
        },
        MENU_STEP,
    ],
    organiser: [
        {
            id: "welcome",
            title: "Hide and Seek",
            text: "A map for Jet Lag's Hide and Seek. Set up a game here, then send everyone the link: each player joins on their own phone.",
        },
        {
            id: "start",
            title: "Start a game",
            text: "It starts in the **Menu**: give your name, then **Start a shared game**. The setup has three screens: the game, the hiding zones and the questions.",
            target: [id("start-shared-game")],
            menu: "game",
            // Not while a game is on.
            optional: true,
        },
        {
            id: "play-area",
            title: "The play area",
            text: "Tap **Change** to choose it on the map: pick cantons, districts or municipalities, then tap the areas to add them or cut them out. You can also search for a place, or draw the area.",
            target: [id("setup-play-area")],
            setup: 0,
            optional: true,
        },
        {
            id: "size",
            title: "Game size",
            text: "**Small**, **Medium** or **Large**: it sets the default hiding zones and radar distances. Medium suits a canton like Zürich.",
            target: [id("setup-size")],
            setup: 0,
            optional: true,
        },
        {
            id: "stations",
            title: "Seekers and stations",
            text: "**Seekers can show the hiding zones**: on, they see the stations still in play and tap **Found it** to start the end game. Off, only the hider sees them, and the hider starts the end game.",
            target: [id("setup-seekers-stations")],
            setup: 1,
            optional: true,
        },
        {
            id: "places",
            title: "Check the places",
            text: "**Review places on the map**: reject wrong zoos, parks or museums before you play, so the questions measure from the right ones. Then **Start the game**.",
            target: ['[data-testid="place-review-setup"]'],
            setup: 2,
            optional: true,
        },
        {
            id: "invite",
            title: "Invite everyone",
            text: "Once the game has started, **Share the game link** from here. Everyone opens it, gives a name and picks seeker or hider.",
            target: [id("share-link"), id("play-together")],
            menu: "game",
        },
        {
            id: "menu",
            title: "Rules and help",
            text: "The rules, every card and the seeker and hider tutorials are in the **Menu**, under **Help**.",
            target: [id("menu-help")],
            menu: "game",
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
        text: "How seeking works, with examples in Zürich on the map, then how to ask questions here.",
    },
    hider: {
        title: "New here?",
        text: "How hiding works, with examples in Zürich on the map, then how to answer and play your cards here.",
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
    | "seeker-move"
    | "seeker-endgame";

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
    "seeker-endgame": {
        title: "End game",
        text: "The hider says you're in their zone and stays put. Only that zone is left on the map: search it.",
        target: [tab("stations"), SIDEBAR_BUTTON],
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
        case "endgame":
            return "seeker-endgame";
        default:
            return null;
    }
};
