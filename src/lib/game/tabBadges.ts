// The sidebar's sections (the phone's tab bar, the desktop's tabs): which
// exist now, and the count each shows. Pure, so the rules are tested once.
import type { SidebarTab } from "@/lib/context";

export interface SectionInput {
    /** This phone is the hider's. */
    hider: boolean;
    /** The hider has no station yet: only the Hider tab and Research. */
    noStationYet: boolean;
    /** The Stations (seekers) or Hider tab exists. */
    stationsTab: boolean;
    /** Questions waiting for the hider's answer (hider only). */
    waitingQuestions: number;
    /** Photo questions not answered yet (in the hider's Questions count). */
    waitingPhotos: number;
    /** Curses in force. */
    activeCurses: number;
    /** The hider's research questions. */
    research: number;
}

export interface Section {
    value: Exclude<SidebarTab, "menu">;
    name: string;
    count: number;
}

export const sidebarSections = (input: SectionInput): Section[] =>
    input.noStationYet
        ? [
              { value: "stations", name: "Hider", count: 0 },
              { value: "research", name: "Research", count: input.research },
          ]
        : [
              {
                  value: "questions",
                  name: "Questions",
                  // The hider's: what waits for an answer, photos included.
                  count:
                      input.waitingQuestions +
                      (input.hider ? input.waitingPhotos : 0),
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
