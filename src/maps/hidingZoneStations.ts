import osmtogeojson from "osmtogeojson";

import {
    displayHidingZones,
    displayHidingZonesOptions,
    hidingRadius,
    hidingRadiusUnits,
} from "@/lib/context";
import { findPlacesInZone, type StationPlace } from "@/maps/api";
import { dedupeStations } from "@/maps/geo-utils/stationManipulations";

/**
 * The stations hiding zones are drawn around: the kinds chosen in the game
 * settings, one entry per real station (a station that is also a tram stop
 * counts once).
 */
export const loadStationPlaces = async (): Promise<StationPlace[]> => {
    const options = displayHidingZonesOptions.get();
    // @ts-expect-error osmtogeojson always defines properties with an "id" string
    const places: StationPlace[] = osmtogeojson(
        await findPlacesInZone(
            options[0],
            "Finding stations. This may take a while. Don't worry, it will be cached.",
            "nwr",
            "center",
            options.slice(1),
        ),
    ).features;
    return dedupeStations(places);
};

/** Changes whenever the hiding zone settings change (for caches). */
export const hidingZoneKey = () =>
    JSON.stringify({
        on: displayHidingZones.get(),
        radius: hidingRadius.get(),
        units: hidingRadiusUnits.get(),
        options: displayHidingZonesOptions.get(),
    });
