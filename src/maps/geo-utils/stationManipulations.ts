import * as turf from "@turf/turf";

import type { StationPlace } from "@/maps/api/types";
import { UNREACHABLE_STATIONS } from "@/maps/datasets/stations";

/** Leaves out the stations players can't get to (datasets/stations.ts). */
export const withoutUnreachable = (places: StationPlace[]): StationPlace[] =>
    places.filter((place) => !(place.properties.id in UNREACHABLE_STATIONS));

/** How a stop ranks when several share a name: the railway station wins. */
const rank = (place: StationPlace) => {
    const tags = place.properties;
    if (tags.railway === "station") return 0;
    if (tags.railway === "halt") return 1;
    if (tags.railway === "tram_stop") return 2;
    if (tags.amenity === "ferry_terminal") return 3;
    return 4;
};

const nameOf = (place: StationPlace) =>
    (place.properties.name ?? "").trim().toLowerCase();

/**
 * One entry per real station. A station that is also a tram stop, a bus
 * stop or a boat stop, or one mapped more than once, appears several times
 * in the map data with the same name a few hundred metres apart; only one
 * is kept, preferring the railway station (so its id and train lines keep
 * working). Unnamed stops are all kept.
 */
export const dedupeStations = (
    places: StationPlace[],
    withinKm = 0.3,
): StationPlace[] => {
    const byName = new Map<string, StationPlace[]>();
    for (const place of places) {
        const name = nameOf(place);
        if (!name) continue;
        if (!byName.has(name)) byName.set(name, []);
        byName.get(name)!.push(place);
    }

    const kept = new Set<StationPlace>(places.filter((p) => !nameOf(p)));
    for (const group of byName.values()) {
        const chosen: StationPlace[] = [];
        for (const place of [...group].sort((a, b) => rank(a) - rank(b))) {
            const near = chosen.some(
                (other) =>
                    turf.distance(place, other, { units: "kilometers" }) <=
                    withinKm,
            );
            if (!near) chosen.push(place);
        }
        for (const place of chosen) kept.add(place);
    }
    return places.filter((place) => kept.has(place));
};
