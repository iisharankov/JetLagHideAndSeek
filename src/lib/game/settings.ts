// The settings of a game, decided before it starts (Menu → Game) and fixed
// while it runs. Shared with the server, which enforces the lock.
import type {
    CustomCard,
    GameSettings,
    GameSize,
    RejectedPlace,
    StationKinds,
} from "./types";

export const GAME_SIZES: GameSize[] = ["small", "medium", "large"];

/** The metric investigation book's radar distances, in km. */
export const RADAR_KM = [0.5, 1, 2, 5, 10, 15, 40, 80, 160];

/**
 * The radar distances that fit a game size (a town, a canton, a country);
 * the setup screens let the players change the list.
 */
export const radarDefaults = (size: GameSize): number[] =>
    ({
        small: [0.5, 1, 2, 5],
        medium: [1, 2, 5, 10, 15, 40],
        large: [5, 10, 15, 40, 80, 160],
    })[size];

/** A new radar question's distance (km) by game size. */
export const radarDefaultKm = (size: GameSize) =>
    ({ small: 2, medium: 10, large: 40 })[size];

/** Hiding zone radius (km) by game size: ¼ mile → 500 m, ½ mile → 1 km. */
export const hidingRadiusDefaultKm = (size: GameSize) =>
    size === "large" ? 1 : 0.5;

export const LAKE_AREA_CHOICES = [10, 20, 25, 50];

/** "matching:zone", "measuring:coastline"…: one question type. */
export const questionKey = (category: string, type: string) =>
    `${category}:${type}`;

/** The place kinds matching and measuring questions use. */
export const PLACE_TYPES = [
    "aquarium",
    "zoo",
    "theme_park",
    "peak",
    "museum",
    "hospital",
    "cinema",
    "library",
    "golf_course",
    "consulate",
    "park",
];

/** Mountain questions: too many unnamed peaks to know which one is meant. */
export const ALWAYS_OFF = [
    questionKey("matching", "peak-full"),
    questionKey("measuring", "peak-full"),
];

/** Question types a region's rules leave out. */
export const regionDisabledQuestions = (region: GameSettings["region"]) => [
    ...ALWAYS_OFF,
    ...(region === "switzerland"
        ? // Landlocked, and there are no 7-Elevens.
          [
              questionKey("measuring", "coastline"),
              questionKey("measuring", "seven11"),
          ]
        : // Lake shores stand in for the coast only under the Swiss rules.
          [questionKey("measuring", "lake")]),
];

export const defaultGameSettings = (
    size: GameSize = "medium",
    region: GameSettings["region"] = "switzerland",
): GameSettings => ({
    size,
    region,
    hidingRadiusKm: hidingRadiusDefaultKm(size),
    radarKm: radarDefaults(size),
    stationKinds: { trams: false, boats: false },
    minLakeAreaKm2: 10,
    disabledQuestions: regionDisabledQuestions(region),
    seekersCanAnswer: false,
    deck: "real",
    deckCounts: {},
    customCards: [],
    cardPopups: "important",
    seekersSeeStations: true,
    latePenalty: true,
    tentacleKm: tentacleDefaults(region),
    rejectedPlaces: [],
});

const MAX_REJECTED = 2000;

const normalizeRejected = (value: unknown): RejectedPlace[] =>
    (Array.isArray(value) ? value : [])
        .filter(
            (entry): entry is RejectedPlace =>
                !!entry &&
                typeof entry === "object" &&
                typeof entry.kind === "string" &&
                typeof entry.name === "string" &&
                Number.isFinite(entry.lat) &&
                Number.isFinite(entry.lng),
        )
        .slice(0, MAX_REJECTED)
        .map((entry) => ({
            kind: entry.kind.slice(0, 40),
            name: entry.name.slice(0, 120),
            lat: entry.lat,
            lng: entry.lng,
        }));

/** Tentacle distances (km): 2 and 10 under the Swiss rules, else 2 and 25. */
export const tentacleDefaults = (
    region: GameSettings["region"],
): [number, number] => (region === "switzerland" ? [2, 10] : [2, 25]);

const normalizeTentacleKm = (value: unknown): [number, number] | undefined => {
    if (!Array.isArray(value) || value.length !== 2) return undefined;
    const [small, large] = value.map(Number);
    return Number.isFinite(small) &&
        Number.isFinite(large) &&
        small > 0 &&
        large > 0
        ? [small, large]
        : undefined;
};

const MAX_COPIES = 40;
const MAX_PHOTO_CHARS = 200_000;

/** A sensible count of copies, or undefined. */
const copies = (value: unknown) => {
    const count = Number(value);
    return Number.isInteger(count) && count >= 0 && count <= MAX_COPIES
        ? count
        : undefined;
};

const normalizeCustomCard = (raw: unknown): CustomCard | undefined => {
    const card = (raw ?? {}) as Partial<Record<keyof CustomCard, unknown>>;
    if (typeof card.id !== "string" || typeof card.name !== "string") {
        return undefined;
    }
    const kind =
        card.kind === "time" || card.kind === "powerup" ? card.kind : "curse";
    const minutes = Array.isArray(card.minutes)
        ? (card.minutes.slice(0, 3).map(Number) as number[])
        : [];
    const photo =
        typeof card.photo === "string" &&
        card.photo.startsWith("data:image/") &&
        card.photo.length <= MAX_PHOTO_CHARS
            ? card.photo
            : undefined;
    return {
        id: card.id.slice(0, 40),
        kind,
        name: card.name.trim().slice(0, 60) || "Custom card",
        text: typeof card.text === "string" ? card.text.slice(0, 600) : "",
        count: copies(card.count) ?? 1,
        ...(kind === "time" &&
        minutes.length === 3 &&
        minutes.every((m) => Number.isFinite(m) && m >= 0 && m <= 600)
            ? { minutes: minutes as [number, number, number] }
            : {}),
        ...(photo ? { photo } : {}),
    };
};

/**
 * The hiding-zone station filters (Overpass style) for the station kinds.
 * A train station is a train station whether every train stops there or
 * not, so the halts are always in.
 */
export const stationFilters = (kinds: StationKinds) => [
    "[railway=station]",
    "[railway=halt]",
    ...(kinds.trams ? ["[railway=tram_stop]"] : []),
    ...(kinds.boats ? ["[amenity=ferry_terminal]"] : []),
];

/** The station kinds behind a list of filters (e.g. from an old saved game). */
export const stationKindsFromFilters = (filters: string[]): StationKinds => ({
    trams: filters.includes("[railway=tram_stop]"),
    boats: filters.includes("[amenity=ferry_terminal]"),
});

/** A list of radar distances in km, sorted and without repeats, or undefined. */
const normalizeRadii = (value: unknown): number[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    const radii = [
        ...new Set(
            value
                .map(Number)
                .filter((km) => Number.isFinite(km) && km > 0 && km <= 1000),
        ),
    ]
        .sort((a, b) => a - b)
        .slice(0, 12);
    return radii.length > 0 ? radii : undefined;
};

const isSize = (value: unknown): value is GameSize =>
    GAME_SIZES.includes(value as GameSize);

/**
 * Settings as received (from a phone, a saved game or an old version):
 * anything missing or unusable gets the default.
 */
export const normalizeGameSettings = (raw: unknown): GameSettings => {
    const input = (raw ?? {}) as Partial<Record<keyof GameSettings, unknown>>;
    const size = isSize(input.size) ? input.size : "medium";
    const region = input.region === "standard" ? "standard" : "switzerland";
    const defaults = defaultGameSettings(size, region);
    const kinds = (input.stationKinds ?? {}) as Partial<StationKinds>;
    const radius = Number(input.hidingRadiusKm);
    const lake = Number(input.minLakeAreaKm2);
    return {
        size,
        region,
        hidingRadiusKm:
            Number.isFinite(radius) && radius > 0 && radius <= 50
                ? radius
                : defaults.hidingRadiusKm,
        radarKm: normalizeRadii(input.radarKm) ?? defaults.radarKm,
        stationKinds: {
            trams: kinds.trams === true,
            boats: kinds.boats === true,
        },
        minLakeAreaKm2:
            Number.isFinite(lake) && lake > 0 ? lake : defaults.minLakeAreaKm2,
        disabledQuestions: Array.isArray(input.disabledQuestions)
            ? input.disabledQuestions
                  .filter((key): key is string => typeof key === "string")
                  .slice(0, 200)
            : defaults.disabledQuestions,
        seekersCanAnswer: input.seekersCanAnswer === true,
        deck: input.deck === "virtual" ? "virtual" : "real",
        deckCounts: Object.fromEntries(
            Object.entries((input.deckCounts ?? {}) as Record<string, unknown>)
                .map(([id, value]) => [id.slice(0, 60), copies(value)] as const)
                .filter(
                    (entry): entry is [string, number] =>
                        entry[1] !== undefined,
                )
                .slice(0, 200),
        ),
        customCards: (Array.isArray(input.customCards) ? input.customCards : [])
            .map(normalizeCustomCard)
            .filter((card): card is CustomCard => card !== undefined)
            .slice(0, 50),
        cardPopups: input.cardPopups === "all" ? "all" : "important",
        seekersSeeStations: input.seekersSeeStations !== false,
        latePenalty: input.latePenalty !== false,
        tentacleKm:
            normalizeTentacleKm(input.tentacleKm) ?? defaults.tentacleKm,
        rejectedPlaces: normalizeRejected(input.rejectedPlaces),
    };
};

/** One line describing the settings, e.g. for the sidebar. */
export const describeStations = (kinds: StationKinds) =>
    ["trains", kinds.trams && "trams", kinds.boats && "boats"]
        .filter(Boolean)
        .join(", ");

/** The big-place tentacle kinds (the book's 15 miles): parks, zoos, aquariums. */
export const BIG_TENTACLES = ["theme_park", "zoo", "aquarium"];

/**
 * The game's tentacle distance for a kind of place: the second figure for
 * the big places (amusement parks, zoos, aquariums), the first otherwise.
 */
export const tentacleRadiusKm = (
    locationType: string,
    km: [number, number] = [2, 25],
) => (BIG_TENTACLES.includes(locationType) ? km[1] : km[0]);
