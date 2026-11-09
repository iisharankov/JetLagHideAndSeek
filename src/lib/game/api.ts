// HTTP calls to the shared-game API (server/src/app.ts).
import { API_URL } from "@/lib/config";

import { playerKey } from "./playerKey";
import type {
    GameOp,
    GameSettings,
    GameState,
    Player,
    PlayerId,
    Role,
    SharedQuestion,
} from "./types";

/**
 * Every request says which player this phone is (its key), and carries the
 * hider token of a phone that became the hider before players (kept one
 * release).
 */
const headers = (token?: string, extra: Record<string, string> = {}) => ({
    ...extra,
    "X-Player-Key": playerKey(),
    ...(token ? { "X-Hider-Token": token } : {}),
});

const call = async <T>(path: string, init?: RequestInit): Promise<T> => {
    let response: Response;
    try {
        response = await fetch(`${API_URL}${path}`, init);
    } catch {
        throw new Error("Can't reach the game server. Check your connection.");
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw Object.assign(
            new Error(
                body?.error ?? `Game server answered HTTP ${response.status}`,
            ),
            { status: response.status },
        );
    }
    return body as T;
};

const post = <T>(path: string, body: unknown, token?: string) =>
    call<T>(path, {
        method: "POST",
        headers: headers(token, { "Content-Type": "application/json" }),
        body: JSON.stringify(body),
    });

export const createGame = (start: {
    playArea: unknown;
    zone: unknown;
    settings: GameSettings;
    questions: SharedQuestion[];
    by: string;
}) =>
    post<{ state: GameState; organiserToken: string | null }>("/games", start);

/** Every answer carries the server's clock, for the clocks on the phones. */
type Timed<T> = T & { now: number };

/** `you`: this phone's player in the game (whether it joined or not). */
export const fetchGame = (id: string, token?: string) =>
    call<Timed<{ role: Role; you: PlayerId | null; state: GameState }>>(
        `/games/${encodeURIComponent(id)}`,
        { headers: headers(token) },
    );

/** The answer to joining (or rejoining with a code). */
export type Joined = Timed<{
    player: Player;
    role: Role;
    you: PlayerId;
    state: GameState;
}>;

export interface JoinBody {
    name: string;
    /** With teams: one of the game's (by id), or a new one (by name). */
    team?: { id?: string; name?: string; password?: string };
    hider?: boolean;
}

export const postJoin = (id: string, body: JoinBody, token?: string) =>
    post<Joined>(`/games/${encodeURIComponent(id)}/join`, body, token);

export const postRejoin = (id: string, code: string, token?: string) =>
    post<Joined>(`/games/${encodeURIComponent(id)}/rejoin`, { code }, token);

export const deletePlayer = (
    id: string,
    player: PlayerId,
    organiserToken?: string,
) =>
    call<{ ok: true }>(
        `/games/${encodeURIComponent(id)}/players/${encodeURIComponent(player)}`,
        {
            method: "DELETE",
            headers: headers(
                undefined,
                organiserToken ? { "X-Organiser-Token": organiserToken } : {},
            ),
        },
    );

export const postOp = (id: string, op: GameOp, by: string, token?: string) =>
    post<Timed<{ state: GameState; role: Role }>>(
        `/games/${encodeURIComponent(id)}/ops`,
        { op, by },
        token,
    );

/** A seeker's position, for the hider's map (not part of the game's state). */
export const postPosition = (
    id: string,
    position: { latitude: number; longitude: number; accuracy?: number },
    by: string,
) =>
    post<{ ok: true }>(`/games/${encodeURIComponent(id)}/position`, {
        ...position,
        by,
    });

export const deleteGameRequest = (
    id: string,
    token?: string,
    organiserToken?: string,
) =>
    call<{ ok: true }>(`/games/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: headers(
            token,
            organiserToken ? { "X-Organiser-Token": organiserToken } : {},
        ),
    });

export const postPhoto = (
    id: string,
    photo: Blob,
    by: string,
    token?: string,
    options: { requestId?: string; caption?: string } = {},
) => {
    const query = new URLSearchParams();
    if (options.requestId) query.set("request", options.requestId);
    if (options.caption) query.set("caption", options.caption);
    return call<Timed<{ photoId: string; state: GameState; role: Role }>>(
        `/games/${encodeURIComponent(id)}/photos?${query}`,
        {
            method: "POST",
            headers: headers(token, {
                "Content-Type": photo.type,
                "X-Player": encodeURIComponent(by),
            }),
            body: photo,
        },
    );
};

export const photoUrl = (id: string, photoId: string) =>
    `${API_URL}/games/${encodeURIComponent(id)}/photos/${encodeURIComponent(photoId)}`;

export const eventsUrl = (id: string) =>
    `${API_URL}/games/${encodeURIComponent(id)}/events`;

/** One server-sent event: its name and its data lines joined. */
export interface SseMessage {
    event: string;
    data: string;
}

/** Parses one event's block of lines (the text between two blank lines). */
export const parseSse = (block: string): SseMessage => {
    let event = "message";
    const data: string[] = [];
    for (const line of block.split(/\r?\n/)) {
        if (line.startsWith(":") || line === "") continue;
        const colon = line.indexOf(":");
        const field = colon === -1 ? line : line.slice(0, colon);
        const value =
            colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
        if (field === "event") event = value;
        else if (field === "data") data.push(value);
    }
    return { event, data: data.join("\n") };
};

/**
 * The game's live stream. EventSource can't send headers, so the stream is
 * read over fetch with the player's key in the header, like every other
 * request. Returns a function that closes the stream.
 */
export const openEvents = (
    id: string,
    token: string | undefined,
    handlers: {
        onEvent: (message: SseMessage) => void;
        /** The stream ended or failed (not closed by us). */
        onEnd: () => void;
    },
) => {
    const controller = new AbortController();
    void (async () => {
        try {
            const response = await fetch(eventsUrl(id), {
                headers: headers(token, { Accept: "text/event-stream" }),
                cache: "no-store",
                signal: controller.signal,
            });
            if (!response.ok || !response.body) {
                throw new Error(`Game server answered HTTP ${response.status}`);
            }
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            for (;;) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                let end = buffer.indexOf("\n\n");
                while (end !== -1) {
                    const block = buffer.slice(0, end);
                    buffer = buffer.slice(end + 2);
                    if (block.trim() !== "") handlers.onEvent(parseSse(block));
                    end = buffer.indexOf("\n\n");
                }
            }
        } catch {
            // Fell through to the end below.
        }
        if (!controller.signal.aborted) handlers.onEnd();
    })();
    return () => controller.abort();
};

// Push notifications ----------------------------------------------------

export const fetchPushKey = () => call<{ key: string | null }>("/push/key");

export const postPushSubscription = (
    id: string,
    subscription: unknown,
    token?: string,
) =>
    post<{ ok: true }>(
        `/games/${encodeURIComponent(id)}/push`,
        { subscription },
        token,
    );

export const deletePushSubscription = (
    id: string,
    endpoint: string,
    token?: string,
) =>
    call<{ ok: true }>(`/games/${encodeURIComponent(id)}/push`, {
        method: "DELETE",
        headers: headers(token, { "Content-Type": "application/json" }),
        body: JSON.stringify({ endpoint }),
    });
