import { useStore } from "@nanostores/react";
import * as turf from "@turf/turf";
import type {
    Feature,
    FeatureCollection,
    MultiPolygon,
    Point,
    Polygon,
} from "geojson";
import * as L from "leaflet";
import _ from "lodash";
import { SidebarCloseIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

import {
    Sidebar,
    SidebarContent,
    SidebarContext,
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuItem,
} from "@/components/ui/sidebar-r";
import {
    animateMapMovements,
    autoZoom,
    busy,
    disabledStations,
    displayHidingZones,
    displayHidingZonesOptions,
    displayHidingZonesStyle,
    gameSettings,
    hidingRadius,
    hidingRadiusUnits,
    isLoading,
    leafletMapContext,
    planningModeEnabled,
    questionFinishedMapData,
    questions,
    remainingMapData,
    trainStations,
} from "@/lib/context";
import { describeStations } from "@/lib/game/settings";
import { escapeHtml } from "@/lib/html";
import { createLatestRunner } from "@/lib/jobs";
import { cn } from "@/lib/utils";
import {
    type APILocations,
    BLANK_GEOJSON,
    findPlacesSpecificInZone,
    findTentacleLocations,
    nearestToQuestion,
    prettifyLocation,
    QuestionSpecificLocation,
    type StationCircle,
    type StationPlace,
} from "@/maps/api";
import { errorMessage, NotApplicableError } from "@/maps/errors";
import {
    arcDistance,
    extractStationLabel,
    extractStationName,
    geoSpatialVoronoi,
    holedMask,
    lngLatToText,
    safeUnion,
} from "@/maps/geo-utils";
import {
    clipZonesToRemaining,
    measuringCouldMatch,
    placesNearStation,
} from "@/maps/hidingZones";
import { loadStationPlaces } from "@/maps/hidingZoneStations";
import type { Question } from "@/maps/schema";
import {
    applyStationNameQuestion,
    nearestStation,
    stationSignName,
} from "@/maps/stationNames";
import { sharesTrainLineWith } from "@/maps/trainLines";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollToTop } from "./ui/scroll-to-top";
import { SegmentedControl, ToggleCard } from "./ui/toggle-card";

/** Sidebar row holding a full-width setting card. */
const CARD_ITEM = "px-2 py-1 list-none";

export const ZoneSidebar = () => {
    const $displayHidingZones = useStore(displayHidingZones);
    const $questionFinishedMapData = useStore(questionFinishedMapData);
    const $remaining = useStore(remainingMapData);
    const $displayHidingZonesOptions = useStore(displayHidingZonesOptions);
    const $displayHidingZonesStyle = useStore(displayHidingZonesStyle);
    const $hidingRadius = useStore(hidingRadius);
    const $hidingRadiusUnits = useStore(hidingRadiusUnits);
    const $gameSettings = useStore(gameSettings);
    const $isLoading = useStore(isLoading);
    const map = useStore(leafletMapContext);
    const stations = useStore(trainStations);
    const $disabledStations = useStore(disabledStations);
    const [selectedStationId, setSelectedStationId] = useState("");
    const [stationSearch, setStationSearch] = useState("");
    const [showLeft, setShowLeft] = useState(true);
    const [showRemoved, setShowRemoved] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);

    const removeHidingZones = () => {
        if (!map) return;

        map.eachLayer((layer: any) => {
            if (layer.hidingZones) {
                // Hopefully only geoJSON layers
                map.removeLayer(layer);
            }
        });
    };

    const showGeoJSON = (
        geoJSONData: any,
        selectableZones: boolean = false,
        additionalOptions: L.GeoJSONOptions = {},
    ) => {
        if (!map) return;

        removeHidingZones();

        const geoJsonLayer = L.geoJSON(geoJSONData, {
            style: {
                color: "green",
                fillColor: "green",
                fillOpacity: 0.2,
            },
            onEachFeature: selectableZones
                ? (feature, layer) => {
                      if (feature.geometry.type === "Point") return;
                      layer.on("click", async () => {
                          if (!map) return;

                          setSelectedStationId(
                              feature.properties.properties.id,
                          );
                      });
                  }
                : undefined,
            pointToLayer(geoJsonPoint, latlng) {
                const marker = L.marker(latlng, {
                    icon: L.divIcon({
                        html: `<div class="text-black bg-opacity-0"><svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 448 512" width="1em" height="1em" xmlns="http://www.w3.org/2000/svg"><path d="M96 0C43 0 0 43 0 96L0 352c0 48 35.2 87.7 81.1 94.9l-46 46C28.1 499.9 33.1 512 43 512l39.7 0c8.5 0 16.6-3.4 22.6-9.4L160 448l128 0 54.6 54.6c6 6 14.1 9.4 22.6 9.4l39.7 0c10 0 15-12.1 7.9-19.1l-46-46c46-7.1 81.1-46.9 81.1-94.9l0-256c0-53-43-96-96-96L96 0zM64 96c0-17.7 14.3-32 32-32l256 0c17.7 0 32 14.3 32 32l0 96c0 17.7-14.3 32-32 32L96 224c-17.7 0-32-14.3-32-32l0-96zM224 288a48 48 0 1 1 0 96 48 48 0 1 1 0-96z"></path></svg></div>`,
                        className: "",
                    }),
                });

                marker.bindPopup(
                    `<b>${escapeHtml(
                        extractStationName(geoJsonPoint) || "No Name Found",
                    )} (${lngLatToText(
                        geoJsonPoint.geometry.coordinates as [number, number],
                    )})</b>`,
                );

                return marker;
            },
            ...additionalOptions,
        });

        // @ts-expect-error This is intentionally added as a check
        geoJsonLayer.hidingZones = true;

        geoJsonLayer.addTo(map);
    };

    useEffect(() => {
        if (!map || !$displayHidingZones || !$questionFinishedMapData) return;

        requestHidingZoneRefresh();
    }, [
        $questionFinishedMapData,
        $displayHidingZones,
        $displayHidingZonesOptions,
        $hidingRadius,
        $hidingRadiusUnits,
    ]);

    useEffect(() => {
        if (!map) return;

        if ($displayHidingZones && selectedStationId) {
            const hiderStation = _.find(
                stations,
                (c) => c.properties.properties.id === selectedStationId,
            );

            if (hiderStation !== undefined) {
                busy.track(() =>
                    selectionProcess(
                        hiderStation,
                        map,
                        stations,
                        showGeoJSON,
                        $questionFinishedMapData,
                        turf.convertLength(
                            $hidingRadius,
                            $hidingRadiusUnits,
                            "kilometers",
                        ),
                    ),
                ).catch((error) => {
                    console.error("Error in hiding zone selection:", error);
                    toast.error(
                        `Couldn't check this hiding zone: ${errorMessage(error)}`,
                        { toastId: "hiding-zone-selection-error" },
                    );
                });
            } else {
                toast.error("Invalid hiding zone selected", {
                    toastId: "hiding-zone-selection-error",
                });
            }
        } else if ($displayHidingZones) {
            const activeStations = stations.filter(
                (x) => !$disabledStations.includes(x.properties.properties.id),
            );
            showGeoJSON(
                styleStations(
                    activeStations,
                    $displayHidingZonesStyle,
                    $remaining,
                ),
                $displayHidingZonesStyle === "zones",
            );
        } else {
            removeHidingZones();
        }
    }, [
        $disabledStations,
        $displayHidingZones,
        $displayHidingZonesStyle,
        $hidingRadius,
        $hidingRadiusUnits,
        $questionFinishedMapData,
        $remaining,
        selectedStationId,
        stations,
    ]);

    const label = (station: StationCircle) =>
        extractStationLabel(station.properties) as string;
    const matches = (station: StationCircle) =>
        stationSearch.trim() === "" ||
        label(station)
            .toLowerCase()
            .includes(stationSearch.trim().toLowerCase());
    const left = stations.filter(
        (x) => !$disabledStations.includes(x.properties.properties.id),
    );
    const removed = stations.filter((x) =>
        $disabledStations.includes(x.properties.properties.id),
    );
    const selected = stations.find(
        (x) => x.properties.properties.id === selectedStationId,
    );

    const StationRow = ({
        station,
        action,
        onAction,
    }: {
        station: StationCircle;
        action: string;
        onAction: () => void;
    }) => (
        <li
            className="flex items-center gap-2 rounded-sm px-2 py-1 text-sm hover:bg-accent"
            data-station-id={station.properties.properties.id}
        >
            <span className="flex-1 truncate">{label(station)}</span>
            <button
                type="button"
                className="rounded-md bg-slate-600 px-1.5 py-0.5 text-xs"
                disabled={$isLoading}
                onClick={() =>
                    setSelectedStationId(station.properties.properties.id)
                }
            >
                View
            </button>
            <button
                type="button"
                className="rounded-md bg-slate-700 px-1.5 py-0.5 text-xs"
                disabled={$isLoading}
                onClick={onAction}
            >
                {action}
            </button>
        </li>
    );

    return (
        <Sidebar side="right">
            <div className="flex items-center justify-between">
                <h2 className="ml-4 mt-4 font-poppins text-2xl">Hiding Zone</h2>
                <SidebarCloseIcon
                    className="mr-2 visible md:hidden scale-x-[-1]"
                    onClick={() => {
                        SidebarContext.get().setOpenMobile(false);
                    }}
                />
            </div>
            <SidebarContent ref={sidebarRef}>
                <ScrollToTop element={sidebarRef} minHeight={500} />
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem className={CARD_ITEM}>
                                <ToggleCard
                                    title="Show hiding zones"
                                    description="Where the hider could still be, around every station still in play."
                                    checked={$displayHidingZones}
                                    onCheckedChange={displayHidingZones.set}
                                    disabled={$isLoading}
                                />
                            </SidebarMenuItem>
                            {$displayHidingZones && (
                                <SidebarMenuItem className={CARD_ITEM}>
                                    <SegmentedControl
                                        label="Show on the map"
                                        options={[
                                            { value: "zones", label: "Zones" },
                                            {
                                                value: "stations",
                                                label: "Stations",
                                            },
                                        ]}
                                        value={$displayHidingZonesStyle}
                                        onValueChange={(style) => {
                                            setSelectedStationId("");
                                            displayHidingZonesStyle.set(style);
                                        }}
                                        disabled={$isLoading}
                                    />
                                </SidebarMenuItem>
                            )}
                            {$displayHidingZones && (
                                <SidebarMenuItem
                                    className={cn(
                                        CARD_ITEM,
                                        "text-xs text-slate-400",
                                    )}
                                >
                                    {$hidingRadius}{" "}
                                    {$hidingRadiusUnits === "kilometers"
                                        ? "km"
                                        : $hidingRadiusUnits}{" "}
                                    around{" "}
                                    {describeStations(
                                        $gameSettings.stationKinds,
                                    )}
                                    . Change: Menu → Game.
                                </SidebarMenuItem>
                            )}
                            {$displayHidingZones && selected && (
                                <SidebarMenuItem
                                    className={cn(
                                        CARD_ITEM,
                                        "rounded-md border border-green-500/60 text-sm",
                                    )}
                                >
                                    <p>
                                        Checking{" "}
                                        <strong>{label(selected)}</strong>: the
                                        parts of its zone the answers rule out
                                        are shaded.
                                    </p>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="mt-1"
                                        onClick={() => setSelectedStationId("")}
                                    >
                                        Back to all zones
                                    </Button>
                                </SidebarMenuItem>
                            )}
                            {$displayHidingZones && (
                                <SidebarMenuItem className={CARD_ITEM}>
                                    <button
                                        type="button"
                                        className="flex w-full items-center justify-between py-1 text-left font-semibold font-poppins"
                                        onClick={() => setShowLeft(!showLeft)}
                                        aria-expanded={showLeft}
                                        data-testid="remaining-stations-count"
                                    >
                                        <span>
                                            {left.length === 1
                                                ? "1 station left"
                                                : `${left.length} stations left`}
                                        </span>
                                        <span aria-hidden="true">
                                            {showLeft ? "▾" : "▸"}
                                        </span>
                                    </button>
                                    {showLeft && (
                                        <>
                                            <Input
                                                placeholder="Search stations…"
                                                value={stationSearch}
                                                onChange={(event) =>
                                                    setStationSearch(
                                                        event.target.value,
                                                    )
                                                }
                                                debounce={200}
                                                disabled={$isLoading}
                                            />
                                            <ul className="mt-1 flex flex-col">
                                                {left
                                                    .filter(matches)
                                                    .map((station) => (
                                                        <StationRow
                                                            key={
                                                                station
                                                                    .properties
                                                                    .properties
                                                                    .id
                                                            }
                                                            station={station}
                                                            action="Remove"
                                                            onAction={() =>
                                                                disabledStations.set(
                                                                    [
                                                                        ...$disabledStations,
                                                                        station
                                                                            .properties
                                                                            .properties
                                                                            .id,
                                                                    ],
                                                                )
                                                            }
                                                        />
                                                    ))}
                                                {left.length > 0 &&
                                                    left.filter(matches)
                                                        .length === 0 && (
                                                        <li className="px-2 py-1 text-sm text-slate-400">
                                                            No station matches.
                                                        </li>
                                                    )}
                                            </ul>
                                        </>
                                    )}
                                </SidebarMenuItem>
                            )}
                            {$displayHidingZones && removed.length > 0 && (
                                <SidebarMenuItem className={CARD_ITEM}>
                                    <button
                                        type="button"
                                        className="flex w-full items-center justify-between py-1 text-left font-semibold font-poppins text-slate-400"
                                        onClick={() =>
                                            setShowRemoved(!showRemoved)
                                        }
                                        aria-expanded={showRemoved}
                                    >
                                        <span>Removed ({removed.length})</span>
                                        <span aria-hidden="true">
                                            {showRemoved ? "▾" : "▸"}
                                        </span>
                                    </button>
                                    {showRemoved && (
                                        <>
                                            <ul className="flex flex-col">
                                                {removed.map((station) => (
                                                    <StationRow
                                                        key={
                                                            station.properties
                                                                .properties.id
                                                        }
                                                        station={station}
                                                        action="Restore"
                                                        onAction={() =>
                                                            disabledStations.set(
                                                                $disabledStations.filter(
                                                                    (id) =>
                                                                        id !==
                                                                        station
                                                                            .properties
                                                                            .properties
                                                                            .id,
                                                                ),
                                                            )
                                                        }
                                                    />
                                                ))}
                                            </ul>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="mt-1"
                                                onClick={() =>
                                                    disabledStations.set([])
                                                }
                                            >
                                                Restore all
                                            </Button>
                                        </>
                                    )}
                                </SidebarMenuItem>
                            )}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    );
};

const HOME_GAME_TYPES = [
    "aquarium",
    "zoo",
    "theme_park",
    "peak",
    "museum",
    "hospital",
    "cinema",
    "library",
    "golf_course",
    "consulate",
    "park",
];

/** Narrows the hiding zones by one question, where that question applies. */
const applyQuestionToHidingZones = async (
    question: Question,
    { places, circles }: { places: StationPlace[]; circles: StationCircle[] },
): Promise<StationCircle[]> => {
    if (question.id === "matching") {
        const data = question.data;
        const seeker = turf.point([data.lng, data.lat]);

        if (
            data.type === "same-first-letter-station" ||
            data.type === "same-length-station"
        ) {
            return applyStationNameQuestion({
                question: { ...data, type: data.type },
                allStations: places,
                remaining: circles,
                seeker,
            });
        }

        if (data.type === "same-train-line") {
            const seekerStation = nearestStation(places, seeker);
            const id = seekerStation.properties.id;
            if (!id || !id.includes("/")) {
                throw new NotApplicableError(
                    "The seeker's nearest station has no map-data id.",
                );
            }
            const sharesLine = await sharesTrainLineWith(
                id,
                stationSignName(seekerStation.properties),
            );
            return circles.filter((circle) => {
                const stationId = circle.properties.properties.id;
                if (!stationId || !stationId.includes("/")) return false;
                const onLine = sharesLine(stationId);
                return data.same ? onLine : !onLine;
            });
        }
    }

    if (
        question.id === "measuring" &&
        (question.data.type === "mcdonalds" || question.data.type === "seven11")
    ) {
        const data = question.data;
        const points = (await findPlacesSpecificInZone(
            data.type === "mcdonalds"
                ? QuestionSpecificLocation.McDonalds
                : QuestionSpecificLocation.Seven11,
        )) as FeatureCollection<Point>;
        if (points.features.length === 0) {
            throw new NotApplicableError(
                data.type === "mcdonalds"
                    ? "No McDonald's in the play area."
                    : "No 7-Elevens in the play area.",
            );
        }

        const seeker = turf.point([data.lng, data.lat]);
        const seekerDistanceKm = await arcDistance(
            seeker,
            turf.nearestPoint(seeker, points),
            "kilometers",
        );
        const eligible = await Promise.all(
            circles.map(async (circle) => {
                const station = turf.point(turf.getCoord(circle.properties));
                const stationDistanceKm = await arcDistance(
                    station,
                    turf.nearestPoint(station, points),
                    "kilometers",
                );
                return measuringCouldMatch({
                    stationDistanceKm,
                    seekerDistanceKm,
                    hidingRadius: hidingRadius.get(),
                    hidingRadiusUnit: hidingRadiusUnits.get(),
                    hiderCloser: data.hiderCloser,
                });
            }),
        );
        return circles.filter((_, index) => eligible[index]);
    }

    return circles;
};

const computeHidingZones = async () => {
    const eliminated = questionFinishedMapData.get();
    if (!displayHidingZones.get() || !eliminated) return;

    if (displayHidingZonesOptions.get().length === 0) {
        toast.error("Choose at least one kind of station for hiding zones.");
        return;
    }

    const radius = hidingRadius.get();
    const units = hidingRadiusUnits.get();

    const places = await loadStationPlaces();

    const eliminatedArea = safeUnion(
        turf.simplify(eliminated, { tolerance: 0.001 }),
    );
    let circles = places
        .map(
            (place) =>
                turf.circle(turf.getCoord(place), radius, {
                    steps: 32,
                    units,
                    properties: place,
                }) as unknown as StationCircle,
        )
        .filter((circle) => !turf.booleanWithin(circle, eliminatedArea));

    for (const question of questions.get()) {
        if (question.data.hidden) continue;
        if (planningModeEnabled.get() && question.data.drag) continue;

        try {
            circles = await applyQuestionToHidingZones(question, {
                places,
                circles,
            });
        } catch (error) {
            toast.warning(
                `Hiding zones skip a question: ${errorMessage(error)}`,
                { toastId: `hiding-zones-${question.key}` },
            );
        }
    }

    trainStations.set(circles);
};

const runHidingZoneRefresh = createLatestRunner(() =>
    busy.track(computeHidingZones),
);

/** Recomputes the hiding zones; overlapping requests are coalesced. */
const requestHidingZoneRefresh = () =>
    runHidingZoneRefresh().catch((error) => {
        console.error("Error in hiding zone initialization:", error);
        toast.error(`Couldn't compute hiding zones: ${errorMessage(error)}`, {
            toastId: "hiding-zone-initialization-error",
        });
    });

/** What to draw: the zones (cut to the area still in play) or the stations. */
function styleStations(
    circles: StationCircle[],
    style: "zones" | "stations",
    remaining: FeatureCollection<Polygon | MultiPolygon> | null,
): FeatureCollection {
    if (circles.length === 0) return turf.featureCollection([]);
    if (style === "stations") {
        return turf.featureCollection(circles.map((c) => c.properties));
    }
    return turf.featureCollection(
        remaining ? clipZonesToRemaining(circles, remaining) : circles,
    );
}

async function selectionProcess(
    station: StationCircle,
    map: L.Map,
    stations: StationCircle[],
    showGeoJSON: (geoJSONData: any) => void,
    $questionFinishedMapData: any,
    hidingRadiusKm: number,
) {
    const bbox = turf.bbox(station);

    const bounds: [[number, number], [number, number]] = [
        [bbox[1], bbox[0]],
        [bbox[3], bbox[2]],
    ];

    const stationPoint = station.properties as unknown as Feature<Point>;
    const [lng, lat] = stationPoint.geometry.coordinates;

    let mapData: any = turf.featureCollection([
        safeUnion(
            turf.featureCollection([
                ...$questionFinishedMapData.features,
                turf.mask(station as any),
            ]),
        ),
    ]);

    for (const question of questions.get()) {
        if (question.data.hidden) continue;
        if (planningModeEnabled.get() && question.data.drag) {
            continue;
        }

        if (
            (question.id === "measuring" || question.id === "matching") &&
            HOME_GAME_TYPES.includes(question.data.type)
        ) {
            const locationType = question.data.type as APILocations;
            const nearestQuestion = await nearestToQuestion(
                question.data as any,
            );

            const nearestPoints = await placesNearStation(
                async (radiusKm) =>
                    (
                        await findTentacleLocations(
                            {
                                lat,
                                lng,
                                radius: radiusKm,
                                unit: "kilometers",
                                locationType,
                            },
                            "Finding matching locations to hiding zone...",
                        )
                    ).features.filter((x: any) => x.properties.name),
                stationPoint,
                {
                    hidingRadiusKm,
                    startKm: 50,
                    maxKm: 400,
                    what: prettifyLocation(locationType, true).toLowerCase(),
                },
            );

            if (question.id === "matching") {
                const voronoi = geoSpatialVoronoi(
                    turf.featureCollection(nearestPoints) as any,
                );

                const correctPolygon = voronoi.features.find((feature: any) => {
                    return (
                        feature.properties.site.properties.name ===
                        nearestQuestion.properties.name
                    );
                });

                if (!correctPolygon) {
                    if (question.data.same) {
                        mapData = BLANK_GEOJSON;
                    }

                    continue;
                }

                mapData = safeUnion(
                    turf.featureCollection([
                        ...mapData.features,
                        question.data.same
                            ? turf.mask(correctPolygon as any)
                            : correctPolygon,
                    ]),
                );
            } else {
                const circles = nearestPoints.map((x) =>
                    turf.circle(
                        turf.getCoord(x),
                        nearestQuestion.properties.distanceToPoint,
                    ),
                );

                mapData = safeUnion(
                    turf.featureCollection(
                        question.data.hiderCloser
                            ? [
                                  ...mapData.features,
                                  holedMask(turf.featureCollection(circles)),
                              ]
                            : [...mapData.features, ...circles],
                    ),
                );
            }
        }
        if (
            question.id === "measuring" &&
            question.data.type === "rail-measure"
        ) {
            const location = turf.point([question.data.lng, question.data.lat]);
            const stationPoints = turf.featureCollection(
                stations.map((x) => x.properties as unknown as Feature<Point>),
            );

            const nearestTrainStation = turf.nearestPoint(
                location,
                stationPoints,
            );
            const distanceKm = await arcDistance(location, nearestTrainStation);

            // Stations that could be the nearest one for someone in this zone.
            const nearby = await Promise.all(
                stationPoints.features.map(
                    async (x) =>
                        (await arcDistance(stationPoint, x)) <
                        distanceKm + hidingRadiusKm,
                ),
            );
            const circles = stationPoints.features
                .filter((_, index) => nearby[index])
                .map((x) =>
                    turf.circle(x, distanceKm, { units: "kilometers" }),
                );

            mapData = safeUnion(
                turf.featureCollection(
                    question.data.hiderCloser
                        ? [
                              ...mapData.features,
                              holedMask(turf.featureCollection(circles)),
                          ]
                        : [...mapData.features, ...circles],
                ),
            );
        }
        if (
            question.id === "measuring" &&
            (question.data.type === "mcdonalds" ||
                question.data.type === "seven11")
        ) {
            const points = await findPlacesSpecificInZone(
                question.data.type === "mcdonalds"
                    ? QuestionSpecificLocation.McDonalds
                    : QuestionSpecificLocation.Seven11,
            );
            if (points.features.length === 0) continue;

            const seeker = turf.point([question.data.lng, question.data.lat]);
            const nearest = turf.nearestPoint(seeker, points as any);

            const distanceKm = await arcDistance(seeker, nearest, "kilometers");

            const nearStation = await Promise.all(
                points.features.map(
                    async (x) =>
                        (await arcDistance(
                            x as any,
                            stationPoint,
                            "kilometers",
                        )) <
                        distanceKm + hidingRadiusKm,
                ),
            );
            const circles = points.features
                .filter((_, index) => nearStation[index])
                .map((x) =>
                    turf.circle(x as any, distanceKm, {
                        units: "kilometers",
                    }),
                );

            mapData = safeUnion(
                turf.featureCollection(
                    question.data.hiderCloser
                        ? [
                              ...mapData.features,
                              holedMask(turf.featureCollection(circles)),
                          ]
                        : [...mapData.features, ...circles],
                ),
            );
        }

        if (mapData.type !== "FeatureCollection") {
            mapData = {
                type: "FeatureCollection",
                features: [mapData],
            };
        }
    }

    if (_.isEqual(mapData, BLANK_GEOJSON)) {
        toast.warning(
            "The hider cannot be in this hiding zone. This wasn't eliminated on the sidebar as its absence was caused by multiple criteria.",
        );
    }

    showGeoJSON(mapData);

    if (autoZoom.get()) {
        if (animateMapMovements.get()) {
            map?.flyToBounds(bounds);
        } else {
            map?.fitBounds(bounds);
        }
    }

    const element: HTMLDivElement | null = document.querySelector(
        `[data-station-id="${CSS.escape(station.properties.properties.id)}"]`,
    );

    if (element) {
        element.scrollIntoView({
            behavior: "smooth",
            block: "center",
        });
        element.classList.add("selected-card-background-temporary");

        setTimeout(() => {
            element.classList.remove("selected-card-background-temporary");
        }, 5000);
    }
}
