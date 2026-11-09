// Dangerous actions wait a few seconds before they're sent, with Undo
// (principle 10 of the phone design): Start the end game reveals the
// hider's zone, so it goes out only after 5 s.

/** Runs `run` after `ms`; the returned function cancels it (Undo). */
export const schedule = (run: () => void, ms: number) => {
    let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        timer = null;
        run();
    }, ms);
    return () => {
        if (timer !== null) clearTimeout(timer);
        timer = null;
    };
};

/** How long Start the end game waits for an Undo. */
export const ENDGAME_DELAY_MS = 5000;

/**
 * The end game's wait. The browser tests shorten it through localStorage
 * `endgameDelayMs` (read once per start; a documented test seam).
 */
export const endgameDelayMs = (stored: string | null) => {
    const value = stored === null ? NaN : Number(stored);
    return Number.isFinite(value) && value >= 0 ? value : ENDGAME_DELAY_MS;
};
