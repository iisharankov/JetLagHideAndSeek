// Place search for the play-area picker and the coordinate pickers: the
// reference data's own zones, stations and places, so it works for any box
// the pack covers and needs no other service. A Photon server is used only
// where one is configured and there's no reference data (development).
import * as turf from "@turf/turf";
import _ from "lodash";

import { GEOCODER_URL } from "@/lib/config";
import { adminLevelLabel } from "@/maps/adminBorders";
import type { DatasetElement } from "@/maps/datasets";
import { datasets } from "@/maps/datasets/load";

import { convertToLatLong, prettifyLocation } from "./geo";
import type { APILocations, OpenStreetMap } from "./types";

type Zone = NonNullable<
    Awaited<ReturnType<typeof datasets.searchZones>>
>[number];

/** Country codes by name, for packs built before the ISO tags were kept. */
const COUNTRY_CODES: Record<string, string> = {
    switzerland: "CH",
    schweiz: "CH",
    suisse: "CH",
    svizzera: "CH",
    svizra: "CH",
    germany: "DE",
    deutschland: "DE",
    austria: "AT",
    österreich: "AT",
    france: "FR",
    italy: "IT",
    italia: "IT",
    liechtenstein: "LI",
};
const codeFromName = (name?: string) => {
    for (const part of (name ?? "").split("/")) {
        const code = COUNTRY_CODES[part.trim().toLowerCase()];
        if (code) return code;
    }
    return undefined;
};

const zoneName = (zone: Zone): string =>
    zone.properties["name:en"] ?? zone.properties.name ?? "";

/** The country (code and name) of a point, from the zone itself or the one around it. */
const countryAt = async (lat: number, lng: number, zone?: Zone) => {
    const own: string | undefined =
        zone?.properties["ISO3166-1:alpha2"] ??
        zone?.properties["ISO3166-2"]?.split("-")[0];
    const country =
        zone && Number(zone.properties.admin_level) === 2
            ? zone
            : await datasets.adminZoneAt(lat, lng, 2);
    const code =
        own ??
        country?.properties["ISO3166-1:alpha2"] ??
        codeFromName(country?.properties["name:en"]) ??
        codeFromName(country?.properties.name) ??
        "";
    return { code, country: country ? zoneName(country) : undefined };
};

const fromZone = async (zone: Zone): Promise<OpenStreetMap> => {
    const [lng, lat] = turf.pointOnFeature(zone).geometry.coordinates;
    const level = Number(zone.properties.admin_level);
    const { code, country } = await countryAt(lat, lng, zone);
    const state = level > 4 ? await datasets.adminZoneAt(lat, lng, 4) : null;
    const [minLng, minLat, maxLng, maxLat] = zone.bbox ?? turf.bbox(zone);
    return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [lat, lng] },
        properties: {
            osm_type: "R",
            osm_id: Number(zone.properties.id),
            osm_key: "boundary",
            osm_value: "administrative",
            type: adminLevelLabel(level, code),
            name: zoneName(zone),
            ...(state ? { state: zoneName(state) } : {}),
            ...(country ? { country } : {}),
            countrycode: code,
            extent: [maxLat, minLng, minLat, maxLng],
        },
    };
};

const PLACE_LABELS: Record<string, string> = {
    "stations-rail": "Train station",
    "stations-tram": "Tram stop",
    "stations-ferry": "Boat stop",
    "stations-aerialway": "Cable car station",
    airports: "Airport",
    cities: "City",
};
const placeLabel = (file: string) =>
    PLACE_LABELS[file] ??
    prettifyLocation(file.replace(/^poi-/, "") as APILocations);

const fromPlace = async ({
    element,
    file,
}: {
    element: DatasetElement;
    file: string;
}): Promise<OpenStreetMap> => {
    const lng = element.center ? element.center.lon : element.lon!;
    const lat = element.center ? element.center.lat : element.lat!;
    const town = await datasets.adminZoneAt(lat, lng, 8);
    const { code, country } = await countryAt(lat, lng);
    return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [lat, lng] },
        properties: {
            osm_type:
                element.type === "node"
                    ? "N"
                    : element.type === "way"
                      ? "W"
                      : "R",
            osm_id: element.id,
            osm_key: file,
            osm_value: placeLabel(file),
            type: placeLabel(file),
            name: element.tags.name ?? element.tags["name:en"] ?? "",
            ...(town ? { city: zoneName(town) } : {}),
            ...(country ? { country } : {}),
            countrycode: code,
        },
    };
};

const key = (feature: OpenStreetMap) =>
    `${feature.properties.osm_type}${feature.properties.osm_id}`;

/**
 * Places by name: zones only (the play-area picker), or stations, airports,
 * cities and places too (a point on the map).
 */
export const geocode = async (
    address: string,
    language: string,
    filter: boolean = true,
): Promise<OpenStreetMap[]> => {
    const zones = await datasets.searchZones(address);
    if (zones) {
        const results = await Promise.all(zones.map(fromZone));
        if (!filter) {
            const places = (await datasets.searchPlaces(address)) ?? [];
            results.push(...(await Promise.all(places.map(fromPlace))));
        }
        return _.uniqBy(results, key);
    }

    if (!GEOCODER_URL) {
        throw new Error(
            "No reference data on this server: place search needs it.",
        );
    }
    const params = new URLSearchParams({ lang: language, q: address });
    const response = await fetch(`${GEOCODER_URL}?${params}`);
    if (!response.ok) {
        throw new Error(`Place search answered HTTP ${response.status}`);
    }
    const features = (await response.json()).features as OpenStreetMap[];

    features.forEach((feature) => {
        feature.geometry.coordinates = convertToLatLong(
            feature.geometry.coordinates as number[],
        );
        if (!feature.properties.extent) return;
        feature.properties.extent = [
            feature.properties.extent[1],
            feature.properties.extent[0],
            feature.properties.extent[3],
            feature.properties.extent[2],
        ];
    });

    return _.uniqBy(
        features.filter((feature) => {
            return filter ? feature.properties.osm_type === "R" : true;
        }),
        (feature) => feature.properties.osm_id,
    );
};
