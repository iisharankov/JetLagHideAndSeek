// Builds the reference datasets from an OpenStreetMap extract:
//
//   node server/dist/build-datasets.mjs --input region.osm.pbf --output data/
//       [--far far-places.osm.pbf]
//
// Needs the `osmium` command (osmium-tool); set OSMIUM to use another path.
// Writes one JSON file per place category (Overpass-style elements), one
// GeoJSON file of boundaries per admin level, the high-speed rail lines,
// train lines per station, big lakes, "nearest place" maps and a
// manifest.json describing what was built.
//
// --elevation <dir> adds elevation tiles for the altitude question (from the
// free AWS Terrain Tiles; downloaded once into <dir>, see elevation.ts).
//
// --far adds airports, cities and other places from a wider area (about
// 300 km around Switzerland; see deploy/update-data.sh), so that e.g. Milan's
// airport counts as the nearest one where it is. `--print-far-filters`
// prints the osmium tags-filter expressions that file needs.
import { execFileSync } from "node:child_process";
import {
    createReadStream,
    mkdirSync,
    mkdtempSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";

import * as turf from "@turf/turf";

import {
    ADMIN_LEVELS,
    DATASET_CATEGORIES,
    type DatasetElement,
    type DatasetManifest,
    LAKE_MIN_AREA_KM2,
    type LakeProperties,
    NEAREST_SETS,
} from "@/maps/datasets/categories";

import { categoriesFor, isLake, osmIdentity, toElement } from "./elements";
import { buildElevation, ELEVATION_ZOOMS } from "./elevation";
import { buildNearestMaps } from "./nearest";
import { linesByStation, trainLinesFromOpl } from "./routes";

const OSMIUM = process.env.OSMIUM ?? "osmium";

const osmium = (...args: string[]) =>
    execFileSync(OSMIUM, args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "inherit"],
        maxBuffer: 1024 * 1024 * 1024,
    });

async function* readFeatures(path: string) {
    const lines = createInterface({ input: createReadStream(path) });
    for await (const line of lines) {
        // geojsonseq records start with an ASCII record separator (0x1e).
        const json = (
            line.charCodeAt(0) === 0x1e ? line.slice(1) : line
        ).trim();
        if (json) yield JSON.parse(json);
    }
}

/** Round to 5 decimals (about a metre) to keep the files small. */
const roundCoordinates = (geojson: any) => {
    turf.coordEach(geojson, (coord) => {
        coord[0] = Math.round(coord[0] * 1e5) / 1e5;
        coord[1] = Math.round(coord[1] * 1e5) / 1e5;
    });
    return geojson;
};

const exportFeatures = (
    input: string,
    work: string,
    name: string,
    filters: string[],
    extra: string[] = [],
) => {
    const filtered = join(work, `${name}.osm.pbf`);
    const exported = join(work, `${name}.geojsonseq`);
    osmium("tags-filter", input, ...filters, "-o", filtered, "--overwrite");
    osmium(
        "export",
        filtered,
        "-f",
        "geojsonseq",
        "--add-unique-id=type_id",
        ...extra,
        "-o",
        exported,
        "--overwrite",
    );
    return exported;
};

const filtersFor = (categories: typeof DATASET_CATEGORIES) => [
    ...new Set(categories.map((c) => `nwr/${c.key}=${c.values.join(",")}`)),
];

const POI_FILTERS = filtersFor(DATASET_CATEGORIES);

/** Categories that "nearest place" questions use, also taken from --far. */
const FAR_CATEGORIES = DATASET_CATEGORIES.filter((category) =>
    NEAREST_SETS.some((set) => set.file === category.file),
);
const FAR_FILTERS = filtersFor(FAR_CATEGORIES);

const buildPlaces = async (
    input: string,
    work: string,
    name = "places",
    filters = POI_FILTERS,
) => {
    const files = new Map<string, Map<string, DatasetElement>>(
        DATASET_CATEGORIES.map((c) => [c.file, new Map()]),
    );

    const exported = exportFeatures(input, work, name, filters);
    for await (const feature of readFeatures(exported)) {
        const tags = feature.properties ?? {};
        const categories = categoriesFor(tags);
        if (categories.length === 0) continue;

        const { type, id } = osmIdentity(feature.id);
        const key = `${type}/${id}`;
        for (const file of categories) {
            const entries = files.get(file)!;
            // A closed way is exported both as a line and as an area.
            if (!entries.has(key)) entries.set(key, toElement(feature));
        }
    }

    return new Map(
        [...files].map(([file, entries]) => [file, [...entries.values()]]),
    );
};

const buildBoundaries = async (input: string, work: string) => {
    const levels = new Map<number, any[]>(
        ADMIN_LEVELS.map((level) => [level, []]),
    );

    const exported = exportFeatures(
        input,
        work,
        "boundaries",
        ["r/boundary=administrative"],
        ["--geometry-types=polygon"],
    );
    for await (const feature of readFeatures(exported)) {
        const { type, id } = osmIdentity(feature.id);
        const level = Number(feature.properties?.admin_level);
        if (type !== "relation" || !levels.has(level)) continue;

        const simplified = roundCoordinates(
            turf.simplify(feature.geometry, { tolerance: 0.0001 }),
        );
        levels.get(level)!.push({
            type: "Feature",
            id,
            bbox: turf.bbox(simplified),
            properties: {
                id,
                admin_level: level,
                name: feature.properties.name,
                "name:en": feature.properties["name:en"],
            },
            geometry: simplified,
        });
    }
    return levels;
};

const buildHighSpeedLines = async (input: string, work: string) => {
    const lines: any[] = [];
    const exported = exportFeatures(
        input,
        work,
        "highspeed",
        ["w/highspeed=yes"],
        ["--geometry-types=linestring"],
    );
    for await (const feature of readFeatures(exported)) {
        lines.push({
            type: "Feature",
            properties: {
                name: feature.properties?.name,
                "name:en": feature.properties?.["name:en"],
            },
            geometry: roundCoordinates(
                turf.simplify(feature.geometry, { tolerance: 0.0001 }),
            ),
        });
    }
    return lines;
};

const positionOf = (element: DatasetElement): [number, number] =>
    element.center
        ? [element.center.lon, element.center.lat]
        : [element.lon!, element.lat!];

const keyOf = (element: DatasetElement) => `${element.type}/${element.id}`;

/** Lakes of at least LAKE_MIN_AREA_KM2, with their area. */
const buildLakes = async (input: string, work: string) => {
    const lakes: any[] = [];
    const exported = exportFeatures(
        input,
        work,
        "lakes",
        ["nwr/natural=water"],
        ["--geometry-types=polygon"],
    );
    for await (const feature of readFeatures(exported)) {
        if (!isLake(feature.properties ?? {})) continue;
        const areaKm2 = turf.area(feature) / 1e6;
        if (areaKm2 < LAKE_MIN_AREA_KM2) continue;

        const geometry = roundCoordinates(
            turf.simplify(feature.geometry, { tolerance: 0.0002 }),
        );
        const properties: LakeProperties = {
            name: feature.properties.name ?? feature.properties["name:en"],
            areaKm2: Math.round(areaKm2 * 10) / 10,
        };
        lakes.push({
            type: "Feature",
            bbox: turf.bbox(geometry),
            properties,
            geometry,
        });
    }
    return lakes;
};

/** Stations tagged railway=station that trains don't stop at. */
const NOT_TRAIN_STATIONS = new Set([
    "funicular",
    "subway",
    "monorail",
    "miniature",
]);

/** For each train station, the train lines stopping there. */
const buildTrainLines = (
    input: string,
    work: string,
    stations: DatasetElement[],
) => {
    const routes = join(work, "train-routes.osm.pbf");
    osmium("tags-filter", input, "r/route=train", "-o", routes, "--overwrite");
    const opl = osmium("cat", routes, "-f", "opl,add_metadata=false");
    return linesByStation(
        trainLinesFromOpl(opl.split("\n")),
        stations
            .filter(
                (station) =>
                    ["station", "halt"].includes(station.tags.railway) &&
                    !NOT_TRAIN_STATIONS.has(station.tags.station),
            )
            .map((station) => {
                const [lon, lat] = positionOf(station);
                return {
                    key: keyOf(station),
                    lon,
                    lat,
                    name: station.tags.name,
                };
            }),
    );
};

type Bbox = [number, number, number, number];

/** The area an extract covers, from its header (osmium fileinfo). */
const extractBbox = (input: string, fallback: DatasetElement[]) => {
    try {
        const info = JSON.parse(osmium("fileinfo", "-j", input));
        const box = info?.header?.boxes?.[0];
        if (Array.isArray(box) && box.length === 4) {
            return box as [number, number, number, number];
        }
    } catch {
        // No header box; derive it from the data below.
    }
    const points = fallback.map((e) =>
        turf.point([e.lon ?? e.center!.lon, e.lat ?? e.center!.lat]),
    );
    return turf.bbox(turf.featureCollection(points)) as [
        number,
        number,
        number,
        number,
    ];
};

const main = async () => {
    const { values } = parseArgs({
        options: {
            input: { type: "string" },
            output: { type: "string" },
            far: { type: "string" },
            elevation: { type: "string" },
            "print-far-filters": { type: "boolean" },
        },
    });
    if (values["print-far-filters"]) {
        console.log(FAR_FILTERS.join(" "));
        return;
    }
    if (!values.input || !values.output) {
        console.error(
            "Usage: build-datasets --input <file.osm.pbf> --output <dir> [--far <file.osm.pbf>] [--elevation <cache dir>]",
        );
        process.exit(2);
    }

    const output = values.output;
    mkdirSync(output, { recursive: true });
    const work = mkdtempSync(join(tmpdir(), "jetlag-datasets-"));
    const counts: Record<string, number> = {};
    const write = (file: string, data: unknown, count: number) => {
        writeFileSync(join(output, `${file}.json`), JSON.stringify(data));
        counts[file] = count;
        console.log(`  ${file}: ${count}`);
    };

    try {
        console.log("Places and stations...");
        const places = await buildPlaces(values.input, work);
        const core = extractBbox(
            values.input,
            places.get("stations-rail") ?? [],
        );

        let farPlaces: Map<string, DatasetElement[]> | null = null;
        let far: Bbox | undefined;
        if (values.far) {
            console.log("Places in the wider area...");
            farPlaces = await buildPlaces(
                values.far,
                work,
                "far-places",
                FAR_FILTERS,
            );
            far = extractBbox(values.far, farPlaces.get("cities") ?? []);
        }

        console.log("Nearest-place maps...");
        for (const [name, map] of buildNearestMaps(places, farPlaces, core)) {
            write(`voronoi-${name}`, map, map.features.length);
        }
        for (const [file, elements] of places) {
            write(file, { elements }, elements.length);
        }

        console.log("Train lines...");
        const trainLines = buildTrainLines(
            values.input,
            work,
            places.get("stations-rail") ?? [],
        );
        write(
            "train-lines",
            trainLines,
            Object.keys(trainLines.stations).length,
        );

        console.log("Lakes...");
        const lakes = await buildLakes(values.input, work);
        write(
            "lakes",
            { type: "FeatureCollection", features: lakes },
            lakes.length,
        );

        console.log("Admin boundaries...");
        for (const [level, features] of await buildBoundaries(
            values.input,
            work,
        )) {
            write(
                `admin-${level}`,
                { type: "FeatureCollection", features },
                features.length,
            );
        }

        console.log("High-speed rail...");
        const lines = await buildHighSpeedLines(values.input, work);
        write(
            "highspeed",
            { type: "FeatureCollection", features: lines },
            lines.length,
        );

        let elevation: DatasetManifest["elevation"];
        if (values.elevation) {
            console.log("Elevation tiles...");
            const tiles = await buildElevation({
                bbox: core,
                cacheDir: values.elevation,
                output,
            });
            elevation = { zooms: ELEVATION_ZOOMS };
            console.log(`  elevation: ${tiles} tiles`);
        }

        const manifest: DatasetManifest = {
            version: 1,
            built: new Date().toISOString(),
            bbox: core,
            files: counts,
            ...(far ? { far } : {}),
            ...(elevation ? { elevation } : {}),
        };
        writeFileSync(join(output, "manifest.json"), JSON.stringify(manifest));
        console.log(`Done. Covers ${manifest.bbox.join(", ")}.`);
    } finally {
        rmSync(work, { recursive: true, force: true });
    }
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
