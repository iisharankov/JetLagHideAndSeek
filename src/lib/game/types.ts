// A shared game: one live board for the seekers and the hider, stored by the
// API server (server/src/games.ts) and mirrored on every phone
// (src/lib/game/session.ts). Shared by the server and the app.

export type GameSize = "small" | "medium" | "large";
export type Role = "seeker" | "hider";

/**
 * draft: a seeker's idea, only seekers see it (its answer is a guess);
 * asked: sent to the hider, waiting for the answer;
 * answered: the hider confirmed the answer.
 */
export type QuestionState = "draft" | "asked" | "answered";

/** A question as the app stores it: { id, key, data }. */
export interface SharedQuestion {
    id: string;
    key: number;
    data: Record<string, unknown>;
}

export interface QuestionEntry {
    question: SharedQuestion;
    state: QuestionState;
    createdBy: string;
    createdAt: number;
    updatedBy: string;
    updatedAt: number;
    answeredAt?: number;
}

export interface PhotoInfo {
    id: string;
    by: string;
    at: number;
    /** The photo question it answers, if any. */
    requestId?: string;
    caption?: string;
}

/** A photo question asked of the hider ("Send me a photo of …"). */
export interface PhotoRequest {
    id: string;
    /** As in the rulebook, e.g. "Tree". */
    name: string;
    askedBy: string;
    askedAt: number;
    photoId?: string;
    answeredAt?: number;
}

export interface CurseEntry {
    id: string;
    /** As in src/lib/rules/cards.ts, e.g. "Curse of the Right Turn". */
    name: string;
    castAt: number;
    clearedAt?: number;
    clearedBy?: string;
}

export interface GameSettings {
    size: GameSize;
    /** Off: only the hider can answer or change answered questions. */
    seekersCanAnswer: boolean;
}

/** One finished round, kept to look back at. */
export interface PastRound {
    endedAt: number;
    questions: QuestionEntry[];
    photoRequests: PhotoRequest[];
    curses: CurseEntry[];
}

export interface GameState {
    id: string;
    version: number;
    createdAt: number;
    updatedAt: number;
    /** The play area, as the app's share format (opaque to the server). */
    playArea: unknown;
    /** Hiding zone settings (radius, station kinds…), opaque to the server. */
    zone: unknown;
    settings: GameSettings;
    questions: Record<string, QuestionEntry>;
    photoRequests: PhotoRequest[];
    photos: PhotoInfo[];
    curses: CurseEntry[];
    hasHider: boolean;
    rounds: PastRound[];
}

/** Fields of a question's data that are the hider's answer. */
export const ANSWER_FIELDS = [
    "within",
    "warmer",
    "location",
    "same",
    "lengthComparison",
    "hiderCloser",
] as const;

/** Per-phone view fields that are never shared. */
export const LOCAL_FIELDS = ["collapsed", "hidden", "drag"] as const;

export type GameOp =
    | {
          type: "putQuestion";
          question: SharedQuestion;
          /** For a new question; default: draft for seekers, asked for the hider. */
          state?: "draft" | "asked";
      }
    | { type: "deleteQuestion"; key: number }
    | { type: "sendQuestion"; key: number }
    | {
          type: "answerQuestion";
          key: number;
          answer: Record<string, unknown>;
          /** updatedAt of the question the answer was worked out for. */
          basedOn: number;
      }
    | { type: "setPlayArea"; playArea: unknown }
    | { type: "setZone"; zone: unknown }
    | { type: "setSettings"; settings: Partial<GameSettings> }
    | { type: "askPhoto"; name: string }
    | { type: "deletePhotoRequest"; id: string }
    | { type: "castCurse"; name: string }
    | { type: "clearCurse"; id: string }
    | { type: "newRound" };
