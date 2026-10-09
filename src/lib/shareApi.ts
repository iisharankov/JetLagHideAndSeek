import { API_URL } from "@/lib/config";

/** Stores a game on our own server and returns its share id. */
export const uploadSharedGame = async (game: string): Promise<string> => {
    const response = await fetch(`${API_URL}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: game,
    });
    if (!response.ok) {
        throw new Error(`Share service answered HTTP ${response.status}`);
    }
    const { id } = await response.json();
    if (typeof id !== "string") throw new Error("Share service sent no id");
    return id;
};

export const downloadSharedGame = async (id: string): Promise<string> => {
    const response = await fetch(`${API_URL}/share/${encodeURIComponent(id)}`);
    if (response.status === 404) {
        throw new Error("This share link doesn't exist (any more).");
    }
    if (!response.ok) {
        throw new Error(`Share service answered HTTP ${response.status}`);
    }
    return response.text();
};
