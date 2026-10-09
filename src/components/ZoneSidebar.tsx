import { useStore } from "@nanostores/react";
import * as turf from "@turf/turf";
import type { Feature, FeatureCollection, Point } from "geojson";
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
    customStations as customStationsAtom,
    disabledStations,
    displayHidingZones,
    displayHidingZonesOptions,
    displayHidingZonesStyle,
    hidingRadius,
    hidingRadiusUnits,
    includeDefaultStations as includeDefaultStationsAtom,
    isLoading,
    leafletMapContext,
    mergeDuplicates as mergeDuplicatesAtom,
    planningModeEnabled,
    questionFinishedMapData,
    questions,
    showRemainingStations,
    trainStations,
    useCustomStations as useCustomStationsAtom,
} from "@/lib/context";
import { escapeHtml } from "@/lib/html";
import { createLatestRunner } from "@/lib/jobs";
import { cn } from "@/lib/utils";
import {
    type APILocations,
    BLANK_GEOJSON,
    findPlacesSpecificInZone,
    findTentacleLocations,
    nearestToQuestion,
    parseCustomStationsFromText,
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
    mergeDuplicateStation,
    safeUnion,
} from "@/maps/geo-utils";
import {
    BOAT_STOPS,
    measuringCouldMatch,
    placesNearStation,
    TRAM_STOPS,
    withStationKind,
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
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "./ui/command";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { MultiSelect } from "./ui/multi-select";
import { ScrollToTop } from "./ui/scroll-to-top";
import { MENU_ITEM_CLASSNAME } from "./ui/sidebar-l";
import { SegmentedControl, ToggleCard } from "./ui/toggle-card";
import { UnitSelect } from "./UnitSelect";

function _previewText(count: number) {
    return `${count} custom station${count === 1 ? "" : "s"} imported`;
}

let buttonJustClicked = false;

/** Sidebar row holding a full-width setting card. */
const CARD_ITEM = "px-2 py-1 list-none";

export const ZoneSidebar = () => {
    const $displayHidingZones = useStore(displayHidingZones);
    const $questionFinishedMapData = useStore(questionFinishedMapData);
    const $displayHidingZonesOptions = useStore(displayHidingZonesOptions);
    const $displayHidingZonesStyle = useStore(displayHidingZonesStyle);
    const $showRemainingStations = useStore(showRemainingStations);
    const $hidingRadius = useStore(hidingRadius);
    const $hidingRadiusUnits = useStore(hidingRadiusUnits);
    const $isLoading = useStore(isLoading);
    const map = useStore(leafletMapContext);
    const stations = useStore(trainStations);
    const $disabledStations = useStore(disabledStations);
    const useCustomStations = useStore(useCustomStationsAtom);
    const mergeDuplicates = useStore(mergeDuplicatesAtom);
    const includeDefaultStations = useStore(includeDefaultStationsAtom);
    const $customStations = useStore(customStationsAtom);
    const [hidingZoneModeStationID, setHidingZoneModeStationID] =
        useState<string>("");
    const [stationSearch, setStationSearch] = useState<string>("");
    const isStationSearchActive = stationSearch.trim().length > 0;
    const setStations = trainStations.set;
    const sidebarRef = useRef<HTMLDivElement>(null);
    const [importUrl, setImportUrl] = useState("");

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
        nonOverlappingStations: boolean = false,
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
            onEachFeature: nonOverlappingStations
                ? (feature, layer) => {
                      if (feature.geometry.type === "Point") return;
                      layer.on("click", async () => {
                          if (!map) return;

                          setHidingZoneModeStationID(
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
        useCustomStations,
        includeDefaultStations,
        $customStations,
        mergeDuplicates,
    ]);

    useEffect(() => {
        if (!map) return;

        if ($displayHidingZones && hidingZoneModeStationID) {
            const hiderStation = _.find(
                stations,
                (c) => c.properties.properties.id === hidingZoneModeStationID,
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
                withStationMarkers(
                    styleStations(activeStations, $displayHidingZonesStyle),
                    activeStations,
                    $showRemainingStations &&
                        $displayHidingZonesStyle !== "stations",
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
        $showRemainingStations,
        hidingZoneModeStationID,
        stations,
    ]);

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
                                    description="A circle around every station the hider could be at. Can be slow on older phones."
                                    checked={$displayHidingZones}
                                    onCheckedChange={displayHidingZones.set}
                                    disabled={$isLoading}
                                />
                            </SidebarMenuItem>
                            {$displayHidingZones && (
                                <SidebarMenuItem className={CARD_ITEM}>
                                    <p className="mb-1 text-xs font-semibold text-slate-300">
                                        Show on the map
                                    </p>
                                    <SegmentedControl
                                        label="Show on the map"
                                        options={[
                                            { value: "zones", label: "Zones" },
                                            {
                                                value: "no-overlap",
                                                label: "Merged",
                                            },
                                            {
                                                value: "stations",
                                                label: "Stations",
                                            },
                                            {
                                                value: "no-display",
                                                label: "Nothing",
                                            },
                                        ]}
                                        value={$displayHidingZonesStyle}
                                        onValueChange={(style) => {
                                            setHidingZoneModeStationID("");
                                            displayHidingZonesStyle.set(style);
                                        }}
                                        disabled={$isLoading}
                                    />
                                </SidebarMenuItem>
                            )}
                            {$displayHidingZones && (
                                <SidebarMenuItem className={CARD_ITEM}>
                                    <ToggleCard
                                        title="Show remaining stations"
                                        description="A marker on every station still in play, on top of the zones."
                                        checked={$showRemainingStations}
                                        onCheckedChange={
                                            showRemainingStations.set
                                        }
                                        disabled={$isLoading}
                                    />
                                </SidebarMenuItem>
                            )}
                            <SidebarMenuItem className={CARD_ITEM}>
                                <ToggleCard
                                    title="Use my own station list"
                                    description="Import stations from a file, a link or pasted text."
                                    checked={useCustomStations}
                                    onCheckedChange={useCustomStationsAtom.set}
                                    disabled={$isLoading}
                                />
                            </SidebarMenuItem>
                            <SidebarMenuItem className={CARD_ITEM}>
                                <ToggleCard
                                    title="Merge duplicate stations"
                                    description="One zone for stations mapped more than once."
                                    checked={mergeDuplicates}
                                    onCheckedChange={mergeDuplicatesAtom.set}
                                    disabled={$isLoading}
                                />
                            </SidebarMenuItem>
                            {useCustomStations && (
                                <>
                                    <SidebarMenuItem
                                        className={MENU_ITEM_CLASSNAME}
                                    >
                                        <div className="flex flex-col gap-2 w-full">
                                            <Label className="font-semibold font-poppins leading-5">
                                                Import stations from URL (CSV,
                                                GeoJSON, KML). This must be a
                                                raw file link.
                                            </Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder="https://..."
                                                    value={importUrl}
                                                    onChange={(e) =>
                                                        setImportUrl(
                                                            e.target.value,
                                                        )
                                                    }
                                                    disabled={$isLoading}
                                                />
                                                <button
                                                    className="bg-blue-600 text-white px-3 rounded-md"
                                                    disabled={$isLoading}
                                                    onClick={async () => {
                                                        if (!importUrl) return;
                                                        try {
                                                            const res =
                                                                await fetch(
                                                                    importUrl,
                                                                );
                                                            const contentType =
                                                                res.headers.get(
                                                                    "content-type",
                                                                ) || undefined;
                                                            const text =
                                                                await res.text();
                                                            const parsed =
                                                                parseCustomStationsFromText(
                                                                    text,
                                                                    contentType ||
                                                                        undefined,
                                                                );
                                                            if (
                                                                parsed.length ===
                                                                0
                                                            ) {
                                                                toast.error(
                                                                    "No stations found in provided URL",
                                                                );
                                                                return;
                                                            }
                                                            customStationsAtom.set(
                                                                parsed,
                                                            );
                                                            toast.success(
                                                                `Imported ${parsed.length} stations`,
                                                            );
                                                        } catch (e: any) {
                                                            toast.error(
                                                                `Failed to import from URL: ${e.message || e}`,
                                                            );
                                                        }
                                                    }}
                                                >
                                                    Import
                                                </button>
                                            </div>
                                            <div>
                                                <Input
                                                    type="file"
                                                    multiple
                                                    accept=".csv,.json,.geojson,.kml,application/json,application/vnd.google-earth.kml+xml,text/csv,application/vnd.google-apps.kml+xml,application/xml,text/xml"
                                                    onInput={async (e) => {
                                                        const files = (
                                                            e.target as HTMLInputElement
                                                        ).files;
                                                        if (
                                                            !files ||
                                                            files.length === 0
                                                        )
                                                            return;
                                                        try {
                                                            const all: any[] =
                                                                [];
                                                            for (const file of Array.from(
                                                                files,
                                                            )) {
                                                                const text =
                                                                    await file.text();
                                                                const parsed =
                                                                    parseCustomStationsFromText(
                                                                        text,
                                                                        file.type,
                                                                    );
                                                                all.push(
                                                                    ...parsed,
                                                                );
                                                            }
                                                            if (
                                                                all.length === 0
                                                            ) {
                                                                toast.error(
                                                                    "No stations found in uploaded files",
                                                                );
                                                                return;
                                                            }
                                                            const byKey =
                                                                new Map<
                                                                    string,
                                                                    any
                                                                >();
                                                            for (const s of all) {
                                                                const key =
                                                                    s.id &&
                                                                    s.id.includes(
                                                                        "/",
                                                                    )
                                                                        ? `id:${s.id}`
                                                                        : `pt:${s.lat},${s.lng}`;
                                                                if (
                                                                    !byKey.has(
                                                                        key,
                                                                    )
                                                                )
                                                                    byKey.set(
                                                                        key,
                                                                        s,
                                                                    );
                                                            }
                                                            const unique =
                                                                Array.from(
                                                                    byKey.values(),
                                                                );
                                                            customStationsAtom.set(
                                                                unique,
                                                            );
                                                            toast.success(
                                                                `Imported ${unique.length} stations`,
                                                            );
                                                        } catch (e: any) {
                                                            toast.error(
                                                                `Failed to import files: ${e.message || e}`,
                                                            );
                                                        }
                                                    }}
                                                />
                                            </div>
                                            <ToggleCard
                                                title="Also use the map's stations"
                                                description="Your list plus the stations chosen below."
                                                checked={includeDefaultStations}
                                                onCheckedChange={
                                                    includeDefaultStationsAtom.set
                                                }
                                                disabled={$isLoading}
                                            />
                                            {$customStations.length > 0 && (
                                                <div className="text-sm text-gray-300">
                                                    {_previewText(
                                                        $customStations.length,
                                                    )}
                                                </div>
                                            )}
                                            {$customStations.length > 0 && (
                                                <div className="flex gap-2">
                                                    <Button
                                                        className="w-full"
                                                        onClick={() =>
                                                            customStationsAtom.set(
                                                                [],
                                                            )
                                                        }
                                                    >
                                                        Clear Imported
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </SidebarMenuItem>
                                </>
                            )}
                            <StationKindSwitch
                                label="Tram stops count as stations"
                                kind={TRAM_STOPS}
                                selected={$displayHidingZonesOptions}
                                disabled={$isLoading}
                            />
                            <StationKindSwitch
                                label="Boat stops count as stations"
                                kind={BOAT_STOPS}
                                selected={$displayHidingZonesOptions}
                                disabled={$isLoading}
                            />
                            <SidebarMenuItem className={MENU_ITEM_CLASSNAME}>
                                <MultiSelect
                                    options={[
                                        {
                                            label: "Railway Stations",
                                            value: "[railway=station]",
                                        },
                                        {
                                            label: "Railway Halts",
                                            value: "[railway=halt]",
                                        },
                                        {
                                            label: "Railway Stops",
                                            value: "[railway=stop]",
                                        },
                                        {
                                            label: "Tram Stops",
                                            value: "[railway=tram_stop]",
                                        },
                                        {
                                            label: "Bus Stops",
                                            value: "[highway=bus_stop]",
                                        },
                                        {
                                            label: "Ferry Terminals",
                                            value: "[amenity=ferry_terminal]",
                                        },
                                        {
                                            label: "Ferry Platforms (public transport)",
                                            value: "[public_transport=platform][platform=ferry]",
                                        },
                                        {
                                            label: "Funicular Stations",
                                            value: "[railway=funicular]",
                                        },
                                        {
                                            label: "Aerialway Stations",
                                            value: "[aerialway=station]",
                                        },
                                        {
                                            label: "Railway Stations Excluding Subways",
                                            value: "[railway=station][subway!=yes]",
                                        },
                                        {
                                            label: "Subway Stations",
                                            value: "[railway=station][subway=yes]",
                                        },
                                        {
                                            label: "Light Rail Stations",
                                            value: "[railway=station][light_rail=yes]",
                                        },
                                        {
                                            label: "Light Rail Halts",
                                            value: "[railway=halt][light_rail=yes]",
                                        },
                                    ]}
                                    onValueChange={
                                        displayHidingZonesOptions.set
                                    }
                                    defaultValue={$displayHidingZonesOptions}
                                    placeholder="Select allowed places"
                                    animation={2}
                                    maxCount={3}
                                    modalPopover
                                    className="!bg-popover bg-opacity-100"
                                    disabled={
                                        $isLoading ||
                                        (useCustomStations &&
                                            !includeDefaultStations)
                                    }
                                />
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <Label className="font-semibold font-poppins ml-2">
                                    Hiding Zone Radius
                                </Label>
                                <div
                                    className={cn(
                                        MENU_ITEM_CLASSNAME,
                                        "gap-2 flex flex-row",
                                    )}
                                >
                                    <Input
                                        type="number"
                                        className="rounded-md p-2 w-16"
                                        value={$hidingRadius}
                                        onChange={(e) => {
                                            hidingRadius.set(
                                                parseFloat(e.target.value),
                                            );
                                        }}
                                        disabled={$isLoading}
                                    />
                                    <UnitSelect
                                        unit={$hidingRadiusUnits}
                                        disabled={$isLoading}
                                        onChange={(unit) => {
                                            hidingRadiusUnits.set(unit);
                                        }}
                                    />
                                </div>
                            </SidebarMenuItem>
                            {$displayHidingZones && hidingZoneModeStationID && (
                                <SidebarMenuItem
                                    className={cn(
                                        MENU_ITEM_CLASSNAME,
                                        "bg-popover hover:bg-accent",
                                    )}
                                    disabled={$isLoading}
                                >
                                    Current:{" "}
                                    {(() => {
                                        const selected = stations.find(
                                            (x) =>
                                                x.properties.properties.id ===
                                                hidingZoneModeStationID,
                                        );
                                        const displayName = extractStationLabel(
                                            selected?.properties,
                                        );
                                        const id = selected?.properties
                                            .properties.id as string;
                                        const coords = selected?.properties
                                            .geometry.coordinates as [
                                            number,
                                            number,
                                        ];
                                        const href = id?.includes("/")
                                            ? `https://www.openstreetmap.org/${id}`
                                            : `https://www.openstreetmap.org/?mlat=${coords[1]}&mlon=${coords[0]}#map=17/${coords[1]}/${coords[0]}`;
                                        return (
                                            <a
                                                href={href}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-blue-500"
                                            >
                                                {displayName}
                                            </a>
                                        );
                                    })()}
                                </SidebarMenuItem>
                            )}
                            {$displayHidingZones &&
                                $disabledStations.length > 0 && (
                                    <SidebarMenuItem
                                        className="bg-popover hover:bg-accent relative flex cursor-pointer gap-2 select-none items-center rounded-sm px-2 py-2.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected='true']:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
                                        onClick={() => {
                                            disabledStations.set([]);
                                        }}
                                        disabled={$isLoading}
                                    >
                                        Clear Disabled
                                    </SidebarMenuItem>
                                )}
                            {$displayHidingZones && (
                                <SidebarMenuItem
                                    className="bg-popover hover:bg-accent relative flex cursor-pointer gap-2 select-none items-center rounded-sm px-2 py-2.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected='true']:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
                                    onClick={() => {
                                        disabledStations.set(
                                            stations.map(
                                                (x) =>
                                                    x.properties.properties.id,
                                            ),
                                        );
                                    }}
                                    disabled={$isLoading}
                                >
                                    Disable All
                                </SidebarMenuItem>
                            )}
                            {$displayHidingZones && (
                                <SidebarMenuItem
                                    className={cn(
                                        MENU_ITEM_CLASSNAME,
                                        "text-sm",
                                    )}
                                    data-testid="remaining-stations-count"
                                >
                                    {stations.length === 1
                                        ? "1 station left"
                                        : `${stations.length} stations left`}
                                </SidebarMenuItem>
                            )}
                            {$displayHidingZones && (
                                <Command
                                    key={
                                        isStationSearchActive
                                            ? "station-search-active"
                                            : "station-search-idle"
                                    }
                                    shouldFilter={isStationSearchActive}
                                >
                                    <CommandInput
                                        placeholder="Search for a hiding zone..."
                                        value={stationSearch}
                                        onValueChange={setStationSearch}
                                        disabled={$isLoading}
                                    />
                                    <CommandList className="max-h-full">
                                        <CommandEmpty>
                                            No hiding zones found.
                                        </CommandEmpty>
                                        <CommandGroup>
                                            {stations.map((station) => (
                                                <CommandItem
                                                    key={
                                                        station.properties
                                                            .properties.id
                                                    }
                                                    data-station-id={
                                                        station.properties
                                                            .properties.id
                                                    }
                                                    className={cn(
                                                        $disabledStations.includes(
                                                            station.properties
                                                                .properties.id,
                                                        ) && "line-through",
                                                    )}
                                                    onSelect={async () => {
                                                        if (!map) return;

                                                        setTimeout(() => {
                                                            if (
                                                                buttonJustClicked
                                                            ) {
                                                                buttonJustClicked =
                                                                    false;
                                                                return;
                                                            }

                                                            if (
                                                                $disabledStations.includes(
                                                                    station
                                                                        .properties
                                                                        .properties
                                                                        .id,
                                                                )
                                                            ) {
                                                                disabledStations.set(
                                                                    [
                                                                        ...$disabledStations.filter(
                                                                            (
                                                                                x,
                                                                            ) =>
                                                                                x !==
                                                                                station
                                                                                    .properties
                                                                                    .properties
                                                                                    .id,
                                                                        ),
                                                                    ],
                                                                );
                                                            } else {
                                                                disabledStations.set(
                                                                    [
                                                                        ...$disabledStations,
                                                                        station
                                                                            .properties
                                                                            .properties
                                                                            .id,
                                                                    ],
                                                                );
                                                            }

                                                            setStations([
                                                                ...stations,
                                                            ]);
                                                        }, 100);
                                                    }}
                                                    disabled={$isLoading}
                                                >
                                                    {extractStationLabel(
                                                        station.properties,
                                                    )}
                                                    <button
                                                        onClick={async () => {
                                                            if (!map) return;

                                                            buttonJustClicked =
                                                                true;

                                                            setHidingZoneModeStationID(
                                                                station
                                                                    .properties
                                                                    .properties
                                                                    .id,
                                                            );
                                                        }}
                                                        className="bg-slate-600 p-0.5 rounded-md"
                                                        disabled={$isLoading}
                                                    >
                                                        View
                                                    </button>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            )}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    );
};

/** A switch that adds or removes one kind of station from the filters. */
const StationKindSwitch = ({
    label,
    kind,
    selected,
    disabled,
}: {
    label: string;
    kind: string;
    selected: string[];
    disabled: boolean;
}) => (
    <SidebarMenuItem className={CARD_ITEM}>
        <ToggleCard
            title={label}
            checked={selected.includes(kind)}
            onCheckedChange={(on) =>
                displayHidingZonesOptions.set(
                    withStationKind(selected, kind, on),
                )
            }
            disabled={disabled}
        />
    </SidebarMenuItem>
);

/** Adds a marker for each station to what is drawn, when asked to. */
const withStationMarkers = (
    shown: FeatureCollection | Feature,
    circles: StationCircle[],
    include: boolean,
): FeatureCollection | Feature => {
    if (!include) return shown;
    return turf.featureCollection([
        ...("features" in shown ? shown.features : [shown]),
        ...circles.map((circle) => circle.properties),
    ]) as FeatureCollection;
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
            if (
                useCustomStationsAtom.get() &&
                !includeDefaultStationsAtom.get()
            ) {
                throw new NotApplicableError(
                    "'Same train line' needs stations from the map data, not a custom-only list.",
                );
            }
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

    const needsMapData =
        !useCustomStationsAtom.get() || includeDefaultStationsAtom.get();
    if (needsMapData && displayHidingZonesOptions.get().length === 0) {
        toast.error("Choose at least one kind of station for hiding zones.");
        return;
    }

    const radius = hidingRadius.get();
    const units = hidingRadiusUnits.get();

    let places = await loadStationPlaces();
    if (mergeDuplicatesAtom.get()) {
        places = await mergeDuplicateStation(places, radius, units);
    }

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

function styleStations(
    circles: StationCircle[],
    style: string,
): FeatureCollection | Feature {
    if (circles.length === 0)
        return { type: "FeatureCollection", features: [] };
    switch (style) {
        case "no-display":
            return { type: "FeatureCollection", features: [] };

        case "no-overlap":
            return safeUnion(turf.featureCollection(circles));

        case "stations":
            return turf.featureCollection(circles.map((c) => c.properties));

        default:
            return turf.featureCollection(circles);
    }
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
