import "leaflet/dist/leaflet.css";
import "leaflet-contextmenu/dist/leaflet.contextmenu.css";
import "leaflet-contextmenu";

import { useStore } from "@nanostores/react";
import * as turf from "@turf/turf";
import * as L from "leaflet";
import { useEffect, useMemo } from "react";
import {
    MapContainer,
    ScaleControl,
    TileLayer,
    ZoomControl,
} from "react-leaflet";
import { toast } from "react-toastify";

import { addNotePin } from "@/components/game/NotePins";
import { SeekerMarkers } from "@/components/game/SeekerMarkers";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMediaQuery } from "@/hooks/useMediaQuery";
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
import { gameRole, gameState, previewAnswers } from "@/lib/game/session";
import { newRadiusQuestion, tentacleKmFor } from "@/lib/gameSettings";
import { currentPosition } from "@/lib/geolocation";
import { questionsMapKey } from "@/lib/questionKey";
import { startTracking } from "@/lib/tracking";
import { cn } from "@/lib/utils";
import { startHidingZoneLayer } from "@/maps/hidingZoneLayer";

import { DraggableMarkers } from "./DraggableMarkers";
import { requestMapRefresh } from "./mapRefresh";
import { PlaceReviewMarkers } from "./PlaceReviewMarkers";
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
    // The places added to (or cut out of) the play area, by what they are:
    // the picker flips "added" on the same objects.
    const $additional = useStore(additionalMapGeoLocations);
    const additionalKey = $additional
        .map((place) => `${place.location.properties.osm_id}:${place.added}`)
        .join(",");
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
    // Phones and tablets pinch to zoom: no +/− buttons. Elsewhere they sit
    // at the bottom right with the scale, away from the sidebar button.
    const isMobile = useIsMobile();
    const touch = useMediaQuery("(pointer: coarse)");
    const showZoom = !isMobile && !touch;

    const $here = useStore(currentPosition);
    const followMeMarkerRef = useMemo(
        () => ({ current: null as L.Marker | null }),
        [],
    );

    const displayMap = useMemo(
        () => (
            <MapContainer
                center={$mapGeoLocation.geometry.coordinates}
                zoom={5}
                className={cn("w-[500px] h-[500px]", className)}
                ref={leafletMapContext.set}
                zoomControl={false}
                // The credits are in Menu → Settings → Map data instead.
                attributionControl={false}
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
                                    radius: tentacleKmFor("theme_park"),
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
                <SeekerMarkers />
                <ReferenceMarkers />
                <PlaceReviewMarkers />
                <PolygonDraw />
                {showZoom && <ZoomControl position="bottomright" />}
                <ScaleControl position="bottomright" />
            </MapContainer>
        ),
        [map, $baseTileLayer, showZoom],
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
    // The hider's answer previews shade the map before they're sent.
    const previewsKey = JSON.stringify(useStore(previewAnswers));
    useEffect(() => {
        if (!map) return;

        requestMapRefresh(true);
    }, [
        questionsKey,
        previewsKey,
        map,
        $hiderMode,
        zoneSettings,
        questionStates,
        $role,
        $mapGeoLocation,
        additionalKey,
        $polyGeoJSON,
        $endgame,
    ]);

    // The hiding zones follow the answers whichever panels are open.
    useEffect(startHidingZoneLayer, []);

    // The phone's position (lib/tracking.ts follows it) as a blue dot,
    // while Follow me is on.
    useEffect(startTracking, []);
    useEffect(() => {
        if (!map) return;
        if (!$followMe || !$here) {
            followMeMarkerRef.current?.remove();
            followMeMarkerRef.current = null;
            return;
        }
        const at: L.LatLngExpression = [$here.latitude, $here.longitude];
        if (followMeMarkerRef.current) {
            followMeMarkerRef.current.setLatLng(at);
            return;
        }
        followMeMarkerRef.current = L.marker(at, {
            icon: L.divIcon({
                html: `<div class="text-blue-700 bg-white rounded-full border-2 border-blue-700 shadow w-5 h-5 flex items-center justify-center"><svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="#2A81CB" opacity="0.5"/><circle cx="8" cy="8" r="3" fill="#2A81CB"/></svg></div>`,
                className: "follow-me-marker",
            }),
            zIndexOffset: 1000,
        }).addTo(map);
    }, [$followMe, $here, map]);
    useEffect(
        () => () => {
            followMeMarkerRef.current?.remove();
            followMeMarkerRef.current = null;
        },
        [map],
    );

    return displayMap;
};
