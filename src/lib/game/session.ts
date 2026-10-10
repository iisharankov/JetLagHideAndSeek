// This phone's connection to a shared game: joins by link, keeps the
// questions, play area and hiding zone settings in step with everyone else,
// and sends this phone's changes. The rules are on the server (gameOps.ts).
import { atom, computed } from "nanostores";
import { toast } from "react-toastify";

import {
    activeQuestionKey,
    additionalMapGeoLocations,
    disabledStations,
    endgame,
    gameSettings,
    hiderMode,
    leafletMapContext,
    mapGeoLocation,
    polyGeoJSON,
    questions,
} from "@/lib/context";
import { normalizeGameSettings } from "@/lib/game/settings";
import { applyGameSettings } from "@/lib/gameSettings";
import {
    chosenStation,
    hiderChoosing,
    pendingStation,
    pinLocked,
} from "@/lib/hiderSpot";
import { persistentAtom } from "@/lib/persist";
import {
    applyPlayArea,
    applyZoneSettings,
    currentPlayArea,
    currentZoneSettings,
    parsePlayArea,
    parseZoneSettings,
} from "@/lib/sharedGame";
import { errorMessage } from "@/maps/errors";

import { refreshPush } from "./alerts";
import {
    createGame,
    deleteGameRequest,
    fetchGame,
    openEvents,
    postHiderPassword,
    postOp,
    postPhoto,
} from "./api";
import { forgetGame, rememberGame, unmarkJoined } from "./knownGames";
import { noteServerTime } from "./serverTime";
import { diffLocal, mergeRemoteQuestions, syncedJson, toShared } from "./sync";
import type { GameOp, GameState, Role } from "./types";

/** The URL parameter holding the game's id: ?game=<id>. */
export const GAME_URL_PARAM = "game";

export const playerName = persistentAtom<string>("playerName", "");
/** The last shared game this phone was in, to rejoin ("" if none). */
export const currentGameId = persistentAtom<string>("currentGame", "");
/** The game this phone is in right now ("" when playing alone). */
export const activeGameId = atom<string>("");
const hiderTokens = persistentAtom<Record<string, string>>(
    "hiderTokens",
    {},
    { encode: JSON.stringify, decode: JSON.parse },
);
// Read once per tab (an unused store re-reads storage on every get): another
// tab of the same browser becoming the hider must not make this one the
// hider too.
hiderTokens.listen(() => {});

export const gameState = atom<GameState | null>(null);
export const gameRole = atom<Role>("seeker");

/**
 * This phone is the hider's: hider mode, and (in a shared game) the hider's
 * role. The one place this is worked out; it only tells its listeners when
 * it flips.
 */
export const hiderPhone = computed(
    [hiderMode, gameState, gameRole],
    (pin, game, role) => pin !== false && (game === null || role === "hider"),
);
export const gameConnection = atom<"off" | "connecting" | "live" | "retrying">(
    "off",
);
/** When this phone last heard from the game (its own clock), for "stale since". */
export const lastUpdateAt = atom<number | null>(null);
/** While reconnecting: when the next try is due. */
export const reconnectAt = atom<number | null>(null);

/** 5 s, 10 s, 20 s… up to a minute between tries. */
export const retryDelayMs = (attempt: number) =>
    Math.min(5000 * 2 ** Math.max(0, attempt), 60_000);

/**
 * Whether this phone may show the hiding zones: always alone or as the
 * hider; as a seeker only when the game's settings allow it.
 */
export const zonesAllowed = computed(
    [gameState, gameRole],
    (game, role) =>
        !game || role === "hider" || game.settings.seekersSeeStations !== false,
);

/** Hider: hider mode's suggested answers, by question key. */
export const suggestedAnswers = atom<
    Record<
        number,
        { answer: Record<string, unknown>; label: string; basedOn: number }
    >
>({});

/**
 * The hider's chosen answers, not sent yet: the map shows what each would
 * rule out, so the hider sees the outcome before tapping Send.
 */
export const previewAnswers = atom<Record<number, Record<string, unknown>>>({});

const me = () => (playerName.get() ?? "").trim() || "Someone";
const token = () => hiderTokens.get()[activeGameId.get()];
/** This phone's hider token for the game it's in, if it is the hider. */
export const hiderToken = token;

/**
 * The hider's phone is in hider mode, full stop: answers are suggested from
 * the hider pin, which starts at the map's centre (the play area's, before
 * the map is up).
 */
const ensureHiderMode = () => {
    if (hiderMode.get() !== false) return;
    const center = leafletMapContext.get()?.getCenter();
    const [lat, lng] = mapGeoLocation.get().geometry.coordinates;
    hiderMode.set({
        latitude: center?.lat ?? lat,
        longitude: center?.lng ?? lng,
    });
};

// What this phone last had in common with the server.
let synced = new Map<number, string>();
/** Rounds the game had when last seen: one more means "say who you are again". */
let roundsSeen = -1;
let syncedPlayArea = "";
let syncedZone = "";
let applyingRemote = false;
/** Closes the live stream, while one is open. */
let closeStream: (() => void) | null = null;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

const setUrl = (id: string) => {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set(GAME_URL_PARAM, id);
    else url.searchParams.delete(GAME_URL_PARAM);
    window.history.replaceState({}, "", url);
};

/** The link to this game, for sharing. */
export const gameLink = (id = activeGameId.get()) => {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set(GAME_URL_PARAM, id);
    return url.toString();
};

/** Applies the server's game to this phone. */
const receive = (received: GameState, force = false) => {
    // A game from an older version may lack newer settings.
    const state: GameState = {
        ...received,
        settings: normalizeGameSettings(received.settings),
    };
    const current = gameState.get();
    if (!force && current?.id === state.id && state.version < current.version) {
        return;
    }
    // A question just asked is the hider's business: it becomes the active
    // card, so the places it measures against show on the map.
    if (gameRole.get() === "hider") {
        const fresh = Object.values(state.questions).find(
            (entry) =>
                entry.state === "asked" &&
                current?.questions[String(entry.question.key)]?.state !==
                    "asked",
        );
        if (fresh) activeQuestionKey.set(fresh.question.key);
    }
    gameState.set(state);
    lastUpdateAt.set(Date.now());
    // A new round: the hider's password is new, so everyone says who they
    // are again; the old hider's phone is a seeker's until then.
    if (roundsSeen >= 0 && state.rounds.length > roundsSeen) startOfRound();
    roundsSeen = state.rounds.length;

    applyingRemote = true;
    try {
        const local = questions.get();
        const merged = mergeRemoteQuestions(state, local, synced, me(), {
            lockAnswered:
                gameRole.get() !== "hider" && !state.settings.seekersCanAnswer,
        });
        const pending = new Set(
            local
                .filter((q) => synced.get(q.key) !== syncedJson(q))
                .map((q) => q.key),
        );
        const next = new Map<number, string>();
        for (const question of merged) {
            if (pending.has(question.key)) {
                const before = synced.get(question.key);
                if (before !== undefined) next.set(question.key, before);
            } else {
                next.set(question.key, syncedJson(question));
            }
        }
        // Deletions not sent yet stay marked as synced so they're sent.
        for (const [key, json] of synced) {
            if (
                !merged.some((q) => q.key === key) &&
                state.questions[String(key)]
            ) {
                next.set(key, json);
            }
        }
        synced = next;
        if (JSON.stringify(merged) !== JSON.stringify(local)) {
            questions.set(merged);
        }

        const playArea = JSON.stringify(state.playArea);
        if (state.playArea && playArea !== syncedPlayArea) {
            syncedPlayArea = playArea;
            if (playArea !== JSON.stringify(currentPlayArea())) {
                applyPlayArea(parsePlayArea(state.playArea));
            }
        }
        const zone = JSON.stringify(state.zone);
        if (state.zone && zone !== syncedZone) {
            syncedZone = zone;
            if (zone !== JSON.stringify(currentZoneSettings())) {
                applyZoneSettings(parseZoneSettings(state.zone));
            }
        }
        // The end game is the game's: the seekers' pick reaches everyone.
        const remoteEndgame = state.endgame ?? null;
        if (JSON.stringify(remoteEndgame) !== JSON.stringify(endgame.get())) {
            endgame.set(remoteEndgame);
        }
        // The hiding spot is shared between the hider's phones (two people
        // hiding together): a station picked on one is the station on both,
        // and nothing from an earlier game lingers.
        if (gameRole.get() === "hider" && state.hider) {
            if (
                JSON.stringify(state.hider.station) !==
                JSON.stringify(chosenStation.get())
            ) {
                chosenStation.set(state.hider.station);
            }
            if (pinLocked.get() !== !!state.hider.pinLocked) {
                pinLocked.set(!!state.hider.pinLocked);
            }
            const pin = state.hider.pin;
            const mine = hiderMode.get();
            if (
                pin &&
                (mine === false ||
                    mine.latitude !== pin.latitude ||
                    mine.longitude !== pin.longitude)
            ) {
                hiderMode.set(pin);
            }
        }
        // The game's settings are the server's.
        applyGameSettings(state.settings);
        rememberGame(state);
    } catch (error) {
        toast.error(`Couldn't apply the shared game: ${errorMessage(error)}`, {
            toastId: "game-apply-error",
        });
    } finally {
        applyingRemote = false;
    }
    if (diffLocal(questions.get(), synced).length > 0) scheduleSync();
};

/** Reloads the game from the server, e.g. after a refused change. */
const resync = async () => {
    const id = activeGameId.get();
    if (!id) return;
    try {
        const { role, state, now } = await fetchGame(id, token());
        noteServerTime(now);
        gameRole.set(role);
        receive(state, true);
    } catch (error) {
        toast.error(errorMessage(error), { toastId: "game-resync-error" });
    }
};

/** Sends one change; the server's answer is applied straight away. */
export const sendOp = async (op: GameOp) => {
    const id = activeGameId.get();
    if (!id) return;
    try {
        const { state, now } = await postOp(id, op, me(), token());
        noteServerTime(now);
        receive(state);
    } catch (error) {
        toast.error(errorMessage(error), { toastId: `game-op-${op.type}` });
        await resync();
    }
};

let syncTimer: ReturnType<typeof setTimeout> | undefined;
let sending = false;
let sendAgain = false;

const flushQuestions = async () => {
    if (sending) {
        sendAgain = true;
        return;
    }
    sending = true;
    try {
        for (const op of diffLocal(questions.get(), synced)) {
            if (op.type === "putQuestion") {
                synced.set(op.question.key, JSON.stringify(op.question));
            } else if (op.type === "deleteQuestion") {
                synced.delete(op.key);
            }
            await sendOp(op);
        }
    } finally {
        sending = false;
        if (sendAgain) {
            sendAgain = false;
            scheduleSync();
        }
    }
};

const scheduleSync = () => {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => void flushQuestions(), 300);
};

const syncPlayArea = () => {
    const playArea = currentPlayArea();
    const json = JSON.stringify(playArea);
    if (json === syncedPlayArea) return;
    syncedPlayArea = json;
    void sendOp({ type: "setPlayArea", playArea });
};

const syncZone = () => {
    const zone = currentZoneSettings();
    const json = JSON.stringify(zone);
    if (json === syncedZone) return;
    syncedZone = json;
    void sendOp({ type: "setZone", zone });
};

const inGame = () => !applyingRemote && gameState.get() !== null;

let listening = false;
const listenForLocalChanges = () => {
    if (listening) return;
    listening = true;
    questions.listen(() => inGame() && scheduleSync());
    for (const store of [
        polyGeoJSON,
        mapGeoLocation,
        additionalMapGeoLocations,
    ]) {
        store.listen(() => inGame() && syncPlayArea());
    }
    disabledStations.listen(() => inGame() && syncZone());
    // The hider's station and pin go to the hider's other phones.
    chosenStation.listen((station) => {
        if (inGame() && gameRole.get() === "hider") {
            void sendOp({ type: "setHiderStation", station });
        }
    });
    let pinTimer: ReturnType<typeof setTimeout> | undefined;
    hiderMode.listen((pin) => {
        if (!inGame() || gameRole.get() !== "hider" || pin === false) return;
        if (pinLocked.get()) return;
        clearTimeout(pinTimer);
        pinTimer = setTimeout(
            () => void sendOp({ type: "setHiderPin", pin }),
            300,
        );
    });
};

const disconnect = () => {
    clearTimeout(retryTimer);
    closeStream?.();
    closeStream = null;
};

/** Failed tries in a row; the wait between tries grows with them. */
let attempts = 0;
const retryLater = () => {
    gameConnection.set("retrying");
    const delay = retryDelayMs(attempts++);
    reconnectAt.set(Date.now() + delay);
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => void connect(), delay);
};

const connect = async () => {
    disconnect();
    const id = activeGameId.get();
    if (!id) return;
    gameConnection.set("connecting");
    try {
        const { role, state, now } = await fetchGame(id, token());
        noteServerTime(now);
        gameRole.set(role);
        receive(state, true);
    } catch (error) {
        if ((error as { status?: number }).status === 404) {
            toast.error("This game doesn't exist (any more).");
            leaveGame();
            return;
        }
        retryLater();
        return;
    }
    attempts = 0;
    reconnectAt.set(null);
    void refreshPush(id, token());

    // The hider's phone is in hider mode; a seeker's isn't.
    if (gameRole.get() === "hider") ensureHiderMode();
    else if (hiderMode.get() !== false) hiderMode.set(false);
    closeStream = openEvents(id, token(), {
        onEvent: (message) => {
            if (message.event === "state") {
                gameConnection.set("live");
                attempts = 0;
                reconnectAt.set(null);
                const { state, now } = JSON.parse(message.data);
                noteServerTime(now);
                receive(state);
            } else if (message.event === "deleted") {
                toast.info("This game was deleted.");
                forgetGame(id);
                leaveGame();
            }
        },
        onEnd: () => {
            closeStream = null;
            if (activeGameId.get() === id) retryLater();
        },
    });
};

/** The game `synced` belongs to, in this page session. */
let sessionGame = "";

/** Joins a shared game: the URL becomes the game's link. */
export const joinGame = (id: string) => {
    if (sessionGame !== id) {
        // The server's version wins: this phone's questions count as what it
        // last had in common with the server, so ones not in the game are
        // dropped and none are sent.
        synced = new Map(questions.get().map((q) => [q.key, syncedJson(q)]));
        syncedPlayArea = "";
        syncedZone = "";
        sessionGame = id;
        roundsSeen = -1;
        gameState.set(null);
        suggestedAnswers.set({});
        previewAnswers.set({});
    }
    currentGameId.set(id);
    activeGameId.set(id);
    setUrl(id);
    listenForLocalChanges();
    void connect();
};

/**
 * Back to no game. The game's questions were the game's: they go, and
 * joining again asks who you are.
 */
/** A new round began on the server: nothing of the old one lingers here. */
const startOfRound = () => {
    const id = activeGameId.get();
    if (gameRole.get() === "hider") {
        // The old token is void: a seeker until someone claims the hider.
        gameRole.set("seeker");
        forgetHider();
    }
    chosenStation.set(null);
    pendingStation.set(null);
    hiderChoosing.set(false);
    pinLocked.set(false);
    if (id) unmarkJoined(id);
};

export const leaveGame = () => {
    const id = activeGameId.get();
    disconnect();
    if (gameRole.get() === "hider") hiderMode.set(false);
    sessionGame = "";
    roundsSeen = -1;
    pendingStation.set(null);
    pinLocked.set(false);
    currentGameId.set("");
    activeGameId.set("");
    gameState.set(null);
    gameRole.set("seeker");
    gameConnection.set("off");
    suggestedAnswers.set({});
    synced = new Map();
    if (id) unmarkJoined(id);
    questions.set([]);
    endgame.set(null);
    setUrl("");
};

/** Starts a shared game from this phone's play area, settings and questions. */
export const startGame = async () => {
    const { state } = await createGame({
        playArea: currentPlayArea(),
        zone: currentZoneSettings(),
        settings: gameSettings.get(),
        questions: questions
            .get()
            .filter((q) => !q.data.research)
            .map(toShared),
        by: me(),
    });
    syncedPlayArea = JSON.stringify(state.playArea);
    syncedZone = JSON.stringify(state.zone);
    // Not marked as joined: whoever starts the game says who they are
    // next, like everyone opening the link.
    joinGame(state.id);
    return state.id;
};

/** Becomes the hider on this phone (the first hider sets the password). */
export const claimHider = async (password: string) => {
    const id = activeGameId.get();
    const { token: hiderToken } = await postHiderPassword(id, password, me());
    hiderTokens.set({ ...hiderTokens.get(), [id]: hiderToken });
    await connect();
};

/** Stops being the hider on this phone (the role stays protected). */
export const forgetHider = () => {
    const id = activeGameId.get();
    const { [id]: removed, ...rest } = hiderTokens.get();
    void removed;
    hiderTokens.set(rest);
    hiderMode.set(false);
    void connect();
};

/** Deletes a game on the server, for everyone; this phone forgets it. */
export const deleteGame = async (id: string) => {
    try {
        await deleteGameRequest(id, hiderTokens.get()[id]);
    } catch (error) {
        if ((error as { status?: number }).status !== 404) throw error;
    }
    forgetGame(id);
    if (activeGameId.get() === id) leaveGame();
    if (currentGameId.get() === id) currentGameId.set("");
};

export const uploadPhoto = async (
    photo: Blob,
    options: { requestId?: string; caption?: string } = {},
) => {
    const { state, now } = await postPhoto(
        activeGameId.get(),
        photo,
        me(),
        token(),
        options,
    );
    noteServerTime(now);
    receive(state);
};

/**
 * On page load: make the saved game settings take effect, then join the game
 * in the URL. The plain address joins nothing (Menu → Game offers to rejoin
 * the last game), so a game that misbehaves can always be left behind.
 */
export const resumeGame = () => {
    applyGameSettings(gameSettings.get());
    const fromUrl = new URL(window.location.href).searchParams.get(
        GAME_URL_PARAM,
    );
    if (fromUrl) {
        joinGame(fromUrl);
    } else if (currentGameId.get() !== "") {
        // The plain address after a game: its questions don't belong here
        // (Menu → Game still offers to rejoin, which brings them back).
        questions.set([]);
        endgame.set(null);
    }
};

/** Forgets the last game without having to join it first. */
export const forgetLastGame = () => currentGameId.set("");
