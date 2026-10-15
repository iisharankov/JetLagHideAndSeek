import * as turf from "@turf/turf";

import {
    DATASET_CATEGORIES,
    type DatasetElement,
    KEPT_TAGS,
} from "@/maps/datasets/categories";

/** OSM object behind an `osmium export --add-unique-id=type_id` id. */
export const osmIdentity = (
    exportId: string,
): { type: DatasetElement["type"]; id: number } => {
    const kind = exportId[0];
    const number = Number(exportId.slice(1));
    if (kind === "n") return { type: "node", id: number };
    if (kind === "w") return { type: "way", id: number };
    if (kind === "r") return { type: "relation", id: number };
    // Areas: osmium numbers way areas 2 × id and relation areas 2 × id + 1.
    return number % 2 === 0
        ? { type: "way", id: number / 2 }
        : { type: "relation", id: (number - 1) / 2 };
};

/** The dataset files a place belongs in (usually none or one). */
export const categoriesFor = (tags: Record<string, string>) =>
    DATASET_CATEGORIES.filter(
        (category) =>
            category.values.includes(tags[category.key]) &&
            (!category.requires || tags[category.requires] !== undefined) &&
            (!category.accept || category.accept(tags)),
    ).map((category) => category.file);

/** "122’937", "1,371,498" or "128 848" → "122937"; anything else unchanged. */
export const normalizePopulation = (population: string) =>
    /^\d{1,3}([’'., ]\d{3})+$/.test(population)
        ? population.replace(/\D/g, "")
        : population;

const keptTags = (properties: Record<string, unknown>) => {
    const tags: Record<string, string> = Object.fromEntries(
        KEPT_TAGS.filter((key) => typeof properties[key] === "string").map(
            (key) => [key, properties[key] as string],
        ),
    );
    if (tags.population) tags.population = normalizePopulation(tags.population);
    return tags;
};

const NOT_LAKES = new Set([
    "river",
    "canal",
    "stream",
    "ditch",
    "drain",
    "moat",
    "wastewater",
    "stream_pool",
    "fish_pass",
]);

/** natural=water that is a lake or reservoir (or doesn't say). */
export const isLake = (tags: Record<string, unknown>) =>
    tags.natural === "water" && !NOT_LAKES.has(String(tags.water ?? ""));

const round = (value: number) => Math.round(value * 1e7) / 1e7;

/** An exported feature as an Overpass-style element (`out center`). */
export const toElement = (feature: {
    id: string;
    geometry: any;
    properties: Record<string, unknown>;
}): DatasetElement => {
    const { type, id } = osmIdentity(feature.id);
    const tags = keptTags(feature.properties);

    if (feature.geometry.type === "Point") {
        const [lon, lat] = feature.geometry.coordinates;
        return { type, id, lat: round(lat), lon: round(lon), tags };
    }

    const [minLon, minLat, maxLon, maxLat] = turf.bbox(feature.geometry);
    // The size of an area, for rules like "parks under half a hectare
    // don't count".
    if (
        feature.geometry.type === "Polygon" ||
        feature.geometry.type === "MultiPolygon"
    ) {
        const area = Math.round(turf.area(feature.geometry));
        if (area > 0) tags.area_m2 = String(area);
    }
    return {
        type,
        id,
        center: {
            lat: round((minLat + maxLat) / 2),
            lon: round((minLon + maxLon) / 2),
        },
        tags,
    };
};
