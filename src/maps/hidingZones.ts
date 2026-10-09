import { NotApplicableError } from "./errors";

/** Hiding-zone stations by default: train stations and the smaller halts. */
export const DEFAULT_STATION_FILTERS = ["[railway=station]", "[railway=halt]"];
export const TRAM_STOPS = "[railway=tram_stop]";
export const BOAT_STOPS = "[amenity=ferry_terminal]";

/** Adds or removes one kind of station from the hiding-zone filters. */
export const withStationKind = (
    filters: string[],
    kind: string,
    included: boolean,
): string[] => {
    if (included) return filters.includes(kind) ? filters : [...filters, kind];
    return filters.filter((filter) => filter !== kind);
};

/**
 * Runs `search` with a doubling radius until something is found, up to
 * `maxKm`. Throws NotApplicableError when nothing exists within reach,
 * instead of searching forever.
 */
export const expandingSearch = async <T>(
    search: (radiusKm: number) => Promise<T[]>,
    {
        startKm,
        maxKm,
        what = "matching places",
    }: { startKm: number; maxKm: number; what?: string },
) => {
    for (let radiusKm = startKm; ; radiusKm = Math.min(radiusKm * 2, maxKm)) {
        const found = await search(radiusKm);
        if (found.length > 0) return { found, radiusKm };
        if (radiusKm >= maxKm) break;
    }
    throw new NotApplicableError(`No ${what} within ${maxKm} km.`);
};
