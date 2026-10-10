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
export type QuestionState = "draft" | "asked" | "answered" | "vetoed";

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
    /** When it was sent to the hider: the five minutes to answer run from here. */
    askedAt?: number;
    answeredAt?: number;
    /** Randomize Question: what it was before the hider played the card. */
    randomizedFrom?: string;
    /** The kinds it has been asked as (questionIdentity), before randomizing. */
    askedAs?: string[];
    /** Answered over the five minutes: which late answer of the round it was (1, 2, 3…). */
    late?: number;
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
    /** Randomize Question: what it was before the hider played the card. */
    randomizedFrom?: string;
    randomizedAt?: number;
    /** The names it was asked as before randomizing (not asked again this round). */
    askedAs?: string[];
}

export interface CurseEntry {
    id: string;
    /** As in src/lib/rules/cards.ts, e.g. "Curse of the Right Turn". */
    name: string;
    castAt: number;
    clearedAt?: number;
    clearedBy?: string;
    /** Drained Brain: the three kinds the hider took away (see curseRules.ts). */
    kinds?: string[];
    /** Spotty Memory: the category the seekers' die disabled, until the next question. */
    category?: string;
    /** Bird Guide: how long the hider filmed, in seconds. */
    seconds?: number;
}

/** A team: people hiding or seeking together (2 v 2, say). */
export interface Team {
    id: string;
    name: string;
    /** Player names. */
    members: string[];
}

/** Minutes the hider was awarded during the round (a curse's penalty, say). */
export interface Award {
    id: string;
    minutes: number;
    reason: string;
    at: number;
    by: string;
}

/** A powerup the hider played, so the seekers know (e.g. Move). */
export interface PowerupEntry {
    id: string;
    /** As in src/lib/rules/cards.ts, e.g. "Move". */
    name: string;
    playedAt: number;
    by: string;
}

/**
 * Which stops count as hiding-zone stations. Train stations always do (the
 * small halts too); funiculars count as trams.
 */
export interface StationKinds {
    trams: boolean;
    boats: boolean;
}

/**
 * The round's hiding clock: started when the seekers set off, paused during
 * a Move, stopped when the hider is found (see lib/game/clock.ts).
 */
export interface RoundClock {
    startedAt: number | null;
    pausedAt: number | null;
    /** Time paused so far, left out of the hiding time. */
    pausedMs: number;
    stoppedAt: number | null;
    /** The hider's time bonuses at the end, once they've sent them. */
    bonusMinutes?: number;
}
export type ClockAction =
    | "start"
    | "pause"
    | "resume"
    | "stop"
    | "reset"
    /** Withdraws a pause or resume one side asked for. */
    | "cancel";

/** One side asks, the other agrees: pausing the clock, deleting a question. */
export interface AgreementRequest {
    by: string;
    role: Role;
    at: number;
}
export interface ClockRequest extends AgreementRequest {
    action: "pause" | "resume";
}

/**
 * The hiding spot, shared between the hider's phones (two people hiding
 * together) and never shown to the seekers: the station, and the pin where
 * the hider really is.
 */
export interface HiderSpot {
    station: StationPick | null;
    pin: { latitude: number; longitude: number } | null;
}

/** The hider is moving to a new station (the Move card). */
export interface MoveState {
    /** The station the hider left, as the card makes them tell the seekers. */
    station: StationPick | null;
    startedAt: number;
    /** The card's period: the game goes on by itself when it's over. */
    endsAt: number;
    by: string;
}

/** A move's archive: the questions of the hiding spot the hider left. */
export interface MoveArchive {
    at: number;
    station: StationPick | null;
    questions: QuestionEntry[];
}

/** A station as picked: its map-data id ("node/123") and position. */
export interface StationPick {
    id: string;
    name: string;
    lat: number;
    lng: number;
}

/**
 * The end game: the seekers have picked the hider's station. Only its zone
 * is left on the map, and the questions asked before no longer apply.
 */
export interface Endgame {
    station: StationPick;
    startedAt: number;
    by?: string;
    /** Keys of the questions from before: they no longer apply. */
    before: number[];
}

/** What the hider draws after a question: "draw N, keep M". */
export interface Draw {
    draw: number;
    keep: number;
    label: string;
}

/**
 * The hider deck in a "virtual deck" game (see lib/game/deck.ts). The
 * seekers get a copy without the cards (deckForSeekers).
 */
export interface Deck {
    /** Card ids (image names), top of the deck first. */
    remaining: string[];
    discard: string[];
    hand: string[];
    /** Cards drawn and shown to the hider, waiting for their pick. */
    pending: string[];
    pendingKeep: number;
    /** Draws the hider is owed: one per answered question, more for repeats. */
    owed: Draw[];
    /** The rulebook's 6, plus one per "Draw 1, Expand 1" played. */
    limit: number;
    /** What everyone may know: extra draws and the like. */
    log: { at: number; text: string }[];
    /** Curse of the Overflowing Chalice: questions left with an extra draw. */
    chaliceLeft?: number;
    /** Curse of the Impressionable Consumer: answers that earn no draw. */
    freeQuestions?: number;
}

/** A card the players added to the deck (a blank card, written on). */
export interface CustomCard {
    id: string;
    kind: "time" | "powerup" | "curse";
    name: string;
    text: string;
    /** Copies in the deck. */
    count: number;
    /** Time bonus: minutes for small, medium and large games. */
    minutes?: [number, number, number];
    /** A photo of the card, as a small data: URL. */
    photo?: string;
}

/** Decided before the game starts; fixed while it runs (see settings.ts). */
export interface GameSettings {
    size: GameSize;
    /** Local rules (which questions exist, "major city" threshold…). */
    region: "standard" | "switzerland";
    /** The hider may still change this during the game. */
    hidingRadiusKm: number;
    /** The radar question's distances in this game (km), by game size. */
    radarKm: number[];
    stationKinds: StationKinds;
    /** Lake shore question: only lakes at least this big count. */
    minLakeAreaKm2: number;
    /** "matching:zone", "measuring:coastline"…: types left out of the game. */
    disabledQuestions: string[];
    /** Off: only the hider can answer or change answered questions. */
    seekersCanAnswer: boolean;
    /** The real deck of cards, or the app's (shuffled and drawn by the game). */
    deck: "real" | "virtual";
    /** Copies of each card in the deck, where it differs from the printed deck. */
    deckCounts: Record<string, number>;
    customCards: CustomCard[];
    /** Which cards the hider plays pop up on the seekers' phones. */
    cardPopups: "important" | "all";
    /** Late answers (over five minutes): two warnings, the third makes the seekers' next question free. */
    latePenalty: boolean;
    /** Tentacle distances in km: small places (museums…), then big ones (zoos, parks, aquariums). */
    tentacleKm: [number, number];
    /**
     * Seekers may show the hiding zones (the stations still in play). Off,
     * only the hider's phone shows them; the seekers keep the shaded map.
     */
    seekersSeeStations: boolean;
}

/** One finished round, kept to look back at. */
export interface PastRound {
    endedAt: number;
    questions: QuestionEntry[];
    photoRequests: PhotoRequest[];
    curses: CurseEntry[];
    powerups: PowerupEntry[];
    endgame?: Endgame | null;
    clock?: RoundClock | null;
    deck?: Deck | null;
    moves?: MoveArchive[];
    /** Who hid that round (for the scoreboard). */
    hiderName?: string;
    awards?: Award[];
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
    powerups: PowerupEntry[];
    endgame: Endgame | null;
    clock: RoundClock | null;
    /** Only in "virtual deck" games. */
    deck: Deck | null;
    /** Set while the hider moves to a new station (the Move card). */
    move: MoveState | null;
    /** The hider's phones only; null in the seekers' view. */
    hider: HiderSpot | null;
    /** The questions archived by moves this round. */
    moves: MoveArchive[];
    hasHider: boolean;
    /** When the hider confirmed their station this round (the seekers know that, not where). */
    hiderReadyAt: number | null;
    teams: Team[];
    /** The team hiding this round, when teams are used. */
    hiderTeamId: string | null;
    /** After a round: the team that claimed the next one. */
    nextHiderTeamId: string | null;
    /** Answers over the five minutes this round (with the late-answer penalty on). */
    lateAnswers: number;
    /** Questions the hider draws nothing for (physical deck; the digital deck keeps its own count). */
    freeQuestions: number;
    /** A pause or resume one side asked for, waiting for the other side. */
    clockRequest: ClockRequest | null;
    /** Deletions one side asked for, by question key, waiting for the other side. */
    deleteRequests: Record<string, AgreementRequest>;
    /** The hider's name this round, once known (for the scoreboard). */
    hiderName: string | null;
    /** Minutes awarded to the hider this round, on top of the hand's bonuses. */
    awards: Award[];
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
export const LOCAL_FIELDS = [
    "collapsed",
    "hidden",
    "drag",
    "research",
] as const;

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
    /** Drained Brain: the hider names the three kinds the seekers lose. */
    | { type: "blockQuestions"; id: string; kinds: string[] }
    /** Spotty Memory: the seekers enter what their die disabled. */
    | { type: "setCurseCategory"; id: string; category: string }
    /** Bird Guide: how long the hider filmed. */
    | { type: "setCurseTime"; id: string; seconds: number }
    /** Minutes for the hider, with the reason (a curse's penalty, say). */
    | { type: "awardMinutes"; minutes: number; reason: string }
    | { type: "playPowerup"; name: string }
    | { type: "startEndgame"; station: StationPick }
    | { type: "endEndgame" }
    | { type: "clock"; action: ClockAction }
    | { type: "setBonus"; minutes: number }
    | DeckOp
    | { type: "vetoQuestion"; key: number }
    /** Randomize Question: the asked question becomes another of its category. */
    | { type: "randomizeQuestion"; key: number }
    | { type: "randomizePhoto"; id: string }
    | { type: "keepQuestion"; key: number }
    | { type: "setHiderStation"; station: StationPick | null }
    | { type: "hiderReady"; station: StationPick }
    | { type: "joinTeam"; name: string }
    | { type: "leaveTeam" }
    | { type: "claimNextRound"; teamId: string | null }
    | { type: "setHiderPin"; pin: { latitude: number; longitude: number } }
    | { type: "move"; station: StationPick | null }
    | { type: "resumeMove" }
    | { type: "newRound" };

/** The hider's moves with the virtual deck. */
export type DeckOp =
    | { type: "drawCards"; extra?: Draw }
    | { type: "keepCards"; picks: number[] }
    | {
          type: "playCard";
          index: number;
          /** "Discard N, draw M": the cards discarded (indexes in the hand). */
          discards?: number[];
          /** Move: the station the hider leaves. */
          station?: StationPick | null;
          /** Duplicate Another Card: the card in the hand it copies. */
          copyOf?: number;
      }
    | { type: "discardCard"; index: number }
    | { type: "discardHand" };
