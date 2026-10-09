import osmtogeojson from "osmtogeojson";

import {
    customStations as customStationsAtom,
    displayHidingZones,
    displayHidingZonesOptions,
    hidingRadius,
    hidingRadiusUnits,
    includeDefaultStations as includeDefaultStationsAtom,
    useCustomStations as useCustomStationsAtom,
} from "@/lib/context";
import {
    findPlacesInZone,
    normalizeToStationFeatures,
    type StationPlace,
} from "@/maps/api";

// The stations hiding zones are drawn around, from the map data and/or a
// custom list, as chosen in the hiding zone sidebar.

const customStationPlaces = (): StationPlace[] =>
    normalizeToStationFeatures(customStationsAtom.get()).features.map(
        (f) =>
            ({
                type: "Feature",
                geometry: f.geometry,
                properties: {
                    id:
                        f.properties?.id ||
                        `${f.geometry.coordinates[1]},${f.geometry.coordinates[0]}`,
                    name: f.properties?.name,
                },
            }) as StationPlace,
    );

/** Stations to draw hiding zones around: map data, custom imports, or both. */
export const loadStationPlaces = async (): Promise<StationPlace[]> => {
    const useCustom = useCustomStationsAtom.get();
    if (useCustom && !includeDefaultStationsAtom.get()) {
        return customStationPlaces();
    }

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

    if (!useCustom || customStationsAtom.get().length === 0) return places;

    // Merge custom stations in, dropping duplicates by OSM id or position.
    const seen = new Set<string>();
    const merged: StationPlace[] = [];
    for (const feat of [...places, ...customStationPlaces()]) {
        const id = feat.properties.id as string | undefined;
        const key =
            id && id.includes("/")
                ? `id:${id}`
                : `pt:${feat.geometry.coordinates[1]},${feat.geometry.coordinates[0]}`;
        if (!seen.has(key)) {
            seen.add(key);
            merged.push(feat);
        }
    }
    return merged;
};

/** Changes whenever the hiding zone settings change (for caches). */
export const hidingZoneKey = () =>
    JSON.stringify({
        on: displayHidingZones.get(),
        radius: hidingRadius.get(),
        units: hidingRadiusUnits.get(),
        options: displayHidingZonesOptions.get(),
        custom: useCustomStationsAtom.get(),
        includeDefault: includeDefaultStationsAtom.get(),
        stations: customStationsAtom.get().length,
    });
