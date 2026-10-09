// The settings of a game, decided before it starts (Menu → Game) and fixed
// while it runs. Shared with the server, which enforces the lock.
import type { GameSettings, GameSize, StationKinds } from "./types";

export const GAME_SIZES: GameSize[] = ["small", "medium", "large"];

/** Radar question default (km) by game size. */
export const radarDefaultKm = (size: GameSize) =>
    ({ small: 2, medium: 10, large: 50 })[size];

/** Hiding zone radius (km) by game size: ¼ mile → 500 m, ½ mile → 1 km. */
export const hidingRadiusDefaultKm = (size: GameSize) =>
    size === "large" ? 1 : 0.5;

export const LAKE_AREA_CHOICES = [10, 20, 25, 50];

/** "matching:zone", "measuring:coastline"…: one question type. */
export const questionKey = (category: string, type: string) =>
    `${category}:${type}`;

/** Question types a region's rules leave out. */
export const regionDisabledQuestions = (region: GameSettings["region"]) =>
    region === "switzerland"
        ? // Landlocked, and there are no 7-Elevens.
          [
              questionKey("measuring", "coastline"),
              questionKey("measuring", "seven11"),
          ]
        : // Lake shores stand in for the coast only under the Swiss rules.
          [questionKey("measuring", "lake")];

export const defaultGameSettings = (
    size: GameSize = "medium",
    region: GameSettings["region"] = "switzerland",
): GameSettings => ({
    size,
    region,
    hidingRadiusKm: hidingRadiusDefaultKm(size),
    stationKinds: { halts: true, trams: false, boats: false },
    minLakeAreaKm2: 10,
    disabledQuestions: regionDisabledQuestions(region),
    seekersCanAnswer: false,
});

/** The hiding-zone station filters (Overpass style) for the station kinds. */
export const stationFilters = (kinds: StationKinds) => [
    "[railway=station]",
    ...(kinds.halts ? ["[railway=halt]"] : []),
    ...(kinds.trams ? ["[railway=tram_stop]"] : []),
    ...(kinds.boats ? ["[amenity=ferry_terminal]"] : []),
];

/** The station kinds behind a list of filters (e.g. from an old saved game). */
export const stationKindsFromFilters = (filters: string[]): StationKinds => ({
    halts: filters.includes("[railway=halt]"),
    trams: filters.includes("[railway=tram_stop]"),
    boats: filters.includes("[amenity=ferry_terminal]"),
});

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
        stationKinds: {
            halts: kinds.halts ?? defaults.stationKinds.halts,
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
    };
};

/** One line describing the settings, e.g. for the sidebar. */
export const describeStations = (kinds: StationKinds) =>
    [
        "trains",
        kinds.halts && "halts",
        kinds.trams && "trams",
        kinds.boats && "boats",
    ]
        .filter(Boolean)
        .join(", ");
