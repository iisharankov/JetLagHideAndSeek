// This phone's connection to a shared game: joins by link, keeps the
// questions, play area and hiding zone settings in step with everyone else,
// and sends this phone's changes. The rules are on the server (gameOps.ts).
import { atom } from "nanostores";
import { toast } from "react-toastify";

import {
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
import { persistentAtom } from "@/lib/persist";
import {
    applyPlayArea,
    applyZoneSettings,
    currentPlayArea,
    currentZoneSettings,
    parsePlayArea,
    parseZoneSettings,
    playAreaName,
} from "@/lib/sharedGame";
import { errorMessage } from "@/maps/errors";

import {
    createGame,
    deleteGameRequest,
    eventsUrl,
    fetchGame,
    postHiderPassword,
    postOp,
    postPhoto,
} from "./api";
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

/** A shared game this phone has been in, for the list in Menu → Game. */
export interface KnownGame {
    id: string;
    area: string;
    joinedAt: number;
    lastSeen: number;
}
export const knownGames = persistentAtom<Record<string, KnownGame>>(
    "knownGames",
    {},
    { encode: JSON.stringify, decode: JSON.parse },
);

/** This phone is the hider's: hider mode, and the hider's role in a game. */
export const isHiderPhone = () =>
    hiderMode.get() !== false &&
    (gameState.get() === null || gameRole.get() === "hider");
export const gameConnection = atom<"off" | "connecting" | "live" | "retrying">(
    "off",
);

/** Hider: hider mode's suggested answers, by question key. */
export const suggestedAnswers = atom<
    Record<
        number,
        { answer: Record<string, unknown>; label: string; basedOn: number }
    >
>({});

const me = () => (playerName.get() ?? "").trim() || "Someone";
const token = () => hiderTokens.get()[activeGameId.get()];

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

/** Keeps the game in the phone's list (Menu → Game). */
const remember = (state: GameState) => {
    const known = knownGames.get()[state.id];
    const now = Date.now();
    if (known && now - known.lastSeen < 60_000) return;
    let area = known?.area ?? "";
    try {
        area = playAreaName(parsePlayArea(state.playArea));
    } catch {
        // An odd play area: keep what we had.
    }
    knownGames.set({
        ...knownGames.get(),
        [state.id]: {
            id: state.id,
            area,
            joinedAt: known?.joinedAt ?? now,
            lastSeen: now,
        },
    });
};

const forget = (id: string) => {
    const { [id]: removed, ...rest } = knownGames.get();
    void removed;
    knownGames.set(rest);
};

// What this phone last had in common with the server.
let synced = new Map<number, string>();
let syncedPlayArea = "";
let syncedZone = "";
let applyingRemote = false;
let source: EventSource | null = null;
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
    gameState.set(state);

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
        // The game's settings are the server's.
        applyGameSettings(state.settings);
        remember(state);
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
        const { role, state } = await fetchGame(id, token());
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
        const { state } = await postOp(id, op, me(), token());
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
};

const disconnect = () => {
    clearTimeout(retryTimer);
    source?.close();
    source = null;
};

const connect = async () => {
    disconnect();
    const id = activeGameId.get();
    if (!id) return;
    gameConnection.set("connecting");
    try {
        const { role, state } = await fetchGame(id, token());
        gameRole.set(role);
        receive(state, true);
    } catch (error) {
        if ((error as { status?: number }).status === 404) {
            toast.error("This game doesn't exist (any more).");
            leaveGame();
            return;
        }
        gameConnection.set("retrying");
        retryTimer = setTimeout(() => void connect(), 5000);
        return;
    }

    // The hider's phone is in hider mode; a seeker's isn't.
    if (gameRole.get() === "hider") ensureHiderMode();
    else if (hiderMode.get() !== false) hiderMode.set(false);
    const events = new EventSource(eventsUrl(id, token()));
    source = events;
    events.addEventListener("state", (event) => {
        gameConnection.set("live");
        receive(JSON.parse((event as MessageEvent).data));
    });
    events.addEventListener("deleted", () => {
        toast.info("This game was deleted.");
        forget(id);
        leaveGame();
    });
    events.onerror = () => {
        gameConnection.set("retrying");
        if (events.readyState === EventSource.CLOSED) {
            retryTimer = setTimeout(() => void connect(), 5000);
        }
    };
};

/** The game `synced` belongs to, in this page session. */
let sessionGame = "";

/** Joins a shared game: the URL becomes the game's link. */
export const joinGame = (id: string) => {
    if (sessionGame !== id) {
        // The server's version wins: this phone's questions count as what it
        // last had in common with the server, so ones not in the game are
        // dropped (kept as a backup) and none are sent.
        if (activeGameId.get() !== id && questions.get().length > 0) {
            try {
                localStorage.setItem(
                    "questions-before-game",
                    JSON.stringify(questions.get()),
                );
            } catch {
                // Storage full or blocked: nothing to back up to.
            }
        }
        synced = new Map(questions.get().map((q) => [q.key, syncedJson(q)]));
        syncedPlayArea = "";
        syncedZone = "";
        sessionGame = id;
        gameState.set(null);
        suggestedAnswers.set({});
    }
    currentGameId.set(id);
    activeGameId.set(id);
    setUrl(id);
    listenForLocalChanges();
    void connect();
};

/** Back to playing alone; this phone keeps its copy of the questions. */
export const leaveGame = () => {
    disconnect();
    if (gameRole.get() === "hider") hiderMode.set(false);
    sessionGame = "";
    currentGameId.set("");
    activeGameId.set("");
    gameState.set(null);
    gameRole.set("seeker");
    gameConnection.set("off");
    suggestedAnswers.set({});
    synced = new Map();
    setUrl("");
};

/** Starts a shared game from this phone's play area, settings and questions. */
export const startGame = async () => {
    const { state } = await createGame({
        playArea: currentPlayArea(),
        zone: currentZoneSettings(),
        settings: gameSettings.get(),
        questions: questions.get().map(toShared),
        by: me(),
    });
    syncedPlayArea = JSON.stringify(state.playArea);
    syncedZone = JSON.stringify(state.zone);
    joinGame(state.id);
    return state.id;
};

/** Becomes the hider on this phone (the first hider sets the password). */
export const claimHider = async (password: string) => {
    const id = activeGameId.get();
    const { token: hiderToken } = await postHiderPassword(id, password);
    hiderTokens.set({ ...hiderTokens.get(), [id]: hiderToken });
    await connect();
};

/** Stops being the hider on this phone (the role stays protected). */
export const forgetHider = () => {
    const { [activeGameId.get()]: removed, ...rest } = hiderTokens.get();
    void removed;
    hiderTokens.set(rest);
    hiderMode.set(false);
    void connect();
};

/** Deletes a game on the server, for everyone; this phone forgets it. */
export const deleteGame = async (id: string) => {
    try {
        await deleteGameRequest(id);
    } catch (error) {
        if ((error as { status?: number }).status !== 404) throw error;
    }
    forget(id);
    if (activeGameId.get() === id) leaveGame();
    if (currentGameId.get() === id) currentGameId.set("");
};

export const uploadPhoto = async (
    photo: Blob,
    options: { requestId?: string; caption?: string } = {},
) => {
    const { state } = await postPhoto(
        activeGameId.get(),
        photo,
        me(),
        token(),
        options,
    );
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
    if (fromUrl) joinGame(fromUrl);
};

/** Forgets the last game without having to join it first. */
export const forgetLastGame = () => currentGameId.set("");
