// The pre-built reference datasets (see deploy/ and server/datasets/): one
// file of OpenStreetMap places per category, in Overpass's JSON shape so the
// app can use them in place of live Overpass queries.

import { isCommercialAirport } from "./airports";

export interface DatasetCategory {
    /** File name (without .json) in the data directory. */
    file: string;
    /** The tag that defines the category, as in an Overpass filter. */
    key: string;
    values: string[];
    /** Extra condition, e.g. airports need an IATA code. */
    requires?: string;
    /** Only places passing this check are included (at build time). */
    accept?: (tags: Record<string, string>) => boolean;
}

export const DATASET_CATEGORIES: DatasetCategory[] = [
    { file: "poi-zoo", key: "tourism", values: ["zoo"] },
    { file: "poi-aquarium", key: "tourism", values: ["aquarium"] },
    { file: "poi-theme_park", key: "tourism", values: ["theme_park"] },
    { file: "poi-museum", key: "tourism", values: ["museum"] },
    { file: "poi-hospital", key: "amenity", values: ["hospital"] },
    { file: "poi-cinema", key: "amenity", values: ["cinema"] },
    { file: "poi-library", key: "amenity", values: ["library"] },
    { file: "poi-golf_course", key: "leisure", values: ["golf_course"] },
    { file: "poi-park", key: "leisure", values: ["park"] },
    { file: "poi-peak", key: "natural", values: ["peak"] },
    { file: "poi-consulate", key: "diplomatic", values: ["consulate"] },
    {
        file: "airports",
        key: "aeroway",
        values: ["aerodrome"],
        requires: "iata",
        accept: (tags) => isCommercialAirport(tags.iata),
    },
    { file: "cities", key: "place", values: ["city"] },
    { file: "brand-mcdonalds", key: "brand:wikidata", values: ["Q38076"] },
    { file: "brand-seven11", key: "brand:wikidata", values: ["Q259340"] },
    {
        file: "stations-rail",
        key: "railway",
        values: ["station", "halt", "stop"],
    },
    { file: "stations-tram", key: "railway", values: ["tram_stop"] },
    { file: "stations-bus", key: "highway", values: ["bus_stop"] },
    { file: "stations-ferry", key: "amenity", values: ["ferry_terminal"] },
    { file: "stations-aerialway", key: "aerialway", values: ["station"] },
];

/** Tags kept in the datasets: names plus everything the filters look at. */
export const KEPT_TAGS = [
    "name",
    "name:en",
    "tourism",
    "amenity",
    "leisure",
    "natural",
    "diplomatic",
    "aeroway",
    "iata",
    "place",
    "population",
    "railway",
    "highway",
    "public_transport",
    "station",
    "subway",
    "light_rail",
    "train",
    "aerialway",
    "brand",
    "brand:wikidata",
];

/** A city's population as a number (0 if unknown). */
export const populationOf = (tags: Record<string, string>) =>
    /^\d+$/.test(tags.population ?? "") ? Number(tags.population) : 0;

/** Sizes of "major city" with pre-computed nearest-city maps. */
export const MAJOR_CITY_POPULATIONS = [100_000, 1_000_000];

/**
 * Sets of places with a pre-computed "which one is nearest" map, written to
 * voronoi-<name>.json. Places just outside Switzerland count too.
 */
export interface NearestSet {
    name: string;
    /** The dataset file the places come from. */
    file: string;
    accept?: (tags: Record<string, string>) => boolean;
    /** Places mapped twice (a node and an area) share this; one is kept. */
    identity?: (tags: Record<string, string>) => string | undefined;
}

export const NEAREST_SETS: NearestSet[] = [
    ...DATASET_CATEGORIES.filter((c) => c.file.startsWith("poi-")).map((c) => ({
        name: c.file,
        file: c.file,
    })),
    {
        name: "airports",
        file: "airports",
        identity: (tags) => tags.iata?.split(";")[0].trim().toUpperCase(),
    },
    ...MAJOR_CITY_POPULATIONS.map((minimum) => ({
        name: `cities-${minimum}`,
        file: "cities",
        accept: (tags: Record<string, string>) => populationOf(tags) >= minimum,
        identity: (tags: Record<string, string>) => tags.name,
    })),
];

/** Lakes for the lake shore question: at least this big (km²). */
export const LAKE_MIN_AREA_KM2 = 10;

/** Admin levels that get a boundary file (admin-<level>.json). */
export const ADMIN_LEVELS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

/** An OpenStreetMap object as Overpass returns it with `out center`. */
export interface DatasetElement {
    type: "node" | "way" | "relation";
    id: number;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags: Record<string, string>;
}

export interface DatasetManifest {
    version: 1;
    /** When the data was built (ISO date). */
    built: string;
    /** [min lon, min lat, max lon, max lat] the data covers. */
    bbox: [number, number, number, number];
    /** Number of entries per file. */
    files: Record<string, number>;
    /** Area of the extra data on airports, cities and places around it. */
    far?: [number, number, number, number];
}

/** A cell of a voronoi-<name>.json file: where that place is the nearest. */
export interface NearestCellProperties {
    /** "node/123", "way/456" or "relation/789". */
    key: string;
    name?: string;
    lat: number;
    lon: number;
}

/** train-lines.json: the train lines stopping at each station. */
export interface TrainLinesFile {
    lines: { name: string }[];
    /** Station key ("node/123") → indexes into `lines`. */
    stations: Record<string, number[]>;
}

/** Properties of a feature in lakes.json. */
export interface LakeProperties {
    name?: string;
    areaKm2: number;
}
