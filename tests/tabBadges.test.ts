import { describe, expect, it } from "vitest";

import { sectionLabel, sidebarSections } from "@/lib/game/tabBadges";

const base = {
    hider: false,
    stationsTab: true,
    waitingQuestions: 0,
    waitingPhotos: 0,
    activeCurses: 0,
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

    it("are the same while the hider picks a station: the seekers' questions are there already (research is a toggle inside)", () => {
        expect(
            // (Whether the station is set doesn't change them any more.)
            sidebarSections({
                ...base,
                hider: true,
                waitingQuestions: 1,
            }).map(sectionLabel),
        ).toEqual(["Questions (1)", "Cards", "Hider"]);
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
