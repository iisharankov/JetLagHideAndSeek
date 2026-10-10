// What the cards do in the game beyond showing their text (the texts are in
// lib/rules/cards.ts): which curses stop the seekers from asking until they
// are cleared, which take questions away, which end by themselves, which
// award the hider minutes, which can't be cast in the end game, and how
// long a Move gives the hider. Shared by the server (the rules) and the
// phones (the buttons and banners).
import { TYPES } from "@/lib/questionInfo";
import { CURSES } from "@/lib/rules/cards";

import type { CurseEntry, GameSize, GameState, SharedQuestion } from "./types";

export const SIZE_INDEX: Record<GameSize, number> = {
    small: 0,
    medium: 1,
    large: 2,
};

export interface CurseRule {
    /** The seekers can't ask (questions or photos) until it's cleared. */
    blocksAsking?: boolean;
    /** Can't be cast during the end game. */
    notInEndgame?: boolean;
    /** Minutes the hider is awarded if the seekers slip, by game size. */
    award?: [number, number, number];
    /** When the award applies, in the card's words. */
    awardReason?: string;
    /** Drained Brain takes three kinds away; Spotty Memory a category per question. */
    takes?: "kinds" | "category";
    /** The hider's own timed task (filming, drawing), minutes by game size. */
    stopwatch?: [number, number, number];
    /** The seekers' next question earns the hider no draw. */
    freeQuestion?: boolean;
    /** The one line the seekers see while it's on them (no block). */
    reminder?: string;
}

/** By the card's image name (lib/rules/cards.ts). */
export const CURSE_RULES: Record<string, CurseRule> = {
    curse_luxury_car: { blocksAsking: true },
    curse_bridge_troll: {
        reminder: "Ask the next question from under a bridge.",
    },
    curse_drained_brain: { takes: "kinds" },
    curse_water_weight: {
        blocksAsking: true,
        award: [30, 30, 60],
        awardReason: "The liquid was lost or abandoned.",
    },
    curse_zoologist: { blocksAsking: true },
    curse_egg_partner: {
        blocksAsking: true,
        notInEndgame: true,
        award: [30, 45, 60],
        awardReason:
            "A team member (the egg included) was abandoned or cracked.",
    },
    curse_jammed_door: {
        reminder: "Roll two dice at every doorway: 7 or more to enter.",
    },
    curse_spotty_memory: { takes: "category" },
    curse_the_bird_guide: { blocksAsking: true, stopwatch: [5, 10, 15] },
    curse_the_unguided_tourist: { blocksAsking: true },
    curse_ransom_note: {
        reminder:
            "The next question in cut-out words and letters, 5 words or more.",
    },
    curse_mediocre_travel_agent: {
        blocksAsking: true,
        award: [30, 45, 60],
        awardReason: "The souvenir was lost.",
    },
    curse_impressionable_consumer: { blocksAsking: true, freeQuestion: true },
    curse_the_uturn: { reminder: "Get off at the next station." },
    curse_cairn: { blocksAsking: true },
    curse_distant_cuisine: { blocksAsking: true },
    curse_lemon_phylactery: {
        blocksAsking: true,
        notInEndgame: true,
        award: [30, 45, 60],
        awardReason: "A lemon stopped touching a seeker.",
    },
    curse_gamblers_feet: {
        reminder: "Roll a die before walking: that many steps.",
    },
    curse_hidden_hangman: { blocksAsking: true },
    curse_endless_tumble: {
        blocksAsking: true,
        award: [10, 20, 30],
        awardReason: "The die hit someone.",
    },
    curse_right_turn: { reminder: "Right turns only at intersections." },
    curse_urban_explorer: {
        reminder: "No questions on transit or in a transit station.",
    },
    curse_overflowing_chalice: {},
    curse_labyrinth: { blocksAsking: true, stopwatch: [10, 20, 30] },
};

/** The curse card by its name, if it's a printed one. */
export const curseCard = (name: string) =>
    CURSES.find((curse) => curse.name === name);

export const curseRule = (name: string): CurseRule =>
    CURSE_RULES[curseCard(name)?.image ?? ""] ?? {};

/** A timed curse's end, or null for one that lasts until it's cleared. */
export const curseEndsAt = (entry: CurseEntry, size: GameSize) => {
    const minutes = curseCard(entry.name)?.minutes;
    return minutes ? entry.castAt + minutes[SIZE_INDEX[size]] * 60_000 : null;
};

/** The minutes a curse awards in this game size, if it awards any. */
export const curseAward = (name: string, size: GameSize) =>
    curseRule(name).award?.[SIZE_INDEX[size]];

/** The curses on the seekers right now: not cleared, not timed out. */
export const activeCurses = (
    state: Pick<GameState, "curses" | "settings">,
    now: number,
) =>
    state.curses.filter((entry) => {
        if (entry.clearedAt) return false;
        const endsAt = curseEndsAt(entry, state.settings.size);
        return endsAt === null || endsAt > now;
    });

/** A curse that lasts the whole run can't be cleared by hand. */
export const lastsTheRun = (name: string) =>
    curseRule(name).takes !== undefined;

/**
 * The curses that stop the seekers from asking right now: the blocking
 * ones until cleared, a Drained Brain until the hider has chosen, a Spotty
 * Memory until the seekers have rolled.
 */
export const blockingCurses = (
    state: Pick<GameState, "curses" | "settings">,
    now: number,
) =>
    activeCurses(state, now).filter((entry) => {
        const rule = curseRule(entry.name);
        if (rule.blocksAsking) return true;
        if (rule.takes === "kinds") return !entry.kinds;
        if (rule.takes === "category") return !entry.category;
        return false;
    });

// Question kinds ----------------------------------------------------------

export const QUESTION_CATEGORIES = [
    "radius",
    "thermometer",
    "tentacles",
    "matching",
    "measuring",
    "photo",
] as const;
export type QuestionCategoryKind = (typeof QUESTION_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<QuestionCategoryKind, string> = {
    radius: "Radar",
    thermometer: "Thermometer",
    tentacles: "Tentacles",
    matching: "Matching",
    measuring: "Measuring",
    photo: "Photo",
};

/** A radar question's distance in km, whatever unit it was typed in. */
const radiusKm = (data: Record<string, unknown>) => {
    const value = Number(data.radius);
    if (!Number.isFinite(value)) return NaN;
    if (data.unit === "meters") return value / 1000;
    if (data.unit === "miles")
        return Math.round(value * 1.609344 * 1000) / 1000;
    return value;
};

/**
 * A question's kind, as a curse can take it away: "radius:5",
 * "thermometer", "tentacles:zoo", "matching:zone", "measuring:lake".
 */
export const questionKind = (question: SharedQuestion) => {
    const data = question.data as Record<string, unknown>;
    if (question.id === "radius") return `radius:${radiusKm(data)}`;
    if (question.id === "thermometer") return "thermometer";
    return `${question.id}:${String(data.type ?? data.locationType ?? "")}`;
};

/** A photo question's kind: "photo:tree". */
export const photoKind = (name: string) => `photo:${name.trim().toLowerCase()}`;

export const kindCategory = (kind: string) =>
    kind.split(":")[0] as QuestionCategoryKind;

/** "Radar 5 km", "Thermometer", "Matching: Same zone", "Photo: Tree". */
export const kindLabel = (kind: string) => {
    const [category, rest] = kind.split(":", 2) as [
        QuestionCategoryKind,
        string?,
    ];
    const name = CATEGORY_LABELS[category] ?? category;
    if (category === "radius") {
        const km = Number(rest);
        return `${name} ${km < 1 ? `${km * 1000} m` : `${km} km`}`;
    }
    if (category === "thermometer" || rest === undefined) return name;
    if (category === "photo") {
        return `${name}: ${rest.charAt(0).toUpperCase()}${rest.slice(1)}`;
    }
    const types = TYPES[category as keyof typeof TYPES];
    return `${name}: ${types?.[rest]?.label ?? rest.replace(/[-_]/g, " ")}`;
};

/** The kinds a Drained Brain has taken away this round. */
export const blockedKinds = (
    state: Pick<GameState, "curses" | "settings">,
    now: number,
) =>
    activeCurses(state, now).flatMap((entry) =>
        curseRule(entry.name).takes === "kinds" ? (entry.kinds ?? []) : [],
    );

/** The category a Spotty Memory has disabled right now, if any. */
export const disabledCategory = (
    state: Pick<GameState, "curses" | "settings">,
    now: number,
): QuestionCategoryKind | null => {
    const entry = activeCurses(state, now).find(
        (candidate) => curseRule(candidate.name).takes === "category",
    );
    return (entry?.category as QuestionCategoryKind | undefined) ?? null;
};

/** Why a kind can't be asked right now, or null. */
export const kindRefusal = (
    state: Pick<GameState, "curses" | "settings">,
    kind: string,
    now: number,
) => {
    if (blockedKinds(state, now).includes(kind)) {
        return `${kindLabel(kind)} was taken away by the Curse of the Drained Brain.`;
    }
    const disabled = disabledCategory(state, now);
    if (disabled && kindCategory(kind) === disabled) {
        return `${CATEGORY_LABELS[disabled]} questions are disabled right now (Curse of the Spotty Memory).`;
    }
    return null;
};

// The Move card ----------------------------------------------------------

/** "This card grants a {10/20/60} minute period." */
export const MOVE_MINUTES: [number, number, number] = [10, 20, 60];
export const moveMinutes = (size: GameSize) => MOVE_MINUTES[SIZE_INDEX[size]];
