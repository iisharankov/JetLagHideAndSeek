import type { ReactNode } from "react";

import { SidebarGroup, SidebarMenu } from "@/components/ui/sidebar-l";
import type { TutorialStepId } from "@/lib/tutorial";
import { STATION_NAME_RULES } from "@/maps/stationNames";

import {
    MatchingQuestionComponent,
    MeasuringQuestionComponent,
    RadiusQuestionComponent,
    TentacleQuestionComponent,
    ThermometerQuestionComponent,
} from "./QuestionCards";

export interface TutorialStep {
    id: TutorialStepId;
    title: string;
    content: ReactNode;
    /** CSS selector of the element to highlight. */
    targetSelector?: string;
    /** Where to put the dialog relative to the highlighted element. */
    position?: "top" | "bottom" | "center";
    /** Rich content (example cards) can't sit inside a description paragraph. */
    isDescription?: boolean;
}

// Example questions are placed at Zürich HB.
const LAT = 47.3779;
const LNG = 8.5403;

const Example = ({ children }: { children: ReactNode }) => (
    <SidebarGroup className="text-foreground">
        <SidebarMenu>{children}</SidebarMenu>
    </SidebarGroup>
);

export const tutorialSteps: TutorialStep[] = [
    {
        id: "welcome",
        title: "Welcome!",
        content: (
            <>
                This map tool is for Jet Lag: The Game&apos;s Hide and Seek.
                Seekers add each question and its answer, and the map shades
                every place the hider can no longer be.
                <br />
                <br />
                The usual flow: <strong>choose the play area</strong>,{" "}
                <strong>add questions</strong> as they&apos;re asked,{" "}
                <strong>share</strong> the game with your team, and let the
                hider use <strong>hider mode</strong> to answer automatically.
                <br />
                <br />
                This takes about two minutes. You can skip it and reopen it any
                time with the Tutorial button.
            </>
        ),
        position: "center",
    },
    {
        id: "place-picker",
        title: "Choose the play area",
        content: (
            <>
                <strong>Menu → Game → Change game settings</strong>: search for
                the area you&apos;re playing in (a city, a canton, a whole
                country) or draw it on the map. <strong>+</strong> adds an area,{" "}
                <strong>−</strong> cuts one out (a lake, a neighbouring canton).
                <br />
                <br />
                Small games work well in a city (e.g. Zürich), medium games in a
                canton, and large games across all of Switzerland.
            </>
        ),
        targetSelector: '[data-tutorial-id="menu-button"]',
        position: "bottom",
    },
    {
        id: "open-sidebar",
        title: "Adding questions",
        content: (
            <>
                Questions live in the panel this button opens (on a phone it
                slides up from the bottom and leaves the map in view). Its
                Stations tab shows the hiding zones and the stations still in
                play.
                <br />
                <br />
                Shortcut: right-click the map (long-press on a phone) to add a
                question right at that spot.
            </>
        ),
        targetSelector: '[data-tutorial-id="left-sidebar-trigger"]',
        position: "bottom",
    },
    {
        id: "question-types",
        title: "The five question types",
        content: (
            <>
                <strong>Radius:</strong> is the hider within a distance of a
                point?
                <br />
                <strong>Thermometer:</strong> did the seekers get closer to or
                further from the hider?
                <br />
                <strong>Tentacles:</strong> which place of a kind (zoo, museum…)
                is the hider nearest to?
                <br />
                <strong>Matching:</strong> is the hider in the same canton,
                nearest the same airport, at a station starting with the same
                letter…?
                <br />
                <strong>Measuring:</strong> is the hider closer to a feature (a
                border, a station, a McDonald&apos;s…) than the seeker?
                <br />
                <br />
                If a question can&apos;t be applied, its card says why, in red
                (an error) or amber (doesn&apos;t apply here).
            </>
        ),
        targetSelector: '[data-tutorial-id="add-questions-buttons"]',
        position: "top",
    },
    {
        id: "radius",
        title: "Radius",
        content: (
            <>
                Set the distance and whether the hider is inside or outside it.
                Drag the pin on the map or enter coordinates, or use your
                current location.
                <br />
                <br />
                <Example>
                    <RadiusQuestionComponent
                        questionKey={Math.random()}
                        data={{
                            collapsed: false,
                            drag: true,
                            hidden: false,
                            lat: LAT,
                            lng: LNG,
                            radius: 5,
                            unit: "kilometers",
                            color: "blue",
                            within: false,
                        }}
                    />
                </Example>
                <br />
                The lock stops accidental edits; the eye hides a question
                without deleting it.
            </>
        ),
        isDescription: false,
        position: "center",
    },
    {
        id: "thermometer",
        title: "Thermometer",
        content: (
            <>
                Put the start and end where the seekers were.
                &ldquo;Warmer&rdquo; keeps the half of the map closer to the end
                point.
                <br />
                <br />
                <Example>
                    <ThermometerQuestionComponent
                        questionKey={Math.random()}
                        data={{
                            collapsed: false,
                            drag: true,
                            hidden: false,
                            latA: LAT,
                            lngA: LNG,
                            latB: 47.3667,
                            lngB: 8.55,
                            colorA: "red",
                            colorB: "blue",
                            warmer: false,
                        }}
                    />
                </Example>
            </>
        ),
        isDescription: false,
        position: "center",
    },
    {
        id: "tentacles",
        title: "Tentacles",
        content: (
            <>
                Choose the kind of place and the radius, then pick the place the
                hider named. The app finds all such places within the radius and
                keeps only the area nearest to the named one.
                <br />
                <br />
                <Example>
                    <TentacleQuestionComponent
                        questionKey={Math.random()}
                        data={{
                            collapsed: false,
                            drag: true,
                            hidden: false,
                            lat: LAT,
                            lng: LNG,
                            radius: 25,
                            unit: "kilometers",
                            color: "red",
                            locationType: "zoo",
                            location: false,
                        }}
                    />
                </Example>
            </>
        ),
        isDescription: false,
        position: "center",
    },
    {
        id: "matching",
        title: "Matching",
        content: (
            <>
                <strong>Zone questions</strong> list the areas that exist at the
                pin by name (canton, district, municipality). Where a level
                doesn&apos;t exist, the question is marked as not applicable.
                <br />
                <br />
                <strong>Station-name questions</strong> (first letter, name
                length, train line) need hiding zones turned on.{" "}
                {STATION_NAME_RULES}
                <br />
                <br />
                <Example>
                    <MatchingQuestionComponent
                        questionKey={Math.random()}
                        data={{
                            collapsed: false,
                            drag: true,
                            hidden: false,
                            lat: LAT,
                            lng: LNG,
                            color: "blue",
                            same: true,
                            type: "airport",
                        }}
                    />
                </Example>
            </>
        ),
        isDescription: false,
        position: "center",
    },
    {
        id: "measuring",
        title: "Measuring",
        content: (
            <>
                Is the hider closer to something than the seeker? For example a
                canton border, an airport, a train station or a McDonald&apos;s.
                <br />
                <br />
                Border questions measure to the nearest border of the chosen
                level, wherever the hider is.
                <br />
                <br />
                <Example>
                    <MeasuringQuestionComponent
                        questionKey={Math.random()}
                        data={{
                            collapsed: false,
                            drag: true,
                            hidden: false,
                            lat: LAT,
                            lng: LNG,
                            color: "green",
                            hiderCloser: true,
                            type: "airport",
                        }}
                    />
                </Example>
            </>
        ),
        isDescription: false,
        position: "center",
    },
    {
        id: "menu",
        title: "Menu",
        content: (
            <>
                Everything else is in the <strong>Menu</strong>:
                <br />
                <strong>Game:</strong> start a <strong>shared game</strong>{" "}
                (everyone, hider included, opens the same link and sees
                questions live; seekers&apos; drafts stay hidden from the hider
                until sent), share a copy, save or load a file, the rules, the
                question &amp; card reference and this tutorial.
                <br />
                <strong>I&apos;m the hider</strong> (in Game) turns your phone
                into the hider&apos;s.
                <br />
                <strong>Settings:</strong> local rules (Swiss adaptations switch
                on automatically for Swiss play areas), planning mode, map
                options.
            </>
        ),
        targetSelector: '[data-tutorial-id="menu-button"]',
        position: "top",
    },
    {
        id: "hider-mode",
        title: "Hider mode",
        content: (
            <>
                The hider opens the game link and, in{" "}
                <strong>Menu → Game</strong>, switches on{" "}
                <strong>I&apos;m the hider</strong> (with a password the seekers
                don&apos;t know). The sidebar&apos;s Stations tab becomes the
                Hider tab: pick your station there; the red circle is your
                hiding zone. The app then suggests each answer from that station
                (from your pin, once the seekers find the station); nothing is
                sent until the hider taps it.
                <br />
                <br />
                The hider&apos;s position never leaves their phone: only the
                answers are shared.
            </>
        ),
        position: "center",
    },
    {
        id: "done",
        title: "You're ready",
        content: (
            <>
                Map data comes from OpenStreetMap, so it&apos;s only as complete
                as the map: double-check anything that decides a game.
                <br />
                <br />
                Have fun hiding and seeking!
            </>
        ),
        position: "center",
    },
];
