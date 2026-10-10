// Joining a shared game replaces this phone's questions with the game's. The
// phone's own questions are kept here, to bring back after the game.
import type { Question } from "@/maps/schema";
import { questionsSchema } from "@/maps/schema";

export const BACKUP_KEY = "questions-before-game";

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

const storage = (): Storage | null =>
    typeof localStorage === "undefined" ? null : localStorage;

/** Keeps the questions for later (nothing happens if storage is full). */
export const writeBackup = (
    questions: Question[],
    store: Storage | null = storage(),
) => {
    try {
        store?.setItem(BACKUP_KEY, JSON.stringify(questions));
    } catch {
        // Storage full or blocked: nothing to back up to.
    }
};

/** The questions kept before a game, or null (none, or unreadable). */
export const readBackup = (
    store: Storage | null = storage(),
): Question[] | null => {
    try {
        const raw = store?.getItem(BACKUP_KEY);
        if (!raw) return null;
        const parsed = questionsSchema.safeParse(JSON.parse(raw));
        return parsed.success && parsed.data.length > 0
            ? (parsed.data as Question[])
            : null;
    } catch {
        return null;
    }
};

export const clearBackup = (store: Storage | null = storage()) => {
    try {
        store?.removeItem(BACKUP_KEY);
    } catch {
        // Nothing to clear.
    }
};
