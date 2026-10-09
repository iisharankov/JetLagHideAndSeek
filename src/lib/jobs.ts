import { atom, computed, type ReadableAtom } from "nanostores";

/**
 * Counts running background jobs. Unlike a shared true/false flag, one job
 * finishing (or failing) can't mark another as done, and a failure can't
 * leave the app stuck in "loading".
 */
export const createBusyTracker = () => {
    const running = atom(0);
    const isBusy: ReadableAtom<boolean> = computed(running, (n) => n > 0);

    /** Marks a job as started; call the returned function when it ends. */
    const begin = () => {
        running.set(running.get() + 1);
        let ended = false;
        return () => {
            if (ended) return;
            ended = true;
            running.set(running.get() - 1);
        };
    };

    const track = async <T>(task: () => Promise<T>): Promise<T> => {
        const end = begin();
        try {
            return await task();
        } finally {
            end();
        }
    };

    return { isBusy, begin, track };
};

/**
 * Wraps a task so it never runs twice at once. A call made while a run is in
 * progress schedules one follow-up run (later calls join it), so no request
 * for fresh results is ever dropped. Each caller's promise settles with a run
 * that started after their call.
 */
export const createLatestRunner = (task: () => Promise<void>) => {
    let current: Promise<void> | null = null;
    let next: Promise<void> | null = null;

    const run = (): Promise<void> => {
        if (!current) {
            current = task().finally(() => {
                current = null;
            });
            return current;
        }
        if (!next) {
            next = current
                .catch(() => {})
                .then(() => {
                    next = null;
                    return run();
                });
        }
        return next;
    };

    return run;
};
