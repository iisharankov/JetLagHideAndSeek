/**
 * Caches an async function's results by key. Unlike lodash's memoize, a
 * rejected call is forgotten, so one network blip doesn't break a question
 * for the rest of the session.
 */
export const memoizeAsync = <Args extends unknown[], R>(
    fn: (...args: Args) => Promise<R>,
    key: (...args: Args) => string,
) => {
    const cache = new Map<string, Promise<R>>();

    return (...args: Args): Promise<R> => {
        const k = key(...args);
        let pending = cache.get(k);
        if (!pending) {
            pending = fn(...args);
            cache.set(k, pending);
            pending.catch(() => {
                if (cache.get(k) === pending) cache.delete(k);
            });
        }
        return pending;
    };
};
