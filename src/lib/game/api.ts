// HTTP calls to the shared-game API (server/src/app.ts).
import { API_URL } from "@/lib/config";

import type {
    GameOp,
    GameSettings,
    GameState,
    Role,
    SharedQuestion,
} from "./types";

const headers = (token?: string, extra: Record<string, string> = {}) => ({
    ...extra,
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
}) => post<{ state: GameState }>("/games", start);

export const fetchGame = (id: string, token?: string) =>
    call<{ role: Role; state: GameState }>(`/games/${encodeURIComponent(id)}`, {
        headers: headers(token),
    });

export const postOp = (id: string, op: GameOp, by: string, token?: string) =>
    post<{ state: GameState }>(
        `/games/${encodeURIComponent(id)}/ops`,
        { op, by },
        token,
    );

export const deleteGameRequest = (id: string) =>
    call<{ ok: true }>(`/games/${encodeURIComponent(id)}`, {
        method: "DELETE",
    });

export const postHiderPassword = (id: string, password: string) =>
    post<{ token: string }>(`/games/${encodeURIComponent(id)}/hider`, {
        password,
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
    return call<{ photoId: string; state: GameState }>(
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

export const eventsUrl = (id: string, token?: string) =>
    `${API_URL}/games/${encodeURIComponent(id)}/events${
        token ? `?hider=${encodeURIComponent(token)}` : ""
    }`;
