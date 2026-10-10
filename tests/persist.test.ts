import { setPersistentEngine } from "@nanostores/persistent";
import { describe, expect, it } from "vitest";

import { persistentAtom } from "@/lib/persist";

describe("persistentAtom", () => {
    it("saves values but never listens to other tabs' storage events", () => {
        const storage: Record<string, string> = {};
        const listeners: unknown[] = [];
        setPersistentEngine(storage, {
            addEventListener: (_key: string, listener: unknown) => {
                listeners.push(listener);
            },
            removeEventListener: () => {},
        });

        const name = persistentAtom<string>("test-name", "");
        const unbind = name.listen(() => {}); // mounts it, as the UI would
        expect(name.get()).toBe("");
        // Another tab's write would have reset this unsaved value.
        expect(listeners).toHaveLength(0);

        name.set("Ana");
        expect(storage["test-name"]).toBe("Ana");
        unbind();
    });
});
