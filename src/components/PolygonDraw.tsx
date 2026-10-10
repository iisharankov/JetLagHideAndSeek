import "leaflet-draw/dist/leaflet.draw.css";

import { useStore } from "@nanostores/react";
import * as turf from "@turf/turf";
import type {
    FeatureCollection,
    MultiPolygon,
    Polygon as GeoJSONPolygon,
} from "geojson";
import * as L from "leaflet";
import _ from "lodash";
import { useEffect, useRef, useState } from "react";
import { FeatureGroup, Marker, Polygon, Polyline } from "react-leaflet";
import { EditControl } from "react-leaflet-draw";

import {
    drawingQuestionKey,
    mapGeoJSON,
    playAreaDrawing,
    polyGeoJSON,
    questions,
    updateQuestion,
} from "@/lib/context";
import { CacheType, clearCache } from "@/maps/api";
import { lngLatToText } from "@/maps/geo-utils";
import type {
    CustomMatchingQuestion,
    CustomMeasuringQuestion,
    CustomTentacleQuestion,
    Question,
} from "@/maps/schema";

import { LatitudeLongitude } from "./LatLngPicker";
import { Dialog, DialogContent } from "./ui/dialog";
import { Input } from "./ui/input";
import { SidebarMenu } from "./ui/sidebar-l";

/** A shape drawn on the map, as kept in a custom question. */
type DrawnFeature = {
    type: "Feature";
    geometry: { type: string; coordinates: any };
    properties?: any;
};

const swapCoordinates = (geojson: any) => {
    return JSON.parse(JSON.stringify(geojson), (key, value) => {
        if (
            Array.isArray(value) &&
            value.length >= 2 &&
            typeof value[0] === "number" &&
            typeof value[1] === "number"
        ) {
            return [value[1], value[0], ...value.slice(2)];
        }
        return value;
    });
};

const TentacleMarker = ({
    point,
    onChange,
}: {
    point: CustomTentacleQuestion["places"][number];
    /** The point as edited: a new object, the question is never changed in place. */
    onChange: (point: CustomTentacleQuestion["places"][number]) => void;
}) => {
    const [open, setOpen] = useState(false);
    const moveTo = (lat: number | null, lng: number | null) =>
        onChange({
            ...point,
            geometry: {
                ...point.geometry,
                coordinates: [
                    lng || point.geometry.coordinates[0],
                    lat || point.geometry.coordinates[1],
                ],
            },
        });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <Marker
                // @ts-expect-error This is passed to options, so it is not typed
                properties={point.properties}
                position={[
                    point.geometry.coordinates[1],
                    point.geometry.coordinates[0],
                ]}
                eventHandlers={{
                    click: () => {
                        setOpen(true);
                    },
                }}
            />
            <DialogContent>
                <div className="flex flex-col gap-2">
                    <Input
                        className="text-center !text-2xl font-bold font-poppins mt-3"
                        value={point.properties?.name}
                        onChange={(e) =>
                            onChange({
                                ...point,
                                properties: {
                                    ...point.properties,
                                    name: e.target.value,
                                },
                            })
                        }
                    />
                    <SidebarMenu>
                        <LatitudeLongitude
                            latitude={point.geometry.coordinates[1]}
                            longitude={point.geometry.coordinates[0]}
                            inlineEdit
                            onChange={moveTo}
                        />
                    </SidebarMenu>
                </div>
            </DialogContent>
        </Dialog>
    );
};

const MatchingPointMarker = ({
    point,
    onChange,
}: {
    point: CustomMatchingQuestion["geo"][number];
    /** The point as edited: a new object, the question is never changed in place. */
    onChange: (point: CustomMatchingQuestion["geo"][number]) => void;
}) => {
    const [open, setOpen] = useState(false);
    const moveTo = (lat: number | null, lng: number | null) =>
        onChange({
            ...point,
            geometry: {
                ...point.geometry,
                coordinates: [
                    lng || point.geometry.coordinates[0],
                    lat || point.geometry.coordinates[1],
                ],
            },
        });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <Marker
                position={[
                    point.geometry.coordinates[1],
                    point.geometry.coordinates[0],
                ]}
                // @ts-expect-error This is passed to options, so it is not typed
                isDialog={true}
                eventHandlers={{
                    click: () => {
                        setOpen(true);
                    },
                }}
            />
            <DialogContent>
                <div className="flex flex-col gap-2">
                    <SidebarMenu>
                        <LatitudeLongitude
                            latitude={point.geometry.coordinates[1]}
                            longitude={point.geometry.coordinates[0]}
                            inlineEdit
                            onChange={moveTo}
                        />
                    </SidebarMenu>
                </div>
            </DialogContent>
        </Dialog>
    );
};

const MeasuringPointMarker = ({
    point,
    onChange,
}: {
    point: CustomMeasuringQuestion["geo"]["features"][number];
    /** The point as edited: a new object, the question is never changed in place. */
    onChange: (
        point: CustomMeasuringQuestion["geo"]["features"][number],
    ) => void;
}) => {
    const [open, setOpen] = useState(false);
    const moveTo = (lat: number | null, lng: number | null) =>
        onChange({
            ...point,
            geometry: {
                ...point.geometry,
                coordinates: [
                    lng || point.geometry.coordinates[0],
                    lat || point.geometry.coordinates[1],
                ],
            },
        });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <Marker
                position={[
                    point.geometry.coordinates[1],
                    point.geometry.coordinates[0],
                ]}
                // @ts-expect-error This is passed to options, so it is not typed
                isDialog={true}
                eventHandlers={{
                    click: () => {
                        setOpen(true);
                    },
                }}
            />
            <DialogContent>
                <div className="flex flex-col gap-2">
                    <SidebarMenu>
                        <LatitudeLongitude
                            latitude={point.geometry.coordinates[1]}
                            longitude={point.geometry.coordinates[0]}
                            inlineEdit
                            onChange={moveTo}
                        />
                    </SidebarMenu>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export const PolygonDraw = () => {
    const $drawingQuestionKey = useStore(drawingQuestionKey);
    const $questions = useStore(questions);
    const $playAreaDrawing = useStore(playAreaDrawing);

    const featureRef = useRef<any | null>(null);
    // The drawing tools show while the play area or a custom question is
    // being drawn.
    const tools = $playAreaDrawing || $drawingQuestionKey !== -1;

    let question: Question | undefined;

    if ($drawingQuestionKey === -1) {
        L.drawLocal.draw.toolbar.buttons.polygon = "Draw the play area";
    } else {
        question = $questions.find((q) => q.key === $drawingQuestionKey);

        if (question?.data.drag === false) {
            drawingQuestionKey.set(-1);
        }
        if (question?.id === "matching") {
            L.drawLocal.draw.toolbar.buttons.polygon =
                "Draw the matching zone(s)!";
        }
        if (question?.id === "measuring") {
            L.drawLocal.draw.toolbar.buttons.polygon =
                "Draw the measuring zone(s)!";
        }
    }

    const onChange = () => {
        if (drawingQuestionKey.get() === -1) {
            if (!featureRef.current?._layers) return;

            const layers = featureRef.current._layers;
            const geoJSONs = Object.values(layers).map((layer: any) =>
                layer.toGeoJSON(),
            );
            const geoJSON = turf.featureCollection(
                geoJSONs,
            ) as FeatureCollection<GeoJSONPolygon | MultiPolygon>;

            mapGeoJSON.set(geoJSON);
            polyGeoJSON.set(geoJSON);
            questions.set([]);
            clearCache(CacheType.ZONE_CACHE);
        } else if (
            question?.id === "tentacles" &&
            question.data.locationType === "custom"
        ) {
            if (!featureRef.current?._layers) return;

            const layers = featureRef.current._layers;
            const geoJSONs = Object.values(layers).map((layer: any) => {
                const geoJSON = layer.toGeoJSON();
                geoJSON.properties = layer.options.properties;

                if (!geoJSON.properties) {
                    geoJSON.properties = {
                        name: lngLatToText(geoJSON.geometry.coordinates),
                    };
                }

                return geoJSON;
            });
            const geoJSON = turf.featureCollection(geoJSONs);

            updateQuestion(question.key, {
                places: _.uniqBy(
                    geoJSON.features as CustomTentacleQuestion["places"],
                    (x) => x.geometry.coordinates.join(","),
                ), // Sometimes keys are duplicated
            });
            if (featureRef.current) {
                Object.values(featureRef.current._layers).map((layer: any) => {
                    if (!layer.options.properties) {
                        featureRef.current.removeLayer(layer);
                    }
                });
            }
        } else if (
            question?.id === "matching" &&
            question.data.type === "custom-zone"
        ) {
            if (!featureRef.current?._layers) return;

            const layers = featureRef.current._layers;
            const geoJSONs = Object.values(layers).map((layer: any) =>
                layer.toGeoJSON(),
            );
            const geoJSON = turf.combine(turf.featureCollection(geoJSONs))
                .features[0];

            updateQuestion(question.key, { geo: geoJSON });
            if (featureRef.current) {
                Object.values(featureRef.current._layers).map((layer: any) => {
                    if (!layer.options.isSpecial) {
                        featureRef.current.removeLayer(layer);
                    }
                });
            }
        } else if (
            question?.id === "matching" &&
            question.data.type === "custom-points"
        ) {
            if (!featureRef.current?._layers) return;

            const layers = featureRef.current._layers;
            const geoJSONs = Object.values(layers).map((layer: any) =>
                layer.toGeoJSON(),
            );
            const geoJSON = turf.featureCollection(geoJSONs);

            updateQuestion(question.key, {
                geo: _.uniqBy(
                    geoJSON.features as CustomTentacleQuestion["places"],
                    (x) => x.geometry.coordinates.join(","),
                ), // Sometimes keys are duplicated
            });
            if (featureRef.current) {
                Object.values(featureRef.current._layers).map((layer: any) => {
                    if (!layer.options.isDialog) {
                        featureRef.current.removeLayer(layer);
                    }
                });
            }
        } else if (
            question?.id === "measuring" &&
            question.data.type === "custom-measure"
        ) {
            if (!featureRef.current?._layers) return;

            const layers = featureRef.current._layers;
            const geoJSONs = Object.values(layers).map((layer: any) =>
                layer.toGeoJSON(),
            );
            const geoJSON = turf.featureCollection(geoJSONs);

            updateQuestion(question.key, {
                geo: turf.featureCollection(
                    _.uniqBy(
                        geoJSON.features as CustomTentacleQuestion["places"],
                        (x) => x.geometry.coordinates.join(","),
                    ),
                ), // Sometimes keys are duplicated
            });
            if (featureRef.current) {
                Object.values(featureRef.current._layers).map((layer: any) => {
                    if (!layer.options.isSpecial && !layer.options.isDialog) {
                        featureRef.current.removeLayer(layer);
                    }
                });
            }
        }
    };

    useEffect(() => {
        if (featureRef.current && $drawingQuestionKey === -1) {
            featureRef.current.clearLayers();
        }
    }, [$drawingQuestionKey]);

    // Each marker edits its own point: the point is replaced in a copy of
    // the question's list (nothing is changed in place).
    const questionKey = question?.key ?? -1;
    const tentaclePlaces =
        question?.id === "tentacles" && question.data.locationType === "custom"
            ? question.data.places
            : null;
    // The schema leaves a custom question's drawn shapes untyped.
    const matchingPoints: DrawnFeature[] | null =
        question?.id === "matching" && question.data.type === "custom-points"
            ? question.data.geo
            : null;
    const measuringGeo: { features: DrawnFeature[] } | null =
        question?.id === "measuring" && question.data.type === "custom-measure"
            ? question.data.geo
            : null;
    const samePoint = (a: DrawnFeature, b: DrawnFeature) =>
        turf.getType(a as any) === "Point" &&
        a.geometry.coordinates.join(",") === b.geometry.coordinates.join(",");

    return (
        <FeatureGroup ref={featureRef}>
            {tentaclePlaces?.map((x, index) => (
                <TentacleMarker
                    key={x.geometry.coordinates.join(",")}
                    point={x}
                    onChange={(point) =>
                        updateQuestion(questionKey, {
                            places: tentaclePlaces.map((p, i) =>
                                i === index ? point : p,
                            ),
                        })
                    }
                />
            ))}
            {matchingPoints?.map((x, index) => (
                <MatchingPointMarker
                    key={x.geometry.coordinates.join(",")}
                    point={x}
                    onChange={(point) =>
                        updateQuestion(questionKey, {
                            geo: matchingPoints.map((p, i) =>
                                i === index ? point : p,
                            ),
                        })
                    }
                />
            ))}
            {measuringGeo &&
                turf
                    .flatten(measuringGeo as any)
                    .features.filter((x: any) => turf.getType(x) === "Point")
                    .map((x: DrawnFeature) => (
                        <MeasuringPointMarker
                            key={x.geometry.coordinates.join(",")}
                            point={x}
                            onChange={(point) =>
                                updateQuestion(questionKey, {
                                    geo: {
                                        ...measuringGeo,
                                        features: measuringGeo.features.map(
                                            (f) =>
                                                samePoint(f, x) ? point : f,
                                        ),
                                    },
                                })
                            }
                        />
                    ))}
            {question &&
                question.id === "measuring" &&
                question.data.type === "custom-measure" &&
                turf
                    .flatten(question.data.geo)
                    .features.filter((x: any) => turf.getType(x) === "Polygon")
                    .map((x: any) => (
                        <Polygon
                            key={x.geometry.coordinates.join(",")}
                            positions={swapCoordinates(x.geometry.coordinates)}
                            // @ts-expect-error This is passed to options, so it is not typed
                            isSpecial={true}
                            stroke
                            pathOptions={{ color: "red" }}
                            fill={false}
                        />
                    ))}
            {question &&
                question.id === "measuring" &&
                question.data.type === "custom-measure" &&
                turf
                    .flatten(question.data.geo)
                    .features.filter(
                        (x: any) => turf.getType(x) === "LineString",
                    )
                    .map((x: any) => (
                        <Polyline
                            key={x.geometry.coordinates.join(",")}
                            positions={swapCoordinates(x.geometry.coordinates)}
                            // @ts-expect-error This is passed to options, so it is not typed
                            isSpecial={true}
                            stroke
                            pathOptions={{ color: "red" }}
                            fill={false}
                        />
                    ))}
            {question &&
                question.id === "matching" &&
                question.data.type === "custom-zone" &&
                question.data.geo &&
                (question.data.geo.type === "FeatureCollection"
                    ? turf.flatten(question.data.geo)
                    : turf.flatten(turf.featureCollection([question.data.geo]))
                ).features.map((x: any) => (
                    <Polygon
                        key={JSON.stringify(x)}
                        positions={swapCoordinates(x.geometry.coordinates)}
                        // @ts-expect-error This is passed to options, so it is not typed
                        isSpecial={true}
                        stroke
                        pathOptions={{ color: "red" }}
                        fill={false}
                    />
                ))}
            {tools && (
                <EditControl
                    position="bottomleft"
                    draw={{
                        rectangle: false,
                        circle: false,
                        circlemarker: false,
                        marker:
                            question?.id === "tentacles" ||
                            (question?.id === "matching" &&
                                question.data.type === "custom-points") ||
                            question?.id === "measuring"
                                ? true
                                : false,
                        polyline: question?.id === "measuring",
                        polygon:
                            question?.id === "tentacles" ||
                            (question?.id === "matching" &&
                                question.data.type === "custom-points")
                                ? false
                                : {
                                      shapeOptions: { fillOpacity: 0 },
                                  },
                    }}
                    onCreated={onChange}
                    onEdited={onChange}
                    onDeleted={onChange}
                />
            )}
        </FeatureGroup>
    );
};
