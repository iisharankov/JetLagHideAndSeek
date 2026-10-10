import * as turf from "@turf/turf";
import type {
    Feature,
    FeatureCollection,
    LineString,
    MultiLineString,
    MultiPolygon,
} from "geojson";
import _ from "lodash";
import osmtogeojson from "osmtogeojson";
import { toast } from "react-toastify";

import { OVERPASS_URLS, withBase } from "@/lib/config";
import {
    additionalMapGeoLocations,
    allowPublicOverpass,
    mapGeoJSON,
    mapGeoLocation,
    overpassCustomHost,
    polyGeoJSON,
} from "@/lib/context";
import { applyPlaceRules, isRejected } from "@/lib/placeRules";
import { datasets } from "@/maps/datasets/load";
import { safeUnion } from "@/maps/geo-utils";
import { expandingSearch } from "@/maps/hidingZones";

import { cacheFetch } from "./cache";
import { LOCATION_FIRST_TAG, PUBLIC_OVERPASS_HOSTS } from "./constants";
import { prettifyLocation } from "./geo";
import {
    cacheStorageCache,
    createOverpassClient,
    OverpassError,
} from "./overpassClient";
import type {
    EncompassingTentacleQuestionSchema,
    HomeGameMatchingQuestions,
    HomeGameMeasuringQuestions,
    QuestionSpecificLocation,
} from "./types";
import { CacheType } from "./types";

type TentacleLocationQuery = Pick<
    EncompassingTentacleQuestionSchema,
    "lat" | "lng" | "radius" | "unit" | "locationType"
>;

/** Servers to ask, in order: our own, an optional custom one, then (opt-in) public ones. */
export const overpassEndpoints = () =>
    _.uniq(
        [
            ...OVERPASS_URLS,
            overpassCustomHost.get().trim(),
            ...(allowPublicOverpass.get() ? PUBLIC_OVERPASS_HOSTS : []),
        ].filter(Boolean),
    );

const queryOverpass = createOverpassClient({ endpoints: overpassEndpoints });

/**
 * Runs an Overpass query (cached). Throws an OverpassError, after showing a
 * toast, when no server could answer; it never pretends nothing was found.
 */
export const getOverpassData = async (
    query: string,
    loadingText?: string,
    cacheType: CacheType = CacheType.CACHE,
) => {
    const pending = queryOverpass(query, {
        cache: cacheStorageCache(cacheType),
    });

    try {
        return await (loadingText
            ? toast.promise(pending, { pending: loadingText })
            : pending);
    } catch (error) {
        if (error instanceof OverpassError) {
            toast.error(error.message, { toastId: "overpass-error" });
        }
        throw error;
    }
};

export const determineGeoJSON = async (
    osmId: string,
    osmTypeLetter: "W" | "R" | "N",
): Promise<any> => {
    const osmTypeMap: { [key: string]: string } = {
        W: "way",
        R: "relation",
        N: "node",
    };
    if (osmTypeLetter === "R") {
        const zone = await datasets.boundaryById(Number(osmId));
        if (zone) return turf.featureCollection([zone]);
    }

    const osmType = osmTypeMap[osmTypeLetter];
    const query = `[out:json];${osmType}(${osmId});out geom;`;
    const data = await getOverpassData(
        query,
        "Loading map data...",
        CacheType.PERMANENT_CACHE,
    );
    const geo = osmtogeojson(data);
    return {
        ...geo,
        features: geo.features.filter(
            (feature: any) => feature.geometry.type !== "Point",
        ),
    };
};

export const findTentacleLocations = async (
    question: TentacleLocationQuery,
    text: string = "Determining tentacle locations...",
) => {
    const radiusKm = turf.convertLength(
        question.radius,
        question.unit,
        "kilometers",
    );
    const elements =
        (await datasets.placesAround(
            question.locationType,
            question.lat,
            question.lng,
            radiusKm,
        )) ??
        (
            await getOverpassData(
                `
[out:json][timeout:25];
nwr["${LOCATION_FIRST_TAG[question.locationType]}"="${question.locationType}"](around:${radiusKm * 1000}, ${question.lat}, ${question.lng});
out center;
    `,
                text,
            )
        ).elements;
    const response = turf.points([]);
    elements.forEach((element: any) => {
        if (!element.tags["name"] && !element.tags["name:en"]) return;
        if (element.lat && element.lon) {
            const name = element.tags["name:en"] ?? element.tags["name"];
            if (
                response.features.find(
                    (feature: any) => feature.properties.name === name,
                )
            )
                return;
            response.features.push(
                turf.point([element.lon, element.lat], { name }),
            );
        }
        if (!element.center || !element.center.lon || !element.center.lat)
            return;
        const name = element.tags["name:en"] ?? element.tags["name"];
        if (
            response.features.find(
                (feature: any) => feature.properties.name === name,
            )
        )
            return;
        response.features.push(
            turf.point([element.center.lon, element.center.lat], { name }),
        );
    });
    return turf.featureCollection(
        applyPlaceRules(question.locationType, response.features),
    );
};

export const findAdminBoundary = async (
    latitude: number,
    longitude: number,
    adminLevel: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
) => {
    const zone = await datasets.adminZoneAt(latitude, longitude, adminLevel);
    if (zone !== undefined) return zone ?? undefined;

    const query = `
[out:json];
is_in(${latitude}, ${longitude})->.a;
rel(pivot.a)["admin_level"="${adminLevel}"];
out geom;
    `;
    const data = await getOverpassData(query, "Determining matching zone...");
    const geo = osmtogeojson(data);
    return geo.features?.[0];
};

/** Every admin level present at a point, with its name, lowest level first. */
export const findAdminLevelsAt = async (
    latitude: number,
    longitude: number,
) => {
    const fromData = await datasets.adminLevelsAt(latitude, longitude);
    if (fromData) return fromData;

    const query = `
[out:json];
is_in(${latitude}, ${longitude})->.a;
rel(pivot.a)[boundary=administrative][admin_level];
out tags;
    `;
    const data = await getOverpassData(query, undefined, CacheType.ZONE_CACHE);
    return (data.elements as { tags: Record<string, string> }[])
        .map((element) => ({
            level: Number(element.tags.admin_level),
            name: element.tags.name ?? element.tags["name:en"] ?? "",
        }))
        .filter((zone) => Number.isInteger(zone.level))
        .sort((a, b) => a.level - b.level);
};

/**
 * The border lines of every admin area of a level inside a bounding box
 * ([minLng, minLat, maxLng, maxLat]), as line features.
 */
export const findAdminBorderLines = async (
    adminLevel: number,
    bbox: [number, number, number, number],
): Promise<Feature<LineString | MultiLineString>[]> => {
    const box = `${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]}`;
    const query = `
[out:json][timeout:120];
rel[boundary=administrative][admin_level=${adminLevel}](${box});
way(r)(${box});
out geom;
    `;
    const data = await getOverpassData(
        query,
        "Finding borders...",
        CacheType.ZONE_CACHE,
    );
    return osmtogeojson(data).features.flatMap((feature: any) => {
        const type = feature.geometry?.type;
        if (type === "LineString" || type === "MultiLineString") {
            return [feature];
        }
        if (type === "Polygon" || type === "MultiPolygon") {
            const outline = turf.polygonToLine(feature);
            return outline.type === "FeatureCollection"
                ? outline.features
                : [outline];
        }
        return [];
    });
};

export const fetchCoastline = async () => {
    const response = await cacheFetch(
        withBase("coastline50.geojson"),
        "Fetching coastline data...",
        CacheType.PERMANENT_CACHE,
    );
    const data = await response.json();
    return data;
};

export const trainLineNodeFinder = async (node: string): Promise<number[]> => {
    const nodeId = node.split("/")[1];
    const tagQuery = `
[out:json];
node(${nodeId});
wr(bn);
out tags;
`;
    const tagData = await getOverpassData(tagQuery, "Finding train line...");
    const query = `
[out:json];
(
${tagData.elements
    .map((element: any) => {
        if (
            !element.tags.name &&
            !element.tags["name:en"] &&
            !element.tags.network
        )
            return "";
        let query = "";
        if (element.tags.name) query += `wr["name"="${element.tags.name}"];`;
        if (element.tags["name:en"])
            query += `wr["name:en"="${element.tags["name:en"]}"];`;
        if (element.tags["network"])
            query += `wr["network"="${element.tags["network"]}"];`;
        return query;
    })
    .join("\n")}
);
out geom;
`;
    const data = await getOverpassData(query, "Finding train lines...");
    const geoJSON = osmtogeojson(data);
    const nodes: number[] = [];
    geoJSON.features.forEach((feature: any) => {
        if (feature && feature.id && feature.id.startsWith("node")) {
            nodes.push(parseInt(feature.id.split("/")[1]));
        }
    });
    data.elements.forEach((element: any) => {
        if (element && element.type === "node") {
            nodes.push(element.id);
        } else if (element && element.type === "way") {
            nodes.push(...element.nodes);
        }
    });
    const uniqNodes = _.uniq(nodes);
    return uniqNodes;
};

export const findPlacesInZone = async (
    filter: string,
    loadingText?: string,
    searchType:
        | "node"
        | "way"
        | "relation"
        | "nwr"
        | "nw"
        | "wr"
        | "nr"
        | "area" = "nwr",
    outType: "center" | "geom" = "center",
    alternatives: string[] = [],
    timeoutDuration: number = 0,
) => {
    const playArea = mapGeoJSON.get();
    if (outType === "center" && playArea) {
        const elements = await datasets.placesInZone(
            [filter, ...alternatives],
            playArea,
            searchType,
        );
        if (elements) return { elements };
    }

    let query = "";
    const $polyGeoJSON = polyGeoJSON.get();
    if ($polyGeoJSON) {
        query = `
[out:json]${timeoutDuration != 0 ? `[timeout:${timeoutDuration}]` : ""};
(
${searchType}${filter}(poly:"${turf
            .getCoords($polyGeoJSON.features)
            .flatMap((polygon) => polygon.geometry.coordinates)
            .flat()
            .map((coord) => [coord[1], coord[0]].join(" "))
            .join(" ")}");
${
    alternatives.length > 0
        ? alternatives
              .map(
                  (alternative) =>
                      `${searchType}${alternative}(poly:"${turf
                          .getCoords($polyGeoJSON.features)
                          .flatMap((polygon) => polygon.geometry.coordinates)
                          .flat()
                          .map((coord) => [coord[1], coord[0]].join(" "))
                          .join(" ")}");`,
              )
              .join("\n")
        : ""
}
);
out ${outType};
`;
    } else {
        const primaryLocation = mapGeoLocation.get();
        const additionalLocations = additionalMapGeoLocations
            .get()
            .filter((entry) => entry.added)
            .map((entry) => entry.location);
        const allLocations = [primaryLocation, ...additionalLocations];
        const relationToAreaBlocks = allLocations
            .map((loc, idx) => {
                const regionVar = `.region${idx}`;
                return `relation(${loc.properties.osm_id});map_to_area->${regionVar};`;
            })
            .join("\n");
        const searchBlocks = allLocations
            .map((_, idx) => {
                const regionVar = `area.region${idx}`;
                const altQueries =
                    alternatives.length > 0
                        ? alternatives
                              .map(
                                  (alt) => `${searchType}${alt}(${regionVar});`,
                              )
                              .join("\n")
                        : "";
                return `
            ${searchType}${filter}(${regionVar});
            ${altQueries}
          `;
            })
            .join("\n");
        query = `
        [out:json]${timeoutDuration !== 0 ? `[timeout:${timeoutDuration}]` : ""};
        ${relationToAreaBlocks}
        (
        ${searchBlocks}
        );
        out ${outType};
        `;
    }
    const data = await getOverpassData(
        query,
        loadingText,
        CacheType.ZONE_CACHE,
    );
    const subtractedEntries = additionalMapGeoLocations
        .get()
        .filter((e) => !e.added);
    const subtractedPolygons = subtractedEntries.map((entry) => entry.location);
    if (subtractedPolygons.length > 0 && data && data.elements) {
        const turfPolys = await Promise.all(
            subtractedPolygons.map(
                async (location) =>
                    turf.combine(
                        await determineGeoJSON(
                            location.properties.osm_id.toString(),
                            location.properties.osm_type,
                        ),
                    ).features[0],
            ),
        );
        data.elements = data.elements.filter((el: any) => {
            const lon = el.center ? el.center.lon : el.lon;
            const lat = el.center ? el.center.lat : el.lat;
            if (typeof lon !== "number" || typeof lat !== "number")
                return false;
            const pt = turf.point([lon, lat]);
            return !turfPolys.some((poly) =>
                turf.booleanPointInPolygon(pt, poly as any),
            );
        });
    }
    return data;
};

export const findPlacesSpecificInZone = async (
    location: `${QuestionSpecificLocation}`,
) => {
    const locations = (
        await findPlacesInZone(
            location,
            `Finding ${
                location === '["brand:wikidata"="Q38076"]'
                    ? "McDonald's"
                    : "7-Elevens"
            }...`,
        )
    ).elements;
    return turf.featureCollection(
        locations.map((x: any) =>
            turf.point([
                x.center ? x.center.lon : x.lon,
                x.center ? x.center.lat : x.lat,
            ]),
        ),
    );
};

/** The place of the question's type nearest to the question's location. */
export const nearestToQuestion = async (
    question: HomeGameMatchingQuestions | HomeGameMeasuringQuestions,
) => {
    const questionPoint = turf.point([question.lng, question.lat]);

    const nearest = await datasets.nearestPlace(
        question.type,
        question.lat,
        question.lng,
        // Places the players rejected while setting up don't count.
        (element) => {
            const lon = element.center ? element.center.lon : element.lon;
            const lat = element.center ? element.center.lat : element.lat;
            return !isRejected(
                question.type,
                element.tags["name:en"] ?? element.tags.name,
                lat!,
                lon!,
            );
        },
    );
    if (nearest) {
        const point = turf.point(
            nearest.center
                ? [nearest.center.lon, nearest.center.lat]
                : [nearest.lon!, nearest.lat!],
        );
        return turf.point(point.geometry.coordinates, {
            name: nearest.tags["name:en"] ?? nearest.tags.name,
            distanceToPoint: turf.distance(questionPoint, point),
        });
    }

    const { found } = await expandingSearch(
        async (radiusKm) =>
            (
                await findTentacleLocations(
                    {
                        lat: question.lat,
                        lng: question.lng,
                        radius: radiusKm,
                        unit: "kilometers",
                        locationType: question.type,
                    },
                    "Finding matching locations...",
                )
            ).features,
        {
            startKm: 50,
            maxKm: 400,
            what: prettifyLocation(question.type, true).toLowerCase(),
        },
    );
    return turf.nearestPoint(questionPoint, turf.featureCollection(found));
};

export const determineMapBoundaries = async () => {
    const mapGeoDatum = await Promise.all(
        [
            {
                location: mapGeoLocation.get(),
                added: true,
                base: true,
            },
            ...additionalMapGeoLocations.get(),
        ].map(async (location) => ({
            added: location.added,
            data: await determineGeoJSON(
                location.location.properties.osm_id.toString(),
                location.location.properties.osm_type,
            ),
        })),
    );

    let mapGeoData = turf.featureCollection([
        safeUnion(
            turf.featureCollection(
                mapGeoDatum
                    .filter((x) => x.added)
                    .flatMap((x) => x.data.features),
            ) as any,
        ),
    ]);

    const differences = mapGeoDatum.filter((x) => !x.added).map((x) => x.data);

    if (differences.length > 0) {
        mapGeoData = turf.featureCollection([
            turf.difference(
                turf.featureCollection([
                    mapGeoData.features[0],
                    ...differences.flatMap((x) => x.features),
                ]),
            )!,
        ]);
    }

    if (turf.coordAll(mapGeoData).length > 10000) {
        turf.simplify(mapGeoData, {
            tolerance: 0.0005,
            highQuality: true,
            mutate: true,
        });
    }

    return turf.combine(mapGeoData) as FeatureCollection<MultiPolygon>;
};
