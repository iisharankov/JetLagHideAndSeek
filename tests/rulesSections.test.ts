import { describe, expect, it } from "vitest";

import { headingSlug, parseRulesPage } from "@/lib/rules/sections";

const page = `---
title: "Measuring Questions"
order: 18
section: seeking
---

Measuring questions follow the format, "Compared to me, are you closer to or further from \\_\\_\\_\\_?"

After a measuring question has been answered, the hider may **draw 3 cards and keep 1**.

![A diagram](/rules/img/x.webp)

### Transit-Related

#### Commercial Airport

If there is any ambiguity, an airport is considered commercial.

#### Station Name's Length

Count every character.

### For <span class="game-size game-size-large">LARGE</span> Sized Games, Add the Following:

#### Zoos Within 15 Miles

Anything correctly categorized as a zoo.
`;

describe("headingSlug", () => {
    it("matches the ids the rules pages get", () => {
        expect(headingSlug("Commercial Airport")).toBe("commercial-airport");
        expect(headingSlug("Station Name's Length")).toBe(
            "station-names-length",
        );
        expect(headingSlug("1st Administrative Division Border")).toBe(
            "1st-administrative-division-border",
        );
        expect(headingSlug("Playing With Cars (Or On Foot)")).toBe(
            "playing-with-cars-or-on-foot",
        );
    });
});

describe("parseRulesPage", () => {
    const parsed = parseRulesPage(page);

    it("reads the title and the text before the first heading", () => {
        expect(parsed.title).toBe("Measuring Questions");
        expect(parsed.intro).toContain("Compared to me");
        expect(parsed.intro).toContain("**draw 3 cards and keep 1**");
    });

    it("splits the page into sections by heading", () => {
        expect(parsed.sections.map((s) => s.title)).toEqual([
            "Transit-Related",
            "Commercial Airport",
            "Station Name's Length",
            "For LARGE Sized Games, Add the Following:",
            "Zoos Within 15 Miles",
        ]);
        const airport = parsed.section("Commercial Airport");
        expect(airport?.slug).toBe("commercial-airport");
        expect(airport?.level).toBe(4);
        expect(airport?.body).toBe(
            "If there is any ambiguity, an airport is considered commercial.",
        );
        expect(parsed.section("zoos within 15 miles")?.body).toContain("zoo");
    });
});
