import { describe, expect, it, vi } from "vitest";

import { decodeStoredQuestions } from "@/lib/storage";

describe("decodeStoredQuestions", () => {
    it("reads saved questions, filling in defaults", () => {
        const questions = decodeStoredQuestions(
            JSON.stringify([
                { id: "radius", key: 1, data: { lat: 47.37, lng: 8.54 } },
            ]),
        );

        expect(questions).toHaveLength(1);
        expect(questions[0].data).toMatchObject({ within: true, radius: 50 });
    });

    it("backs up unreadable questions instead of breaking the app", () => {
        const backup = vi.fn();
        const raw = JSON.stringify([{ id: "radius", data: { lat: "north" } }]);

        expect(decodeStoredQuestions(raw, backup)).toEqual([]);
        expect(backup).toHaveBeenCalledWith(raw);
    });

    it("survives text that isn't JSON at all", () => {
        const backup = vi.fn();

        expect(decodeStoredQuestions("{oops", backup)).toEqual([]);
        expect(backup).toHaveBeenCalledWith("{oops");
    });
});
