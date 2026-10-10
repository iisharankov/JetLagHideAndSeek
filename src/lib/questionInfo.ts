// Every question type: its rulebook section (shown by the ⓘ buttons and the
// question reference page) and a note on how this app works it out.
import type { RuleRef } from "@/lib/rules/content";

export type QuestionCategory =
    | "radius"
    | "thermometer"
    | "tentacles"
    | "matching"
    | "measuring";

export interface CategoryInfo {
    name: string;
    /** What the app does with the answer. */
    app: string;
    rules: RuleRef;
}

export const CATEGORIES: Record<QuestionCategory, CategoryInfo> = {
    radius: {
        name: "Radar",
        app: "Yes keeps the circle around the seeker; no removes it.",
        rules: { page: "seeking/radar-questions" },
    },
    thermometer: {
        name: "Thermometer",
        app: "Splits the map halfway between the two points and keeps the side the answer points to.",
        rules: { page: "seeking/thermometer-questions" },
    },
    tentacles: {
        name: "Tentacles",
        app: "Keeps the part of the circle that is closest to the place the hider names. The card lists the places in reach.",
        rules: { page: "seeking/tentacle-questions" },
    },
    matching: {
        name: "Matching",
        app: "Same keeps the area whose nearest place (or zone) is the seeker's; different removes it.",
        rules: { page: "seeking/matching-questions" },
    },
    measuring: {
        name: "Measuring",
        app: "Closer keeps everywhere nearer to such a place than the seeker is; further keeps the rest.",
        rules: { page: "seeking/measuring-questions" },
    },
};

export interface TypeInfo {
    label: string;
    /** How the app answers this type, where that needs saying. */
    note?: string;
    rules?: RuleRef;
}

const AIRPORT_NOTE =
    "Counts the airports on the app's list of airports with international flights (src/maps/datasets/airports.ts), including ones across the border such as Basel-Mulhouse, Milan or Munich.";
const CITY_NOTE =
    "Not in the rulebook. A major city has 1,000,000+ people, or 100,000+ under the Swiss rules (Zürich, Geneva, Basel, Lausanne, Bern, Winterthur). Cities across the border count too.";
const ALL_PLACES_NOTE =
    "Every such place counts, including ones just outside the play area, so the answer is right near the edges.";
const ZONE_MODE_NOTE =
    "Worked out per station, with the hiding zones on (Stations tab).";
const STATION_NOTE =
    "Uses each player's nearest train station (halts count). Names are as on the station sign; accents don't matter for first letters.";

/** Places of interest, as matching and measuring types. */
const PLACES: [string, string, string][] = [
    // type, label, rulebook heading
    ["aquarium", "Aquarium", "Aquarium"],
    ["zoo", "Zoo", "Zoo"],
    ["theme_park", "Amusement park", "Amusement Park"],
    ["peak", "Mountain", "Mountain"],
    ["museum", "Museum", "Museum"],
    ["hospital", "Hospital", "Hospital"],
    ["cinema", "Movie theater", "Movie Theater"],
    ["library", "Library", "Library"],
    ["golf_course", "Golf course", "Golf Course"],
    ["consulate", "Foreign consulate", "Foreign Consulate"],
    ["park", "Park", "Park"],
];

const placeTypes = (page: RuleRef["page"]) =>
    Object.fromEntries(
        PLACES.flatMap(([type, label, heading]) => [
            [
                `${type}-full`,
                {
                    label,
                    note: ALL_PLACES_NOTE,
                    rules: { page, heading },
                },
            ],
        ]),
    ) as Record<string, TypeInfo>;

const MATCHING = "seeking/matching-questions";
const MEASURING = "seeking/measuring-questions";
const TENTACLES = "seeking/tentacle-questions";

export const TYPES: Record<
    "matching" | "measuring" | "tentacles",
    Record<string, TypeInfo>
> = {
    matching: {
        airport: {
            label: "Commercial airport",
            note: AIRPORT_NOTE,
            rules: { page: MATCHING, heading: "Commercial Airport" },
        },
        "major-city": { label: "Major city", note: CITY_NOTE },
        zone: {
            label: "Same zone",
            note: "Whether the hider is in the same canton, district or municipality (choose the level: 1st, 2nd, 3rd or 4th division). The seeker's zone is outlined on the map.",
            rules: { page: MATCHING, heading: "1st Administrative Division" },
        },
        "letter-zone": {
            label: "Zone starting with the same letter",
            note: "Not in the rulebook. Whether the hider's zone (of the chosen level) starts with the same letter as the seeker's. Accents don't matter.",
        },
        "same-first-letter-station": {
            label: "Station starting with the same letter",
            note: `Not in the rulebook. ${STATION_NOTE}`,
        },
        "same-length-station": {
            label: "Station name length",
            note: `${STATION_NOTE} Length counts every character, spaces and "/" included.`,
            rules: { page: MATCHING, heading: "Station Name's Length" },
        },
        "same-train-line": {
            label: "Station on the same train line",
            note: "Whether the hider's nearest station is on a train line (S-Bahn, regional or long-distance service) that stops at the seeker's nearest station.",
            rules: { page: MATCHING, heading: "Transit Line" },
        },
        "custom-zone": {
            label: "Custom zone",
            note: "Draw the zone yourself on the map.",
        },
        "custom-points": {
            label: "Custom places",
            note: "Place the points yourself; nearest-point areas are drawn around them.",
        },
        ...placeTypes(MATCHING),
    },
    measuring: {
        airport: {
            label: "Commercial airport",
            note: AIRPORT_NOTE,
            rules: { page: MEASURING, heading: "Commercial Airport" },
        },
        city: { label: "Major city", note: CITY_NOTE },
        "highspeed-measure-shinkansen": {
            label: "High-speed rail line",
            note: "Distance to the nearest railway tagged as high-speed in OpenStreetMap.",
            rules: { page: MEASURING, heading: "High-Speed Train Line" },
        },
        "admin-measure": {
            label: "Admin border",
            note: "Distance to the nearest border of the chosen level (country, canton, district, municipality): for everyone that's the edge of the zone they're in. With hiding zones on, the answer only shades inside the zones.",
            rules: {
                page: MEASURING,
                heading: "1st Administrative Division Border",
            },
        },
        lake: {
            label: "Lake shore",
            note: "Distance to the shore of the nearest lake of at least the chosen size (10 km² unless changed). The app's version of the body of water question.",
            rules: { page: MEASURING, heading: "Body of Water" },
        },
        "sea-level": {
            label: "Altitude (higher or lower)",
            note: "Compares the hider's altitude with the seeker's. The seeker's altitude is the ground height at their pin unless you type in your phone's reading. Ground heights come from free elevation data (about 50–200 m detail), so near the boundary the answer may be off.",
            rules: { page: MEASURING, heading: "Sea Level" },
        },
        coastline: {
            label: "Coastline",
            rules: { page: MEASURING, heading: "Coastline" },
        },
        "rail-measure": {
            label: "Train station",
            note: `${ZONE_MODE_NOTE} Distance to the nearest station among the hiding-zone stations.`,
            rules: { page: MEASURING, heading: "Rail Station" },
        },
        mcdonalds: {
            label: "McDonald's",
            note: `Not in the rulebook. ${ZONE_MODE_NOTE}`,
        },
        seven11: {
            label: "7-Eleven",
            note: `Not in the rulebook. ${ZONE_MODE_NOTE}`,
        },
        "custom-measure": {
            label: "Custom places",
            note: "Draw the places yourself on the map.",
        },
        ...placeTypes(MEASURING),
    },
    tentacles: {
        museum: {
            label: "Museums",
            rules: { page: TENTACLES, heading: "Museums Within 1 Mile" },
        },
        library: {
            label: "Libraries",
            rules: { page: TENTACLES, heading: "Libraries Within 1 Mile" },
        },
        cinema: {
            label: "Movie theaters",
            rules: { page: TENTACLES, heading: "Movie Theaters Within 1 Mile" },
        },
        hospital: {
            label: "Hospitals",
            rules: { page: TENTACLES, heading: "Hospitals Within 1 Mile" },
        },
        zoo: {
            label: "Zoos",
            rules: { page: TENTACLES, heading: "Zoos Within 15 Miles" },
        },
        aquarium: {
            label: "Aquariums",
            rules: { page: TENTACLES, heading: "Aquariums Within 15 Miles" },
        },
        theme_park: {
            label: "Amusement parks",
            rules: {
                page: TENTACLES,
                heading: "Amusement Parks Within 15 Miles",
            },
        },
        custom: {
            label: "Custom places",
            note: "Place the points yourself.",
        },
    },
};

/** Everything the ⓘ button shows for a question. */
export const questionInfo = (category: QuestionCategory, type?: string) => ({
    category: CATEGORIES[category],
    type:
        type &&
        (category === "matching" ||
            category === "measuring" ||
            category === "tentacles")
            ? TYPES[category][type]
            : undefined,
});
