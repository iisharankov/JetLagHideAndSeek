import { describe, expect, it, vi } from "vitest";

import { createBusyTracker, createLatestRunner } from "@/lib/jobs";

const deferred = () => {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

describe("createBusyTracker", () => {
    it("is busy while any tracked task runs", async () => {
        const busy = createBusyTracker();
        const a = deferred();
        const b = deferred();

        const first = busy.track(() => a.promise);
        const second = busy.track(() => b.promise);
        expect(busy.isBusy.get()).toBe(true);

        a.resolve();
        await first;
        expect(busy.isBusy.get()).toBe(true);

        b.resolve();
        await second;
        expect(busy.isBusy.get()).toBe(false);
    });

    it("supports begin/end for callback-style code, ending only once", () => {
        const busy = createBusyTracker();
        const endA = busy.begin();
        const endB = busy.begin();

        endA();
        endA(); // a second call must not end someone else's job
        expect(busy.isBusy.get()).toBe(true);

        endB();
        expect(busy.isBusy.get()).toBe(false);
    });

    it("stops being busy when a task fails", async () => {
        const busy = createBusyTracker();

        await expect(
            busy.track(async () => {
                throw new Error("no station names");
            }),
        ).rejects.toThrow("no station names");

        expect(busy.isBusy.get()).toBe(false);
    });
});

describe("createLatestRunner", () => {
    it("runs the task", async () => {
        const task = vi.fn(async () => {});
        const run = createLatestRunner(task);

        await run();
        expect(task).toHaveBeenCalledTimes(1);
    });

    it("never runs two copies at once, and re-runs once for calls made while busy", async () => {
        const gates = [deferred(), deferred()];
        let active = 0;
        let maxActive = 0;
        let calls = 0;
        const run = createLatestRunner(async () => {
            const gate = gates[calls++];
            active++;
            maxActive = Math.max(maxActive, active);
            await gate.promise;
            active--;
        });

        const first = run();
        const second = run(); // arrives mid-run: must not be dropped
        const third = run(); // coalesced with the second

        gates[0].resolve();
        await vi.waitFor(() => expect(calls).toBe(2));
        gates[1].resolve();
        await Promise.all([first, second, third]);

        expect(calls).toBe(2);
        expect(maxActive).toBe(1);
    });

    it("keeps working after a run fails", async () => {
        const task = vi
            .fn()
            .mockRejectedValueOnce(new Error("Overpass down"))
            .mockResolvedValueOnce(undefined);
        const run = createLatestRunner(task);

        await expect(run()).rejects.toThrow("Overpass down");
        await expect(run()).resolves.toBeUndefined();
        expect(task).toHaveBeenCalledTimes(2);
    });
});
