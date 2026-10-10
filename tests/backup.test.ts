import { describe, expect, it } from "vitest";

import {
    BACKUP_KEY,
    clearBackup,
    readBackup,
    writeBackup,
} from "@/lib/game/backup";
import { type Question, questionSchema } from "@/maps/schema";

const fakeStorage = () => {
    const items = new Map<string, string>();
    return {
        getItem: (key: string) => items.get(key) ?? null,
        setItem: (key: string, value: string) => void items.set(key, value),
        removeItem: (key: string) => void items.delete(key),
        items,
    };
};

const radius = (key: number) =>
    questionSchema.parse({
        id: "radius",
        key,
        data: { lat: 47.37, lng: 8.54 },
    }) as Question;

describe("the questions kept before a game", () => {
    it("come back as they were", () => {
        const store = fakeStorage();
        writeBackup([radius(1), radius(2)], store);
        expect(readBackup(store)?.map((q) => q.key)).toEqual([1, 2]);
        clearBackup(store);
        expect(readBackup(store)).toBeNull();
    });

    it("are null when there's nothing, or nothing readable", () => {
        const store = fakeStorage();
        expect(readBackup(store)).toBeNull();
        store.items.set(BACKUP_KEY, "[]");
        expect(readBackup(store)).toBeNull();
        store.items.set(BACKUP_KEY, "not json");
        expect(readBackup(store)).toBeNull();
        store.items.set(BACKUP_KEY, JSON.stringify([{ id: "nope" }]));
        expect(readBackup(store)).toBeNull();
    });

    it("work without storage at all", () => {
        expect(() => writeBackup([radius(1)], null)).not.toThrow();
        expect(readBackup(null)).toBeNull();
    });
});
