import { convertLength } from "@turf/turf";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { z } from "zod";

import {
    additionalMapGeoLocations,
    type CustomPreset,
    disabledStations,
    mapGeoJSON,
    mapGeoLocation,
    polyGeoJSON,
} from "@/lib/context";
import { stationKindsFromFilters } from "@/lib/game/settings";
import type { GameSettings } from "@/lib/game/types";
import { updateGameSettings } from "@/lib/gameSettings";
import type { AdditionalMapGeoLocations, OpenStreetMap } from "@/maps/api";
import type { Questions } from "@/maps/schema";

// A shared game's play area (a place with areas added or cut out, or a
// drawn polygon) and the hiding zone settings that travel with it.

const settingsSchema = z.object({
    disabledStations: z.array(z.string()).nullish(),
    hidingRadius: z.number().positive().nullish(),
    hidingRadiusUnits: z.enum(["miles", "kilometers", "meters"]).nullish(),
    zoneOptions: z.array(z.string()).nullish(),
});

export type Settings = {
    [K in keyof z.infer<typeof settingsSchema>]?: NonNullable<
        z.infer<typeof settingsSchema>[K]
    >;
};

export interface SharedGame {
    playArea:
        | {
              kind: "place";
              location: OpenStreetMap;
              alternateLocations: AdditionalMapGeoLocations[];
          }
        | {
              kind: "polygon";
              polygon: FeatureCollection<Polygon | MultiPolygon>;
          };
    questions: Questions;
    settings: Settings;
    presets: CustomPreset[];
}

const isPolygon = (feature: any) =>
    feature?.geometry?.type === "Polygon" ||
    feature?.geometry?.type === "MultiPolygon";

const parseSettings = (raw: any): Settings => {
    const result = settingsSchema.safeParse(raw);
    if (!result.success) {
        throw new Error("The shared game has invalid hiding zone settings.");
    }
    return Object.fromEntries(
        Object.entries(result.data).filter(
            ([key, value]) =>
                value !== undefined && value !== null && key in raw,
        ),
    ) as Settings;
};

const placeLabel = (location: OpenStreetMap) =>
    [location.properties.name, location.properties.country]
        .filter(Boolean)
        .join(", ");

/**
 * The play area in words: the place it starts from, the places added to it
 * and the ones cut out of it (a lake, a neighbouring canton).
 */
export const playAreaParts = (playArea: SharedGame["playArea"]) => {
    if (playArea.kind !== "place") {
        return { base: "a drawn play area", added: [], removed: [] };
    }
    const named = (added: boolean) =>
        playArea.alternateLocations
            .filter((entry) => entry.added === added)
            .map((entry) => entry.location.properties.name ?? "a place");
    return {
        base: placeLabel(playArea.location),
        added: named(true),
        removed: named(false),
    };
};

/** "Zürich, Switzerland + Kilchberg − Zürichsee", or "a drawn play area". */
export const playAreaName = (playArea: SharedGame["playArea"]) => {
    const { base, added, removed } = playAreaParts(playArea);
    return [
        base,
        ...added.map((name) => `+ ${name}`),
        ...removed.map((name) => `− ${name}`),
    ].join(" ");
};

/** The play area as shared: a place (with added areas) or a drawn polygon. */
export const currentPlayArea = (): SharedGame["playArea"] => {
    const polygon = polyGeoJSON.get();
    return polygon
        ? { kind: "polygon", polygon }
        : {
              kind: "place",
              location: mapGeoLocation.get(),
              alternateLocations: additionalMapGeoLocations.get(),
          };
};

/** Checks a play area received from a shared game (throws if invalid). */
export const parsePlayArea = (raw: any): SharedGame["playArea"] => {
    if (
        raw?.kind === "place" &&
        raw.location?.geometry?.type === "Point" &&
        typeof raw.location?.properties?.osm_id === "number"
    ) {
        return {
            kind: "place",
            location: raw.location,
            alternateLocations: Array.isArray(raw.alternateLocations)
                ? raw.alternateLocations
                : [],
        };
    }
    if (
        raw?.kind === "polygon" &&
        raw.polygon?.type === "FeatureCollection" &&
        Array.isArray(raw.polygon.features) &&
        raw.polygon.features.every(isPolygon)
    ) {
        return { kind: "polygon", polygon: raw.polygon };
    }
    throw new Error("The shared game's play area is invalid.");
};

/** Switches to a shared play area. */
export const applyPlayArea = (playArea: SharedGame["playArea"]) => {
    if (playArea.kind === "place") {
        mapGeoLocation.set(playArea.location);
        additionalMapGeoLocations.set(playArea.alternateLocations);
        polyGeoJSON.set(null);
    } else {
        polyGeoJSON.set(playArea.polygon);
    }
    mapGeoJSON.set(null);
};

/** What a shared game syncs about hiding zones (the rest is in its settings). */
export const currentZoneSettings = (): Settings => ({
    disabledStations: disabledStations.get(),
});

/** Checks shared hiding zone settings (throws if they're invalid). */
export const parseZoneSettings = (raw: unknown): Settings =>
    parseSettings(raw ?? {});

export const applyZoneSettings = (settings: Settings) => {
    if (settings.disabledStations)
        disabledStations.set(settings.disabledStations);
    // Older saved games carry the radius and station kinds here; they're
    // game settings now.
    const changes: Partial<GameSettings> = {};
    if (settings.hidingRadius) {
        changes.hidingRadiusKm = convertLength(
            settings.hidingRadius,
            settings.hidingRadiusUnits ?? "kilometers",
            "kilometers",
        );
    }
    if (settings.zoneOptions) {
        changes.stationKinds = stationKindsFromFilters(settings.zoneOptions);
    }
    if (Object.keys(changes).length > 0) updateGameSettings(changes);
};

