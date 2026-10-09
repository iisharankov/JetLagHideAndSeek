import { type Questions, questionsSchema } from "@/maps/schema";

export const UNREADABLE_QUESTIONS_KEY = "questions-unreadable-backup";

const backupToLocalStorage = (raw: string) => {
    try {
        localStorage.setItem(UNREADABLE_QUESTIONS_KEY, raw);
    } catch {
        // Storage unavailable or full: nothing more we can do.
    }
};

/**
 * Reads the saved questions. Data this version can't read (for example from
 * an older format) is set aside under UNREADABLE_QUESTIONS_KEY rather than
 * stopping the app from loading.
 */
export const decodeStoredQuestions = (
    raw: string,
    backup: (raw: string) => void = backupToLocalStorage,
): Questions => {
    try {
        const result = questionsSchema.safeParse(JSON.parse(raw));
        if (result.success) return result.data;
    } catch {
        // Not JSON; fall through to the backup.
    }
    console.warn("Saved questions couldn't be read; backed them up.");
    backup(raw);
    return [];
};
