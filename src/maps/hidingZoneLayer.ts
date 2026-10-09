// The hiding zones on the map: the stations the answers haven't ruled out,
// each with a circle of the hiding radius around it, and the picked station
// in red. A station is in or out by its own position (the hider may be
// anywhere in its circle), so this is cheap. Runs on its own, whichever
// panels are open; the Stations tab shows the list.
import * as turf from "@turf/turf";
import type { Feature, FeatureCollection, Point } from "geojson";
import * as L from "leaflet";
import type { ReadableAtom } from "nanostores";
import { toast } from "react-toastify";

import {
    busy,
    chosenStation,
    disabledStations,
    displayHidingZones,
    displayHidingZonesOptions,
    displayHidingZonesStyle,
    hidingRadius,
    hidingRadiusUnits,
    highlightedStation,
    leafletMapContext,
    planningModeEnabled,
    questionFinishedMapData,
    questions,
    sidebarTab,
    trainStations,
} from "@/lib/context";
import { escapeHtml } from "@/lib/html";
import { createLatestRunner } from "@/lib/jobs";
import {
    findPlacesSpecificInZone,
    nearestToQuestion,
    QuestionSpecificLocation,
    type StationCircle,
    type StationPlace,
} from "@/maps/api";
import { errorMessage, NotApplicableError } from "@/maps/errors";
import {
    arcDistance,
    extractStationName,
    lngLatToText,
    safeUnion,
} from "@/maps/geo-utils";
import { loadStationPlaces } from "@/maps/hidingZoneStations";
import type {
    HomeGameMatchingQuestions,
    HomeGameMeasuringQuestions,
    Question,
} from "@/maps/schema";
import {
    applyStationNameQuestion,
    nearestStation,
    stationSignName,
} from "@/maps/stationNames";
import { sharesTrainLineWith } from "@/maps/trainLines";

/** Question types answered by the nearest place of a kind (zoo, museum…). */
const PLACE_TYPES = [
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

/** The station's map-data id ("node/123"). */
export const stationId = (station: StationCircle): string =>
    station.properties.properties.id;

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
                const id = stationId(circle);
                if (!id || !id.includes("/")) return false;
                const onLine = sharesLine(id);
                return data.same ? onLine : !onLine;
            });
        }
    }

    if (
        (question.id === "matching" || question.id === "measuring") &&
        PLACE_TYPES.includes(question.data.type)
    ) {
        // Matching: the station's nearest place is the seeker's (or isn't).
        // Measuring: the station is closer to one than the seeker (or not).
        const data = question.data as HomeGameMatchingQuestions &
            HomeGameMeasuringQuestions;
        const seekerNearest = await nearestToQuestion(data);
        const eligible = await Promise.all(
            circles.map(async (circle) => {
                const [lng, lat] = turf.getCoord(circle.properties);
                const nearest = await nearestToQuestion({ ...data, lat, lng });
                if (question.id === "matching") {
                    const same =
                        turf.getCoord(nearest).join() ===
                        turf.getCoord(seekerNearest).join();
                    return question.data.same ? same : !same;
                }
                return question.data.hiderCloser
                    ? nearest.properties.distanceToPoint <
                          seekerNearest.properties.distanceToPoint
                    : nearest.properties.distanceToPoint >
                          seekerNearest.properties.distanceToPoint;
            }),
        );
        return circles.filter((_, index) => eligible[index]);
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
        // The station's own distance decides.
        const eligible = await Promise.all(
            circles.map(async (circle) => {
                const station = turf.point(turf.getCoord(circle.properties));
                const stationDistanceKm = await arcDistance(
                    station,
                    turf.nearestPoint(station, points),
                    "kilometers",
                );
                return data.hiderCloser
                    ? stationDistanceKm < seekerDistanceKm
                    : stationDistanceKm > seekerDistanceKm;
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
    // A station is out once the answers rule out the station itself.
    let circles = places
        .filter(
            (place) =>
                !turf.booleanPointInPolygon(
                    turf.point(turf.getCoord(place)),
                    eliminatedArea,
                ),
        )
        .map(
            (place) =>
                turf.circle(turf.getCoord(place), radius, {
                    steps: 32,
                    units,
                    properties: place,
                }) as unknown as StationCircle,
        );

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
export const requestHidingZoneRefresh = () =>
    runHidingZoneRefresh().catch((error) => {
        console.error("Error in hiding zone initialization:", error);
        toast.error(`Couldn't compute hiding zones: ${errorMessage(error)}`, {
            toastId: "hiding-zone-initialization-error",
        });
    });

const ZONE_STYLE = { color: "green", fillColor: "green", fillOpacity: 0.2 };
const PICKED_STYLE = {
    color: "red",
    fillColor: "red",
    weight: 3,
    fillOpacity: 0.1,
};

const STATION_ICON = L.divIcon({
    html: `<div class="text-black bg-opacity-0"><svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 448 512" width="1em" height="1em" xmlns="http://www.w3.org/2000/svg"><path d="M96 0C43 0 0 43 0 96L0 352c0 48 35.2 87.7 81.1 94.9l-46 46C28.1 499.9 33.1 512 43 512l39.7 0c8.5 0 16.6-3.4 22.6-9.4L160 448l128 0 54.6 54.6c6 6 14.1 9.4 22.6 9.4l39.7 0c10 0 15-12.1 7.9-19.1l-46-46c46-7.1 81.1-46.9 81.1-94.9l0-256c0-53-43-96-96-96L96 0zM64 96c0-17.7 14.3-32 32-32l256 0c17.7 0 32 14.3 32 32l0 96c0 17.7-14.3 32-32 32L96 224c-17.7 0-32-14.3-32-32l0-96zM224 288a48 48 0 1 1 0 96 48 48 0 1 1 0-96z"></path></svg></div>`,
    className: "",
});

const stationMarker = (point: Feature<Point>, latlng: L.LatLng) => {
    const marker = L.marker(latlng, { icon: STATION_ICON });
    marker.bindPopup(
        `<b>${escapeHtml(extractStationName(point) || "No Name Found")} (${lngLatToText(
            point.geometry.coordinates as [number, number],
        )})</b>`,
    );
    return marker;
};

type ZoneLayer = L.Layer & { hidingZones?: boolean };

const removeZoneLayers = (map: L.Map) => {
    map.eachLayer((layer: ZoneLayer) => {
        if (layer.hidingZones) map.removeLayer(layer);
    });
};

/** Draws the zones (or just the stations) and the picked station's zone. */
const draw = () => {
    const map = leafletMapContext.get();
    if (!map) return;

    removeZoneLayers(map);
    if (!displayHidingZones.get()) return;

    const disabled = disabledStations.get();
    const active = trainStations
        .get()
        .filter((station) => !disabled.includes(stationId(station)));
    const features: Feature[] =
        displayHidingZonesStyle.get() === "zones"
            ? active
            : active.map((station) => station.properties);
    const layer: ZoneLayer = L.geoJSON(turf.featureCollection(features), {
        style: ZONE_STYLE,
        onEachFeature: (feature, featureLayer) => {
            if (feature.geometry.type === "Point") return;
            // A tap on a zone points the Stations tab at its station.
            const id = feature.properties?.properties?.id;
            if (!id) return;
            featureLayer.on("click", () => {
                highlightedStation.set(id);
                sidebarTab.set("stations");
            });
        },
        pointToLayer: stationMarker,
    });
    layer.hidingZones = true;
    layer.addTo(map);

    const picked = active.find(
        (station) => stationId(station) === chosenStation.get(),
    );
    if (picked) {
        const zone: ZoneLayer = L.geoJSON(picked as Feature, {
            style: PICKED_STYLE,
            interactive: false,
        });
        zone.hidingZones = true;
        zone.addTo(map);
    }
};

const watch = (stores: ReadableAtom<unknown>[], run: () => void) => {
    for (const store of stores) store.listen(run);
};

let started = false;

/** Starts keeping the map's hiding zones up to date (once per page). */
export const startHidingZoneLayer = () => {
    if (started) return;
    started = true;
    watch(
        [
            questionFinishedMapData,
            displayHidingZones,
            displayHidingZonesOptions,
            hidingRadius,
            hidingRadiusUnits,
        ],
        () => void requestHidingZoneRefresh(),
    );
    watch(
        [
            trainStations,
            disabledStations,
            displayHidingZones,
            displayHidingZonesStyle,
            chosenStation,
            leafletMapContext,
        ],
        draw,
    );
    draw();
    void requestHidingZoneRefresh();
};
