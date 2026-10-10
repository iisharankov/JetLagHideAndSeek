import "leaflet/dist/leaflet.css";
import "leaflet-contextmenu/dist/leaflet.contextmenu.css";
import "leaflet-contextmenu";

import { useStore } from "@nanostores/react";
import * as turf from "@turf/turf";
import * as L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, ScaleControl, TileLayer } from "react-leaflet";
import { toast } from "react-toastify";

import { addNotePin } from "@/components/game/NotePins";
import { TILES_URL } from "@/lib/config";
import {
    additionalMapGeoLocations,
    addQuestion,
    type BaseTileLayer,
    baseTileLayer,
    displayHidingZones,
    displayHidingZonesOptions,
    endgame,
    followMe,
    hiderMode,
    hidingRadius,
    hidingRadiusUnits,
    leafletMapContext,
    mapGeoLocation,
    polyGeoJSON,
    questions,
} from "@/lib/context";
import { gameRole, gameState } from "@/lib/game/session";
import { tentacleRadiusKm } from "@/lib/game/settings";
import { newRadiusQuestion } from "@/lib/gameSettings";
import {
    currentPosition,
    describeGeoError,
    watchPosition,
} from "@/lib/geolocation";
import { questionsMapKey } from "@/lib/questionKey";
import { cn } from "@/lib/utils";
import { startHidingZoneLayer } from "@/maps/hidingZoneLayer";

import { DraggableMarkers } from "./DraggableMarkers";
import { requestMapRefresh } from "./mapRefresh";
import { PMTilesLayer } from "./PMTilesLayer";
import { PolygonDraw } from "./PolygonDraw";
import { ReferenceMarkers } from "./ReferenceMarkers";

/** In a shared game the hider answers; the seekers ask. */
const hiderAsking = () => {
    if (gameState.get() && gameRole.get() === "hider") {
        toast.info("The seekers ask the questions; you answer them.", {
            toastId: "hider-asking",
        });
        return true;
    }
    return false;
};

const OSM_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const getTileLayer = (tileLayer: BaseTileLayer) => {
    switch (tileLayer) {
        case "selfhosted":
            return <PMTilesLayer url={TILES_URL} flavor="light" />;
        case "selfhosted-dark":
            return <PMTilesLayer url={TILES_URL} flavor="dark" />;
        case "osmcarto":
            return (
                <TileLayer
                    attribution={OSM_ATTRIBUTION}
                    url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                    maxZoom={19}
                    minZoom={2}
                    noWrap
                />
            );
    }

    return <PMTilesLayer url={TILES_URL} flavor="light" />;
};

export const Map = ({ className }: { className?: string }) => {
    useStore(additionalMapGeoLocations);
    const $mapGeoLocation = useStore(mapGeoLocation);
    const $questions = useStore(questions);
    const $baseTileLayer = useStore(baseTileLayer);
    const $hiderMode = useStore(hiderMode);
    const $followMe = useStore(followMe);
    const $displayHidingZones = useStore(displayHidingZones);
    const $hidingRadius = useStore(hidingRadius);
    const $hidingRadiusUnits = useStore(hidingRadiusUnits);
    const $zoneOptions = useStore(displayHidingZonesOptions);
    const map = useStore(leafletMapContext);

    const followMeMarkerRef = useMemo(
        () => ({ current: null as L.Marker | null }),
        [],
    );
    const stopWatchRef = useMemo(
        () => ({ current: null as (() => void) | null }),
        [],
    );

    const displayMap = useMemo(
        () => (
            <MapContainer
                center={$mapGeoLocation.geometry.coordinates}
                zoom={5}
                className={cn("w-[500px] h-[500px]", className)}
                ref={leafletMapContext.set}
                // @ts-expect-error Typing doesn't update from react-contextmenu
                contextmenu={true}
                contextmenuWidth={140}
                contextmenuItems={[
                    {
                        text: "Add Radius",
                        callback: (e: any) =>
                            !hiderAsking() &&
                            addQuestion(
                                newRadiusQuestion(e.latlng.lat, e.latlng.lng),
                            ),
                    },
                    {
                        text: "Add a note pin",
                        callback: (e: any) =>
                            addNotePin(e.latlng.lat, e.latlng.lng),
                    },
                    {
                        text: "Add Thermometer",
                        callback: (e: any) => {
                            if (hiderAsking()) return;
                            const destination = turf.destination(
                                [e.latlng.lng, e.latlng.lat],
                                5,
                                90,
                                {
                                    units: "miles",
                                },
                            );

                            addQuestion({
                                id: "thermometer",
                                data: {
                                    latA: e.latlng.lat,
                                    lngA: e.latlng.lng,
                                    latB: destination.geometry.coordinates[1],
                                    lngB: destination.geometry.coordinates[0],
                                },
                            });
                        },
                    },
                    {
                        text: "Add Tentacles",
                        callback: (e: any) => {
                            if (hiderAsking()) return;
                            addQuestion({
                                id: "tentacles",
                                data: {
                                    lat: e.latlng.lat,
                                    lng: e.latlng.lng,
                                    radius: tentacleRadiusKm("theme_park"),
                                    unit: "kilometers",
                                },
                            });
                        },
                    },
                    {
                        text: "Add Matching",
                        callback: (e: any) => {
                            if (hiderAsking()) return;
                            addQuestion({
                                id: "matching",
                                data: {
                                    lat: e.latlng.lat,
                                    lng: e.latlng.lng,
                                },
                            });
                        },
                    },
                    {
                        text: "Add Measuring",
                        callback: (e: any) => {
                            if (hiderAsking()) return;
                            addQuestion({
                                id: "measuring",
                                data: {
                                    lat: e.latlng.lat,
                                    lng: e.latlng.lng,
                                },
                            });
                        },
                    },
                    {
                        text: "Exclude Country",
                        callback: (e: any) => {
                            if (hiderAsking()) return;
                            addQuestion({
                                id: "matching",
                                data: {
                                    lat: e.latlng.lat,
                                    lng: e.latlng.lng,
                                    same: false,
                                    cat: {
                                        adminLevel: 2,
                                    },
                                    type: "zone",
                                },
                            });
                        },
                    },
                    {
                        text: "Copy Coordinates",
                        callback: (e: any) => {
                            if (!navigator || !navigator.clipboard) {
                                toast.error(
                                    "Clipboard API not supported in your browser",
                                );
                                return;
                            }

                            const latitude = e.latlng.lat;
                            const longitude = e.latlng.lng;

                            toast.promise(
                                navigator.clipboard.writeText(
                                    `${Math.abs(latitude)}°${latitude > 0 ? "N" : "S"}, ${Math.abs(
                                        longitude,
                                    )}°${longitude > 0 ? "E" : "W"}`,
                                ),
                                {
                                    pending: "Writing to clipboard...",
                                    success: "Coordinates copied!",
                                    error: "An error occurred while copying",
                                },
                                { autoClose: 1000 },
                            );
                        },
                    },
                ]}
            >
                {getTileLayer($baseTileLayer)}
                <DraggableMarkers />
                <ReferenceMarkers />
                <PolygonDraw />
                <ScaleControl position="bottomleft" />
            </MapContainer>
        ),
        [map, $baseTileLayer],
    );

    // Admin-border answers shade only inside hiding zones while those are
    // on, so they depend on the zone settings too.
    const zoneSettings = $questions.some(
        (q) => q.id === "measuring" && q.data.type === "admin-measure",
    )
        ? JSON.stringify([
              $displayHidingZones,
              $hidingRadius,
              $hidingRadiusUnits,
              $zoneOptions,
          ])
        : "";

    // In a shared game, a question's state (draft, asked, answered) decides
    // how it shades the map.
    const $game = useStore(gameState);
    const $role = useStore(gameRole);
    const questionStates = $game
        ? Object.values($game.questions)
              .map((entry) => `${entry.question.key}:${entry.state}`)
              .join(",")
        : "";

    const $polyGeoJSON = useStore(polyGeoJSON);
    // The end game clips the map to one station's zone.
    const $endgame = useStore(endgame);
    // What the map follows: each question's data, hidden or locked (a folded
    // card isn't its business).
    const questionsKey = questionsMapKey($questions);
    useEffect(() => {
        if (!map) return;

        requestMapRefresh(true);
    }, [
        questionsKey,
        map,
        $hiderMode,
        zoneSettings,
        questionStates,
        $role,
        $mapGeoLocation,
        $polyGeoJSON,
        $endgame,
    ]);

    // The hiding zones follow the answers whichever panels are open.
    useEffect(startHidingZoneLayer, []);

    useEffect(() => {
        if (!map) return;
        if (!$followMe) {
            if (followMeMarkerRef.current) {
                map.removeLayer(followMeMarkerRef.current);
                followMeMarkerRef.current = null;
            }
            stopWatchRef.current?.();
            stopWatchRef.current = null;
            currentPosition.set(null);
            return;
        }

        stopWatchRef.current = watchPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                currentPosition.set({
                    latitude: lat,
                    longitude: lng,
                    at: Date.now(),
                });
                if (followMeMarkerRef.current) {
                    followMeMarkerRef.current.setLatLng([lat, lng]);
                } else {
                    const marker = L.marker([lat, lng], {
                        icon: L.divIcon({
                            html: `<div class="text-blue-700 bg-white rounded-full border-2 border-blue-700 shadow w-5 h-5 flex items-center justify-center"><svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="#2A81CB" opacity="0.5"/><circle cx="8" cy="8" r="3" fill="#2A81CB"/></svg></div>`,
                            className: "",
                        }),
                        zIndexOffset: 1000,
                    });
                    marker.addTo(map);
                    followMeMarkerRef.current = marker;
                }
            },
            (error) => {
                toast.error(describeGeoError(error), { autoClose: 12000 });
                followMe.set(false);
            },
        );
        return () => {
            if (followMeMarkerRef.current) {
                map.removeLayer(followMeMarkerRef.current);
                followMeMarkerRef.current = null;
            }
            stopWatchRef.current?.();
            stopWatchRef.current = null;
        };
    }, [$followMe, map]);

    return displayMap;
};
