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
    openQuestion,
    polyGeoJSON,
    questions,
} from "@/lib/context";
import { normalizeGameSettings } from "@/lib/game/settings";
import { applyGameSettings } from "@/lib/gameSettings";
import { currentPosition } from "@/lib/geolocation";
import {
    chosenStation,
    hiderChoosing,
    pendingStation,
    pinDrivenElsewhere,
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
    deletePlayer,
    fetchGame,
    type JoinBody,
    type Joined,
    openEvents,
    postJoin,
    postOp,
    postPhoto,
    postPosition,
    postRejoin,
} from "./api";
import { forgetCode, myCode } from "./codes";
import { forgetGame, rememberGame } from "./knownGames";
import { positionDue, seekerPositions } from "./positions";
import { noteServerTime } from "./serverTime";
import { diffLocal, mergeRemoteQuestions, syncedJson, toShared } from "./sync";
import type { GameOp, GameState, Player, PlayerId, Role } from "./types";

/** The URL parameter holding the game's id: ?game=<id>. */
export const GAME_URL_PARAM = "game";

export const playerName = persistentAtom<string>("playerName", "");
/** The last shared game this phone was in, to rejoin ("" if none). */
export const currentGameId = persistentAtom<string>("currentGame", "");
/** The game this phone is in right now ("" when playing alone). */
export const activeGameId = atom<string>("");
/**
 * Hider tokens from before players (the hider password): a phone that
 * became the hider that way stays the hider for one more release.
 */
const hiderTokens = persistentAtom<Record<string, string>>(
    "hiderTokens",
    {},
    { encode: JSON.stringify, decode: JSON.parse },
);
/** The keys of the games this phone started: only they delete a game. */
export const organiserTokens = persistentAtom<Record<string, string>>(
    "organiserTokens",
    {},
    { encode: JSON.stringify, decode: JSON.parse },
);
// Read once per tab (an unused store re-reads storage on every get): another
// tab of the same browser becoming the hider must not make this one the
// hider too.
hiderTokens.listen(() => {});

export const gameState = atom<GameState | null>(null);
/** This phone's role, as the server says with every answer. */
export const gameRole = atom<Role>("seeker");
/** This phone's player in the game (its public id; set once the game loads). */
export const myPlayerId = atom<PlayerId | null>(null);
/** This phone's player record, once it has joined. */
export const myPlayer = computed(
    [gameState, myPlayerId],
    (game, id): Player | undefined =>
        game && id ? game.players?.[id] : undefined,
);
/** Joined: in the game's players, and not taken over by another phone. */
export const joinedHere = computed(
    myPlayer,
    (player) => !!player && !player.left,
);
/**
 * Counts the times this phone became the hider while open (joined as the
 * hider, a new round handed to its team): the Hider tab opens for it.
 */
export const hiderTurn = atom(0);

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

const me = () =>
    (myPlayer.get()?.name ?? playerName.get() ?? "").trim() || "Someone";
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

/**
 * The role from the server. Becoming the hider puts the phone in hider
 * mode (and, mid-session, opens the Hider tab); no longer the hider, the
 * hider's spot goes.
 */
const applyRole = (role: Role, initial = false) => {
    const before = gameRole.get();
    gameRole.set(role);
    if (role === before) return;
    // Notifications are per role: say the new one.
    if (!initial) void refreshPush(activeGameId.get(), token());
    if (role === "hider") {
        ensureHiderMode();
        if (!initial) hiderTurn.set(hiderTurn.get() + 1);
    } else {
        if (hiderMode.get() !== false) hiderMode.set(false);
        chosenStation.set(null);
        pendingStation.set(null);
        hiderChoosing.set(false);
        pinLocked.set(false);
    }
};

// What this phone last had in common with the server.
let synced = new Map<number, string>();
/** Rounds the game had when last seen: one more is a new round. */
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
        if (fresh) {
            activeQuestionKey.set(fresh.question.key);
            // Straight to it, unless the hider has another one open.
            const open = openQuestion.get();
            if (!questions.get().some((q) => q.key === open)) {
                openQuestion.set(fresh.question.key);
            }
        }
    }
    // This phone's player moved to another phone (its code), or was
    // removed: this phone is out of the game.
    const you = myPlayerId.get();
    const mineBefore = you ? current?.players?.[you] : undefined;
    const mineNow = you ? state.players?.[you] : undefined;
    if (mineBefore && !mineBefore.left && mineNow?.left) {
        toast.info(
            mineNow.removed
                ? "You were removed from the game. Open its link to join again."
                : "You continued on another phone. Rejoin here with your code if that was a mistake.",
            { toastId: "player-left", autoClose: 15_000 },
        );
        leaveGame();
        return;
    }
    gameState.set(state);
    lastUpdateAt.set(Date.now());
    // A new round: nothing of the old one lingers (the role came with this
    // state: the team that claimed the round is the hider now).
    if (roundsSeen >= 0 && state.rounds.length > roundsSeen) {
        startOfRound();
    }
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
            const pending = state.hider.pending ?? null;
            if (
                JSON.stringify(pending) !== JSON.stringify(pendingStation.get())
            ) {
                pendingStation.set(pending);
            }
            // Which of the hider's phones moved the pin last.
            const driver = state.hider.pinDriver;
            const elsewhere = pinDrivenElsewhere.get();
            if (!driver || driver === myPlayerId.get()) {
                if (elsewhere) pinDrivenElsewhere.set(null);
            } else if (elsewhere?.by !== driver) {
                pinDrivenElsewhere.set({ by: driver, since: Date.now() });
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
        const { role, you, state, now } = await fetchGame(id, token());
        noteServerTime(now);
        myPlayerId.set(you);
        applyRole(role);
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
        const { state, role, now } = await postOp(id, op, me(), token());
        noteServerTime(now);
        if (role) applyRole(role);
        receive(state);
    } catch (error) {
        toast.error(errorMessage(error), { toastId: `game-op-${op.type}` });
        await resync();
    }
};

let syncTimer: ReturnType<typeof setTimeout> | undefined;
/** The questions' changes go one flush after another. */
let flushing: Promise<void> = Promise.resolve();

const flushQuestions = () => {
    flushing = flushing
        .then(async () => {
            for (const op of diffLocal(questions.get(), synced)) {
                if (op.type === "putQuestion") {
                    synced.set(op.question.key, JSON.stringify(op.question));
                } else if (op.type === "deleteQuestion") {
                    synced.delete(op.key);
                }
                await sendOp(op);
            }
        })
        .catch(() => undefined);
    return flushing;
};

/** A draft to the hider, with its last changes first (a pin just moved). */
export const sendQuestion = async (key: number) => {
    clearTimeout(syncTimer);
    await flushQuestions();
    await sendOp({ type: "sendQuestion", key });
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
    pendingStation.listen((station) => {
        if (inGame() && gameRole.get() === "hider") {
            void sendOp({ type: "setHiderPending", station });
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
    // A seeker's position, for the hider's map (the rulebook: seekers keep
    // a tracker on): when it moves, and once a minute while it's followed.
    let sent: { latitude: number; longitude: number; at: number } | null = null;
    const sharePosition = () => {
        const here = currentPosition.get();
        if (!here || !inGame() || gameRole.get() !== "seeker") return;
        const fix = { ...here, at: Date.now() };
        if (!positionDue(sent, fix)) return;
        sent = fix;
        const { latitude, longitude, accuracy } = here;
        postPosition(
            activeGameId.get(),
            { latitude, longitude, accuracy },
            me(),
        ).catch(() => {
            // The next fix, or the next minute, tries again.
            sent = null;
        });
    };
    currentPosition.listen(sharePosition);
    setInterval(sharePosition, 15_000);
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
        const { role, you, state, now } = await fetchGame(id, token());
        noteServerTime(now);
        myPlayerId.set(you);
        applyRole(role, true);
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
                const { state, role, now } = JSON.parse(message.data);
                noteServerTime(now);
                if (role) applyRole(role);
                receive(state);
            } else if (message.event === "positions") {
                const { positions, now } = JSON.parse(message.data);
                noteServerTime(now);
                seekerPositions.set(positions);
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

/** A new round began on the server: nothing of the old one lingers here. */
const startOfRound = () => {
    // A hider token from before players is void after a round.
    const id = activeGameId.get();
    if (hiderTokens.get()[id]) {
        const { [id]: removed, ...rest } = hiderTokens.get();
        void removed;
        hiderTokens.set(rest);
    }
    chosenStation.set(null);
    pendingStation.set(null);
    // The new hider picks their station first.
    hiderChoosing.set(gameRole.get() === "hider");
    pinLocked.set(false);
};

/**
 * Back to no game. The game's questions were the game's: they go. The
 * player stays this phone's (opening the link again needs no joining).
 */
export const leaveGame = () => {
    const id = activeGameId.get();
    disconnect();
    if (gameRole.get() === "hider") hiderMode.set(false);
    sessionGame = "";
    roundsSeen = -1;
    pendingStation.set(null);
    pinLocked.set(false);
    previewAnswers.set({});
    seekerPositions.set([]);
    currentGameId.set("");
    activeGameId.set("");
    gameState.set(null);
    gameRole.set("seeker");
    myPlayerId.set(null);
    // After the game is gone, so nothing is sent: no station of this game
    // shows on the next one.
    chosenStation.set(null);
    hiderChoosing.set(false);
    pinDrivenElsewhere.set(null);
    gameConnection.set("off");
    suggestedAnswers.set({});
    synced = new Map();
    void id;
    questions.set([]);
    endgame.set(null);
    setUrl("");
};

/** Starts a shared game from this phone's play area, settings and questions. */
export const startGame = async () => {
    const code = myCode.get();
    if (!code) {
        throw new Error(
            "Starting a game needs a creator code: ask whoever runs this site, and type it in Menu → Game.",
        );
    }
    let started: Awaited<ReturnType<typeof createGame>>;
    try {
        started = await createGame(
            {
                playArea: currentPlayArea(),
                zone: currentZoneSettings(),
                settings: gameSettings.get(),
                questions: questions
                    .get()
                    .filter((q) => !q.data.research)
                    .map(toShared),
                by: me(),
            },
            code.code,
        );
    } catch (error) {
        // A code that no longer works (revoked, mistyped) is forgotten.
        if ((error as { status?: number }).status === 403) forgetCode();
        throw error;
    }
    const { state, organiserToken } = started;
    if (organiserToken) {
        organiserTokens.set({
            ...organiserTokens.get(),
            [state.id]: organiserToken,
        });
    }
    syncedPlayArea = JSON.stringify(state.playArea);
    syncedZone = JSON.stringify(state.zone);
    // Whoever starts the game says who they are next, like everyone
    // opening the link.
    joinGame(state.id);
    return state.id;
};

/** The server's answer to joining: this phone's player, role and game. */
const acceptPlayer = ({ player, role, you, state, now }: Joined) => {
    noteServerTime(now);
    myPlayerId.set(you);
    playerName.set(player.name);
    applyRole(role);
    receive(state);
};

/** Joins the game this phone is in (or updates its player: a new name, a team). */
export const joinAs = async (body: JoinBody) =>
    acceptPlayer(await postJoin(activeGameId.get(), body, token()));

/** Becomes, on this phone, the player whose code this is. */
export const rejoinWithCode = async (code: string) =>
    acceptPlayer(await postRejoin(activeGameId.get(), code, token()));

/** Without teams: says this phone's player hides this round (or not any more). */
export const setHiding = (hider: boolean) => joinAs({ name: me(), hider });

/** A new name, for the others too, once joined. */
export const renameInGame = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || !joinedHere.get() || trimmed === myPlayer.get()?.name) {
        return;
    }
    try {
        await joinAs({ name: trimmed });
    } catch (error) {
        toast.error(errorMessage(error), { toastId: "rename" });
    }
};

/** Takes a player gone quiet out of the game (whoever started it: anyone). */
export const removePlayer = (player: PlayerId) => {
    const id = activeGameId.get();
    return deletePlayer(id, player, organiserTokens.get()[id]);
};

/** Deletes a game on the server, for everyone; this phone forgets it. */
export const deleteGame = async (id: string) => {
    try {
        await deleteGameRequest(
            id,
            hiderTokens.get()[id],
            organiserTokens.get()[id],
        );
    } catch (error) {
        if ((error as { status?: number }).status !== 404) throw error;
    }
    forgetGame(id);
    if (activeGameId.get() === id) leaveGame();
    if (currentGameId.get() === id) currentGameId.set("");
};

/** Drops a game from this phone only (it goes on for the others). */
export const forgetGameHere = (id: string) => {
    forgetGame(id);
    if (activeGameId.get() === id) leaveGame();
    if (currentGameId.get() === id) currentGameId.set("");
};

export const uploadPhoto = async (
    photo: Blob,
    options: { requestId?: string; caption?: string } = {},
) => {
    const { state, role, now } = await postPhoto(
        activeGameId.get(),
        photo,
        me(),
        token(),
        options,
    );
    noteServerTime(now);
    if (role) applyRole(role);
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
