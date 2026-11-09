import { describe, expect, it } from "vitest";

import { sectionLabel, sidebarSections } from "@/lib/game/tabBadges";

const base = {
    hider: false,
    noStationYet: false,
    stationsTab: true,
    waitingQuestions: 0,
    waitingPhotos: 0,
    activeCurses: 0,
    research: 0,
};

describe("the tab bar's sections", () => {
    it("are Questions, Cards and Stations for a seeker, with counts (photos are questions)", () => {
        const sections = sidebarSections({
            ...base,
            waitingPhotos: 1,
            activeCurses: 2,
        });
        expect(sections.map(sectionLabel)).toEqual([
            "Questions",
            "Cards (2)",
            "Stations",
        ]);
        // No Stations when the game keeps them to the hider.
        expect(
            sidebarSections({ ...base, stationsTab: false }).map((s) => s.name),
        ).not.toContain("Stations");
    });

    it("are the Hider tab and Research only, while the hider picks a station", () => {
        expect(
            sidebarSections({
                ...base,
                hider: true,
                noStationYet: true,
                research: 2,
            }).map(sectionLabel),
        ).toEqual(["Hider", "Research (2)"]);
        // The hider's Questions count what waits for an answer: questions
        // and photos.
        expect(
            sidebarSections({
                ...base,
                hider: true,
                waitingQuestions: 3,
                waitingPhotos: 1,
            }).map(sectionLabel),
        ).toEqual(["Questions (4)", "Cards", "Hider"]);
    });
});
