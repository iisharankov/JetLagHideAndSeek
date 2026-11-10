// The sidebar's sections (the phone's tab bar, the desktop's tabs): which
// exist now, and the count each shows. Pure, so the rules are tested once.
import type { SidebarTab } from "@/lib/context";

export interface SectionInput {
    /** This phone is the hider's. */
    hider: boolean;
    /** The Stations (seekers) or Hider tab exists. */
    stationsTab: boolean;
    /** Questions waiting for the hider's answer (hider only). */
    waitingQuestions: number;
    /** Photo questions not answered yet (in the hider's Questions count). */
    waitingPhotos: number;
    /** Curses in force. */
    activeCurses: number;
}

export interface Section {
    value: Exclude<SidebarTab, "menu" | "research">;
    name: string;
    count: number;
}

/**
 * The same sections with or without the hider's station (round 41): the
 * seekers may ask before the hider has settled, and the hider's research
 * is a toggle inside Questions.
 */
export const sidebarSections = (input: SectionInput): Section[] => [
    {
        value: "questions",
        name: "Questions",
        // The hider's: what waits for an answer, photos included.
        count: input.waitingQuestions + (input.hider ? input.waitingPhotos : 0),
    },
    { value: "curses", name: "Cards", count: input.activeCurses },
    ...(input.stationsTab
        ? [
              {
                  value: "stations" as const,
                  name: input.hider ? "Hider" : "Stations",
                  count: 0,
              },
          ]
        : []),
];

/** "Questions (2)": what a screen reader hears, and what the tests find. */
export const sectionLabel = (section: Section) =>
    section.count > 0 ? `${section.name} (${section.count})` : section.name;
