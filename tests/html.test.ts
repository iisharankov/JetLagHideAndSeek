import { describe, expect, it } from "vitest";

import { escapeHtml } from "@/lib/html";

describe("escapeHtml", () => {
    it("neutralises markup in names from map data or shared links", () => {
        expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
            "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
        );
    });

    it("leaves ordinary names alone", () => {
        expect(escapeHtml("Zürich HB")).toBe("Zürich HB");
        expect(escapeHtml("Biel/Bienne")).toBe("Biel/Bienne");
    });

    it("escapes ampersands and quotes", () => {
        expect(escapeHtml(`Tom & Jerry's "Bar"`)).toBe(
            "Tom &amp; Jerry&#39;s &quot;Bar&quot;",
        );
    });
});
