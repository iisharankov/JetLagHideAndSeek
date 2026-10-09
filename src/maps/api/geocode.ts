import _ from "lodash";

import { GEOCODER_URL } from "@/lib/config";

import { convertToLatLong } from "./geo";
import type { OpenStreetMap } from "./types";

export const geocode = async (
    address: string,
    language: string,
    filter: boolean = true,
) => {
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
