// Small stand-ins for the lodash functions the app used (round 49: lodash
// whole was 71 KB of the first page load).

/** The items without repeats, the first of each kept, in order. */
export const unique = <T>(items: T[]) => [...new Set(items)];

/** The first item of each key, in order. */
export const uniqueBy = <T>(items: T[], key: (item: T) => unknown) => {
    const seen = new Set<unknown>();
    return items.filter((item) => {
        const k = key(item);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });
};

/** Remembers each result by key (by default the first argument). */
export const memoize = <Args extends unknown[], R>(
    fn: (...args: Args) => R,
    key: (...args: Args) => unknown = (...args) => args[0],
) => {
    const cache = new Map<unknown, R>();
    return (...args: Args): R => {
        const k = key(...args);
        if (!cache.has(k)) cache.set(k, fn(...args));
        return cache.get(k) as R;
    };
};
