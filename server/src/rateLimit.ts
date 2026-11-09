// Wrong guesses, counted in memory: team passwords and player codes allow
// five wrong tries a minute per game (the owner's Q50 answer). A restart
// forgets the counts, which is fine for a game among friends.

export type RateLimiter = ReturnType<typeof createRateLimiter>;

export const createRateLimiter = ({
    limit = 5,
    windowMs = 60_000,
    now = () => Date.now(),
}: { limit?: number; windowMs?: number; now?: () => number } = {}) => {
    const failures = new Map<string, number[]>();

    const recent = (key: string) => {
        const since = now() - windowMs;
        const kept = (failures.get(key) ?? []).filter((at) => at > since);
        if (kept.length > 0) failures.set(key, kept);
        else failures.delete(key);
        return kept;
    };

    return {
        /** False once `limit` wrong tries were made in the last window. */
        allow: (key: string) => recent(key).length < limit,
        /** Counts one wrong try. */
        failed: (key: string) => {
            failures.set(key, [...recent(key), now()]);
        },
    };
};
